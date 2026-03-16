import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fetches all worksheets ordered by creation date descending.
 */
export async function getWorksheets() {
  try {
    return await prisma.worksheet.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  } catch (error) {
    console.error("Database Error fetching worksheets:", error);
    throw error;
  }
}

/**
 * Performs a best-effort auto-parsing of a word against the Morpheme table.
 */
export async function autoParseWord(inputWord: string) {
  const normalizedWord = inputWord.trim().toLowerCase();
  if (!normalizedWord) return [];

  try {
    const allMorphemes = await prisma.morpheme.findMany();

    const matchedMorphemes = allMorphemes.filter(m => {
      const cleanText = m.text.toLowerCase();
      if (m.type === 'prefix') {
        return normalizedWord.startsWith(cleanText);
      } else if (m.type === 'suffix') {
        return normalizedWord.endsWith(cleanText);
      } else if (m.type === 'root') {
        return normalizedWord.includes(cleanText);
      }
      return false;
    });

    // Sort by length descending (longest matches first)
    return matchedMorphemes.sort((a, b) => b.text.length - a.text.length);
  } catch (error) {
    console.error("Database Error auto-parsing word:", error);
    throw error;
  }
}

/**
 * Creates a new worksheet.
 */
export async function createWorksheet(name?: string) {
  try {
    return await prisma.worksheet.create({
      data: {
        name: name || null,
      },
    });
  } catch (error) {
    console.error("Database Error creating worksheet:", error);
    throw error;
  }
}

/**
 * Updates a worksheet's name.
 */
export async function updateWorksheetName(id: number, name: string) {
  try {
    return await prisma.worksheet.update({
      where: { id },
      data: { name },
    });
  } catch (error) {
    console.error("Database Error updating worksheet name:", error);
    throw error;
  }
}

/**
 * Deletes a worksheet.
 */
export async function deleteWorksheet(id: number) {
  try {
    await prisma.worksheet.delete({
      where: { id },
    });
  } catch (error) {
    console.error("Database Error deleting worksheet:", error);
    throw error;
  }
}

/**
 * Fetches entries and words for a specific worksheet.
 */
export async function getWordsForWorksheet(worksheetId: number) {
  try {
    return await prisma.worksheetEntry.findMany({
      where: { worksheetId },
      include: {
        word: {
          include: {
            morphemes: {
              include: {
                morpheme: true
              }
            }
          }
        }
      },
      orderBy: [
        { columnIndex: 'asc' },
        { position: 'asc' }
      ]
    });
  } catch (error) {
    console.error("Database Error fetching worksheet words:", error);
    throw error;
  }
}

/**
 * Adds or updates a word in a specific worksheet and column.
 */
export async function addWordToWorksheet(
  worksheetId: number,
  wordText: string,
  columnIndex: number,
  position: number,
  morphemeString: string = ""
) {
  const formattedWord = wordText.trim().toLowerCase();

  try {
    // Delete existing entry at this position in this worksheet if it exists
    await prisma.worksheetEntry.deleteMany({
      where: {
        worksheetId,
        columnIndex,
        position
      }
    });

    if (!formattedWord) return null;

    const entry = await prisma.worksheetEntry.create({
      data: {
        columnIndex,
        position,
        word: {
          connectOrCreate: {
            where: { text: formattedWord },
            create: { text: formattedWord },
          },
        },
        worksheet: {
          connect: { id: worksheetId }
        }
      },
      include: {
        word: true,
        worksheet: true
      }
    });

    if (morphemeString.trim()) {
      await processAndSaveMorphemes(formattedWord, morphemeString.trim());
    }

    return entry;
  } catch (error) {
    console.error("Database Error adding word to worksheet:", error);
    throw error;
  }
}

/**
 * Fetches words that are linked to a specific morpheme.
 */
export async function getWordsForMorpheme(morphemeId: number) {
  try {
    const wordMorphemes = await prisma.wordMorpheme.findMany({
      where: {
        morphemeId: morphemeId
      },
      include: {
        word: true
      }
    });
    return wordMorphemes.map(wm => wm.word);
  } catch (error) {
    console.error("Database Error fetching words for morpheme:", error);
    throw error;
  }
}

/**
 * Parses user input like "pre[dict]ion" or "pre-[dict]-ion" and saves the morphemes.
 * Only links existing morphemes from the database.
 */
async function processAndSaveMorphemes(wordText: string, morphemeString: string) {
  let root = '';
  const rootMatch = morphemeString.match(/\[(.*?)\]/);
  if (rootMatch) {
    root = rootMatch[1].trim();
  }

  let prefix = '';
  const prefixMatch = morphemeString.match(/^(.*?)-/);
  if (prefixMatch) {
    prefix = prefixMatch[1].trim();
  }

  let suffix = '';
  const suffixMatch = morphemeString.match(/-([^-]*?)$/);
  if (suffixMatch) {
    suffix = suffixMatch[1].trim();
  }

  // Support "prefix[root]suffix" format
  if (!prefix && !suffix && rootMatch) {
    const parts = morphemeString.split(/\[.*?\]/);
    if (parts.length >= 1) prefix = parts[0].trim();
    if (parts.length >= 2) suffix = parts[1].trim();
  }

  // Clean up
  prefix = prefix.replace(/[\[\]\-]/g, '').trim();
  suffix = suffix.replace(/[\[\]\-]/g, '').trim();
  root = root.replace(/[\[\]\-]/g, '').trim();

  const word = await prisma.word.findUnique({ where: { text: wordText } });
  if (!word) return;

  // Clear existing morpheme links for this word before re-linking
  await prisma.wordMorpheme.deleteMany({
    where: { wordId: word.id }
  });

  if (prefix) await linkMorpheme(word.id, prefix, 'prefix');
  if (root) await linkMorpheme(word.id, root, 'root');
  if (suffix) await linkMorpheme(word.id, suffix, 'suffix');
}

/**
 * Links an existing morpheme to a word. Does NOT create new morphemes.
 */
async function linkMorpheme(wordId: number, text: string, type: string) {
  const formattedText = text.toLowerCase();

  const morpheme = await prisma.morpheme.findFirst({
    where: {
      text: formattedText,
      type: type
    }
  });

  if (morpheme) {
    await prisma.wordMorpheme.upsert({
      where: {
        wordId_morphemeId: {
          wordId: wordId,
          morphemeId: morpheme.id
        }
      },
      update: {},
      create: {
        wordId: wordId,
        morphemeId: morpheme.id
      }
    });
  }
}

/**
 * Searches words containing the query string.
 */
export async function searchWords(query: string) {
  try {
    const words = await prisma.word.findMany({
      where: {
        text: {
          contains: query,
        },
      },
      orderBy: {
        text: 'asc',
      },
    });
    return words;
  } catch (error) {
    console.error("Database Error searching words:", error);
    throw error;
  }
}

/**
 * Fetches the vocabulary progress (word and morpheme counts).
 */
export async function getProgress() {
  try {
    const totalWords = await prisma.word.count();
    const totalLearned = await prisma.worksheetEntry.count();
    const sheetsCreated = await prisma.worksheet.count();

    // Grouping morphemes by type that users have ACTUALLY linked to words
    const userMorphemes = await prisma.wordMorpheme.findMany({
      include: {
        morpheme: true
      }
    });

    let totalPrefixes = 0;
    let totalSuffixes = 0;
    let totalRoots = 0;

    // To track unique morphemes identified by user
    const uniqueUserMorphemes = new Set();
    const morphemeUsageCount: Record<string, {id: number, text: string, type: string, count: number}> = {};

    for (const wm of userMorphemes) {
       const m = wm.morpheme;
       uniqueUserMorphemes.add(m.id);

       if (!morphemeUsageCount[m.text]) {
          morphemeUsageCount[m.text] = { id: m.id, text: m.text, type: m.type, count: 0 };
       }
       morphemeUsageCount[m.text].count += 1;
    }

    // Now count types among the unique morphemes identified
    const uniqueMorphemeObjects = await prisma.morpheme.findMany({
        where: {
            id: { in: Array.from(uniqueUserMorphemes) as number[] }
        }
    });

    for (const m of uniqueMorphemeObjects) {
        if (m.type === 'prefix') totalPrefixes++;
        else if (m.type === 'suffix') totalSuffixes++;
        else if (m.type === 'root') totalRoots++;
    }

    const topMorphemes = Object.values(morphemeUsageCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    return {
        totalWords,
        totalLearned,
        weeksTracked: sheetsCreated,
        totalMorphemes: uniqueUserMorphemes.size,
        totalPrefixes,
        totalSuffixes,
        totalRoots,
        topMorphemes
    };
  } catch (error) {
    console.error("Database Error fetching progress:", error);
    throw error;
  }
}

/**
 * Fetches the user account details.
 */
export async function getAccount() {
  try {
    const user = await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        name: true,
      }
    });
    return user;
  } catch (error) {
    console.error("Database Error fetching account:", error);
    throw error;
  }
}

/**
 * Fetches all morphemes from the database.
 */
export async function getAllMorphemes() {
  try {
    const morphemes = await prisma.morpheme.findMany({
      orderBy: {
        text: 'asc',
      },
    });
    return morphemes;
  } catch (error) {
    console.error("Database Error fetching morphemes:", error);
    throw error;
  }
}

/**
 * Links a Morpheme to a specific Word.
 */
export async function addMorphemeToWord(
  wordText: string,
  morphemeText: string,
  morphemeType: 'prefix' | 'root' | 'suffix',
  meaning: string
) {
  const formattedWord = wordText.trim().toLowerCase();
  const formattedMorpheme = morphemeText.trim().toLowerCase();
  const formattedMeaning = meaning.trim();

  try {
    const wordMorphemeLink = await prisma.wordMorpheme.create({
      data: {
        word: {
          connectOrCreate: {
            where: { text: formattedWord },
            create: { text: formattedWord },
          },
        },
        morpheme: {
          connectOrCreate: {
            where: {
              text_meaning: {
                text: formattedMorpheme,
                meaning: formattedMeaning,
              }
            },
            create: { 
              text: formattedMorpheme,
              displaytext: formattedMorpheme,
              meaning: formattedMeaning,
              type: morphemeType
            },
          },
        },
      },
    });

    return wordMorphemeLink;
  } catch (error) {
    console.error("Database Error linking morpheme:", error);
    throw error;
  }
}
