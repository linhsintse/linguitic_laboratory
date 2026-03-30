const API_URL = 'http://localhost:3000/api';

export function renderSearch(element: HTMLElement) {
    element.innerHTML = `
        <main class="flex-grow flex flex-col items-center p-8 md:px-16 w-full">
            <div class="w-full max-w-4xl mb-12">
                <h1 class="font-serif font-bold text-3xl mb-2">Etymological Database</h1>
                <p class="text-[0.65rem] tracking-[0.2em] text-brand-gray uppercase mb-8">Corpus Search & Analysis</p>
                
                <div class="relative group flex gap-4">
                    <div class="relative flex-grow">
                        <input 
                            type="text" 
                            id="search-input" 
                            placeholder="Enter a word to analyze..." 
                            class="w-full border-b-2 border-brand-border py-6 pl-4 pr-4 text-2xl font-serif focus:outline-none focus:border-black transition-colors bg-transparent placeholder:text-gray-300"
                        />
                    </div>
                    <button 
                        id="search-button" 
                        class="bg-black text-white px-8 py-2 font-bold uppercase tracking-widest text-[0.65rem] hover:bg-gray-800 transition-colors mt-2 mb-2"
                    >
                        Analyze
                    </button>
                </div>
            </div>

            <div id="results-container" class="w-full max-w-4xl space-y-16">
                <div id="empty-state" class="py-16 flex flex-col items-center justify-center border-b border-brand-border">
                    <p class="text-brand-gray font-serif italic text-lg">Enter a term to generate its morphological equation and historical timeline.</p>
                </div>
            </div>
        </main>
    `;

    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    const searchButton = document.getElementById('search-button') as HTMLButtonElement;
    const resultsContainer = document.getElementById('results-container') as HTMLDivElement;

    // --- SANITIZATION & FORMATTING HELPERS ---
    
    const escapeHTML = (str: string | null) => {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
    };

    function renderResults(data: any[]) {
        const escapeHTML = (str: string) => str ? str.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
        const rawJsonHtml = `
            <section class="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 pb-16">
                <div class="flex items-center mb-10">
                    <h3 class="text-[0.7rem] uppercase tracking-[0.15em] text-brand-gray">Raw JSON Response</h3>
                    <div class="flex-grow ml-4 border-t border-brand-border"></div>
                </div>
                <div class="bg-gray-50 border border-brand-border p-4 rounded-md overflow-x-auto text-xs font-mono text-gray-800 shadow-inner">
                    <pre>${escapeHTML(JSON.stringify(data, null, 2))}</pre>
                </div>
            </section>
        `;
        const resultsContainer = document.getElementById('results-container');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                ${rawJsonHtml}
            `;
        }
    }

    // --- SEARCH EXECUTION ---

    async function performSearch() {
        const word = searchInput.value.trim().toLowerCase();
        if (!word) return;

        resultsContainer.innerHTML = `
            <div class="py-16 flex flex-col items-center justify-center">
                <p class="text-brand-gray font-serif italic text-lg">Querying linguistic database...</p>
            </div>
        `;

        try {
            const response = await fetch(`${API_URL}/etymology/${word}`);
            if (!response.ok) {
                if (response.status === 404) {
                    resultsContainer.innerHTML = `
                        <div class="py-16 flex flex-col items-center justify-center border-b border-brand-border">
                            <p class="text-black font-serif italic text-lg">No records found for "<span class="font-bold">${escapeHTML(word)}</span>".</p>
                            <p class="text-brand-gray text-sm mt-2">Try searching for a base root or checking the spelling.</p>
                        </div>
                    `;
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } else {
                const data = await response.json();
                renderResults(data);
            }
        } catch (error) {
            console.error("Search failed:", error);
            resultsContainer.innerHTML = `
                <div class="py-16 text-center text-red-500 font-serif italic">
                    A network error occurred while accessing the database.
                </div>
            `;
        }
    }

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    searchInput.focus();
}