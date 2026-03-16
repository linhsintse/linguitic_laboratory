// --- Type Definitions ---
interface Worksheet {
  id: number;
  name: string | null;
  createdAt: string;
}

interface Morpheme {
    id: number;
    text: string;
    displaytext: string;
    type: string;
    meaning: string;
}

interface WorksheetEntry {
  id: number;
  wordId: number;
  worksheetId: number;
  columnIndex: number;
  position: number;
  word: {
    id: number;
    text: string;
  };
  morphemes?: Morpheme[];
  morphemeString?: string;
}

// The base URL for the backend API.
const API_URL = 'http://localhost:3000/api';
const COLUMN_HEADERS = ['COL 1', 'COL 2', 'COL 3', 'COL 4', 'COL 5', 'COL 6', 'COL 7'];

// --- State ---
let worksheets: Worksheet[] = [];
let currentWorksheetId: number | null = null;
let wordsByColumn: { [key: number]: string[] } = {};
let morphemesByColumn: { [key: number]: Morpheme[][] } = {};
let worksheetName: string = '';

// --- Functions ---

async function fetchWorksheets() {
    try {
        const response = await fetch(`${API_URL}/worksheets`);
        if (!response.ok) throw new Error('Failed to fetch worksheets');
        worksheets = await response.json();
        if (worksheets.length > 0 && currentWorksheetId === null) {
            currentWorksheetId = worksheets[0].id;
            worksheetName = worksheets[0].name || '';
        }
    } catch (error) {
        console.error('Error fetching worksheets:', error);
    }
}

async function createNewSheet() {
    try {
        const response = await fetch(`${API_URL}/worksheets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'New Worksheet' })
        });
        if (!response.ok) throw new Error('Failed to create worksheet');
        const newSheet = await response.json();
        currentWorksheetId = newSheet.id;
        worksheetName = newSheet.name || '';
        wordsByColumn = {};
        morphemesByColumn = {};
        await fetchWorksheets();
        await createAndPopulateWorksheet();
    } catch (error) {
        console.error('Error creating worksheet:', error);
    }
}

async function renameCurrentSheet(name: string) {
    if (currentWorksheetId === null) return;
    try {
        const response = await fetch(`${API_URL}/worksheets/${currentWorksheetId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!response.ok) throw new Error('Failed to rename worksheet');
        worksheetName = name;
        await fetchWorksheets();
        updateWorksheetDisplay();
    } catch (error) {
        console.error('Error renaming worksheet:', error);
    }
}

function updateWorksheetDisplay() {
    const sheetNameInput = document.getElementById('sheet-name-input') as HTMLInputElement;
    if (sheetNameInput) {
        sheetNameInput.value = worksheetName;
    }

    const sheetSelect = document.getElementById('sheet-select') as HTMLSelectElement;
    if (sheetSelect) {
        sheetSelect.innerHTML = worksheets.map(ws => `
            <option value="${ws.id}" ${ws.id === currentWorksheetId ? 'selected' : ''}>
                ${ws.name || 'Unnamed'} (${new Date(ws.createdAt).toLocaleDateString()})
            </option>
        `).join('');
    }
}

function enterEditMode(slot: HTMLElement) {
    const existingInput = slot.querySelector('input.word-edit-input');
    if (existingInput) return; // Already in edit mode

    const wordTextSpan = slot.querySelector('.word-text') as HTMLAnchorElement;
    const currentWord = wordTextSpan ? wordTextSpan.innerText : '';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'word-input';
    input.value = currentWord;
    input.className = 'word-edit-input font-serif text-lg block leading-none mb-1 bg-white border border-gray-300 p-1 w-full rounded focus:ring-1 focus:ring-academic-blue focus:border-academic-blue';
    input.style.outline = 'none';

    const tagContainer = document.createElement('div');
    tagContainer.id = 'tag-container';
    tagContainer.className = 'flex flex-wrap gap-1 mt-1 mb-2';

    if (wordTextSpan) {
        wordTextSpan.replaceWith(input);
        input.after(tagContainer);
    } else {
        const placeholder = slot.querySelector('.font-serif.italic');
        if(placeholder) {
            placeholder.replaceWith(input);
            input.after(tagContainer);
        }
    }

    // Hide the non-edit tags
    const nonEditTagsContainer = slot.querySelector('.morpheme-tags-container');
    if (nonEditTagsContainer) {
        (nonEditTagsContainer as HTMLElement).style.display = 'none';
    }

    // Pre-populate global state if we already have morphemes for this slot
    const colIndex = parseInt(slot.dataset.colIndex!);
    const pos = parseInt(slot.dataset.position!);
    if (morphemesByColumn[colIndex] && morphemesByColumn[colIndex][pos]) {
        (window as any).selectedMorphemes = [...morphemesByColumn[colIndex][pos]];
    } else {
        (window as any).selectedMorphemes = [];
    }

    input.focus();
    if ((window as any).initAutoParser) {
        (window as any).initAutoParser();
    }

    let isSaving = false;

    const save = async () => {
        if (isSaving) return;
        isSaving = true;

        const newWord = input.value.trim();
        const columnIndex = parseInt((slot as HTMLDivElement).dataset.colIndex!);
        const position = parseInt((slot as HTMLDivElement).dataset.position!);

        // Get tags from the global selectedMorphemes if the initAutoParser script ran.
        // Wait, the main.ts currently handles updating it. Let's just pass an empty string
        // or a reconstructed string.
        // We will fetch selectedMorphemes from window if needed.
        let newMorphemeString = '';
        if ((window as any).selectedMorphemes) {
            const selected = (window as any).selectedMorphemes as Morpheme[];
            const prefixes = selected.filter(m => m.type === 'prefix').map(m => m.text);
            const roots = selected.filter(m => m.type === 'root').map(m => `[${m.text}]`);
            const suffixes = selected.filter(m => m.type === 'suffix').map(m => m.text);

            let str = "";
            for (let p of prefixes) { str += p; }
            for (let r of roots) { str += r; }
            for (let s of suffixes) {
                if (!str.endsWith("-") && str !== "" && !s.startsWith("-")) str += "-";
                str += s;
            }
            newMorphemeString = str;
        }

        if (!wordsByColumn[columnIndex]) {
            wordsByColumn[columnIndex] = [];
        }
        wordsByColumn[columnIndex][position] = newWord;

        if (!morphemesByColumn[columnIndex]) {
            morphemesByColumn[columnIndex] = [];
        }
        morphemesByColumn[columnIndex][position] = (window as any).selectedMorphemes || [];

        await saveWordData(columnIndex, position, newWord, newMorphemeString);
        await createAndPopulateWorksheet();
    };

    // We don't save on word input blur anymore to allow interacting with suggested tags.
    // Save happens on Enter or when blurring the morpheme guide.
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            save();
        }
    });

    // If the user clicks outside the slot, we might want to save.
    // But since the add tag button is also in the slot, we can just save when blurring the input
    // ONLY if the related target is not inside the slot.
    input.addEventListener('blur', (e) => {
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (!slot.contains(relatedTarget)) {
            // Wait a small bit in case the blur was to the tag delete button or add button
            setTimeout(() => {
                if (!slot.contains(document.activeElement)) {
                    save();
                }
            }, 100);
        }
    });
}

/**
 * Generates the worksheet grid and populates it with words.
 */
export async function createAndPopulateWorksheet() {
    const worksheetGrid = document.getElementById('worksheet-grid') as HTMLDivElement;
    if (!worksheetGrid) return;

    if (worksheets.length === 0) {
        await fetchWorksheets();
    }

    if (currentWorksheetId === null && worksheets.length > 0) {
        currentWorksheetId = worksheets[0].id;
        worksheetName = worksheets[0].name || '';
    }

    updateWorksheetDisplay();

    if (currentWorksheetId !== null) {
        const entries = await fetchWords(currentWorksheetId);
        wordsByColumn = {};
        morphemesByColumn = {};

        for (let i = 0; i < 7; i++) {
            wordsByColumn[i] = [];
            morphemesByColumn[i] = [];
        }

        entries.forEach(entry => {
            if (wordsByColumn[entry.columnIndex]) {
                wordsByColumn[entry.columnIndex][entry.position] = entry.word.text;
                if (entry.morphemes) {
                   morphemesByColumn[entry.columnIndex][entry.position] = entry.morphemes;
                }
            }
        });
    }

    worksheetGrid.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const dayColumn = document.createElement('section');
        dayColumn.className = `day-column ${i === 6 ? '' : 'border-r border-gray-200'}`;

        dayColumn.innerHTML = `
            <div class="bg-academic-gray border-b border-gray-200 p-2 flex justify-between items-center">
                <span class="text-[11px] font-bold uppercase tracking-wider">${COLUMN_HEADERS[i]}</span>
            </div>
            <div class="word-slots-container">
                ${Array(7).fill(0).map((_, j) => {
                    const word = wordsByColumn[i]?.[j] || '';
                    const morphemes = morphemesByColumn[i]?.[j] || [];

                    const morphemeTagsHTML = morphemes.map(m =>
                        `<span class="inline-flex items-center bg-blue-100 text-blue-800 text-[10px] font-medium mr-1 px-1.5 py-0.5 rounded-full">${m.displaytext}</span>`
                    ).join('');

                    return `
                        <div class="word-slot p-2 h-20 flex flex-col justify-center border-b border-gray-100" data-col-index="${i}" data-position="${j}">
                            <div class="flex items-start space-x-2">
                                <span class="text-[10px] font-bold text-text-muted mt-1">${j + 1}</span>
                                <div class="w-full">
                                    ${word ? `
                                        <div class="flex justify-between items-start">
                                            <a href="https://www.thewordfinder.com/define/${word.toLowerCase()}" target="_blank" class="word-text font-serif text-lg block leading-none mb-1 cursor-pointer hover:underline">${word}</a>
                                            <span class="material-symbols-outlined edit-button text-[18px] text-gray-400 hover:text-black cursor-pointer select-none">edit</span>
                                        </div>
                                    ` : `
                                        <span class="font-serif italic text-lg text-text-muted block leading-none mb-1 cursor-pointer">word...</span>
                                    `}
                                    <div class="morpheme-tags-container flex flex-wrap gap-1 mt-1">
                                        ${morphemeTagsHTML}
                                        ${word ? `<button class="add-morpheme-btn inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 focus:outline-none" title="Add Morpheme">+</button>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        worksheetGrid.appendChild(dayColumn);
    }

     // Add event listeners for editing
     worksheetGrid.querySelectorAll('.word-slot').forEach(slot => {
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

        // Handle Add Morpheme Button click
        const addMorphemeBtn = slot.querySelector('.add-morpheme-btn');
        if (addMorphemeBtn) {
            addMorphemeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                enterEditMode(slot as HTMLElement);
                // Also trigger focusing the input and maybe show a prompt or just let them edit
            });
        }
    });
}

/**
 * Fetches the list of words from the backend API for a specific worksheet.
 */
async function fetchWords(worksheetId: number): Promise<WorksheetEntry[]> {
  try {
    const response = await fetch(`${API_URL}/worksheets/${worksheetId}/words`);
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
 * Saves a word to the backend.
 */
async function saveWordData(columnIndex: number, position: number, wordText: string, morphemeString: string) {
    if (currentWorksheetId === null) return;
    try {
        await fetch(`${API_URL}/worksheets/${currentWorksheetId}/words`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wordText, columnIndex, position, morphemeString }),
        });
    } catch (error) {
        console.error('Failed to save word:', error);
    }
}

function addEventListeners() {
    const newSheetButton = document.getElementById('new-sheet-button') as HTMLButtonElement;
    const prevSheetButton = document.getElementById('prev-sheet-button') as HTMLButtonElement;
    const nextSheetButton = document.getElementById('next-sheet-button') as HTMLButtonElement;
    const sheetSelect = document.getElementById('sheet-select') as HTMLSelectElement;
    const sheetNameInput = document.getElementById('sheet-name-input') as HTMLInputElement;

    if(newSheetButton) {
        newSheetButton.addEventListener('click', () => {
            createNewSheet();
        });
    }

    if(prevSheetButton) {
        prevSheetButton.addEventListener('click', () => {
            if (currentWorksheetId !== null && worksheets.length > 1) {
                const currentIndex = worksheets.findIndex(ws => ws.id === currentWorksheetId);
                if (currentIndex > 0) {
                    const prevIndex = currentIndex - 1;
                    currentWorksheetId = worksheets[prevIndex].id;
                    worksheetName = worksheets[prevIndex].name || '';
                    wordsByColumn = {};
                    createAndPopulateWorksheet();
                }
            }
        });
    }

    if(nextSheetButton) {
        nextSheetButton.addEventListener('click', () => {
            if (currentWorksheetId !== null && worksheets.length > 1) {
                const currentIndex = worksheets.findIndex(ws => ws.id === currentWorksheetId);
                if (currentIndex < worksheets.length - 1) {
                    const nextIndex = currentIndex + 1;
                    currentWorksheetId = worksheets[nextIndex].id;
                    worksheetName = worksheets[nextIndex].name || '';
                    wordsByColumn = {};
                    createAndPopulateWorksheet();
                }
            }
        });
    }

    if(sheetSelect) {
        sheetSelect.addEventListener('change', () => {
            currentWorksheetId = parseInt(sheetSelect.value);
            const ws = worksheets.find(w => w.id === currentWorksheetId);
            worksheetName = ws ? (ws.name || '') : '';
            wordsByColumn = {};
            createAndPopulateWorksheet();
        });
    }

    if(sheetNameInput) {
        sheetNameInput.addEventListener('blur', () => {
            renameCurrentSheet(sheetNameInput.value);
        });
        sheetNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                renameCurrentSheet(sheetNameInput.value);
                sheetNameInput.blur();
            }
        });
    }
}

export function renderWorksheet(element: HTMLElement) {
    element.innerHTML = `
    <main class="worksheet-container p-4">
        <div class="flex justify-between items-center max-w-[95%] mx-auto mb-4 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
             <div class="flex items-center space-x-4">
                <input id="sheet-name-input" class="text-xl font-bold text-gray-800 border-b-2 border-transparent hover:border-gray-200 focus:border-academic-blue focus:outline-none bg-transparent py-1" placeholder="Sheet Name..." />
             </div>
             <div class="flex items-center space-x-2">
                <select id="sheet-select" class="text-sm border-gray-300 rounded-md focus:ring-academic-blue focus:border-academic-blue bg-gray-50 py-1 pl-2 pr-8 mr-2">
                </select>
                <button id="prev-sheet-button" class="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-gray-300 rounded-md hover:bg-gray-100 text-gray-600 transition-colors">Previous Sheet</button>
                <button id="next-sheet-button" class="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-gray-300 rounded-md hover:bg-gray-100 text-gray-600 transition-colors">Next Sheet</button>
                <button id="new-sheet-button" class="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-black text-white rounded-md hover:bg-gray-800 transition-colors">New Sheet</button>
             </div>
        </div>
        <div class="worksheet-grid grid grid-cols-7 gap-0 bg-white border border-gray-200 shadow-lg max-w-[95%] mx-auto rounded-lg overflow-hidden" id="worksheet-grid">
        </div>
    </main>
    `;
    createAndPopulateWorksheet();
    addEventListeners();
}
