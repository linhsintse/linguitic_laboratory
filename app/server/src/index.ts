import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { addWordToWeek, getWordsForWeek, deleteWordsForWeek } from './database'; // Import the logic

const app = express();
app.use(cors());
app.use(express.json());

// The POST route to handle user input
app.post('/api/words', async (req, res) => {
  try {
    const { wordText, date, dayOfWeek, position } = req.body;

    // Call the isolated database logic
    const newEntry = await addWordToWeek(wordText, date, dayOfWeek, position);

    // Send the successful response back to the frontend
    res.status(201).json(newEntry);

  } catch (error) {
    console.error("Failed to add word:", error);
    res.status(500).json({ error: "Internal server error while saving the word." });
  }
});

// The GET route to fetch words for a week
app.get('/api/words', async (req, res) => {
  try {
    const dateParam = req.query.date as string;

    // 1. Check if the parameter exists
    if (!dateParam) {
      return res.status(400).json({ error: "Missing 'date' query parameter." });
    }

    // 2. Check if the parameter is a valid date
    const parsedDate = new Date(dateParam);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format provided." });
    }

    // 3. Only call the database if validation passes
    const entries = await getWordsForWeek(dateParam);
    res.status(200).json(entries);

  } catch (error) {
    console.error("Failed to fetch words:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// The DELETE route to clear words for a week
app.delete('/api/words', async (req, res) => {
    try {
        const dateParam = req.query.date as string;

        if (!dateParam) {
            return res.status(400).json({ error: "Missing 'date' query parameter." });
        }

        const parsedDate = new Date(dateParam);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: "Invalid date format provided." });
        }
        await deleteWordsForWeek(dateParam);
        res.status(204).send();
    } catch (error) {
        console.error("Failed to delete words:", error);
        res.status(500).json({ error: "Internal server error while deleting words." });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});