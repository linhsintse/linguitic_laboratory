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

function updateSlotUI(slot: HTMLElement, _colIndex: number, _position: number, word: string, morphemes: Morpheme[]) {
    const wFullDiv = slot.querySelector('.w-full');
    if (!wFullDiv) return;

    const morphemeTagsHTML = morphemes.map(m =>
        `<span class="inline-flex items-center bg-blue-100 text-blue-800 text-[10px] font-medium mr-1 px-1.5 py-0.5 rounded-full">${m.displaytext}</span>`
    ).join('');

    wFullDiv.innerHTML = `
        ${word ? `
                                        <div class="flex justify-between items-start w-full relative group">
                <div class="flex-1">
                    <a href="https://www.thewordfinder.com/define/${word.toLowerCase()}" target="_blank" class="word-text font-serif text-lg block leading-none mb-1 cursor-pointer hover:underline">${word}</a>
                </div>
                                            <div class="hidden group-hover:flex items-center gap-1 shrink-0 absolute right-0 top-0 bg-white">
                    <span class="material-symbols-outlined parse-button text-[18px] text-gray-400 hover:text-blue-500 cursor-pointer select-none" title="Auto-parse tags">autorenew</span>
                    <span class="material-symbols-outlined edit-button text-[18px] text-gray-400 hover:text-black cursor-pointer select-none" title="Edit tags">edit</span>
                </div>
            </div>
        ` : `
            <span class="font-serif italic text-lg text-text-muted block leading-none mb-1 cursor-pointer">word...</span>
        `}
        <div class="morpheme-tags-container flex flex-wrap gap-1 mt-1 w-full">
            ${morphemeTagsHTML}
        </div>
    `;

    // Reattach listeners to new elements
    const editButton = slot.querySelector('.edit-button');
    if (editButton) {
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            enterEditMode(slot);
        });
    }

    const parseBtn = slot.querySelector('.parse-button');
    if (parseBtn) {
        parseBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!word) return;
            try {
                const response = await fetch(`${API_URL}/morphemes/parse?word=${word}`);
                if (response.ok) {
                    const parsedMorphemes = await response.json();
                    morphemesByColumn[_colIndex][_position] = parsedMorphemes;
                    await saveWordData(_colIndex, _position, word, "", parsedMorphemes);
                    updateSlotUI(slot, _colIndex, _position, word, parsedMorphemes);
                }
            } catch (error) {
                console.error('Error auto parsing on click:', error);
            }
        });
    }

    const wordTextSpan = slot.querySelector('.word-text, .font-serif.italic');
    if (wordTextSpan) {
        // we already have a slot click listener that handles the area, but the
        // link prevents default behavior. we can let the slot listener handle it
        // but we just need to make sure the slot listener is still there, which it is
        // since we didn't replace the slot element itself.
    }
}

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
    input.className = 'word-edit-input font-serif text-lg block leading-none mb-1 bg-white border border-gray-300 p-1 w-full rounded focus:ring-1 focus:ring-academic-blue focus:border-academic-blue relative z-10';
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

    // Hide the non-edit tags and tools
    const nonEditTagsContainer = slot.querySelector('.morpheme-tags-container');
    if (nonEditTagsContainer) {
        (nonEditTagsContainer as HTMLElement).style.display = 'none';
    }
    const toolsContainer = slot.querySelector('.group-hover\\:flex');
    if (toolsContainer) {
        (toolsContainer as HTMLElement).style.display = 'none';
    }

    const colIndex = parseInt(slot.dataset.colIndex!);
    const pos = parseInt(slot.dataset.position!);

    let currentMorphemes: Morpheme[] = [];
    if (morphemesByColumn[colIndex] && morphemesByColumn[colIndex][pos]) {
        currentMorphemes = [...morphemesByColumn[colIndex][pos]];
    }

    const renderEditTags = () => {
        tagContainer.innerHTML = '';
        currentMorphemes.forEach((morpheme, index) => {
            const tag = document.createElement('span');
            tag.className = 'inline-flex items-center bg-blue-100 text-blue-800 text-[10px] font-medium mr-1 px-1.5 py-0.5 rounded-full';
            tag.innerHTML = `${morpheme.displaytext}
                <button type="button" class="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none" data-index="${index}">
                    &times;
                </button>`;
            tagContainer.appendChild(tag);
        });

        // Add the "+" button
        const addBtn = document.createElement('button');
        addBtn.className = 'add-morpheme-btn inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 focus:outline-none';
        addBtn.title = 'Add Morpheme';
        addBtn.innerText = '+';
        addBtn.onclick = (e) => {
            e.preventDefault();
            const text = prompt("Enter morpheme (e.g. pre-, dict, -ion):");
            if (text && text.trim()) {
                const trimmed = text.trim();
                let type: 'prefix' | 'root' | 'suffix' = 'root';
                if (trimmed.endsWith('-')) type = 'prefix';
                else if (trimmed.startsWith('-')) type = 'suffix';

                currentMorphemes.push({
                    id: Date.now(), // Temp ID
                    text: trimmed.replace(/-/g, ''),
                    displaytext: trimmed,
                    type,
                    meaning: 'manual input'
                });
                renderEditTags();
            }
        };
        tagContainer.appendChild(addBtn);

        // Attach delete handlers
        tagContainer.querySelectorAll('button[data-index]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const index = parseInt((btn as HTMLButtonElement).dataset.index!);
                currentMorphemes.splice(index, 1);
                renderEditTags();
            });
        });
    };

    renderEditTags();
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

        if (!morphemesByColumn[columnIndex]) {
            morphemesByColumn[columnIndex] = [];
        }
        morphemesByColumn[columnIndex][position] = currentMorphemes;

        await saveWordData(columnIndex, position, newWord, "", currentMorphemes);
        updateSlotUI(slot, columnIndex, position, newWord, currentMorphemes);

        return true;
    };

    // We don't save on word input blur anymore to allow interacting with suggested tags.
    // Save happens on Enter or when blurring the morpheme guide.
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
                                                <span class="material-symbols-outlined parse-button text-[18px] text-gray-400 hover:text-blue-500 cursor-pointer select-none" title="Auto-parse tags">auto_awesome</span>
                                                <span class="material-symbols-outlined edit-button text-[18px] text-gray-400 hover:text-black cursor-pointer select-none" title="Edit tags">edit</span>
                                            </div>
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

        // Handle Parse Morpheme Button click
        const parseBtn = slot.querySelector('.parse-button');
        if (parseBtn) {
            parseBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const w = slot.querySelector('.word-text');
                if (!w) return;
                const word = (w as HTMLElement).innerText.trim();
                const colIndex = parseInt((slot as HTMLDivElement).dataset.colIndex!);
                const position = parseInt((slot as HTMLDivElement).dataset.position!);
                if (!word) return;
                try {
                    const response = await fetch(`${API_URL}/morphemes/parse?word=${word}`);
                    if (response.ok) {
                        const morphemes = await response.json();
                        morphemesByColumn[colIndex][position] = morphemes;
                        await saveWordData(colIndex, position, word, "", morphemes);
                        updateSlotUI(slot as HTMLElement, colIndex, position, word, morphemes);
                    }
                } catch (error) {
                    console.error('Error auto parsing on click:', error);
                }
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
async function saveWordData(columnIndex: number, position: number, wordText: string, morphemeString: string, morphemes: Morpheme[] = []) {
    if (currentWorksheetId === null) return;
    try {
        await fetch(`${API_URL}/worksheets/${currentWorksheetId}/words`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wordText, columnIndex, position, morphemeString, morphemes }),
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
