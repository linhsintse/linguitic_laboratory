import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  getWorksheets,
  createWorksheet,
  updateWorksheetName,
  deleteWorksheet,
  getWordsForWorksheet,
  addWordToWorksheet,
  getAllMorphemes,
  searchWords,
  getProgress,
  getAccount,
  createAccount,
  updateAccount,
  getWordsForMorpheme
} from './database';

const app = express();
app.use(cors());
app.use(express.json());

// --- Worksheet Management Endpoints ---

app.get('/api/worksheets', async (req, res) => {
  try {
    const worksheets = await getWorksheets();
    res.status(200).json(worksheets);
  } catch (error) {
    console.error("Failed to fetch worksheets:", error);
    res.status(500).json({ error: "Internal server error while fetching worksheets." });
  }
});

app.post('/api/worksheets', async (req, res) => {
  try {
    const { name } = req.body;
    const newWorksheet = await createWorksheet(name);
    res.status(201).json(newWorksheet);
  } catch (error) {
    console.error("Failed to create worksheet:", error);
    res.status(500).json({ error: "Internal server error while creating worksheet." });
  }
});

app.patch('/api/worksheets/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: "Invalid worksheet ID." });
    const updatedWorksheet = await updateWorksheetName(id, name);
    res.status(200).json(updatedWorksheet);
  } catch (error) {
    console.error("Failed to update worksheet:", error);
    res.status(500).json({ error: "Internal server error while updating worksheet." });
  }
});

app.delete('/api/worksheets/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid worksheet ID." });
    await deleteWorksheet(id);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete worksheet:", error);
    res.status(500).json({ error: "Internal server error while deleting worksheet." });
  }
});

// --- Word & Entry Endpoints ---

app.get('/api/worksheets/:id/words', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid worksheet ID." });

    const entries = await getWordsForWorksheet(id);

    // Reconstruct morphemeString for frontend
    const mappedEntries = entries.map(entry => {
      let morphemeString = '';
      let morphemes: any[] = [];
      if (entry.word && entry.word.morphemes && entry.word.morphemes.length > 0) {
          morphemes = entry.word.morphemes.map(wm => wm.morpheme);
          const prefixes = entry.word.morphemes.filter(wm => wm.morpheme.type === 'prefix').map(wm => wm.morpheme.displaytext);
          const roots = entry.word.morphemes.filter(wm => wm.morpheme.type === 'root').map(wm => `[${wm.morpheme.text}]`);
          const suffixes = entry.word.morphemes.filter(wm => wm.morpheme.type === 'suffix').map(wm => wm.morpheme.displaytext);

          let str = "";
          for (let p of prefixes) { str += p; }
          for (let r of roots) { str += r; }
          for (let s of suffixes) {
             if (!str.endsWith("-") && str !== "" && !s.startsWith("-")) str += "-";
             str += s;
          }
          morphemeString = str;
      }

      return {
        ...entry,
        morphemes,
        morphemeString
      };
    });

    res.status(200).json(mappedEntries);
  } catch (error) {
    console.error("Failed to fetch words:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post('/api/worksheets/:id/words', async (req, res) => {
  try {
    const worksheetId = parseInt(req.params.id);
    const { wordText, columnIndex, position, morphemeString, morphemes } = req.body;

    if (isNaN(worksheetId)) return res.status(400).json({ error: "Invalid worksheet ID." });

    const newEntry = await addWordToWorksheet(worksheetId, wordText, columnIndex, position, morphemeString, morphemes);
    res.status(201).json(newEntry);
  } catch (error) {
    console.error("Failed to add word:", error);
    res.status(500).json({ error: "Internal server error while saving the word." });
  }
});

// --- Other Endpoints ---

app.get('/api/words/search', async (req, res) => {
    try {
        const query = req.query.q as string;
        if (!query) {
            return res.status(400).json({ error: "Missing 'q' query parameter." });
        }
        const words = await searchWords(query);
        res.status(200).json(words);
    } catch (error) {
        console.error("Failed to search words:", error);
        res.status(500).json({ error: "Internal server error while searching words." });
    }
});

app.get('/api/progress', async (req, res) => {
    try {
        const progress = await getProgress();
        res.status(200).json(progress);
    } catch (error) {
        console.error("Failed to fetch progress:", error);
        res.status(500).json({ error: "Internal server error while fetching progress." });
    }
});

app.get('/api/account', async (req, res) => {
    try {
        const account = await getAccount();
        if (account) {
            res.status(200).json(account);
        } else {
            res.status(404).json({ error: "Account not found." });
        }
    } catch (error) {
        console.error("Failed to fetch account:", error);
        res.status(500).json({ error: "Internal server error while fetching account." });
    }
});

app.post('/api/account', async (req, res) => {
    try {
        const { email, username, name, password } = req.body;
        if (!email || !username || !password) {
            return res.status(400).json({ error: "Email, username, and password are required." });
        }
        const newAccount = await createAccount({ email, username, name, password });
        res.status(201).json(newAccount);
    } catch (error) {
        console.error("Failed to create account:", error);
        res.status(500).json({ error: "Internal server error while creating account." });
    }
});

app.put('/api/account', async (req, res) => {
    try {
        // For simple single-user simulation, we first fetch the account to get its ID.
        // In a real app, this would be based on an auth token or session.
        const account = await getAccount();
        if (!account) {
            return res.status(404).json({ error: "Account not found to update." });
        }

        const { email, username, name, password } = req.body;
        const updatedAccount = await updateAccount(account.id, { email, username, name, password });
        res.status(200).json(updatedAccount);
    } catch (error) {
        console.error("Failed to update account:", error);
        res.status(500).json({ error: "Internal server error while updating account." });
    }
});

app.get('/api/morphemes', async (req, res) => {
    try {
        const morphemes = await getAllMorphemes();
        res.status(200).json(morphemes);
    } catch (error) {
        console.error("Failed to fetch morphemes:", error);
        res.status(500).json({ error: "Internal server error while fetching morphemes." });
    }
});

app.get('/api/morphemes/:id/words', async (req, res) => {
    try {
        const morphemeId = parseInt(req.params.id);
        if (isNaN(morphemeId)) {
            return res.status(400).json({ error: "Invalid morpheme ID." });
        }
        const words = await getWordsForMorpheme(morphemeId);
        res.status(200).json(words);
    } catch (error) {
        console.error("Failed to fetch words for morpheme:", error);
        res.status(500).json({ error: "Internal server error while fetching words for morpheme." });
    }
});

// --- Old routes (for backward compatibility or to be removed later) ---
// Note: Keeping them might be good if other parts of the app still use them,
// but the plan says to update/replace.

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
