import Cookies from 'js-cookie';

export interface User {
    id: number;
    email: string;
    username: string;
    firstname: string | null;
    lastname: string | null;
    role: string;
    teacherId?: number | null;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const authService = {
    setToken(token: string, rememberMe: boolean = false) {
        if (rememberMe) {
            Cookies.set(TOKEN_KEY, token, { expires: 30 });
        } else {
            Cookies.set(TOKEN_KEY, token, { expires: 1 });
        }
    },

    getToken(): string | undefined {
        return Cookies.get(TOKEN_KEY);
    },

    removeToken() {
        Cookies.remove(TOKEN_KEY);
    },

    setUser(user: User) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    },

    getUser(): User | null {
        const userStr = localStorage.getItem(USER_KEY);
        if (!userStr) return null;
        try {
            return JSON.parse(userStr);
        } catch (e) {
            return null;
        }
    },

    removeUser() {
        localStorage.removeItem(USER_KEY);
    },

    isAuthenticated(): boolean {
        return !!this.getToken();
    },

    logout() {
        this.removeToken();
        this.removeUser();
        window.location.href = '/account';
    },

    getHeaders(): Record<string, string> {
        const token = this.getToken();
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };
    }
};
