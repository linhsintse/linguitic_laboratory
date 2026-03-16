const API_URL = 'http://localhost:3000/api';

interface Morpheme {
    id: number;
    text: string;
    type: string;
    meaning?: string;
    origin?: string;
    frequency?: number;
    category?: string;
}

let allMorphemes: Morpheme[] = [];

export async function renderMorphologyLibrary(element: HTMLElement) {
    element.innerHTML = `
        <div class="flex h-screen bg-white">
            <!-- Sidebar -->
            <div class="w-64 border-r border-gray-200 flex flex-col h-full bg-white flex-shrink-0">
                <div class="p-4 border-b border-gray-200">
                    <p class="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Search Morphemes</p>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 flex items-center pl-3">
                            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </span>
                        <input type="text" id="morpheme-search" placeholder="e.g. 'morph', 'logy'..." class="w-full pl-10 pr-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-300">
                    </div>
                </div>

                <div class="p-4 border-b border-gray-200">
                     <p class="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Recently Analyzed</p>
                </div>

                <div class="flex-1 overflow-y-auto" id="morpheme-list">
                    <div class="p-4 text-gray-500 text-sm">Loading...</div>
                </div>
            </div>

            <!-- Main Content -->
            <div class="flex-1 overflow-y-auto p-12 bg-white" id="morpheme-main">
                 <div class="max-w-4xl mx-auto h-full flex items-center justify-center text-gray-400">
                    <p>Select a morpheme from the sidebar to view details.</p>
                 </div>
            </div>
        </div>
    `;

    try {
        const response = await fetch(`${API_URL}/morphemes`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allMorphemes = await response.json();
        renderSidebarList(allMorphemes);

        // Render a default one if available
        if (allMorphemes.length > 0) {
            renderMainContent(allMorphemes[0]);
        }

        // Add Event Listeners
        const searchInput = document.getElementById('morpheme-search') as HTMLInputElement;
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = (e.target as HTMLInputElement).value.toLowerCase();
                const filtered = allMorphemes.filter(m =>
                    m.text.toLowerCase().includes(term) ||
                    (m.meaning && m.meaning.toLowerCase().includes(term))
                );
                renderSidebarList(filtered);
            });
        }

    } catch (error) {
        console.error('Failed to fetch morphemes:', error);
        const listDiv = document.getElementById('morpheme-list');
        if (listDiv) listDiv.innerHTML = '<div class="p-4 text-red-500 text-sm">Failed to load morphemes.</div>';
    }
}

function renderSidebarList(morphemes: Morpheme[]) {
    const listDiv = document.getElementById('morpheme-list');
    if (!listDiv) return;

    if (morphemes.length === 0) {
        listDiv.innerHTML = '<div class="p-4 text-gray-500 text-sm">No morphemes found.</div>';
        return;
    }

    listDiv.innerHTML = morphemes.map(m => `
        <div class="morpheme-item cursor-pointer px-4 py-3 hover:bg-gray-50 border-b border-gray-100 flex items-center justify-between" data-id="${m.id}">
            <div>
                <span class="font-bold text-gray-900">${formatMorphemeText(m)}</span>
                <span class="text-sm text-gray-400 ml-2 uppercase text-xs tracking-wider">${m.meaning || 'UNKNOWN'}</span>
            </div>
        </div>
    `).join('');

    const items = listDiv.querySelectorAll('.morpheme-item');
    items.forEach(item => {
        item.addEventListener('click', () => {
            const id = Number(item.getAttribute('data-id'));
            const selected = allMorphemes.find(m => m.id === id);
            if (selected) {
                renderMainContent(selected);
            }
        });
    });
}

function formatMorphemeText(m: Morpheme): string {
    let text = m.text.toUpperCase().replace(/^-|-$/g, '');
    if (m.type === 'prefix') {
        return text + '-';
    } else if (m.type === 'suffix') {
        return '-' + text;
    }
    return text;
}

function formatMorphemeTextMain(m: Morpheme): string {
    let text = m.text.toUpperCase().replace(/^-|-$/g, '');
    if (m.type === 'prefix') {
        return text + '-';
    } else if (m.type === 'suffix') {
        return '-' + text;
    }
    return '-' + text + '-';
}

function renderMainContent(m: Morpheme) {
    const mainDiv = document.getElementById('morpheme-main');
    if (!mainDiv) return;

    const originText = m.origin === 'L' ? 'Latin' : m.origin === 'G' ? 'Greek' : m.origin === 'OE' ? 'Old English' : m.origin === 'OF' ? 'Old French' : m.origin === 'F' ? 'French' : m.origin || 'Unknown';

    mainDiv.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <div class="mb-12">
                <p class="text-xs text-gray-500 uppercase tracking-widest mb-4">MORPHEME WORKBENCH</p>
                <h1 class="text-6xl font-serif font-bold mb-4">${formatMorphemeTextMain(m)}</h1>
                <p class="text-xl text-gray-500 italic font-serif">${originText}: ${m.text} "${m.meaning || 'unknown'}"</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
                <div>
                    <h2 class="text-xs text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">PRIMARY DEFINITION</h2>
                    <p class="text-sm text-gray-700 leading-relaxed">
                        The ${m.type} <strong>${m.text}</strong> is of ${originText} origin and primarily indicates a meaning related to "${m.meaning}". ${m.category ? `It often functions within the semantic category of <strong>${m.category}</strong>.` : ''}
                    </p>
                </div>
                <div>
                    <h2 class="text-xs text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">LINGUISTIC CONTEXTS</h2>
                    <div class="flex flex-col gap-4 text-sm text-gray-500 italic">
                        <p>More linguistic context data will be available as you analyze more words with this morpheme.</p>
                    </div>
                </div>
            </div>

            <div class="mb-8 border-b border-black pb-4">
                <h2 class="text-2xl font-serif font-bold">My Annotated Words</h2>
                <p class="text-xs text-gray-400 uppercase tracking-widest mt-2">PERSONAL LIBRARY ENTRIES USING '${formatMorphemeTextMain(m)}'</p>
            </div>

            <div class="space-y-0 text-sm text-gray-500 italic p-4 text-center bg-gray-50 rounded" id="annotated-words-list">
                Loading...
            </div>
        </div>
    `;

    // Fetch and populate annotated words
    fetch(`${API_URL}/morphemes/${m.id}/words`)
        .then(res => res.json())
        .then(words => {
            const list = document.getElementById('annotated-words-list');
            if (list) {
                if (words && words.length > 0) {
                    list.className = "space-y-0 text-sm text-gray-700";
                    list.innerHTML = words.map((w: any) => `
                        <div class="annotated-word-item border-b border-gray-200 last:border-0 py-3 cursor-pointer group hover:bg-gray-50 px-2 rounded -mx-2 transition-colors">
                            <div class="flex justify-between items-center toggle-btn">
                                <span class="font-bold text-gray-900 font-serif tracking-wide text-base capitalize">${w.text}</span>
                                <svg class="w-5 h-5 text-gray-400 group-hover:text-black transition-transform duration-200 transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                            <div class="content-area hidden mt-3 pl-4 border-l-2 border-gray-200 text-gray-600 pb-2">
                                <p class="mb-1"><span class="font-semibold text-xs uppercase tracking-wider text-gray-400">Word:</span> ${w.text}</p>
                            </div>
                        </div>
                    `).join('');

                    // Add Accordion listeners
                    list.querySelectorAll('.annotated-word-item').forEach(item => {
                        const toggleBtn = item.querySelector('.toggle-btn');
                        const contentArea = item.querySelector('.content-area');
                        const svgIcon = item.querySelector('svg');

                        if (toggleBtn && contentArea && svgIcon) {
                            toggleBtn.addEventListener('click', () => {
                                const isHidden = contentArea.classList.contains('hidden');
                                if (isHidden) {
                                    contentArea.classList.remove('hidden');
                                    svgIcon.classList.add('rotate-180');
                                } else {
                                    contentArea.classList.add('hidden');
                                    svgIcon.classList.remove('rotate-180');
                                }
                            });
                        }
                    });
                } else {
                    list.className = "space-y-0 text-sm text-gray-500 italic p-4 text-center bg-gray-50 rounded";
                    list.innerHTML = "No personal annotated words linked to this morpheme yet.";
                }
            }
        })
        .catch(() => {
            const list = document.getElementById('annotated-words-list');
            if (list) {
                list.className = "space-y-0 text-sm text-red-500 italic p-4 text-center bg-gray-50 rounded";
                list.innerHTML = "Failed to load words.";
            }
        });
}
