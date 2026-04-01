import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Fetches all worksheets ordered by creation date descending.
 */
export async function getWorksheets(userId: number) {
  try {
    return await prisma.worksheet.findMany({
      where: { userId },
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

export async function getAllTeachers() {
  try {
    const teachers = await prisma.user.findMany({
      where: { role: 'teacher' },
      select: {
        id: true,
        email: true,
        username: true,
        firstname: true,
        lastname: true
      }
    });
    return teachers;
  } catch (error) {
    console.error("Database Error fetching teachers:", error);
    throw error;
  }
}

export async function assignStudentToTeacher(teacherId: number, studentEmail: string) {
  try {
    const student = await prisma.user.findUnique({
      where: { email: studentEmail },
    });
    if (!student) {
      throw new Error("Student not found.");
    }
    if (student.role !== 'student') {
      throw new Error("User is not a student.");
    }
    const updatedStudent = await prisma.user.update({
      where: { id: student.id },
      data: { teacherId },
      select: {
        id: true,
        email: true,
        username: true,
        firstname: true,
        lastname: true,
      }
    });
    return updatedStudent;
  } catch (error) {
    console.error("Database Error assigning student:", error);
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
            { columnIndex: 0, morpheme: 'focus..', type: 'root' },
            { columnIndex: 1, morpheme: 'focus..', type: 'root' },
            { columnIndex: 2, morpheme: 'focus..', type: 'root' },
            { columnIndex: 3, morpheme: 'focus..', type: 'root' },
            { columnIndex: 4, morpheme: 'focus..', type: 'root' },
            { columnIndex: 5, morpheme: 'focus..', type: 'root' },
            { columnIndex: 6, morpheme: 'focus..', type: 'root' },
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
    
    return await prisma.worksheet.findUnique({
      where: { id: id }
    });
  } catch (error) {
    console.error("Database Error updating worksheet name:", error);
    throw error;
  }
}

/**
 * Updates a worksheet column's name.
 */
export async function updateWorksheetColumnMorpheme(userId: number, worksheetId: number, columnIndex: number, morpheme: string, type: string) {
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
      data: { morpheme, type },
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

      // Fetch all worksheets, their columns (containing the target morphemes), and entries
      const worksheets = await prisma.worksheet.findMany({
          where: {
              userId: userId
          },
          include: {
              columns: true,
              entries: true
          }
      });

      let totalPrefixes = 0;
      let totalSuffixes = 0;
      let totalRoots = 0;

      // morpheme -> count map
      const morphemeCounts: Record<string, { type: string, count: number }> = {};

      for (const sheet of worksheets) {
          // Map columnIndex to the morpheme string for this specific worksheet
          const columnMorphemeMap = new Map<number, { text: string, type: string }>();
          for (const col of sheet.columns) {
              if (col.morpheme && col.morpheme.trim() !== '') {
                  columnMorphemeMap.set(col.columnIndex, {
                      text: col.morpheme.trim().toLowerCase(),
                      type: col.type || 'root'
                  });
              }
          }

          // Tally the entries based on their assigned column
          for (const entry of sheet.entries) {
              const mData = columnMorphemeMap.get(entry.columnIndex);
              
              if (mData) {
                  const mText = mData.text;
                  const mType = mData.type;

                  if (!morphemeCounts[mText]) {
                      morphemeCounts[mText] = { type: mType, count: 0 };
                  } else if (morphemeCounts[mText].type !== mType) {
                      // Update type if it changed to keep latest state
                      morphemeCounts[mText].type = mType;
                  }
                  
                  morphemeCounts[mText].count++;

                  // Update global counters
                  if (mType === 'prefix') totalPrefixes++;
                  else if (mType === 'suffix') totalSuffixes++;
                  else totalRoots++;
              }
          }
      }

      const sortedMorphemes = Object.keys(morphemeCounts).map(k => ({
          id: Math.random(), // arbitrary ID for frontend (see note below)
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

export async function verifyAccount(identifier: string, passwordPlain: string) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier }
        ]
      }
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
