// auth.js - Maneja la lógica de validación de usuarios

const Auth = {
    isAuthenticated: false,
    currentUser: null,

    init() {
        const loginForm = document.getElementById('login-form');
        const logoutBtn = document.getElementById('btn-logout');

        // Verificar si hay sesión previa guardada
        if (localStorage.getItem('auth_user') && localStorage.getItem('auth_token')) {
            this.loginSuccess(localStorage.getItem('auth_user'));
        }

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = document.getElementById('username').value.trim();
            const pass = document.getElementById('password').value.trim();

            this.attemptLogin(user, pass);
        });

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    },

    async attemptLogin(username, password) {
        const errorEl = document.getElementById('login-error');
        const lowerUser = username.toLowerCase();
        
        let isValid = false;

        // Validacion externa via archivo TOML (users.toml)
        try {
            const response = await fetch('./users.toml');
            if (response.ok) {
                const tomlText = await response.text();
                const lines = tomlText.split('\n');
                
                for (let line of lines) {
                    line = line.trim();
                    if (line.startsWith('#') || line.startsWith('[')) continue;
                    
                    const parts = line.split('=');
                    if (parts.length >= 2) {
                        const userKey = parts[0].trim().toLowerCase();
                        // Remover comillas y espacios
                        const passValRaw = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
                        // Soporte para contraseñas múltiples separadas por comas (ej. vicentelc)
                        const validPasswords = passValRaw.split(',').map(p => p.trim());
                        
                        if (userKey === lowerUser && validPasswords.includes(password)) {
                            isValid = true;
                            break;
                        }
                    }
                }
            } else {
                console.error("Fallo al cargar la base de credenciales locales (users.toml).");
            }
        } catch (e) {
            console.error("No se pudo acceder a users.toml", e);
        }

        if (isValid) {
            errorEl.classList.add('hidden');
            this.loginSuccess(lowerUser);
        } else {
            errorEl.classList.remove('hidden');
            // Shake effect
            const box = document.querySelector('#login-view .relative');
            box.style.transform = 'translate(-10px, 0)';
            setTimeout(() => box.style.transform = 'translate(10px, 0)', 100);
            setTimeout(() => box.style.transform = 'translate(-10px, 0)', 200);
            setTimeout(() => box.style.transform = 'translate(0, 0)', 300);
        }
    },

    loginSuccess(username) {
        this.isAuthenticated = true;
        this.currentUser = username;
        localStorage.setItem('auth_user', username);
        localStorage.setItem('auth_token', 'mock_token_' + Date.now());

        document.getElementById('current-user-display').textContent = username;

        // Ocultar login y mostrar app con animación
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
        document.getElementById('app-view').classList.add('animate-slide-up');

        // Inicializar App
        if (window.App) window.App.init();
    },

    logout() {
        this.isAuthenticated = false;
        this.currentUser = null;
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_token');

        document.getElementById('login-view').classList.remove('hidden');
        document.getElementById('app-view').classList.add('hidden');

        // Limpiar campos form
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('login-error').classList.add('hidden');
    }
};

window.addEventListener('DOMContentLoaded', () => Auth.init());
