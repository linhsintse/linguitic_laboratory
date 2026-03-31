import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import {
  getWorksheets,
  createWorksheet,
  updateWorksheetName,
  deleteWorksheet,
  getWordsForWorksheet,
  addWordToWorksheet,
  searchWords,
  getProgress,
  getAccount,
  createAccount,
  updateAccount,
  updateWorksheetColumnName,
  getWordEtymology,
  verifyAccount,
  getStudentsByTeacher,
  assignStudentToTeacher,
  getAllTeachers
} from './database';

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

// Augment express request with user
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: string; email: string };
    }
  }
}

// Authentication middleware
export function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user as { id: number; role: string; email: string };
    next();
  });
}
app.use(cors());
app.use(express.json());

// --- Worksheet Management Endpoints ---

app.get('/api/worksheets', authenticateToken, async (req, res) => {
  try {
    if (!req.user) return res.sendStatus(401);

    // allow teacher to view student worksheets via query param
    const targetUserId = req.query.studentId ? parseInt(req.query.studentId as string) : req.user.id;

    // basic authorization: only teacher/admin can view someone else's worksheets
    if (targetUserId !== req.user.id && req.user.role === 'student') {
        return res.status(403).json({ error: "Forbidden" });
    }

    const worksheets = await getWorksheets(targetUserId);
    res.status(200).json(worksheets);
  } catch (error) {
    console.error("Failed to fetch worksheets:", error);
    res.status(500).json({ error: "Internal server error while fetching worksheets." });
  }
});

app.post('/api/worksheets', authenticateToken, async (req, res) => {
  try {
    if (!req.user) return res.sendStatus(401);
    const { name } = req.body;
    const newWorksheet = await createWorksheet(req.user.id, name);
    res.status(201).json(newWorksheet);
  } catch (error) {
    console.error("Failed to create worksheet:", error);
    res.status(500).json({ error: "Internal server error while creating worksheet." });
  }
});

app.patch('/api/worksheets/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.user) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    const { name } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: "Invalid worksheet ID." });
    const updatedWorksheet = await updateWorksheetName(req.user.id, id, name);
    res.status(200).json(updatedWorksheet);
  } catch (error) {
    console.error("Failed to update worksheet:", error);
    res.status(500).json({ error: "Internal server error while updating worksheet." });
  }
});

app.delete('/api/worksheets/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.user) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid worksheet ID." });
    await deleteWorksheet(req.user.id, id);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete worksheet:", error);
    res.status(500).json({ error: "Internal server error while deleting worksheet." });
  }
});

app.patch('/api/worksheets/:id/columns', authenticateToken, async (req, res) => {
  try {
    if (!req.user) return res.sendStatus(401);
    const worksheetId = parseInt(req.params.id);
    const { columnIndex, name } = req.body;
    if (isNaN(worksheetId)) return res.status(400).json({ error: "Invalid worksheet ID." });
    if (columnIndex === undefined || !name) return res.status(400).json({ error: "Missing columnIndex or name." });
    const updatedColumn = await updateWorksheetColumnName(req.user.id, worksheetId, columnIndex, name);
    res.status(200).json(updatedColumn);
  } catch (error) {
    console.error("Failed to update worksheet column:", error);
    res.status(500).json({ error: "Internal server error while updating worksheet column." });
  }
});

// --- Word & Entry Endpoints ---

app.get('/api/worksheets/:id/words', authenticateToken, async (req, res) => {
  try {
    if (!req.user) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid worksheet ID." });

    const targetUserId = req.query.studentId ? parseInt(req.query.studentId as string) : req.user.id;

    if (targetUserId !== req.user.id && req.user.role === 'student') {
        return res.status(403).json({ error: "Forbidden" });
    }

    const entries = await getWordsForWorksheet(targetUserId, id);
    res.status(200).json(entries);
  } catch (error) {
    console.error("Failed to fetch words:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post('/api/worksheets/:id/words', authenticateToken, async (req, res) => {
  try {
    if (!req.user) return res.sendStatus(401);
    const worksheetId = parseInt(req.params.id);
    const { wordText, columnIndex, position } = req.body;

    if (isNaN(worksheetId)) return res.status(400).json({ error: "Invalid worksheet ID." });

    const newEntry = await addWordToWorksheet(req.user.id, worksheetId, wordText, columnIndex, position);
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

app.get('/api/progress', authenticateToken, async (req, res) => {
    try {
        if (!req.user) return res.sendStatus(401);
        const targetUserId = req.query.studentId ? parseInt(req.query.studentId as string) : req.user.id;

        if (targetUserId !== req.user.id && req.user.role === 'student') {
            return res.status(403).json({ error: "Forbidden" });
        }

        const progress = await getProgress(targetUserId);
        res.status(200).json(progress);
    } catch (error) {
        console.error("Failed to fetch progress:", error);
        res.status(500).json({ error: "Internal server error while fetching progress." });
    }
});

app.get('/api/teacher/students', authenticateToken, async (req, res) => {
    try {
        if (!req.user) return res.sendStatus(401);
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Forbidden" });
        }

        const students = await getStudentsByTeacher(req.user.id);
        res.status(200).json(students);
    } catch (error) {
        console.error("Failed to fetch students:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/api/teacher/students', authenticateToken, async (req, res) => {
    try {
        if (!req.user) return res.sendStatus(401);
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Forbidden" });
        }

        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Student email is required." });
        }

        const student = await assignStudentToTeacher(req.user.id, email);
        res.status(200).json(student);
    } catch (error: any) {
        console.error("Failed to assign student:", error);
        if (error.message === "Student not found." || error.message === "User is not a student.") {
             return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: "Internal server error while assigning student." });
    }
});

app.get('/api/teachers', async (req, res) => {
    try {
        const teachers = await getAllTeachers();
        res.status(200).json(teachers);
    } catch (error) {
        console.error("Failed to fetch teachers:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, username, name, password, role } = req.body;
        if (!email || !username || !password) {
            return res.status(400).json({ error: "Email, username, and password are required." });
        }

        let firstname = null;
        let lastname = null;
        if (name) {
           const parts = name.split(' ');
           firstname = parts[0];
           lastname = parts.slice(1).join(' ') || null;
        }

        const newAccount = await createAccount({ email, username, firstname, lastname, password, role });

        const token = jwt.sign({ id: newAccount.id, role: newAccount.role, email: newAccount.email }, JWT_SECRET, { expiresIn: '1d' });

        res.status(201).json({ user: newAccount, token });
    } catch (error) {
        console.error("Failed to create account:", error);
        res.status(500).json({ error: "Internal server error while creating account." });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }

        const user = await verifyAccount(email, password);
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const expiresIn = rememberMe ? '30d' : '1d';
        const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn });

        // omit password from response
        const { password: _, ...userWithoutPassword } = user;

        res.status(200).json({ user: userWithoutPassword, token });
    } catch (error) {
        console.error("Failed to login:", error);
        res.status(500).json({ error: "Internal server error during login." });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        const account = await getAccount(req.user.id);
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

app.get('/api/account', authenticateToken, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        const account = await getAccount(req.user.id);
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

app.get('/api/etymology/:word', async (req, res) => {
  try {
    const word = req.params.word.toLowerCase();
    
    // Update default from 'English' to 'en'
    const lang = (req.query.lang as string) || 'en'; 

    const etymologyData = await getWordEtymology(word, lang);
    
    if (!etymologyData || etymologyData.length === 0) {
      return res.status(404).json({ error: "No etymology data found for this term." });
    }

    res.status(200).json(etymologyData);
  } catch (error) {
    console.error("Failed to fetch etymology:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.put('/api/account', authenticateToken, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        const account = await getAccount(req.user.id);
        if (!account) {
            return res.status(404).json({ error: "Account not found to update." });
        }

        const { email, username, name, password } = req.body;
        let firstname = account.firstname;
        let lastname = account.lastname;
        if (name !== undefined) {
             const parts = (name || '').split(' ');
             firstname = parts[0] || null;
             lastname = parts.slice(1).join(' ') || null;
        }

        const updatedAccount = await updateAccount(account.id, { email, username, firstname, lastname, password });
        res.status(200).json(updatedAccount);
    } catch (error) {
        console.error("Failed to update account:", error);
        res.status(500).json({ error: "Internal server error while updating account." });
    }
});



// --- Old routes (for backward compatibility or to be removed later) ---
// Note: Keeping them might be good if other parts of the app still use them,
// but the plan says to update/replace.

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
