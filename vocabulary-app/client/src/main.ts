// Import the CSS file to ensure Tailwind's styles are applied.
import './style.css';

// --- Type Definitions ---
interface VocabularyWord {
  id: number;
  wordText: string;
  dayOfWeek: string;
}

// --- DOM Element References ---
const tableBody = document.getElementById('words-table-body') as HTMLTableSectionElement;
const saveButton = document.getElementById('save-progress-button') as HTMLButtonElement;
const startFreshButton = document.getElementById('start-fresh-button') as HTMLButtonElement;
const lastWeekButton = document.getElementById('last-week-button') as HTMLButtonElement;
const nextWeekButton = document.getElementById('next-week-button') as HTMLButtonElement;
const weekDisplay = document.getElementById('week-display') as HTMLSpanElement;

// The base URL for the backend API.
const API_URL = 'http://localhost:3002/api';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// --- State ---
let weekOffset = 0;
const isEditing: { [key: string]: boolean } = {};
for (const day of DAYS) {
    isEditing[day] = true; // Start in editing mode by default
}

// --- Functions ---

/**
 * Get the date for Monday of a given week offset.
 * @param offset - The week offset from the current week.
 */
function getWeekMonday(offset: number): Date {
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday - 0, Monday - 1, ...
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today.setDate(today.getDate() + distanceToMonday));
    monday.setDate(monday.getDate() + offset * 7);
    return monday;
}

/**
 * Updates the week display.
 */
function updateWeekDisplay() {
    const monday = getWeekMonday(weekOffset);
    const weekNumber = Math.ceil((monday.getDate() + monday.getDay() + 1) / 7);
    const month = monday.toLocaleString('default', { month: 'long' });
    weekDisplay.textContent = `Week ${weekNumber} — ${month}`;
}

/**
 * Checks if input boxes already have words.
 * If a day has words, it switches off edit mode so they appear as links.
 * @param wordsByDay - The dictionary of words grouped by day.
 */
function checkExistingWords(wordsByDay: { [key: string]: string[] }) {
    for (const day of DAYS) {
        isEditing[day] = wordsByDay[day].length === 0;
    }
}

/**
 * Generates the table grid and populates it with words.
 * @param shouldCheckExistingWords - If true, automatically switches filled columns to view mode.
 */
async function createAndPopulateTable(shouldCheckExistingWords: boolean = false) {
    tableBody.innerHTML = ''; // Clear existing table
    updateWeekDisplay();
    const words = await fetchWords(weekOffset);
    const wordsByDay: { [key: string]: string[] } = {};

    for (const day of DAYS) {
        wordsByDay[day] = [];
    }

    words.forEach(word => {
        if (wordsByDay[word.dayOfWeek]) {
            wordsByDay[word.dayOfWeek].push(word.wordText);
        }
    });

    if (shouldCheckExistingWords) {
        checkExistingWords(wordsByDay);
    }

    const maxWords = 10;
    for (let i = 0; i < maxWords; i++) {
        const row = tableBody.insertRow();
        for (const day of DAYS) {
            const cell = row.insertCell();
            cell.className = 'p-0';
            const word = wordsByDay[day][i] || '';
            
            if (isEditing[day] || !word) {
                cell.innerHTML = `
                    <div class="m-[1px]">
                        <input 
                            class="table-input w-full h-14 px-4 bg-white border border-slate-200 rounded-sm focus:ring-0 text-ink text-base font-body" 
                            placeholder="..." 
                            type="text"
                            value="${word}"
                            data-day="${day}"
                        />
                    </div>
                `;
            } else {
                cell.innerHTML = `
                    <div class="m-[1px]">
                        <a href="https://www.thewordfinder.com/define/${word.toLowerCase()}" target="_blank" class="table-input w-full h-14 px-4 flex items-center bg-slate-50 border border-slate-200 rounded-sm text-ink text-base font-body hover:bg-slate-100">
                            ${word}
                        </a>
                    </div>
                `;
            }
        }
    }
    
    // Add event listeners to edit buttons
    for (const day of DAYS) {
        const editButton = document.getElementById(`edit-${day.substring(0,3)}-button`);
        if(editButton) {
            editButton.addEventListener('click', () => handleEditDay(day));
        }
    }
}

/**
 * Fetches the list of words from the backend API for a specific week.
 * @param offset - The week offset from the current week.
 */
async function fetchWords(offset: number): Promise<VocabularyWord[]> {
  try {
    const monday = getWeekMonday(offset);
    const response = await fetch(`${API_URL}/words?date=${monday.toISOString()}`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch words:', error);
    return [];
  }
}

/**
 * Clears all words for the current week from the database.
 * @param offset - The week offset from the current week.
 */
async function clearWords(offset: number) {
    try {
        const monday = getWeekMonday(offset);
        const response = await fetch(`${API_URL}/words?date=${monday.toISOString()}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('Failed to clear words:', error);
    }
}

/**
 * Handles saving the progress.
 */
async function handleSaveProgress() {
    await clearWords(weekOffset);
    const inputs = Array.from(tableBody.querySelectorAll('input[type="text"]'));
    const savePromises = inputs.map(input => {
        const htmlInputElement = input as HTMLInputElement;
        const wordText = htmlInputElement.value.trim();
        const dayOfWeek = htmlInputElement.dataset.day;

        if (wordText && dayOfWeek) {
            return fetch(`${API_URL}/words`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wordText, dayOfWeek, date: getWeekMonday(weekOffset).toISOString() }),
            }).catch(error => console.error('Failed to save word:', error));
        }
        return Promise.resolve();
    });

    await Promise.all(savePromises);

    alert('Progress saved!');
    await createAndPopulateTable(true);
}

/**
 * Handles starting fresh for the current week.
 */
async function handleStartFresh() {
    if (confirm('Are you sure you want to clear all words for this week? This action cannot be undone.')) {
        await clearWords(weekOffset);
        await createAndPopulateTable(true);
    }
}

/**
 * Handles toggling edit mode for a day.
 * @param day - The day to toggle edit mode for.
 */
function handleEditDay(day: string) {
    isEditing[day] = true;
    createAndPopulateTable();
}

// --- Event Listeners ---
saveButton.addEventListener('click', handleSaveProgress);
startFreshButton.addEventListener('click', handleStartFresh);

lastWeekButton.addEventListener('click', () => {
    weekOffset--;
    createAndPopulateTable(true);
});

nextWeekButton.addEventListener('click', () => {
    weekOffset++;
    createAndPopulateTable(true);
});

window.addEventListener('DOMContentLoaded', () => {
  createAndPopulateTable(true);
});
