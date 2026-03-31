import { authService, User } from '../auth';

const API_URL = 'http://localhost:3000/api';

interface Progress {
    totalWords: number;
    totalLearned: number;
    weeksTracked: number;
    totalMorphemes: number;
    totalPrefixes: number;
    totalSuffixes: number;
    totalRoots: number;
}

export async function renderStudents(element: HTMLElement) {
    element.innerHTML = `
        <div class="p-8 max-w-[1600px] mx-auto min-h-screen">
            <div class="grid grid-cols-3 gap-8 h-full">
                <!-- Left Column (1/3) -->
                <div class="col-span-1 bg-white p-6 rounded shadow border border-gray-100 flex flex-col h-[calc(100vh-140px)]">
                    <h2 class="text-xl font-bold mb-4">My Students</h2>

                    <form id="add-student-form" class="mb-6 flex gap-2">
                        <input type="email" id="new-student-email" placeholder="Student Email" class="flex-1 p-2 border rounded text-sm" required />
                        <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition">Add</button>
                    </form>
                    <p id="add-student-msg" class="text-sm hidden mb-4"></p>

                    <div id="students-list" class="flex-1 overflow-y-auto pr-2">
                        <p class="text-gray-500 text-sm">Loading students...</p>
                    </div>
                </div>

                <!-- Right Column (2/3) -->
                <div class="col-span-2 bg-gray-50 p-8 rounded border border-gray-200 h-[calc(100vh-140px)] overflow-y-auto" id="student-details-panel">
                    <div class="flex h-full items-center justify-center text-gray-400">
                        <p>Select a student from the list to view their progress and worksheets.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupAddStudentForm();
    await fetchAndRenderStudents();
}

async function setupAddStudentForm() {
    const form = document.getElementById('add-student-form') as HTMLFormElement;
    const msgEl = document.getElementById('add-student-msg') as HTMLElement;

    if (!form || !msgEl) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('new-student-email') as HTMLInputElement;
        const email = emailInput.value.trim();

        try {
            const response = await fetch(`${API_URL}/teacher/students`, {
                method: 'POST',
                headers: authService.getHeaders(),
                body: JSON.stringify({ email })
            });

            if (response.ok) {
                msgEl.textContent = 'Student added successfully!';
                msgEl.className = 'text-sm text-green-600 block mb-4';
                emailInput.value = '';
                await fetchAndRenderStudents();
            } else {
                const err = await response.json();
                msgEl.textContent = err.error || 'Failed to add student.';
                msgEl.className = 'text-sm text-red-600 block mb-4';
            }
        } catch (err) {
            console.error(err);
            msgEl.textContent = 'An error occurred.';
            msgEl.className = 'text-sm text-red-600 block mb-4';
        }
    });
}

async function fetchAndRenderStudents() {
    const listDiv = document.getElementById('students-list');
    if (!listDiv) return;

    try {
        const response = await fetch(`${API_URL}/teacher/students`, {
            headers: authService.getHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch');

        const students: User[] = await response.json();

        if (students.length === 0) {
            listDiv.innerHTML = '<p class="text-gray-500 text-sm italic">You currently have no students assigned to you.</p>';
            return;
        }

        let html = '<ul class="space-y-2">';
        students.forEach(student => {
            const name = [student.firstname, student.lastname].filter(Boolean).join(' ') || student.username;
            html += `
                <li>
                    <button class="student-select-btn w-full text-left p-4 rounded border border-gray-200 hover:border-blue-400 hover:shadow-sm transition bg-white" data-id="${student.id}" data-name="${name}">
                        <p class="font-bold text-gray-900">${name}</p>
                        <p class="text-xs text-gray-500">${student.email}</p>
                    </button>
                </li>
            `;
        });
        html += '</ul>';
        listDiv.innerHTML = html;

        // Attach click listeners to load details
        const btns = listDiv.querySelectorAll('.student-select-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Highlight active button
                btns.forEach(b => {
                    b.classList.remove('border-blue-500', 'ring-1', 'ring-blue-500');
                    b.classList.add('border-gray-200');
                });
                btn.classList.remove('border-gray-200');
                btn.classList.add('border-blue-500', 'ring-1', 'ring-blue-500');

                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                if (id && name) {
                    loadStudentDetails(parseInt(id), name);
                }
            });
        });

    } catch (error) {
        console.error('Error:', error);
        listDiv.innerHTML = '<p class="text-red-500 text-sm">Failed to load students.</p>';
    }
}

async function loadStudentDetails(studentId: number, studentName: string) {
    const panel = document.getElementById('student-details-panel');
    if (!panel) return;

    panel.innerHTML = `
        <div class="animate-pulse flex space-x-4">
            <div class="flex-1 space-y-4 py-1">
                <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                <div class="space-y-2">
                    <div class="h-4 bg-gray-200 rounded"></div>
                    <div class="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
            </div>
        </div>
    `;

    try {
        // Fetch progress and worksheets concurrently
        const [progRes, sheetsRes] = await Promise.all([
            fetch(`${API_URL}/progress?studentId=${studentId}`, { headers: authService.getHeaders() }),
            fetch(`${API_URL}/worksheets?studentId=${studentId}`, { headers: authService.getHeaders() })
        ]);

        if (!progRes.ok || !sheetsRes.ok) throw new Error("Failed to fetch student data");

        const progress: Progress = await progRes.json();
        const worksheets: any[] = await sheetsRes.json();

        let worksheetsHtml = '';
        if (worksheets.length === 0) {
            worksheetsHtml = '<p class="text-sm text-gray-500 italic">This student has no worksheets.</p>';
        } else {
            worksheetsHtml = '<div class="grid grid-cols-2 gap-4">';
            worksheets.forEach(ws => {
                const sheetName = ws.name || 'Unnamed Sheet';
                // Opens in new tab, passes studentId and sheetId
                const href = `/?studentId=${studentId}&sheetId=${ws.id}`;
                worksheetsHtml += `
                    <a href="${href}" target="_blank" class="block p-4 bg-white border border-gray-200 rounded hover:border-blue-500 hover:shadow-md transition group">
                        <h4 class="font-bold text-gray-800 mb-1 group-hover:text-blue-600">${sheetName}</h4>
                        <div class="flex justify-between items-center mt-4">
                           <span class="text-xs text-gray-400">Created: ${new Date(ws.createdAt).toLocaleDateString()}</span>
                           <span class="material-symbols-outlined text-[16px] text-gray-400 group-hover:text-blue-500">open_in_new</span>
                        </div>
                    </a>
                `;
            });
            worksheetsHtml += '</div>';
        }

        panel.innerHTML = `
            <div class="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">${studentName}</h2>
                    <p class="text-sm text-gray-500">Student ID: ${studentId}</p>
                </div>
                <a href="/vocabulary-progress?studentId=${studentId}" data-navigo class="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    Full Progress Report <span class="material-symbols-outlined text-[16px]" style="font-family: 'Material Symbols Outlined';">arrow_forward</span>
                </a>
            </div>

            <div class="mb-10">
                <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Quick Stats</h3>
                <div class="grid grid-cols-4 gap-4">
                    <div class="bg-white p-4 rounded border border-gray-200 text-center shadow-sm">
                        <div class="text-3xl font-serif font-bold text-gray-900">${progress.totalLearned}</div>
                        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Words Learned</div>
                    </div>
                    <div class="bg-white p-4 rounded border border-gray-200 text-center shadow-sm">
                        <div class="text-3xl font-serif font-bold text-gray-900">${progress.totalPrefixes}</div>
                        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Prefixes</div>
                    </div>
                    <div class="bg-white p-4 rounded border border-gray-200 text-center shadow-sm">
                        <div class="text-3xl font-serif font-bold text-gray-900">${progress.totalRoots}</div>
                        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Roots</div>
                    </div>
                     <div class="bg-white p-4 rounded border border-gray-200 text-center shadow-sm">
                        <div class="text-3xl font-serif font-bold text-gray-900">${progress.totalSuffixes}</div>
                        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Suffixes</div>
                    </div>
                </div>
            </div>

            <div>
                <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Worksheets</h3>
                ${worksheetsHtml}
            </div>
        `;

        // We injected normal anchor tags, Navigo won't intercept target="_blank" links automatically the way we want
        // They will just work natively to open a new tab.

    } catch (err) {
        console.error(err);
        panel.innerHTML = '<p class="text-red-500">Failed to load student details.</p>';
    }
}
