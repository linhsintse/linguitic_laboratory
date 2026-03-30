// --- Type Definitions ---
interface Worksheet {
  id: number;
  name: string | null;
  createdAt: string;
  columns: WorksheetColumn[];
}

interface WorksheetColumn {
  id: number;
  worksheetId: number;
  columnIndex: number;
  name: string;
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
}

import { authService } from '../auth';

// The base URL for the backend API.
const API_URL = 'http://localhost:3000/api';

// --- State ---
let worksheets: Worksheet[] = [];
let currentWorksheetId: number | null = null;
let currentStudentId: number | null = null;
let wordsByColumn: { [key: number]: string[] } = {};
let worksheetName: string = '';

// --- Functions ---

function updateSlotUI(slot: HTMLElement, _colIndex: number, _position: number, word: string) {
    const wFullDiv = slot.querySelector('.w-full');
    if (!wFullDiv) return;

    wFullDiv.innerHTML = `
        ${word ? `
            <div class="flex justify-between items-start w-full relative group">
                <div class="flex-1">
                    <a href="https://www.thewordfinder.com/define/${word.toLowerCase()}" target="_blank" class="word-text font-serif text-lg block leading-none mb-1 cursor-pointer hover:underline">${word}</a>
                </div>
                <div class="hidden group-hover:flex items-center gap-1 shrink-0 absolute right-0 top-0 bg-white">
                    <span class="material-symbols-outlined edit-button text-[18px] text-gray-400 hover:text-black cursor-pointer select-none" title="Edit word">edit</span>
                </div>
            </div>
        ` : `
            <span class="font-serif italic text-lg text-text-muted block leading-none mb-1 cursor-pointer">word...</span>
        `}
    `;

    // Reattach listeners to new elements
    const editButton = slot.querySelector('.edit-button');
    if (editButton) {
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            enterEditMode(slot);
        });
    }
}

async function fetchWorksheets() {
    try {
        const query = currentStudentId ? `?studentId=${currentStudentId}` : '';
        const response = await fetch(`${API_URL}/worksheets${query}`, {
            headers: authService.getHeaders()
        });
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
            headers: {
                ...authService.getHeaders()
            },
            body: JSON.stringify({ name: 'New Worksheet' })
        });
        if (!response.ok) throw new Error('Failed to create worksheet');
        const newSheet = await response.json();
        currentWorksheetId = newSheet.id;
        worksheetName = newSheet.name || '';
        wordsByColumn = {};
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
            headers: {
                ...authService.getHeaders()
            },
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

async function renameColumn(worksheetId: number, columnIndex: number, name: string) {
    try {
        await fetch(`${API_URL}/worksheets/${worksheetId}/columns`, {
            method: 'PATCH',
            headers: {
                ...authService.getHeaders()
            },
            body: JSON.stringify({ columnIndex, name })
        });
    } catch (error) {
        console.error('Error renaming column:', error);
    }
}

async function deleteCurrentSheet() {
    if (currentWorksheetId === null) return;
    
    if (!confirm('Are you sure you want to delete this worksheet? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/worksheets/${currentWorksheetId}`, {
            method: 'DELETE',
            headers: authService.getHeaders()
        });
        if (!response.ok) throw new Error('Failed to delete worksheet');
        
        await fetchWorksheets();
        
        if (worksheets.length > 0) {
            currentWorksheetId = worksheets[0].id;
            worksheetName = worksheets[0].name || '';
        } else {
            currentWorksheetId = null;
            worksheetName = '';
        }
        wordsByColumn = {};
        await createAndPopulateWorksheet();
    } catch (error) {
        console.error('Error deleting worksheet:', error);
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
    input.className = 'word-edit-input font-serif text-lg block leading-none mb-1 bg-white border border-gray-300 p-1 w-full rounded focus:ring-1 focus:ring-academic-blue focus:border-academic-blue relative z-10';
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
        const columnIndex = parseInt((slot as HTMLDivElement).dataset.colIndex!);
        const position = parseInt((slot as HTMLDivElement).dataset.position!);

        if (!wordsByColumn[columnIndex]) {
            wordsByColumn[columnIndex] = [];
        }
        wordsByColumn[columnIndex][position] = newWord;

        await saveWordData(columnIndex, position, newWord);
        updateSlotUI(slot, columnIndex, position, newWord);

        // We only move focus to the next slot if the save was triggered by enter, not blur
        return true;
    };

    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const saved = await save();
            if (saved) {
                // Focus the next slot based on current position
                const columnIndex = parseInt((slot as HTMLDivElement).dataset.colIndex!);
                const position = parseInt((slot as HTMLDivElement).dataset.position!);
                const nextPosition = position + 1;

                if (nextPosition < 7) {
                    const grid = document.getElementById('worksheet-grid');
                    const nextSlot = grid?.querySelector(`.word-slot[data-col-index="${columnIndex}"][data-position="${nextPosition}"]`) as HTMLElement;
                    if (nextSlot) {
                        enterEditMode(nextSlot);
                    }
                } else if (columnIndex < 6) {
                    // move to next column first slot
                    const nextCol = columnIndex + 1;
                    const grid = document.getElementById('worksheet-grid');
                    const nextSlot = grid?.querySelector(`.word-slot[data-col-index="${nextCol}"][data-position="0"]`) as HTMLElement;
                    if (nextSlot) {
                        enterEditMode(nextSlot);
                    }
                }
            }
        }
    });

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

        for (let i = 0; i < 7; i++) {
            wordsByColumn[i] = [];
        }

        entries.forEach(entry => {
            if (wordsByColumn[entry.columnIndex]) {
                wordsByColumn[entry.columnIndex][entry.position] = entry.word.text;
            }
        });
    }

    worksheetGrid.innerHTML = '';

    const currentWorksheet = worksheets.find(w => w.id === currentWorksheetId);
    const columns = currentWorksheet?.columns.sort((a, b) => a.columnIndex - b.columnIndex) || [];

    for (let i = 0; i < 7; i++) {
        const column = columns[i];
        const dayColumn = document.createElement('section');
        dayColumn.className = `day-column ${i === 6 ? '' : 'border-r border-gray-200'}`;

        dayColumn.innerHTML = `
            <div class="bg-academic-gray border-b border-gray-200 p-2 flex justify-between items-center">
                <input class="column-name-input text-[11px] font-bold uppercase tracking-wider bg-transparent focus:outline-none w-full" 
                       value="${column ? column.name : ''}" 
                       data-column-index="${i}" />
            </div>
            <div class="word-slots-container">
                ${Array(7).fill(0).map((_, j) => {
                    const word = wordsByColumn[i]?.[j] || '';

                    return `
                        <div class="word-slot p-2 min-h-[5rem] h-auto flex flex-col justify-center border-b border-gray-100 transition-all duration-200" data-col-index="${i}" data-position="${j}">
                            <div class="flex items-start space-x-2">
                                <span class="text-[10px] font-bold text-text-muted mt-1">${j + 1}</span>
                                <div class="w-full">
                                    ${word ? `
                                        <div class="flex justify-between items-start w-full relative group">
                                            <div class="flex-1">
                                                <a href="https://www.thewordfinder.com/define/${word.toLowerCase()}" target="_blank" class="word-text font-serif text-lg block leading-none mb-1 cursor-pointer hover:underline">${word}</a>
                                            </div>
                                            <div class="hidden group-hover:flex items-center gap-1 shrink-0 absolute right-0 top-0 bg-white">
                                                <span class="material-symbols-outlined edit-button text-[18px] text-gray-400 hover:text-black cursor-pointer select-none" title="Edit word">edit</span>
                                            </div>
                                        </div>
                                    ` : `
                                        <span class="font-serif italic text-lg text-text-muted block leading-none mb-1 cursor-pointer">word...</span>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        worksheetGrid.appendChild(dayColumn);
    }

    // Add event listeners for editing column names
    worksheetGrid.querySelectorAll('.column-name-input').forEach(input => {
        input.addEventListener('blur', (e) => {
            const target = e.target as HTMLInputElement;
            const newName = target.value;
            const colIndex = parseInt(target.dataset.columnIndex!);
            if (currentWorksheetId !== null) {
                renameColumn(currentWorksheetId, colIndex, newName);
            }
        });
    });

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
    });
}

/**
 * Fetches the list of words from the backend API for a specific worksheet.
 */
async function fetchWords(worksheetId: number): Promise<WorksheetEntry[]> {
  try {
    const query = currentStudentId ? `?studentId=${currentStudentId}` : '';
    const response = await fetch(`${API_URL}/worksheets/${worksheetId}/words${query}`, {
        headers: authService.getHeaders()
    });
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
async function saveWordData(columnIndex: number, position: number, wordText: string) {
    if (currentWorksheetId === null) return;
    try {
        await fetch(`${API_URL}/worksheets/${currentWorksheetId}/words`, {
            method: 'POST',
            headers: {
                ...authService.getHeaders()
            },
            body: JSON.stringify({ wordText, columnIndex, position }),
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
    const deleteSheetButton = document.getElementById('delete-sheet-button') as HTMLButtonElement;
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

    if(deleteSheetButton) {
        deleteSheetButton.addEventListener('click', () => {
            deleteCurrentSheet();
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
    const urlParams = new URLSearchParams(window.location.search);
    const studentIdParam = urlParams.get('studentId');
    if (studentIdParam) {
        currentStudentId = parseInt(studentIdParam);
    } else {
        currentStudentId = null;
    }

    const isTeacherView = currentStudentId !== null && authService.getUser()?.role !== 'student';
    const teacherBanner = isTeacherView ?
        `<div class="bg-blue-50 text-blue-800 p-4 max-w-[95%] mx-auto mb-4 rounded flex justify-between items-center shadow-sm border border-blue-100">
            <span>Viewing worksheets for student ID: ${currentStudentId}</span>
            <a href="/students" data-navigo class="bg-blue-200 text-blue-900 px-3 py-1 rounded text-sm hover:bg-blue-300 transition">Back to Students</a>
        </div>` : '';

    element.innerHTML = `
    <main class="worksheet-container p-4">
        ${teacherBanner}
        <div class="flex justify-between items-center max-w-[95%] mx-auto mb-4 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
             <div class="flex items-center space-x-4">
                <input id="sheet-name-input" class="text-xl font-bold text-gray-800 border-b-2 border-transparent hover:border-gray-200 focus:border-academic-blue focus:outline-none bg-transparent py-1" placeholder="Sheet Name..." ${isTeacherView ? 'disabled' : ''} />
             </div>
             <div class="flex items-center space-x-2">
                <select id="sheet-select" class="text-sm border-gray-300 rounded-md focus:ring-academic-blue focus:border-academic-blue bg-gray-50 py-1 pl-2 pr-8 mr-2">
                </select>
                <button id="prev-sheet-button" class="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-gray-300 rounded-md hover:bg-gray-100 text-gray-600 transition-colors">Previous Sheet</button>
                <button id="next-sheet-button" class="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-gray-300 rounded-md hover:bg-gray-100 text-gray-600 transition-colors">Next Sheet</button>
                <button id="delete-sheet-button" class="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-red-300 rounded-md hover:bg-red-50 text-red-600 transition-colors ${isTeacherView ? 'hidden' : ''}">Delete Sheet</button>
                <button id="new-sheet-button" class="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-black text-white rounded-md hover:bg-gray-800 transition-colors ${isTeacherView ? 'hidden' : ''}">New Sheet</button>
             </div>
        </div>
        <div class="worksheet-grid grid grid-cols-7 gap-0 bg-white border border-gray-200 shadow-lg max-w-[95%] mx-auto rounded-lg overflow-hidden ${isTeacherView ? 'opacity-90 pointer-events-none' : ''}" id="worksheet-grid">
        </div>
    </main>
    `;
    createAndPopulateWorksheet();
    addEventListeners();
}
