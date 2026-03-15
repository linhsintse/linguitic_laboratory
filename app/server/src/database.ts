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
  position: number
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

    return entry;
  } catch (error) {
    console.error("Database Error inserting weekly word:", error);
    throw error;
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
    const totalMorphemes = await prisma.morpheme.count();
    return { totalWords, totalMorphemes };
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
        word: true, // Pulls the actual text of the word
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
