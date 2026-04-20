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

        this.initUserMgmt();
    },

    async attemptLogin(username, password) {
        const errorEl = document.getElementById('login-error');
        const lowerUser = username.toLowerCase();
        
        let isValid = false;

        // Credenciales desde localStorage + base (incluye usuarios creados en Gestion de Usuarios)
        const localCredentials = this.getStoredUsers();

        // Solo intentar fetch si la app está servida bajo HTTP/HTTPS real (no file://)
        const isHttpServed = ['http:', 'https:'].includes(window.location.protocol);
        
        if (isHttpServed) {
            try {
                const response = await fetch('./users.toml');
                if (response.ok) {
                    const tomlText = await response.text();
                    const lines = tomlText.split('\n');
                    for (let line of lines) {
                        line = line.trim();
                        if (!line || line.startsWith('#') || line.startsWith('[')) continue;
                        const eqIdx = line.indexOf('=');
                        if (eqIdx === -1) continue;
                        const userKey = line.substring(0, eqIdx).trim().toLowerCase();
                        const passValRaw = line.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
                        const validPasswords = passValRaw.split(',').map(p => p.trim());
                        if (userKey === lowerUser && validPasswords.includes(password)) {
                            isValid = true;
                            break;
                        }
                    }
                }
            } catch (e) {
                console.warn('users.toml no accesible via HTTP, usando credenciales locales.', e);
            }
        }

        // Fallback/Primary en protocolo file://
        if (!isValid) {
            isValid = !!(localCredentials[lowerUser] && localCredentials[lowerUser].includes(password));
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

    // ---- GESTION DE USUARIOS ----
    GLOBAL_ADMIN_PASS: 'F0rm4C10VN', // También en users.toml (fuente de verdad en HTTP)

    getStoredUsers() {
        // Leer usuarios de localStorage (persistencia local)
        const raw = localStorage.getItem('vn_users');
        const stored = raw ? JSON.parse(raw) : {};
        
        // Merge con credenciales base del sistema
        const base = { admin: ['12345'], vicentelc: ['admin', '12345'] };
        return Object.assign({}, base, stored);
    },

    saveStoredUsers(users) {
        localStorage.setItem('vn_users', JSON.stringify(users));
    },

    initUserMgmt() {
        const modal       = document.getElementById('user-mgmt-modal');
        const btnOpen     = document.getElementById('btn-open-user-mgmt');
        const btnClose    = document.getElementById('btn-close-user-mgmt');
        const btnVerify   = document.getElementById('btn-verify-admin');
        const btnSave     = document.getElementById('btn-save-user');
        const step1       = document.getElementById('user-mgmt-step1');
        const step2       = document.getElementById('user-mgmt-step2');
        const errorEl     = document.getElementById('user-mgmt-error');
        const successEl   = document.getElementById('user-mgmt-success');
        const successMsg  = document.getElementById('user-mgmt-success-msg');
        const adminInput  = document.getElementById('global-admin-pass');

        const openModal = () => {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            step1.classList.remove('hidden');
            step2.classList.add('hidden');
            errorEl.classList.add('hidden');
            successEl.classList.add('hidden');
            adminInput.value = '';
            if (window.lucide) window.lucide.createIcons({ root: modal });
        };

        const closeModal = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        };

        btnOpen?.addEventListener('click', openModal);
        btnClose?.addEventListener('click', closeModal);
        modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        // Verificar contraseña global admin
        btnVerify?.addEventListener('click', () => {
            const pass = adminInput.value.trim();
            if (pass === this.GLOBAL_ADMIN_PASS) {
                errorEl.classList.add('hidden');
                step1.classList.add('hidden');
                step2.classList.remove('hidden');
                this.renderUsersList();
                if (window.lucide) window.lucide.createIcons({ root: step2 });
            } else {
                errorEl.classList.remove('hidden');
                adminInput.value = '';
                adminInput.focus();
            }
        });

        // Enter en campo admin-pass
        adminInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnVerify?.click();
        });

        // Guardar usuario nuevo o actualizado
        btnSave?.addEventListener('click', () => {
            const usernameVal = document.getElementById('mgmt-username').value.trim().toLowerCase();
            const passwordVal = document.getElementById('mgmt-password').value.trim();

            if (!usernameVal || !passwordVal) {
                successEl.classList.add('hidden');
                return;
            }

            const users = this.getStoredUsers();
            const isNew = !users[usernameVal];
            users[usernameVal] = [passwordVal];
            this.saveStoredUsers(users);
            
            document.getElementById('mgmt-username').value = '';
            document.getElementById('mgmt-password').value = '';
            successMsg.textContent = isNew
                ? `Usuario "${usernameVal}" creado correctamente.`
                : `Contraseña de "${usernameVal}" actualizada.`;
            successEl.classList.remove('hidden');
            this.renderUsersList();
            if (window.lucide) window.lucide.createIcons({ root: step2 });
        });
    },

    renderUsersList() {
        const container = document.getElementById('users-list');
        if (!container) return;
        const users = this.getStoredUsers();
        container.innerHTML = '';
        Object.keys(users).forEach(u => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between px-3 py-2 bg-zinc-950/60 border border-zinc-800 rounded-lg';
            row.innerHTML = `
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-lime-500/20 flex items-center justify-center">
                        <i data-lucide="user" class="w-3 h-3 text-lime-400"></i>
                    </div>
                    <span class="text-sm text-white font-medium">${u}</span>
                </div>
                <button class="btn-delete-user text-xs text-red-500 hover:text-red-400 transition" data-user="${u}">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>`;
            container.appendChild(row);
        });

        // Bind delete buttons
        container.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetUser = btn.getAttribute('data-user');
                // Proteger usuarios base no borrables
                if (['admin'].includes(targetUser)) {
                    alert('El usuario "admin" es el usuario del sistema y no puede eliminarse.');
                    return;
                }
                const users = this.getStoredUsers();
                delete users[targetUser];
                this.saveStoredUsers(users);
                this.renderUsersList();
                if (window.lucide) window.lucide.createIcons({ root: document.getElementById('users-list') });
            });
        });
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
