import Navigo from 'navigo';

export function renderHeader(element: HTMLElement, router: Navigo) {
    const headerHTML = `
    <header class="px-8 pt-8 pb-4 border-b border-border-light bg-white sticky top-0 z-50">
        <div class="flex justify-between items-end mb-6">
            <div data-purpose="branding">
                <p class="text-[10px] uppercase tracking-[0.3em] text-text-muted mb-2 font-semibold">ACTA ACADEMY</p>
                <h1 class="academic-title font-serif font-bold">The Linguistic Laboratory</h1>
            </div>
            <div class="flex items-center space-x-8" data-purpose="top-meta-nav">
                <div class="flex items-center space-x-4">
                     <button class="bg-accent-black text-white text-[10px] font-bold py-2.5 px-6 uppercase tracking-widest hover:bg-gray-800 transition-colors" id="account-button" data-navigo href="/account">
                        Account
                    </button>
                </div>
            </div>
        </div>
        <nav class="flex items-center space-x-12">
            <a class="nav-link" href="/" data-navigo>WORKSHEET</a>
            <a class="nav-link" href="/vocabulary-progress" data-navigo>PROGRESS</a>
            <a class="nav-link" href="/search" data-navigo>SEARCH</a>
            <a class="nav-link" href="/about" data-navigo>ABOUT THIS WEBSITE</a>
        </nav>
    </header>
    `;

    element.innerHTML = headerHTML;

    router.updatePageLinks();
}
