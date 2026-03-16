const API_URL = 'http://localhost:3000/api';

interface TopMorpheme {
    id: number;
    text: string;
    type: string;
    count: number;
}

interface Progress {
    totalWords: number;
    totalLearned: number;
    weeksTracked: number;
    totalMorphemes: number;
    totalPrefixes: number;
    totalSuffixes: number;
    totalRoots: number;
    topMorphemes: TopMorpheme[];
}

export async function renderVocabularyProgress(element: HTMLElement) {
    element.innerHTML = `
        <div class="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen">
            <div id="progress-data" class="space-y-8">
                <div class="text-sm text-gray-500 italic p-4 text-center">Loading progress...</div>
            </div>
        </div>
    `;

    try {
        const response = await fetch(`${API_URL}/progress`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const progress: Progress = await response.json();

        const formatType = (type: string) => {
            if (type === 'prefix') return 'PREFIX';
            if (type === 'suffix') return 'SUFFIX';
            if (type === 'root') return 'ROOT';
            return type.toUpperCase();
        };

        let topMorphemesHtml = '';
        for (let i = 0; i < 5; i++) {
            const m = progress.topMorphemes[i];
            const num = (i + 1).toString().padStart(2, '0');
            if (m) {
                let displayStr = m.text;
                if (m.type === 'prefix') displayStr = displayStr + '-';
                if (m.type === 'suffix') displayStr = '-' + displayStr;

                topMorphemesHtml += `
                    <div class="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
                        <div class="flex items-center gap-4">
                            <div class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-xs text-gray-400 font-medium">${num}</div>
                            <div>
                                <div class="font-bold text-gray-900 text-lg">${displayStr}</div>
                                <div class="text-xs text-gray-400 uppercase tracking-wider">${formatType(m.type)}</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold text-gray-900 text-xl">${m.count}</div>
                            <div class="text-[10px] text-gray-400 uppercase tracking-widest">USES</div>
                        </div>
                    </div>
                `;
            } else {
                topMorphemesHtml += `
                    <div class="flex items-center justify-between py-4 border-b border-gray-100 last:border-0 opacity-50">
                        <div class="flex items-center gap-4">
                            <div class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-xs text-gray-400 font-medium">${num}</div>
                            <div>
                                <div class="font-bold text-gray-400 text-lg">—</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold text-gray-400 text-xl">0</div>
                        </div>
                    </div>
                `;
            }
        }

        const dataDiv = document.getElementById('progress-data');
        if (dataDiv) {
            dataDiv.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <!-- Left Column: Word Progress -->
                    <div class="md:col-span-1 space-y-8">
                        <div>
                            <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">WORD PROGRESS SUMMARY</h2>
                            <div class="bg-white border border-gray-200 p-6 h-64 flex flex-col relative">
                                <!-- Chart mock -->
                                <div class="flex items-center gap-4 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-auto">
                                    <div class="flex items-center gap-2"><div class="w-2 h-2 bg-gray-200"></div> TOTAL</div>
                                    <div class="flex items-center gap-2"><div class="w-2 h-2 bg-black"></div> LEARNED</div>
                                </div>
                                <div class="mt-auto border-t border-gray-100 pt-4 flex justify-around text-[10px] text-gray-400 font-bold tracking-widest">
                                    <div class="text-center">
                                        <div class="mb-1">0/0</div>
                                        <div>W1</div>
                                    </div>
                                    <div class="text-center">
                                        <div class="mb-1">0/0</div>
                                        <div>W2</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">MORPHEME ACTIVITY OVERVIEW</h2>
                            <div class="bg-white border border-gray-200 p-6 h-[400px]">
                                <h3 class="font-bold text-gray-900 mb-6 uppercase tracking-wider text-sm">TOP 5 MOST USED MORPHEMES</h3>
                                ${topMorphemesHtml}
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Metrics & Breakdown -->
                    <div class="md:col-span-2 space-y-8">
                        <div>
                            <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">GLOBAL METRICS</h2>
                            <div class="grid grid-cols-3 bg-white border border-gray-200">
                                <div class="p-8 border-r border-gray-200">
                                    <div class="text-6xl font-serif font-bold text-gray-900 mb-2">${progress.totalWords}</div>
                                    <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">TOTAL WORDS</div>
                                </div>
                                <div class="p-8 border-r border-gray-200">
                                    <div class="text-6xl font-serif font-bold text-gray-900 mb-2">${progress.totalLearned}</div>
                                    <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">TOTAL LEARNED</div>
                                </div>
                                <div class="p-8">
                                    <div class="text-6xl font-serif font-bold text-gray-900 mb-2">${progress.weeksTracked}</div>
                                    <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">WEEKS TRACKED</div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div class="bg-white border border-gray-200 p-8 h-[400px] flex flex-col">
                                <h3 class="font-bold text-gray-900 mb-12 uppercase tracking-wider text-sm">MORPHEME CATEGORY BREAKDOWN</h3>
                                <div class="grid grid-cols-3 gap-8 flex-1">
                                    <!-- Prefixes -->
                                    <div class="flex flex-col">
                                        <div class="flex items-center gap-2 mb-8 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                            <span class="material-symbols-outlined text-[16px]"></span> PREFIXES
                                        </div>
                                        <div class="text-6xl font-serif font-bold text-gray-900 mb-2">${progress.totalPrefixes}</div>
                                        <div class="text-[10px] text-gray-400 uppercase tracking-widest mb-auto">IDENTIFIED ELEMENTS</div>
                                        <div class="mt-auto">
                                            <div class="w-full h-1 bg-gray-100 rounded-full mb-2"></div>
                                            <div class="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                <span>GROWTH</span>
                                                <span class="text-black">+0%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Suffixes -->
                                    <div class="flex flex-col">
                                        <div class="flex items-center gap-2 mb-8 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                            <span class="material-symbols-outlined text-[16px]"></span> SUFFIXES
                                        </div>
                                        <div class="text-6xl font-serif font-bold text-gray-900 mb-2">${progress.totalSuffixes}</div>
                                        <div class="text-[10px] text-gray-400 uppercase tracking-widest mb-auto">IDENTIFIED ELEMENTS</div>
                                        <div class="mt-auto">
                                            <div class="w-full h-1 bg-gray-100 rounded-full mb-2"></div>
                                            <div class="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                <span>GROWTH</span>
                                                <span class="text-black">+0%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Roots -->
                                    <div class="flex flex-col">
                                        <div class="flex items-center gap-2 mb-8 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                            <span class="material-symbols-outlined text-[16px]"></span> ROOTS
                                        </div>
                                        <div class="text-6xl font-serif font-bold text-gray-900 mb-2">${progress.totalRoots}</div>
                                        <div class="text-[10px] text-gray-400 uppercase tracking-widest mb-auto">IDENTIFIED ELEMENTS</div>
                                        <div class="mt-auto">
                                            <div class="w-full h-1 bg-gray-100 rounded-full mb-2"></div>
                                            <div class="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                <span>GROWTH</span>
                                                <span class="text-black">+0%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to fetch progress:', error);
        const dataDiv = document.getElementById('progress-data');
        if (dataDiv) dataDiv.innerHTML = '<p class="text-red-500 p-4 text-center">Failed to load progress data.</p>';
    }
}
