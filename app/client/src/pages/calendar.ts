// --- Type Definitions ---
interface VocabularyWord {
  id: number;
  wordText: string;
  dayOfWeek: number;
  position: number;
}

// The base URL for the backend API.
const API_URL = 'http://localhost:3000/api';
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_MAP: { [key: string]: number } = {
    'MON': 0,
    'TUE': 1,
    'WED': 2,
    'THU': 3,
    'FRI': 4,
    'SAT': 5,
    'SUN': 6,
};

// --- State ---
let weekOffset = 0;
let wordsByDay: { [key: string]: string[] } = {};
let focusWordsByDay: { [key: string]: string } = {};

// --- Functions ---

/**
 * Get the date for Monday of a given week offset (ISO week).
 * @param offset - The week offset from the current week.
 */
function getWeekMonday(offset: number): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight to avoid time-of-day inconsistencies
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // Adjust for Sunday (0) being end of ISO week
    const monday = new Date(today.setDate(today.getDate() + diff));
    monday.setDate(monday.getDate() + offset * 7);
    return monday;
}

/**
 * Updates the week display.
 */
function updateWeekDisplay() {
    const weekDisplay = document.getElementById('week-display') as HTMLSpanElement;
    if (!weekDisplay) return;
    const monday = getWeekMonday(weekOffset);
    const weekNumber = Math.ceil(monday.getDate() / 7);
    const month = monday.toLocaleString('default', { month: 'long' });
    weekDisplay.textContent = `Week ${weekNumber} — ${month}`;
}

function enterEditMode(slot: HTMLElement) {
    const existingInput = slot.querySelector('input.word-edit-input');
    if (existingInput) return; // Already in edit mode

    const wordTextSpan = slot.querySelector('.word-text') as HTMLAnchorElement;
    const currentWord = wordTextSpan ? wordTextSpan.innerText : '';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentWord;
    input.className = 'word-edit-input font-serif text-lg block leading-none mb-1 bg-transparent border-none p-0 w-full';
    input.style.outline = 'none';

    if (wordTextSpan) {
        wordTextSpan.replaceWith(input);
    } else {
        const placeholder = slot.querySelector('.font-serif.italic');
        if(placeholder) {
            placeholder.replaceWith(input);
        }
    }
    input.focus();

    let isSaving = false;

    const save = async () => {
        if (isSaving) return;
        isSaving = true;

        const newWord = input.value.trim();
        const day = (slot as HTMLDivElement).dataset.day!;
        const index = parseInt((slot as HTMLDivElement).dataset.index!);
        
        if (!wordsByDay[day]) {
            wordsByDay[day] = [];
        }
        wordsByDay[day][index] = newWord;
        
        createAndPopulateCalendar();
        await saveCalendarData();
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            save();
            input.blur(); // Trigger blur to close, but guard handles duplicate save
        }
    });
}

/**
 * Generates the calendar grid and populates it with words.
 */
async function createAndPopulateCalendar() {
    const calendarGrid = document.getElementById('calendar-grid') as HTMLDivElement;
    if (!calendarGrid) return;

    calendarGrid.innerHTML = ''; // Clear existing calendar
    updateWeekDisplay();

    if (Object.keys(wordsByDay).length === 0) {
        const words = await fetchWords(weekOffset);
        wordsByDay = {};
        focusWordsByDay = {};

        for (const day of DAYS) {
            wordsByDay[day] = [];
        }

        words.forEach(word => {
            const dayShort = Object.keys(DAY_MAP).find(key => DAY_MAP[key] === word.dayOfWeek);
            if (dayShort && wordsByDay[dayShort]) {
                wordsByDay[dayShort][word.position] = word.wordText;
            }
        });
    }


    for (const day of DAYS) {
        const dayColumn = document.createElement('section');
        dayColumn.className = `day-column ${day === 'SUN' ? '' : 'border-r border-gray-200'}`;

        const dayDate = getWeekMonday(weekOffset);
        dayDate.setDate(dayDate.getDate() + DAYS.indexOf(day));

        dayColumn.innerHTML = `
            <div class="bg-academic-gray border-b border-gray-200 p-2 flex justify-between items-center">
                <span class="text-[11px] font-bold uppercase tracking-wider">${day}</span>
                <span class="text-[9px] text-text-muted italic">${dayDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}</span>
            </div>
            <div class="p-2 border-b border-gray-200 bg-white">
                <p class="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">FOCUS</p>
                <input class="focus-input font-serif italic text-text-muted text-sm bg-transparent border-none p-0 w-full" placeholder="e.g. ambi–" value="${focusWordsByDay[day] || ''}" data-day="${day}" />
            </div>
            <div class="word-slots-container">
                ${Array(7).fill(0).map((_, i) => {
                    const word = wordsByDay[day]?.[i] || '';
                    return `
                        <div class="word-slot p-2 h-20 flex flex-col justify-center" data-day="${day}" data-index="${i}">
                            <div class="flex items-start space-x-2">
                                <span class="text-[10px] font-bold text-text-muted mt-1">${i + 1}</span>
                                <div class="w-full">
                                    ${word ? `
                                        <a href="https://www.thewordfinder.com/define/${word.toLowerCase()}" target="_blank" class="word-text font-serif text-lg block leading-none mb-1 cursor-pointer">${word}</a>
                                        <span class="material-symbols-outlined edit-button text-[18px] text-gray-400 hover:text-black cursor-pointer select-none">edit</span>
                                    ` : `
                                        <span class="font-serif italic text-lg text-text-muted block leading-none mb-1 cursor-pointer">word...</span>
                                    `}
                                    <input class="morpheme-guide bg-transparent border-none py-1 mt-1 w-full text-xs" placeholder="prefix[root]suffix" />
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        calendarGrid.appendChild(dayColumn);
    }

    // Add event listeners for focus inputs to save state locally so it persists on re-render
    calendarGrid.querySelectorAll('.focus-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            focusWordsByDay[target.dataset.day!] = target.value;
        });
    });

     // Prevent clicks on morpheme inputs from bubbling up to the slot and triggering edit mode
     calendarGrid.querySelectorAll('.morpheme-guide').forEach(input => {
        input.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

     // Add event listeners for editing
     calendarGrid.querySelectorAll('.word-slot').forEach(slot => {
        const editButton = slot.querySelector('.edit-button');
        if (editButton) {
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();
                enterEditMode(slot as HTMLElement);
            });
        }
        
        slot.addEventListener('click', () => {
            const wordText = slot.querySelector('.word-text');
            if (!wordText) {
                enterEditMode(slot as HTMLElement);
            }
        });
    });
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
 * Saves the current calendar data to the backend.
 */
async function saveCalendarData() {
    await clearWords(weekOffset);
    const savePromises: Promise<any>[] = [];

    const monday = getWeekMonday(weekOffset);

    for (const day in wordsByDay) {
        wordsByDay[day].forEach((wordText, position) => {
            const dayOfWeek = DAY_MAP[day];

            if (wordText && dayOfWeek !== undefined) {
                savePromises.push(fetch(`${API_URL}/words`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ wordText, date: monday.toISOString(), dayOfWeek, position }),
                }).catch(error => console.error('Failed to save word:', error)));
            }
        });
    }

    await Promise.all(savePromises);
}

function addEventListeners() {
    const lastWeekButton = document.getElementById('last-week-button') as HTMLButtonElement;
    const nextWeekButton = document.getElementById('next-week-button') as HTMLButtonElement;
    const currentWeekButton = document.getElementById('current-week-button') as HTMLButtonElement;

    if(lastWeekButton) {
        lastWeekButton.addEventListener('click', () => {
            weekOffset--;
            wordsByDay = {};
            createAndPopulateCalendar();
        });
    }
    
    if(nextWeekButton) {
        nextWeekButton.addEventListener('click', () => {
            weekOffset++;
            wordsByDay = {};
            createAndPopulateCalendar();
        });
    }

    if(currentWeekButton) {
        currentWeekButton.addEventListener('click', () => {
            weekOffset = 0;
            wordsByDay = {};
            createAndPopulateCalendar();
        });
    }
}

export function renderCalendar(element: HTMLElement) {
    element.innerHTML = `
    <main class="calendar-container p-4">
        <div class="flex justify-between items-center max-w-[95%] mx-auto mb-4">
             <h2 id="week-display" class="text-lg font-bold text-gray-700 uppercase tracking-wide"></h2>
             <div class="flex space-x-2">
                <button id="last-week-button" class="px-3 py-1 text-xs font-bold uppercase tracking-wider border border-gray-300 rounded hover:bg-gray-100 text-gray-600">Prev</button>
                <button id="current-week-button" class="px-3 py-1 text-xs font-bold uppercase tracking-wider border border-gray-300 rounded hover:bg-gray-100 text-gray-600">This Week</button>
                <button id="next-week-button" class="px-3 py-1 text-xs font-bold uppercase tracking-wider border border-gray-300 rounded hover:bg-gray-100 text-gray-600">Next</button>
             </div>
        </div>
        <div class="calendar-grid grid grid-cols-7 gap-0 bg-white border border-gray-200 shadow-sm max-w-[95%] mx-auto" id="calendar-grid">
        </div>
    </main>
    `;
    createAndPopulateCalendar();
    addEventListeners();
}
