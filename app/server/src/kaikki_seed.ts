import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const prisma = new PrismaClient();

// 2000 is the sweet spot for SQLite batch inserts without hitting variable limits
const BATCH_SIZE = 2000; 

async function main() {
  const jsonlFilePath = path.join(__dirname, '../prisma/kaikki.jsonl');
  
  if (!fs.existsSync(jsonlFilePath)) {
    console.error(`Critical Error: Kaikki JSONL file not found at ${jsonlFilePath}`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(jsonlFilePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let batch: any[] = [];
  let totalProcessed = 0;

  console.log("Starting Kaikki JSONL streaming ingestion...");

  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      
      // Skip entries without etymological data
      if (!entry.etymology_templates || !Array.isArray(entry.etymology_templates)) {
        continue;
      }

      const term = entry.word;
      const lang = entry.lang_code;
      const pos = entry.pos || null;

      entry.etymology_templates.forEach((tmpl: any) => {
        const template_name = tmpl.name;
        const args = tmpl.args || {};
        
        // In Wiktionary Lua, arg "1" is almost always the language code of the morphemes
        const morphemeLang = args["1"] || lang;

        // Iterate through the arguments object
        for (const key in args) {
          // We only want sequential numeric arguments (2, 3, 4...). 
          // This filters out named metadata args like 'alt=', 'tr=' (transliteration), or 'sc=' (script)
          if (key !== "1" && !isNaN(Number(key)) && args[key].trim() !== "") {
            batch.push({
              term: term,
              lang: lang,
              pos: pos,
              template_name: template_name,
              morpheme: args[key],
              morpheme_lang: morphemeLang,
              position: Number(key) // Keeps 'un-' before 'believe'
            });
          }
        }
      });

      // Execute batch insert when threshold is reached
      if (batch.length >= BATCH_SIZE) {
        await prisma.kaikkiEtymology.createMany({ data: batch });
        totalProcessed += batch.length;
        
        if (totalProcessed % 50000 === 0) {
            console.log(`Ingested ${totalProcessed} morphological components...`);
        }
        batch = []; // Reset batch
      }
    } catch (error) {
      // Catch JSON parse errors on malformed lines to prevent the stream from dying
      console.warn("Skipped malformed line.");
    }
  }

  // Flush any remaining records in the final incomplete batch
  if (batch.length > 0) {
    await prisma.kaikkiEtymology.createMany({ data: batch });
    totalProcessed += batch.length;
  }

  console.log(`Ingestion complete! Total morphological components successfully written: ${totalProcessed}`);
}

main()
  .catch((e) => {
    console.error("Fatal exception during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });