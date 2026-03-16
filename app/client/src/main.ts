import './style.css';
import './router';

// Best-Effort Auto-Parser with Manual Override logic

interface Morpheme {
    id: number;
    text: string;
    displaytext: string;
    type: string;
    meaning: string;
}

/**
 * State Management for Selected Morphemes
 * We keep an array of morpheme objects that are currently displayed as tags.
 * When a user blurs the word input, we fetch suggestions and update this state.
 * Users can also manually remove tags by clicking the "x".
 */
let selectedMorphemes: Morpheme[] = [];

function initAutoParser() {
    const wordInput = document.getElementById('word-input') as HTMLInputElement;
    const tagContainer = document.getElementById('tag-container') as HTMLDivElement;

    if (!wordInput || !tagContainer) return;

    // Load initial state if available
    if ((window as any).selectedMorphemes) {
        selectedMorphemes = (window as any).selectedMorphemes;
        renderTags(tagContainer);
    }

    wordInput.addEventListener('blur', async () => {
        const word = wordInput.value.trim();
        if (!word) {
            selectedMorphemes = [];
            renderTags(tagContainer);
            return;
        }

        try {
            const response = await fetch(`http://localhost:3000/api/morphemes/parse?word=${word}`);
            if (!response.ok) throw new Error('Failed to fetch suggestions');

            // Best-effort match from backend
            const suggestions: Morpheme[] = await response.json();

            // Replace current state with new suggestions
            selectedMorphemes = suggestions;
            (window as any).selectedMorphemes = selectedMorphemes;
            renderTags(tagContainer);
            updateMorphemeGuide(wordInput);
        } catch (error) {
            console.error('Error fetching morpheme suggestions:', error);
        }
    });
}

/**
 * Updates the hidden/visible morpheme guide input based on the current selected tags.
 */
function updateMorphemeGuide(wordInput: HTMLInputElement) {
    // Also update global state
    (window as any).selectedMorphemes = selectedMorphemes;

    const slot = wordInput.closest('.word-slot');
    if (!slot) return;
    const morphemeGuide = slot.querySelector('.morpheme-guide') as HTMLInputElement;
    if (!morphemeGuide) return;

    // Construct morpheme string from tags: pre-[root]-suff
    const prefixes = selectedMorphemes.filter(m => m.type === 'prefix').map(m => m.text);
    const roots = selectedMorphemes.filter(m => m.type === 'root').map(m => `[${m.text}]`);
    const suffixes = selectedMorphemes.filter(m => m.type === 'suffix').map(m => m.text);

    let str = "";
    for (let p of prefixes) { str += p; }
    for (let r of roots) { str += r; }
    for (let s of suffixes) {
        if (!str.endsWith("-") && str !== "" && !s.startsWith("-")) str += "-";
        str += s;
    }
    morphemeGuide.value = str;
}

/**
 * Renders the tags based on the current state of selectedMorphemes.
 */
function renderTags(container: HTMLDivElement) {
    container.innerHTML = '';

    selectedMorphemes.forEach((morpheme, index) => {
        const tag = document.createElement('span');
        // Tailwind styling for tags
        tag.className = 'inline-flex items-center bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded-full mb-1';

        tag.innerHTML = `
            <span>${morpheme.displaytext} (${morpheme.type})</span>
            <button class="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-blue-200 focus:outline-none" data-index="${index}">
                <svg class="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                    <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
                </svg>
            </button>
        `;

        // Manual Override: Handle tag removal
        const removeBtn = tag.querySelector('button')!;
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Remove from state array
            selectedMorphemes.splice(index, 1);
            // Re-render to reflect state change
            renderTags(container);

            // Sync with hidden guide
            const wordInput = document.getElementById('word-input') as HTMLInputElement;
            if (wordInput) updateMorphemeGuide(wordInput);
        });

        container.appendChild(tag);
    });

    // Add "+" button for manual input
    const addContainer = document.createElement('div');
    addContainer.className = 'inline-flex items-center mb-1';

    const addBtn = document.createElement('button');
    addBtn.className = 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 focus:outline-none';
    addBtn.innerHTML = '+';
    addBtn.title = 'Add Morpheme manually (e.g., pre-, -tion, root)';

    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.className = 'hidden ml-1 px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-20';
    addInput.placeholder = 'type...';

    addBtn.addEventListener('mousedown', (e) => {
        // use mousedown to prevent blur from firing on the main input if needed
        e.preventDefault();
        e.stopPropagation();
    });

    addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        addBtn.classList.add('hidden');
        addInput.classList.remove('hidden');
        addInput.focus();
    });

    const handleAdd = () => {
        const val = addInput.value.trim();
        if (val) {
            let type = 'root';
            let text = val;
            let displaytext = val;

            if (val.endsWith('-')) {
                type = 'prefix';
                text = val.slice(0, -1);
            } else if (val.startsWith('-')) {
                type = 'suffix';
                text = val.slice(1);
            }

            selectedMorphemes.push({
                id: Date.now(), // dummy id for new manual entries
                text: text,
                displaytext: displaytext,
                type: type,
                meaning: 'manual input'
            });

            renderTags(container);
            const wordInput = document.getElementById('word-input') as HTMLInputElement;
            if (wordInput) updateMorphemeGuide(wordInput);
        } else {
            // just hide if empty
            addInput.classList.add('hidden');
            addBtn.classList.remove('hidden');
        }
    };

    addInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        } else if (e.key === 'Escape') {
            addInput.value = '';
            addInput.classList.add('hidden');
            addBtn.classList.remove('hidden');
        }
    });

    addInput.addEventListener('blur', () => {
        handleAdd();
    });

    addContainer.appendChild(addBtn);
    addContainer.appendChild(addInput);
    container.appendChild(addContainer);
}

// Initialize the logic once the DOM is ready or when needed
// In this SPA, we can wait for initial load, but for specific pages,
// we might need to call this after the page component renders.
document.addEventListener('DOMContentLoaded', initAutoParser);

// Since this is an SPA using Navigo, we should also expose a way to re-init
// if the elements are added dynamically.
(window as any).initAutoParser = initAutoParser;
