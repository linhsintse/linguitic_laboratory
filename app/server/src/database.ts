import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Gets the ISO week number and year for a given date.
 * @param date - The date to get the week info for.
 */
function getWeekInfoFromDate(date: Date): { weekNumber: number; year: number } {
  const sunday = new Date(date.valueOf());
  sunday.setDate(sunday.getDate() - sunday.getDay());
  const thursday = new Date(sunday.valueOf());
  thursday.setDate(sunday.getDate() + 4);
  const year = thursday.getFullYear();
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { weekNumber, year };
}

/**
 * Inserts a word into a specific day and week.
 * It intelligently prevents duplicating the core Word or WeeklyTable.
 */
export async function addWordToWeek(
  wordText: string,
  date: string,
  dayOfWeek: number,
  position: number,
  morphemeString: string = ""
) {
  const { weekNumber, year } = getWeekInfoFromDate(new Date(date));
  // Objective validation before hitting the DB
  if (dayOfWeek < 0 || dayOfWeek > 6) throw new Error("dayOfWeek must be between 0 and 6");
  
  const formattedWord = wordText.trim().toLowerCase();

  try {
    const entry = await prisma.weeklyEntry.create({
      data: {
        dayOfWeek,
        position,
        // 1. Handle the Word: Link it if it exists, create it if it doesn't.
        word: {
          connectOrCreate: {
            where: { text: formattedWord },
            create: { text: formattedWord },
          },
        },
        // 2. Handle the Week: Link it if it exists, create it if it doesn't.
        weeklyTable: {
          connectOrCreate: {
            where: {
              weekNumber_year: {
                weekNumber,
                year,
              },
            },
            create: {
              weekNumber,
              year,
            },
          },
        },
      },
      // Include the relations in the return object so you can verify the IDs
      include: {
        word: true,
        weeklyTable: true,
      },
    });

    // Handle Morphemes if provided
    if (morphemeString.trim()) {
      await processAndSaveMorphemes(formattedWord, morphemeString.trim());
    }

    return entry;
  } catch (error) {
    console.error("Database Error inserting weekly word:", error);
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
 * Parses user input like "pre[dict]ion" and saves the morphemes.
 * Any morpheme prior to a - is a prefix, any after a - is a suffix, anything inside of [] are roots
 * Oh wait, the prompt says "any morpheme prior to a - is a prefix, any after a - is a suffix"
 * E.g. "pre-[dict]-ion" or "prefix[root]suffix" -> wait.
 * "prefix[root]suffix input box don't save to the database... any morpheme prior to a - is a prefix, any after a - is a suffix, anything inside of [] are roots"
 * Let's interpret: "pre-[dict]-ion"
 */
async function processAndSaveMorphemes(wordText: string, morphemeString: string) {
  let remaining = morphemeString;

  // Extract root first (inside [])
  let root = '';
  const rootMatch = remaining.match(/\[(.*?)\]/);
  if (rootMatch) {
    root = rootMatch[1];
    // remove the root and its brackets
    remaining = remaining.replace(rootMatch[0], '');
  }

  // Find prefix (ends with -) and suffix (starts with -)
  // But wait, the prompt literally says:
  // "any morpheme prior to a - is a prefix, any after a - is a suffix"
  // So if user types "pre-[dict]-ion"
  // remaining would be "pre--ion"

  // Actually, a simpler approach:
  // 1. Root is inside [ ]
  // 2. Prefix is before -
  // 3. Suffix is after -
  // But if the user types "un-[able]" or "[dict]-ion"

  // Let's do a generic parse. The prompt says: "prefix[root]suffix" as the example!
  // Then says "any morpheme prior to a - is a prefix, any after a - is a suffix, anything inside of [] are roots"
  // If the user inputs "pre-[dict]-ion", the prefix is "pre", root is "dict", suffix is "ion".

  let prefix = '';
  let suffix = '';

  // Find prefix: anything before a '-'
  // Wait, if it's "pre-[dict]-ion", prefix is "pre".
  const prefixMatch = morphemeString.match(/^(.*?)-/);
  if (prefixMatch) {
     prefix = prefixMatch[1].trim();
  }

  // Find suffix: anything after a '-' (the last '-' if there are multiple)
  const suffixMatch = morphemeString.match(/-(.*?)$/);
  if (suffixMatch) {
     suffix = suffixMatch[1].trim();
  }

  // Handle cases without hyphens but with brackets like "pre[dict]ion"
  // The prompt says "any morpheme prior to a - is a prefix...". This implies the user MUST use hyphens.
  // BUT the example placeholder says "prefix[root]suffix" which lacks hyphens!
  // Let's support both. If they use "prefix[root]suffix":
  if (!prefix && !suffix && rootMatch) {
     const splitByRoot = morphemeString.split(rootMatch[0]);
     if (splitByRoot.length === 2) {
       prefix = splitByRoot[0].trim();
       suffix = splitByRoot[1].trim();
       // remove any trailing/leading hyphens just in case
       prefix = prefix.replace(/-$/, '');
       suffix = suffix.replace(/^-/, '');
     }
  } else {
     // Clean up
     prefix = prefix.replace(/\[.*\]/, '').trim();
     suffix = suffix.replace(/\[.*\]/, '').trim();
  }

  // Try to find the exact morpheme or create a default one
  if (prefix) await linkMorpheme(wordText, `${prefix}-`, 'prefix');
  if (root) await linkMorpheme(wordText, root, 'root');
  if (suffix) await linkMorpheme(wordText, `-${suffix}`, 'suffix');
}

async function linkMorpheme(wordText: string, text: string, type: 'prefix' | 'root' | 'suffix') {
  const formattedText = text.trim().toLowerCase();

  // Try to find an existing morpheme with this text
  let morpheme = await prisma.morpheme.findFirst({
    where: { text: formattedText }
  });

  if (!morpheme) {
    // We don't have the meaning, but unique constraint requires meaning.
    // Fallback meaning is required.
    morpheme = await prisma.morpheme.create({
      data: {
        text: formattedText,
        meaning: 'User defined meaning',
        type: type
      }
    });
  }

  // Link word and morpheme
  const word = await prisma.word.findUnique({ where: { text: wordText } });
  if (word && morpheme) {
      await prisma.wordMorpheme.upsert({
        where: {
          wordId_morphemeId: {
            wordId: word.id,
            morphemeId: morpheme.id
          }
        },
        update: {},
        create: {
          wordId: word.id,
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
    const totalLearned = await prisma.weeklyEntry.count(); // Approximate 'learned' by entries
    const weeksTracked = await prisma.weeklyTable.count();

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
        weeksTracked,
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

interface WeeklyEntryWithWord {
    id: number;
    word: {
        text: string;
    };
    dayOfWeek: number;
    position: number | null;
}

/**
 * Fetches all words for a given week and year.
 * @param date - The date to get the week info for.
 */
export async function getWordsForWeek(date: string) {
  const { weekNumber, year } = getWeekInfoFromDate(new Date(date));

  // Failsafe: Prevent invalid data from hitting Prisma
  if (isNaN(weekNumber) || isNaN(year)) {
    throw new Error("Invalid weekNumber or year calculated.");
  }

  try {
    const entries = await prisma.weeklyEntry.findMany({
      where: {
        weeklyTable: {
          weekNumber: weekNumber,
          year: year,
        },
      },
      include: {
        word: {
          include: {
            morphemes: {
              include: {
                morpheme: true
              }
            }
          }
        },
      },
      orderBy: {
        dayOfWeek: 'asc',
      }
    });
    return entries;
  } catch (error) {
    console.error("Database Error fetching weekly words:", error);
    throw error;
  }
}
/**
 * Deletes all words for a given week and year.
 * @param date - The date to get the week info for.
 */
export async function deleteWordsForWeek(date: string) {
    const { weekNumber, year } = getWeekInfoFromDate(new Date(date));

    try {
        const weeklyTable = await prisma.weeklyTable.findUnique({
            where: {
                weekNumber_year: {
                    weekNumber,
                    year,
                },
            },
        });

        if (weeklyTable) {
            await prisma.weeklyEntry.deleteMany({
                where: {
                    weeklyTableId: weeklyTable.id,
                },
            });
        }
    } catch (error) {
        console.error("Database Error deleting weekly words:", error);
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
