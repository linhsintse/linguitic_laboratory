import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  // Locate and parse the JSON file
  const filePath = path.join(__dirname, 'morphemes.json');
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const morphemes = JSON.parse(rawData);

  console.log(`Starting insertion of ${morphemes.length} morphemes...`);

  // Iterate through the array and upsert each record
  for (const item of morphemes) {
    await prisma.morpheme.upsert({
      where: {
        text_meaning: {
          text: item.text,
          meaning: item.meaning,
        },
      },
      update: {}, // If it exists, do nothing
      create: {
        type: item.type,
        text: item.text,
        displaytext: item.displaytext || item.text,
        meaning: item.meaning,
        frequency: item.frequency,
        origin: item.origin,
        category: item.category,
      },
    });
  }

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });