import { authService, User } from '../auth';

const API_URL = 'http://localhost:3000/api';

export async function renderStudents(element: HTMLElement) {
    element.innerHTML = `
        <div class="p-8 max-w-4xl mx-auto">
            <h1 class="text-2xl font-bold mb-6">My Students</h1>
            <div id="students-list">Loading students...</div>
        </div>
    `;

    const listDiv = document.getElementById('students-list');
    if (!listDiv) return;

    try {
        const response = await fetch(`${API_URL}/teacher/students`, {
            headers: authService.getHeaders()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const students: User[] = await response.json();

        if (students.length === 0) {
            listDiv.innerHTML = '<p class="text-gray-500">You currently have no students assigned to you.</p>';
            return;
        }

        let html = '<ul class="divide-y divide-gray-200 bg-white border rounded shadow-sm">';
        students.forEach(student => {
            const name = [student.firstname, student.lastname].filter(Boolean).join(' ') || 'No Name Provided';
            html += `
                <li class="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                    <div>
                        <p class="font-bold text-gray-900">${name}</p>
                        <p class="text-sm text-gray-500">${student.email} (${student.username})</p>
                    </div>
                    <a href="/?studentId=${student.id}" data-navigo class="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded hover:bg-blue-200 transition">View Worksheets</a>
                </li>
            `;
        });
        html += '</ul>';

        listDiv.innerHTML = html;

    } catch (error) {
        console.error('Failed to fetch students:', error);
        listDiv.innerHTML = '<p class="text-red-500">Failed to load students.</p>';
    }
}
