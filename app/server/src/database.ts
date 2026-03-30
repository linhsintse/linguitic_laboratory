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
export async function createWorksheet(name?: string) {
  try {
    return await prisma.worksheet.create({
      data: {
        name: name || null,
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
 * Updates a worksheet column's name.
 */
export async function updateWorksheetColumnName(worksheetId: number, columnIndex: number, name: string) {
  try {
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
  worksheetId: number,
  wordText: string,
  columnIndex: number,
  position: number
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
export async function getProgress() {
  try {
    const totalWords = await prisma.word.count();
    const totalLearned = await prisma.worksheetEntry.count();
    const sheetsCreated = await prisma.worksheet.count();

    return {
        totalWords,
        totalLearned,
        weeksTracked: sheetsCreated
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
        username: true,
        firstname: true,
        lastname: true
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
export async function createAccount(data: { email: string; username: string; firstname: string | null; lastname: string | null ;password?: string }) {
  try {
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        firstname: data.firstname,
        lastname: data.lastname,
        password: data.password || 'password', // Default password if not provided
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstname: true,
        lastname: true
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
export async function updateAccount(id: number, data: { email?: string; username?: string; name?: string | null; password?: string }) {
  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.email && { email: data.email }),
        ...(data.username && { username: data.username }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.password && { password: data.password }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstname: true,
        lastname: true
      }
    });
    return user;
  } catch (error) {
    console.error("Database Error updating account:", error);
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

