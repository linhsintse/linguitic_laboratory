// Import necessary modules from Express and Prisma.
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import 'dotenv/config';

// Initialize the Express application.
const app = express();
const port = process.env.PORT || 3002;

// Initialize the Prisma Client.
// This client is used to interact with your database.
const prisma = new PrismaClient();

// --- Middleware ---
// Enable CORS (Cross-Origin Resource Sharing) for all routes.
// This allows the frontend (running on a different port) to make requests to this backend.
app.use(cors());
// Enable the Express app to parse JSON formatted request bodies.
app.use(express.json());


// --- Utility function ---
// Gets the week number for a given date.
const getWeekNumber = (d: Date): [number, number] => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  return [d.getUTCFullYear(), weekNo];
};


// --- API Routes ---

/**
 * GET /
 * Returns a welcome message.
 */
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the Vocabulary App API!' });
});

/**
 * GET /api/words
 * Fetches all vocabulary words for the current week.
 * It determines the current week number and year, then finds the corresponding
 * weekly table and returns all associated words.
 */
app.get('/api/words', async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const dateToUse = (date && typeof date === 'string') ? new Date(date) : new Date();
    const [year, weekNumber] = getWeekNumber(dateToUse);

    // Find the weekly table for the current week.
    // 'findUnique' is used here for performance, assuming week/year combination is unique.
    const weeklyTable = await prisma.weeklyTable.findUnique({
      where: { weekNumber_year: { weekNumber, year } },
      include: { words: true }, // 'include' is like a JOIN in SQL. It fetches the related VocabularyWord records.
    });

    if (weeklyTable) {
      res.json(weeklyTable.words);
    } else {
      // If no table exists for the current week, return an empty array.
      res.json([]);
    }
  } catch (error) {
    console.error('Failed to fetch words:', error);
    res.status(500).json({ error: 'Failed to fetch words' });
  }
});

/**
 * POST /api/words
 * Creates a new vocabulary word.
 * It expects a 'wordText' and 'dayOfWeek' in the request body.
 * It finds or creates a weekly table for the current week and then creates
 * the new word linked to that table.
 */
app.post('/api/words', async (req: Request, res: Response) => {
  try {
    const { wordText, dayOfWeek, date } = req.body;

    if (!wordText || !dayOfWeek) {
      return res.status(400).json({ error: 'wordText and dayOfWeek are required' });
    }
    
    const dateToUse = date ? new Date(date) : new Date();
    const [year, weekNumber] = getWeekNumber(dateToUse);

    // 'upsert' is a Prisma operation that either creates or updates a record.
    // Here, it finds the WeeklyTable for the current week or creates it if it doesn't exist.
    const weeklyTable = await prisma.weeklyTable.upsert({
        where: { weekNumber_year: { weekNumber, year } },
        update: {},
        create: { weekNumber, year },
    });

    // Create the new vocabulary word and connect it to the weekly table.
    const newWord = await prisma.vocabularyWord.create({
      data: {
        wordText,
        dayOfWeek,
        weeklyTableId: weeklyTable.id,
      },
    });

    res.status(201).json(newWord);
  } catch (error) {
    console.error('Failed to save word:', error);
    res.status(500).json({ error: 'Failed to save word' });
  }
});

/**
 * DELETE /api/words
 * Deletes all words for a specific week.
 * The week is determined by the 'date' query parameter.
 */
app.delete('/api/words', async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Date query parameter is required.' });
    }

    const [year, weekNumber] = getWeekNumber(new Date(date));

    const weeklyTable = await prisma.weeklyTable.findUnique({
      where: { weekNumber_year: { weekNumber, year } },
    });

    if (weeklyTable) {
      await prisma.vocabularyWord.deleteMany({
        where: { weeklyTableId: weeklyTable.id },
      });
    }

    res.status(204).send(); // 204 No Content
  } catch (error) {
    console.error('Failed to delete words:', error);
    res.status(500).json({ error: 'Failed to delete words' });
  }
});


// --- Server Initialization ---

// Start the Express server and listen for incoming requests on the specified port.
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
