import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Fetches all worksheets ordered by creation date descending.
 */
export async function getWorksheets(userId: number) {
  try {
    return await prisma.worksheet.findMany({
      where: { 
        id: userId 
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        columns: true,
      },
    });
  } catch (error) {
    console.error("Database Error fetching worksheets:", error);
    throw error;
  }
}

/**
 * Creates a new worksheet.
 */
export async function createWorksheet(userId: number, name?: string) {
  try {
    return await prisma.worksheet.create({
      data: {
        name: name || null,
        userId: userId,
        columns: {
          create: [
            { columnIndex: 0, name: 'COL 1' },
            { columnIndex: 1, name: 'COL 2' },
            { columnIndex: 2, name: 'COL 3' },
            { columnIndex: 3, name: 'COL 4' },
            { columnIndex: 4, name: 'COL 5' },
            { columnIndex: 5, name: 'COL 6' },
            { columnIndex: 6, name: 'COL 7' },
          ],
        },
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
export async function updateWorksheetName(userId: number, id: number, name: string) {
  try {
    return await prisma.worksheet.update({
      where: { id, userId },
      data: { name },
    });
  } catch (error) {
    console.error("Database Error updating worksheet name:", error);
    throw error;
  }
}

/**
 * Updates a worksheet column's name.
 */
export async function updateWorksheetColumnName(userId: number, worksheetId: number, columnIndex: number, name: string) {
  try {
    const worksheet = await prisma.worksheet.findFirst({
        where: { id: worksheetId, userId }
    });
    if (!worksheet) {
        throw new Error("Worksheet not found or unauthorized");
    }

    return await prisma.worksheetColumn.update({
      where: {
        worksheetId_columnIndex: {
            worksheetId,
            columnIndex
        }
      },
      data: { name },
    });
  } catch (error) {
    console.error("Database Error updating worksheet column name:", error);
    throw error;
  }
}

/**
 * Deletes a worksheet.
 */
export async function deleteWorksheet(userId: number, id: number) {
  try {
    await prisma.worksheet.delete({
      where: { id, userId },
    });
  } catch (error) {
    console.error("Database Error deleting worksheet:", error);
    throw error;
  }
}

/**
 * Fetches entries and words for a specific worksheet.
 */
export async function getWordsForWorksheet(userId: number, worksheetId: number) {
  try {
    const worksheet = await prisma.worksheet.findFirst({
        where: { id: worksheetId, userId }
    });
    if (!worksheet) {
        throw new Error("Worksheet not found or unauthorized");
    }

    return await prisma.worksheetEntry.findMany({
      where: { worksheetId },
      include: {
        word: true
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
  userId: number,
  worksheetId: number,
  wordText: string,
  columnIndex: number,
  position: number
) {
  const formattedWord = wordText.trim().toLowerCase();

  try {
    const worksheet = await prisma.worksheet.findFirst({
        where: { id: worksheetId, userId }
    });
    if (!worksheet) {
        throw new Error("Worksheet not found or unauthorized");
    }

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

    return entry;
  } catch (error) {
    console.error("Database Error adding word to worksheet:", error);
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
export async function getProgress(userId: number) {
  try {
    const totalWords = await prisma.word.count();
    const totalLearned = await prisma.worksheetEntry.count({
        where: {
            worksheet: {
                userId: userId
            }
        }
    });
    const sheetsCreated = await prisma.worksheet.count({
        where: {
            userId: userId
        }
    });

    // Get all words the user has learned
    const learnedEntries = await prisma.worksheetEntry.findMany({
        where: {
            worksheet: {
                userId: userId
            }
        },
        include: {
            word: true
        }
    });

    const userWordTexts = Array.from(new Set(learnedEntries.map(e => e.word.text)));

    // Fetch etymology data for those words
    const etymologies = await prisma.kaikkiEtymology.findMany({
        where: {
            term: {
                in: userWordTexts
            }
        }
    });

    let totalPrefixes = 0;
    let totalSuffixes = 0;
    let totalRoots = 0;

    // morpheme -> count map
    const morphemeCounts: Record<string, { type: string, count: number }> = {};

    for (const ety of etymologies) {
        let type = 'root';
        if (ety.template_name === 'prefix') type = 'prefix';
        else if (ety.template_name === 'suffix') type = 'suffix';
        else if (ety.template_name === 'affix') {
             // Heuristic: if position 1, prefix. if position > 1, suffix.
             // (Simplified, but works for the UI categories)
             type = ety.position === 1 ? 'prefix' : 'suffix';
        }

        if (type === 'prefix') totalPrefixes++;
        else if (type === 'suffix') totalSuffixes++;
        else totalRoots++;

        const mKey = ety.morpheme;
        if (!morphemeCounts[mKey]) {
            morphemeCounts[mKey] = { type, count: 0 };
        }
        morphemeCounts[mKey].count++;
    }

    const sortedMorphemes = Object.keys(morphemeCounts).map(k => ({
        id: Math.random(), // arbitrary ID for frontend
        text: k,
        type: morphemeCounts[k].type,
        count: morphemeCounts[k].count
    })).sort((a, b) => b.count - a.count);

    return {
        totalWords,
        totalLearned,
        weeksTracked: sheetsCreated,
        totalMorphemes: totalPrefixes + totalSuffixes + totalRoots,
        totalPrefixes,
        totalSuffixes,
        totalRoots,
        topMorphemes: sortedMorphemes.slice(0, 5)
    };
  } catch (error) {
    console.error("Database Error fetching progress:", error);
    throw error;
  }
}

export async function getStudentsByTeacher(teacherId: number) {
  try {
    const students = await prisma.user.findMany({
      where: { teacherId },
      select: {
        id: true,
        email: true,
        username: true,
        firstname: true,
        lastname: true
      }
    });
    return students;
  } catch (error) {
    console.error("Database Error fetching students:", error);
    throw error;
  }
}

/**
 * Fetches the user account details.
 */
export async function getAccount(id: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstname: true,
        lastname: true,
        role: true,
        teacherId: true
      }
    });
    return user;
  } catch (error) {
    console.error("Database Error fetching account:", error);
    throw error;
  }
}

/**
 * Creates a new user account.
 */
export async function createAccount(data: { email: string; username: string; firstname: string | null; lastname: string | null ;password?: string, role?: string, teacherId?: number | null }) {
  try {
    const hashedPassword = await bcrypt.hash(data.password || 'password', 10);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        firstname: data.firstname,
        lastname: data.lastname,
        password: hashedPassword,
        role: data.role || 'student',
        teacherId: data.teacherId
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstname: true,
        lastname: true,
        role: true,
        teacherId: true
      }
    });
    return user;
  } catch (error) {
    console.error("Database Error creating account:", error);
    throw error;
  }
}

/**
 * Updates an existing user account.
 */
export async function updateAccount(id: number, data: { email?: string; username?: string; firstname?: string | null; lastname?: string | null; password?: string, role?: string, teacherId?: number | null }) {
  try {
    let hashedPassword = undefined;
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 10);
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.email && { email: data.email }),
        ...(data.username && { username: data.username }),
        ...(data.firstname !== undefined && { firstname: data.firstname }),
        ...(data.lastname !== undefined && { lastname: data.lastname }),
        ...(hashedPassword && { password: hashedPassword }),
        ...(data.role && { role: data.role }),
        ...(data.teacherId !== undefined && { teacherId: data.teacherId }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstname: true,
        lastname: true,
        role: true,
        teacherId: true
      }
    });
    return user;
  } catch (error) {
    console.error("Database Error updating account:", error);
    throw error;
  }
}

export async function verifyAccount(email: string, passwordPlain: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });
    if (!user) return null;
    const match = await bcrypt.compare(passwordPlain, user.password);
    if (!match) return null;
    return user;
  } catch (error) {
    console.error("Database error verifying account", error);
    throw error;
  }
}

export async function getWordEtymology(term: string, lang: string = 'en') {
  try {
    return await prisma.kaikkiEtymology.findMany({
      where: {
        term: term,
        lang: lang 
      },
      orderBy: {
        position: 'asc' // Maintains the correct un- + believe + -able order
      }
    });
  } catch (error) {
    console.error("Database Error fetching etymology:", error);
    throw error;
  }
}
