const API_URL = 'http://localhost:3000/api';

interface User {
    id: number;
    email: string;
    username: string;
    name: string | null;
}

export async function renderAccount(element: HTMLElement) {
    element.innerHTML = `
        <div class="p-4">
            <h1 class="text-2xl font-bold mb-4">Account</h1>
            <div id="account-info">Loading account details...</div>
        </div>
    `;

    try {
        const response = await fetch(`${API_URL}/account`);
        const infoDiv = document.getElementById('account-info');

        if (response.status === 404) {
             if (infoDiv) {
                 infoDiv.innerHTML = `
                    <div class="bg-white p-4 rounded shadow border max-w-md">
                        <h2 class="text-xl font-semibold mb-4">Create Account</h2>
                        <form id="account-form" class="flex flex-col gap-4">
                            <input type="email" id="email" placeholder="Email" class="p-2 border rounded" required />
                            <input type="text" id="username" placeholder="Username" class="p-2 border rounded" required />
                            <input type="text" id="name" placeholder="Name (optional)" class="p-2 border rounded" />
                            <input type="password" id="password" placeholder="Password" class="p-2 border rounded" required />
                            <button type="submit" class="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition">Register</button>
                        </form>
                        <p id="form-message" class="mt-2 text-sm hidden"></p>
                    </div>
                 `;
                 setupForm(element, 'POST');
             }
             return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const account: User = await response.json();

        if (infoDiv) {
            infoDiv.innerHTML = `
                <div class="bg-white p-4 rounded shadow border max-w-md">
                    <h2 class="text-xl font-semibold mb-4">Account Details</h2>
                    <form id="account-form" class="flex flex-col gap-4">
                        <label class="flex flex-col gap-1 text-sm font-semibold">
                            Email
                            <input type="email" id="email" value="${account.email}" class="p-2 border rounded font-normal" required />
                        </label>
                        <label class="flex flex-col gap-1 text-sm font-semibold">
                            Username
                            <input type="text" id="username" value="${account.username}" class="p-2 border rounded font-normal" required />
                        </label>
                        <label class="flex flex-col gap-1 text-sm font-semibold">
                            Name
                            <input type="text" id="name" value="${account.name || ''}" class="p-2 border rounded font-normal" />
                        </label>
                        <label class="flex flex-col gap-1 text-sm font-semibold">
                            New Password (leave blank to keep current)
                            <input type="password" id="password" placeholder="New Password" class="p-2 border rounded font-normal" />
                        </label>
                        <button type="submit" class="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition">Save Changes</button>
                    </form>
                    <p id="form-message" class="mt-2 text-sm hidden"></p>
                </div>
            `;
            setupForm(element, 'PUT');
        }
    } catch (error) {
        console.error('Failed to fetch account:', error);
        const infoDiv = document.getElementById('account-info');
        if (infoDiv) infoDiv.innerHTML = '<p class="text-red-500">Failed to load account details.</p>';
    }
}

function setupForm(element: HTMLElement, method: 'POST' | 'PUT') {
    const form = element.querySelector('#account-form') as HTMLFormElement;
    const messageEl = element.querySelector('#form-message') as HTMLElement;

    if (!form || !messageEl) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = (document.getElementById('email') as HTMLInputElement).value;
        const username = (document.getElementById('username') as HTMLInputElement).value;
        const nameInput = (document.getElementById('name') as HTMLInputElement).value;
        const passwordInput = (document.getElementById('password') as HTMLInputElement).value;

        const data: any = {
            email,
            username,
            name: nameInput ? nameInput : null,
        };

        // Only include password if creating new account OR if it was filled during edit
        if (method === 'POST') {
            data.password = passwordInput;
        } else if (passwordInput) {
            data.password = passwordInput;
        }

        try {
            const response = await fetch(`${API_URL}/account`, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                messageEl.textContent = method === 'POST' ? 'Account created successfully!' : 'Account updated successfully!';
                messageEl.className = 'mt-2 text-sm text-green-600 block';
                if (method === 'POST') {
                    // Reload the view to show the edit form instead of register
                    renderAccount(element);
                }
            } else {
                const errorData = await response.json();
                messageEl.textContent = errorData.error || 'Failed to save account.';
                messageEl.className = 'mt-2 text-sm text-red-600 block';
            }
        } catch (error) {
            console.error('Failed to save account:', error);
            messageEl.textContent = 'An error occurred while saving.';
            messageEl.className = 'mt-2 text-sm text-red-600 block';
        }
    });
}
