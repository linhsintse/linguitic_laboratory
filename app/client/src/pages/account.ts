import { authService, User } from '../auth';

const API_URL = 'http://localhost:3000/api';

export async function renderAccount(element: HTMLElement) {
    element.innerHTML = `
        <div class="p-8 max-w-4xl mx-auto">
            <h1 class="text-2xl font-bold mb-6">Account</h1>
            <div id="account-info">Loading account details...</div>
        </div>
    `;

    const infoDiv = document.getElementById('account-info');
    if (!infoDiv) return;

    if (!authService.isAuthenticated()) {
         renderAuthForms(infoDiv);
         return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: authService.getHeaders()
        });

        if (response.status === 401 || response.status === 403 || response.status === 404) {
            authService.logout();
            renderAuthForms(infoDiv);
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const account: User = await response.json();
        authService.setUser(account); // Update local copy

        const name = [account.firstname, account.lastname].filter(Boolean).join(' ');

        infoDiv.innerHTML = `
            <div class="bg-white p-6 rounded shadow border max-w-md">
                <h2 class="text-xl font-semibold mb-4">Account Details</h2>
                <div class="mb-4">
                    <span class="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2 uppercase">${account.role}</span>
                </div>
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
                        <input type="text" id="name" value="${name || ''}" class="p-2 border rounded font-normal" />
                    </label>
                    <label class="flex flex-col gap-1 text-sm font-semibold">
                        New Password (leave blank to keep current)
                        <input type="password" id="password" placeholder="New Password" class="p-2 border rounded font-normal" />
                    </label>
                    <button type="submit" class="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition">Save Changes</button>
                </form>
                <p id="form-message" class="mt-2 text-sm hidden"></p>

                <div class="mt-8 border-t pt-4">
                    <button id="logout-button" class="bg-red-600 text-white p-2 rounded hover:bg-red-700 transition w-full">Logout</button>
                </div>
            </div>
        `;
        setupEditForm(infoDiv);

        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                authService.logout();
            });
        }
    } catch (error) {
        console.error('Failed to fetch account:', error);
        infoDiv.innerHTML = '<p class="text-red-500">Failed to load account details.</p>';
    }
}

function renderAuthForms(container: HTMLElement) {
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="bg-white p-6 rounded shadow border">
                <h2 class="text-xl font-semibold mb-4">Login</h2>
                <form id="login-form" class="flex flex-col gap-4">
                    <input type="text" id="login-identifier" placeholder="Username or Email" class="p-2 border rounded" required />
                    <input type="password" id="login-password" placeholder="Password" class="p-2 border rounded" required />
                    <label class="flex items-center gap-2 text-sm">
                        <input type="checkbox" id="login-remember" />
                        Remember me on this device
                    </label>
                    <button type="submit" class="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition">Login</button>
                </form>
                <p id="login-message" class="mt-2 text-sm hidden"></p>
            </div>

            <div class="bg-white p-6 rounded shadow border">
                <h2 class="text-xl font-semibold mb-4">Register</h2>
                <form id="register-form" class="flex flex-col gap-4">
                    <input type="email" id="reg-email" placeholder="Email" class="p-2 border rounded" required />
                    <input type="text" id="reg-username" placeholder="Username" class="p-2 border rounded" required />
                    <input type="text" id="reg-name" placeholder="Name (optional)" class="p-2 border rounded" />
                    <input type="password" id="reg-password" placeholder="Password" class="p-2 border rounded" required />
                    <select id="reg-role" class="p-2 border rounded" required>
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button type="submit" class="bg-green-600 text-white p-2 rounded hover:bg-green-700 transition">Register</button>
                </form>
                <p id="reg-message" class="mt-2 text-sm hidden"></p>
            </div>
        </div>
    `;

    setupAuthForms();
}

function setupAuthForms() {
    const loginForm = document.getElementById('login-form') as HTMLFormElement;
    const regForm = document.getElementById('register-form') as HTMLFormElement;

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = (document.getElementById('login-identifier') as HTMLInputElement).value;
            const password = (document.getElementById('login-password') as HTMLInputElement).value;
            const rememberMe = (document.getElementById('login-remember') as HTMLInputElement).checked;
            const msgEl = document.getElementById('login-message')!;

            try {
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, rememberMe })
                });

                if (response.ok) {
                    const data = await response.json();
                    authService.setToken(data.token, rememberMe);
                    authService.setUser(data.user);
                    // Reload page to reflect authenticated state
                    window.location.href = '/';
                } else {
                    const errorData = await response.json();
                    msgEl.textContent = errorData.error || 'Login failed.';
                    msgEl.className = 'mt-2 text-sm text-red-600 block';
                }
            } catch (err) {
                msgEl.textContent = 'An error occurred during login.';
                msgEl.className = 'mt-2 text-sm text-red-600 block';
            }
        });
    }

    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = (document.getElementById('reg-email') as HTMLInputElement).value;
            const username = (document.getElementById('reg-username') as HTMLInputElement).value;
            const name = (document.getElementById('reg-name') as HTMLInputElement).value;
            const password = (document.getElementById('reg-password') as HTMLInputElement).value;
            const role = (document.getElementById('reg-role') as HTMLSelectElement).value;
            const msgEl = document.getElementById('reg-message')!;

            try {
                const response = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, username, name, password, role })
                });

                if (response.ok) {
                    const data = await response.json();
                    authService.setToken(data.token, false);
                    authService.setUser(data.user);
                    window.location.href = '/';
                } else {
                    const errorData = await response.json();
                    msgEl.textContent = errorData.error || 'Registration failed.';
                    msgEl.className = 'mt-2 text-sm text-red-600 block';
                }
            } catch (err) {
                msgEl.textContent = 'An error occurred during registration.';
                msgEl.className = 'mt-2 text-sm text-red-600 block';
            }
        });
    }
}

function setupEditForm(container: HTMLElement) {
    const form = container.querySelector('#account-form') as HTMLFormElement;
    const messageEl = container.querySelector('#form-message') as HTMLElement;

    if (!form || !messageEl) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = (document.getElementById('email') as HTMLInputElement).value;
        const username = (document.getElementById('username') as HTMLInputElement).value;
        const nameInput = (document.getElementById('name') as HTMLInputElement).value;
        const passwordInput = (document.getElementById('password') as HTMLInputElement).value;
        const teacherSelect = document.getElementById('teacherId') as HTMLSelectElement;

        const data: any = {
            email,
            username,
            name: nameInput ? nameInput : null,
        };

        if (teacherSelect) {
            data.teacherId = teacherSelect.value;
        }

        if (passwordInput) {
            data.password = passwordInput;
        }

        try {
            const response = await fetch(`${API_URL}/account`, {
                method: 'PUT',
                headers: authService.getHeaders(),
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const updatedAccount = await response.json();
                authService.setUser(updatedAccount); // refresh cache
                messageEl.textContent = 'Account updated successfully!';
                messageEl.className = 'mt-2 text-sm text-green-600 block';
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
