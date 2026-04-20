// json-refactor.js - Lógica para el Refactorizador de JSON Asistido por IA
// Totalmente reconstruido para asegurar robustez y funcionalidad interactiva

class JSONRefactorer {
    constructor() {
        this.originalJSON = null;
        this.history = [];
        this.currentIndex = -1;
        this.prompts = {}; // store prompts by path, e.g., "root.employee.name": "uppercase"
        this.editMode = false;
        this.pendingAction = null;
    }

    init() {
        this.bindEvents();
        this.loadInitialJSON();
    }

    bindEvents() {
        const safeAddEvent = (id, event, callback) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, callback);
        };

        safeAddEvent('json-btn-undo', 'click', () => this.undo());
        safeAddEvent('json-btn-redo', 'click', () => this.redo());
        safeAddEvent('json-btn-apply', 'click', () => this.applyRules());
        safeAddEvent('json-btn-export', 'click', () => this.exportJSON());
        safeAddEvent('btn-load-json', 'click', () => document.getElementById('json-file-input')?.click());
        safeAddEvent('json-btn-load-new', 'click', () => document.getElementById('json-file-input')?.click());
        
        const fileInput = document.getElementById('json-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        const globalPrompt = document.getElementById('json-global-prompt');
        if (globalPrompt) {
            globalPrompt.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.applyRules();
                }
            });
        }

        const editSwitch = document.getElementById('json-mode-edit');
        const btnSaveManual = document.getElementById('json-btn-save-manual');
        const treeContainer = document.getElementById('json-tree-container');
        if (editSwitch) {
            editSwitch.addEventListener('change', (e) => {
                const isEdit = e.target.checked;
                if (isEdit) {
                    btnSaveManual?.classList.remove('hidden');
                    treeContainer?.classList.add('json-edit-mode');
                } else {
                    btnSaveManual?.classList.add('hidden');
                    treeContainer?.classList.remove('json-edit-mode');
                }
            });
        }

        safeAddEvent('json-btn-save-manual', 'click', () => this.saveManualChanges());

        // Reload File Events
        safeAddEvent('json-btn-reload', 'click', () => {
            if (confirm("¿Estás seguro? Se perderán todos los cambios no exportados y se forzará la recarga original del archivo.")) {
                localStorage.removeItem('cachedJSON');
                this.history = [];
                this.currentIndex = -1;
                this.prompts = {};
                this.loadInitialJSON();
            }
        });
        
        // Help Modal Events
        safeAddEvent('json-btn-help', 'click', () => document.getElementById('json-help-modal')?.classList.remove('hidden'));
        safeAddEvent('json-btn-close-help', 'click', () => document.getElementById('json-help-modal')?.classList.add('hidden'));

        // Console Copy
        safeAddEvent('json-btn-copy-debug', 'click', () => {
            const con = document.getElementById('json-ai-debugger-console');
            if (con) {
                const text = con.innerText || con.textContent || '';
                navigator.clipboard.writeText(text).then(() => {
                    window.App?.showToast?.("Log de consola copiado", "success");
                });
            }
        });

        // Supabase Sync
        safeAddEvent('json-btn-supabase-sync', 'click', () => this.syncSupabase());

        // Panel Resizer
        const resizer = document.getElementById('json-resizer');
        const leftPanel = document.getElementById('json-left-panel');
        const rightPanel = document.getElementById('json-right-panel');
        const container = document.getElementById('json-split-container');
        let isDragging = false;
        
        if (resizer && leftPanel && container && rightPanel) {
            resizer.addEventListener('mousedown', (e) => {
                isDragging = true;
                document.body.style.cursor = 'col-resize';
                resizer.classList.add('bg-lime-500');
                e.preventDefault();
            });
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const containerRect = container.getBoundingClientRect();
                let newWidthPercentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
                if (newWidthPercentage < 15) newWidthPercentage = 15;
                if (newWidthPercentage > 85) newWidthPercentage = 85;
                leftPanel.style.flex = `0 0 ${newWidthPercentage}%`;
                rightPanel.style.flex = `1 1 0%`;
            });
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.style.cursor = '';
                    resizer.classList.remove('bg-lime-500');
                }
            });
        }
    }

    async loadInitialJSON() {
        try {
            // 1. Check LocalStorage
            const cached = localStorage.getItem('cachedJSON');
            if (cached) {
                const data = JSON.parse(cached);
                this.originalJSON = JSON.parse(JSON.stringify(data));
                this.history = [];
                this.currentIndex = -1;
                this.saveState(data);
                this.hideWelcomeModal();
                return;
            }

            // 2. Attempt load default (try multiple paths)
            const pathsToTry = ['./jsoncreated/1497524_PAK.json', './1497524_PAK.json'];
            let data = null;

            for (const path of pathsToTry) {
                try {
                    const response = await fetch(path);
                    if (response.ok) {
                        data = await response.json();
                        break;
                    }
                } catch (e) {}
            }

            if (data) {
                this.originalJSON = JSON.parse(JSON.stringify(data));
                localStorage.setItem('cachedJSON', JSON.stringify(data));
                this.saveState(data);
                this.hideWelcomeModal();
            } else {
                this.showWelcomeModal();
            }
        } catch (error) {
            this.showWelcomeModal();
        }
    }

    showWelcomeModal() {
        const modal = document.getElementById('json-welcome-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    hideWelcomeModal() {
        const modal = document.getElementById('json-welcome-modal');
        if (modal) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.originalJSON = JSON.parse(JSON.stringify(data));
                this.history = [];
                this.currentIndex = -1;
                this.prompts = {};
                
                localStorage.setItem('cachedJSON', JSON.stringify(data));
                this.hideWelcomeModal();
                this.saveState(data);
                window.App?.showToast?.('Archivo JSON cargado exitosamente', 'success');
            } catch (err) {
                alert('El archivo seleccionado no es un JSON válido.');
            }
        };
        reader.readAsText(file);
    }

    saveState(data) {
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }
        this.history.push(JSON.parse(JSON.stringify(data)));
        this.currentIndex++;
        this.updateUI();
    }

    getCurrentState() {
        return this.history[this.currentIndex];
    }

    undo() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateUI();
        }
    }

    redo() {
        if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            this.updateUI();
        }
    }

    updateUI() {
        const btnUndo = document.getElementById('json-btn-undo');
        const btnRedo = document.getElementById('json-btn-redo');
        if (btnUndo) btnUndo.disabled = this.currentIndex <= 0;
        if (btnRedo) btnRedo.disabled = this.currentIndex >= this.history.length - 1;
        
        this.renderTree();
        this.renderDiff();
    }

    renderTree() {
        const container = document.getElementById('json-tree-container');
        if (!container) return;
        container.innerHTML = '';
        
        const data = this.getCurrentState();
        if (!data) return;

        const rootEl = this.buildTreeNode('root', data, 'root', true);
        container.appendChild(rootEl);

        if (window.lucide) window.lucide.createIcons({ root: container });
    }

    buildTreeNode(key, value, path, expanded = true) {
        const node = document.createElement('div');
        node.className = 'ml-4 mt-2 mb-2 font-mono text-sm';
        
        const isObjectOrArray = value !== null && typeof value === 'object';
        const isArray = Array.isArray(value);

        const header = document.createElement('div');
        header.className = 'flex items-center space-x-2 group relative';

        let toggleBtn = '';
        if (isObjectOrArray) {
            toggleBtn = `<button class="p-1 text-zinc-500 hover:text-lime-400 transition-colors shrink-0 tree-toggle-btn">
                            <i data-lucide="${expanded ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4"></i>
                         </button>`;
        } else {
            toggleBtn = `<div class="w-6 shrink-0"></div>`;
        }

        const typeColor = isArray ? 'text-blue-400' : isObjectOrArray ? 'text-purple-400' : 
                          typeof value === 'string' ? 'text-green-400' : 
                          typeof value === 'number' ? 'text-orange-400' : 'text-red-400';

        let valueHtml = '';
        if (isObjectOrArray) {
            const displayValue = isArray ? '[ ... ]' : '{ ... }';
            valueHtml = `<span class="${typeColor} truncate max-w-[200px]">${displayValue}</span>`;
        } else {
            const displayValue = JSON.stringify(value);
            let strVal = typeof value === 'string' ? value.replace(/"/g, '&quot;') : value;
            valueHtml = `
                <span class="${typeColor} truncate max-w-[200px] display-value-span">${displayValue}</span>
                <input type="text" data-manual-path="${path}" value="${strVal}" class="manual-value-input px-2 py-0.5 ml-2 text-xs text-white bg-zinc-850 border border-zinc-700 rounded focus:border-lime-500 focus:outline-none w-48">
            `;
        }

        header.innerHTML = `
            ${toggleBtn}
            <span class="text-white font-bold">${key}:</span>
            ${valueHtml}
        `;
        
        // AI Prompt Input
        const currentPrompt = this.prompts[path] || '';
        const inputDiv = document.createElement('div');
        inputDiv.className = `ml-4 flex-1 max-w-xs flex items-center transition-opacity duration-200 prompt-input-container ${currentPrompt ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`;
        inputDiv.innerHTML = `
            <input type="text" data-path="${path}" value="${currentPrompt}"
                   class="prompt-input flex-1 px-2 py-1 text-xs text-lime-100 bg-zinc-800 border border-zinc-700 rounded-l-md focus:outline-none focus:border-lime-500" 
                   placeholder="AI Prompt...">
            <button class="node-ai-inline-btn px-2 py-1 bg-lime-500/10 hover:bg-lime-500/30 border border-zinc-700 border-l-0 rounded-r-md text-lime-400 transition" data-path="${path}" data-key="${key}">
                <i data-lucide="zap" class="w-4 h-4 pointer-events-none"></i>
            </button>
        `;
        header.appendChild(inputDiv);
        node.appendChild(header);

        // Events
        const promptInput = inputDiv.querySelector('.prompt-input');
        const aiBtn = inputDiv.querySelector('.node-ai-inline-btn');
        
        if (promptInput && aiBtn) {
            promptInput.addEventListener('change', (e) => this.prompts[path] = e.target.value.trim());
            promptInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.applyInlineRule(path, key, value, promptInput.value.trim(), aiBtn);
            });
            aiBtn.addEventListener('click', () => this.applyInlineRule(path, key, value, promptInput.value.trim(), aiBtn));
        }

        if (isObjectOrArray) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = `border-l border-zinc-700/50 ml-3 pl-1 ${expanded ? 'block' : 'hidden'}`;
            
            if (isArray) {
                value.forEach((v, i) => childrenContainer.appendChild(this.buildTreeNode(i.toString(), v, `${path}[${i}]`, false)));
            } else {
                Object.keys(value).forEach(k => childrenContainer.appendChild(this.buildTreeNode(k, value[k], `${path}.${k}`, false)));
            }
            node.appendChild(childrenContainer);

            const tBtn = header.querySelector('.tree-toggle-btn');
            if (tBtn) {
                tBtn.addEventListener('click', () => {
                    const isHidden = childrenContainer.classList.contains('hidden');
                    childrenContainer.classList.toggle('hidden');
                    childrenContainer.classList.toggle('block');
                    tBtn.innerHTML = `<i data-lucide="${isHidden ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4"></i>`;
                    if (window.lucide) window.lucide.createIcons({ root: tBtn });
                });
            }
        }

        return node;
    }

    renderDiff() {
        const viewer = document.getElementById('json-diff-viewer');
        if (!viewer) return;

        const currentData = this.getCurrentState();
        const currentText = JSON.stringify(currentData, null, 4);
        const originalText = JSON.stringify(this.originalJSON, null, 4);

        if (currentText === originalText) {
            viewer.innerHTML = `<div class="text-zinc-500 italic p-2 opacity-50">// No hay cambios respecto al archivo original</div><div class="p-2">${currentText.replace(/</g, "&lt;")}</div>`;
            return;
        }

        if (typeof JsDiff === 'undefined') {
            viewer.innerHTML = `<div class="text-orange-400 p-2">JsDiff no detectado. Mostrando JSON actual:</div><pre class="p-2">${currentText.replace(/</g, "&lt;")}</pre>`;
            return;
        }

        try {
            const diff = JsDiff.diffJson(this.originalJSON, currentData);
            let html = '<div class="bg-zinc-950/50 p-2 border-b border-zinc-800 mb-2 text-[10px] uppercase font-bold text-zinc-500 tracking-widest flex items-center justify-between"><span>Comparativa de Cambios (Unified Diff)</span><span class="text-lime-500">Documento en Memoria</span></div>';
            
            diff.forEach(part => {
                const escapedValue = part.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                if (part.added) {
                    html += `<div class="bg-green-500/10 text-green-400 px-1 border-l-2 border-green-500 font-bold"><span class="opacity-50 mr-2 font-mono">+</span>${escapedValue}</div>`;
                } else if (part.removed) {
                    html += `<div class="bg-red-500/10 text-red-400 px-1 border-l-2 border-red-500 line-through opacity-70"><span class="opacity-50 mr-2 font-mono">-</span>${escapedValue}</div>`;
                } else {
                    html += `<div class="text-zinc-500 px-1 opacity-50"><span class="opacity-0 mr-2"> </span>${escapedValue}</div>`;
                }
            });
            
            viewer.innerHTML = `<div class="font-mono text-[11px] leading-tight">${html}</div>`;
        } catch (e) {
            viewer.textContent = currentText;
        }
    }

    // --- AI LOGIC ---

    async applyInlineRule(path, key, originalValue, instruction, anchorEl) {
        if (!instruction) {
            window.App?.showToast?.("Ingresa una instrucción.", "warning");
            return;
        }

        this.addConsoleChat('Tú', `<b>${key}</b>: "${instruction}"`);
        this.addConsoleChat('🤖 Gemini', `Analizando el campo <b>${key}</b> con valor <code>${JSON.stringify(originalValue)}</code>...`);
        
        const overlay = document.getElementById('json-loading-overlay');
        overlay?.classList.remove('hidden');
        overlay?.classList.add('flex');

        try {
            const previewResult = await this.callAI(originalValue, instruction, false);
            overlay?.classList.remove('flex');
            overlay?.classList.add('hidden');

            const changed = JSON.stringify(previewResult) !== JSON.stringify(originalValue);
            if (!changed) {
                this.addConsoleChat('🤖 Gemini', `He analizado el valor y no detecté cambios necesarios con esa instrucción. ¿Puedes reformularla?`);
                window.App?.showToast?.("La IA no detectó cambios para esa instrucción.", "warning");
                return;
            }

            this.addConsoleChat('🤖 Gemini', `He entendido la instrucción. Propongo cambiar <b>${key}</b> de <span class="text-red-400">${JSON.stringify(originalValue)}</span> a <span class="text-lime-400">${JSON.stringify(previewResult)}</span>. Confirma para aplicar.`);

            this.showPreviewPopover(anchorEl, key, originalValue, previewResult, () => {
                this.updateNodeValue(path, previewResult);
                this.addConsoleChat('🤖 Gemini', `✅ Cambio aplicado en <b>${key}</b>.`);
                window.App?.showToast?.("Cambio aplicado con éxito", "success");
            });

        } catch (err) {
            overlay?.classList.remove('flex');
            overlay?.classList.add('hidden');
            this.addConsoleChat('Error IA', err.message);
            window.App?.showToast?.("Error en la IA: " + err.message, "error");
        }
    }

    async applyRules() {
        const input = document.getElementById('json-global-prompt');
        const instruction = input?.value.trim();
        if (!instruction) {
            window.App?.showToast?.("Escribe una instrucción en el Master Prompt.", "warning");
            return;
        }

        const data = this.getCurrentState();
        const keyList = Array.isArray(data)
            ? Object.keys(data[0] || {}).slice(0, 15).join(', ')
            : Object.keys(data).slice(0, 15).join(', ');

        this.addConsoleChat('Tú (Global)', instruction);
        this.addConsoleChat('🤖 Gemini',
            `He recibido tu instrucción. Voy a analizar el JSON completo y generar la transformación.<br>` +
            `<span class="text-zinc-500">Campos detectados: ${keyList}...</span>`);
        
        const overlay = document.getElementById('json-loading-overlay');
        overlay?.classList.remove('hidden');
        overlay?.classList.add('flex');

        try {
            const result = await this.callAI(data, instruction, true);
            overlay?.classList.remove('flex');
            overlay?.classList.add('hidden');

            this.addConsoleChat('🤖 Gemini', `Transformación calculada. Revisa el resultado antes de confirmar.`);

            this.showPreviewPopover(null, 'GLOBAL', 'Documento Completo', `Instrucción ejecutada: "${instruction}"`, () => {
                this.saveState(result);
                this.addConsoleChat('🤖 Gemini', '✅ Transformación global aplicada al documento.');
                if (input) input.value = '';
            });
        } catch (err) {
            overlay?.classList.remove('flex');
            overlay?.classList.add('hidden');
            this.addConsoleChat('Error IA', err.message);
            window.App?.showToast?.("Error de la IA: " + err.message, "error");
        }
    }

    updateNodeValue(path, newValue) {
        const data = JSON.parse(JSON.stringify(this.getCurrentState()));
        const pathParts = path.split(/[\.\[\]]+/).filter(Boolean);
        
        let curr = data;
        for (let i = 1; i < pathParts.length - 1; i++) {
            curr = curr[pathParts[i]];
        }
        const lastKey = pathParts[pathParts.length - 1];
        curr[lastKey] = newValue;
        
        this.saveState(data);
    }

    simulateInterpretation(currentValue, instruction) {
        if (!instruction || currentValue === undefined) return currentValue;
        
        const isNumeric = typeof currentValue === 'number';
        const isString = typeof currentValue === 'string';
        let res = currentValue;
        
        const lowerInst = instruction.toLowerCase().trim();
        
        // 1. Sustitución Parcial: "Sustituye 'rojo' por 'verde'"
        // Captura: Sustituye [texto original] por [texto nuevo]
        const replaceMatch = instruction.match(/(?:sustitu[iy]e[r]?|cambi[aeo][r]?|reemplaz[aeo][r]?)\s+(?:el\s+|la\s+|los\s+|las\s+)?["']?(.*?)["']?\s+(?:por|a)\s+["']?(.*?)["']?$/i);
        
        // 2. Sobrescritura Total (SET): "Pon 'Hola'", "Cambia a 'Valencia'", "Todo como 'Activo'"
        const setMatch = instruction.match(/^(?:pon(?:er)?|escribe(?:r)?|todo\s+como|todo\s+a|establece(?:r)?|fija(?:r)?|cambia(?:\s+todo)?\s+(?:a|por))\s+["']?(.*?)["']?$/i);
        
        // 3. Operaciones matemáticas: "+ 50", "* 1.10", "Añade 5"
        const mathMatch = instruction.match(/(?:calcula(?:r)?|suma(?:r)?|multiplica(?:r)?|divide|resta(?:r)?|anade)?\s*([\+\-\*\/])\s*([\d\.,]+)/i);

        if (mathMatch && isNumeric) {
            const op = mathMatch[1];
            const num = parseFloat(mathMatch[2].replace(',', '.'));
            if (op === '+') res = currentValue + num;
            if (op === '-') res = currentValue - num;
            if (op === '*') res = currentValue * num;
            if (op === '/') res = currentValue / num;
        }
        else if (replaceMatch && isString) {
            const toFind = replaceMatch[1].trim();
            const toReplace = replaceMatch[2].trim();
            // Reemplazo global en la cadena
            res = currentValue.replace(new RegExp(this.escapeRegExp(toFind), 'g'), toReplace);
        }
        else if (setMatch) {
            let newVal = setMatch[1].trim();
            // Intentar preservar tipo si el valor parece número
            if (!isNaN(newVal.replace(',', '.')) && newVal !== "") {
                res = parseFloat(newVal.replace(',', '.'));
            } else {
                res = newVal;
            }
        }
        else if (lowerInst.includes("extraer") && (lowerInst.includes("número") || lowerInst.includes("numero")) && isString) {
            res = currentValue.replace(/[^0-9]/g, '');
        }
        else if ((lowerInst.includes("mayúscula") || lowerInst.includes("upper")) && isString) {
            res = currentValue.toUpperCase();
        }
        else if ((lowerInst.includes("minúscula") || lowerInst.includes("lower")) && isString) {
            res = currentValue.toLowerCase();
        }
        else if (lowerInst.includes("trim") || lowerInst.includes("limpiar")) {
            res = isString ? currentValue.trim() : currentValue;
        }
        else if (lowerInst.includes("iva") && isNumeric) {
            res = Number(parseFloat((currentValue * 1.21).toFixed(2)));
        }

        return res;
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // =============================================
    // MOTOR IA — Gemini REST API
    // =============================================

    getGeminiApiKey() {
        return localStorage.getItem('vn_gemini_api_key') || '';
    }

    promptForApiKey() {
        const current = this.getGeminiApiKey();
        const key = window.prompt(
            '🤖 Introduce tu API Key de Gemini (se guarda sólo en tu navegador):\n' +
            'Obténla gratis en: https://aistudio.google.com/apikey',
            current
        );
        if (key && key.trim()) {
            localStorage.setItem('vn_gemini_api_key', key.trim());
            return key.trim();
        }
        return current;
    }

    async callGeminiAPI(promptText) {
        let apiKey = this.getGeminiApiKey();
        if (!apiKey) {
            apiKey = this.promptForApiKey();
        }
        if (!apiKey) throw new Error('Se necesita una API Key de Gemini. Concígurala intro en el campo de prompt.');

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        
        const body = {
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
        };

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err?.error?.message || `Error HTTP ${res.status}`);
        }

        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    async callAI(context, instruction, isGlobal = false) {
        try {
            let prompt;

            if (isGlobal) {
                // Análisis de estructura + transformación masiva
                const keys = Array.isArray(context)
                    ? Object.keys(context[0] || {}).slice(0, 20)
                    : Object.keys(context).slice(0, 20);

                prompt = `Eres un experto en archivos JSON y transformación de datos estructurados.

Se te proporciona un archivo JSON. Tu tarea es aplicar la siguiente instrucción de forma inteligente a todos los valores relevantes del JSON:

**INSTRUCCIÓN DEL USUARIO:** "${instruction}"

**ESTRUCTURA** (primeras claves detectadas): ${keys.join(', ')}

**JSON COMPLETO:**
${JSON.stringify(context, null, 2)}

**REGLAS ESTRICTAS:**
1. Devuelve ÚNICAMENTE el JSON transformado y válido. Sin explicaciones, sin markdown, sin comentarios.
2. Respeta la estructura original exacta (claves, tipos, anidamiento).
3. Sólo modifica los valores que correspondan según la instrucción.
4. Si la instrucción no aplica a un campo, deja ese campo exactamente igual.
5. El JSON resultante debe comenzar con { o [ directamente.`;

                const raw = await this.callGeminiAPI(prompt);
                let cleaned = raw.trim()
                    .replace(/^```json\s*/i, '')
                    .replace(/^```\s*/i, '')
                    .replace(/\s*```$/i, '')
                    .trim();
                return JSON.parse(cleaned);

            } else {
                // Transformación de un único valor
                const tipo = typeof context;
                prompt = `Eres un experto en transformación de datos de archivos JSON.

Debes modificar un único valor siguiendo la instrucción del usuario.

**NOMBRE DEL CAMPO:** Desconocido (aplica la regla al valor directamente)
**VALOR ACTUAL:** ${JSON.stringify(context)}
**TIPO DE DATO:** ${tipo}
**INSTRUCCIÓN:** "${instruction}"

**REGLAS ESTRICTAS:**
1. Responde ÚNICAMENTE con el valor transformado. Cero texto adicional, cero explicaciones.
2. Si el tipo es string, devuelve el texto directamente sin comillas adicionales.
3. Si el tipo es number, devuelve solo el número.
4. Si no es posible aplicar la instrucción a este valor, devuelve el valor original exacto.
5. Si la instrucción pide sustituir texto, busca en la cadena y reemplaza todas las ocurrencias.

Valor resultante:`;

                let raw = await this.callGeminiAPI(prompt);
                raw = raw.trim();

                // Intentar preservar tipo numérico
                if (tipo === 'number') {
                    const num = parseFloat(raw);
                    return isNaN(num) ? context : num;
                }
                // Intentar preservar tipo booleano
                if (tipo === 'boolean') {
                    if (raw.toLowerCase() === 'true') return true;
                    if (raw.toLowerCase() === 'false') return false;
                }
                // Intentar parsear JSON si la respuesta parece un objeto/array
                if (raw.startsWith('{') || raw.startsWith('[')) {
                    try { return JSON.parse(raw); } catch(e) {}
                }
                return raw;
            }
        } catch (err) {
            console.error('Gemini API Error:', err);
            // Fallback local si falla la API
            if (!isGlobal) return this.simulateInterpretation(context, instruction);
            throw err;
        }
    }

    showPreviewPopover(anchor, key, oldVal, newVal, onConfirm) {
        document.querySelectorAll('.ai-preview-popover').forEach(p => p.remove());

        const isGlobal = !anchor;
        const popover = document.createElement('div');
        popover.className = 'ai-preview-popover fixed z-[100] bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-6 w-96 animate-in fade-in zoom-in duration-300';
        
        if (isGlobal) {
            // Center on screen
            popover.style.top = '50%';
            popover.style.left = '50%';
            popover.style.transform = 'translate(-50%, -50%)';
            popover.classList.add('border-lime-500/50');
        } else {
            const rect = anchor.getBoundingClientRect();
            popover.style.top = `${rect.bottom + 10}px`;
            popover.style.left = `${rect.left}px`;
        }

        popover.innerHTML = `
            <div class="text-xs font-bold text-lime-400 mb-2 uppercase tracking-widest flex items-center">
                <i data-lucide="eye" class="w-3 h-3 mr-1"></i> Vista Previa IA
            </div>
            <div class="mb-3">
                <p class="text-[10px] text-zinc-500 mb-1">Nodo: ${key}</p>
                <div class="flex items-center gap-2 text-xs">
                    <div class="flex-1 p-2 bg-red-500/10 border border-red-500/20 rounded line-through text-red-400 truncate">${JSON.stringify(oldVal)}</div>
                    <i data-lucide="arrow-right" class="w-3 h-3 text-zinc-600"></i>
                    <div class="flex-1 p-2 bg-green-500/10 border border-green-500/20 rounded text-green-400 truncate">${JSON.stringify(newVal)}</div>
                </div>
            </div>
            <div class="flex gap-2">
                <button class="flex-1 py-2 text-xs font-bold text-zinc-400 bg-zinc-800 rounded-lg hover:text-white" id="prev-cancel">Cancelar</button>
                <button class="flex-1 py-2 text-xs font-bold text-zinc-950 bg-lime-400 rounded-lg hover:bg-lime-500" id="prev-apply">Aplicar</button>
            </div>
        `;
        document.body.appendChild(popover);
        if (window.lucide) window.lucide.createIcons({ root: popover });

        popover.querySelector('#prev-cancel').onclick = () => popover.remove();
        popover.querySelector('#prev-apply').onclick = () => {
            onConfirm();
            popover.remove();
        };

        // Close on click outside (safe with optional anchor)
        const outside = (e) => {
            const clickedAnchor = anchor && anchor.contains(e.target);
            if (!popover.contains(e.target) && !clickedAnchor) {
                popover.remove();
                document.removeEventListener('mousedown', outside);
            }
        };
        document.addEventListener('mousedown', outside);
    }

    addConsoleChat(sender, htmlContent) {
        const consoleEl = document.getElementById('json-ai-debugger-console');
        const wrapper = document.getElementById('json-ai-debugger-wrapper');
        if (!consoleEl) return;
        
        wrapper?.classList.remove('hidden');
        wrapper?.classList.add('flex');

        const msg = document.createElement('div');
        msg.className = "flex flex-col border-l-2 pl-3 py-1 " + (sender === 'Tú' ? 'border-zinc-700' : 'border-lime-500');
        msg.innerHTML = `<span class="text-[10px] font-bold uppercase text-zinc-500 mb-1">${sender}</span><div class="text-sm text-zinc-300 font-sans">${htmlContent}</div>`;
        consoleEl.appendChild(msg);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    saveManualChanges() {
        const inputs = document.querySelectorAll('.manual-value-input');
        const data = JSON.parse(JSON.stringify(this.getCurrentState()));

        inputs.forEach(input => {
            const path = input.getAttribute('data-manual-path');
            const val = input.value;
            const pathParts = path.split(/[\.\[\]]+/).filter(Boolean);
            
            let curr = data;
            for (let i = 1; i < pathParts.length - 1; i++) {
                curr = curr[pathParts[i]];
            }
            const lastKey = pathParts[pathParts.length - 1];
            
            // Try type persistence
            const oldVal = curr[lastKey];
            if (typeof oldVal === 'number') curr[lastKey] = parseFloat(val);
            else if (typeof oldVal === 'boolean') curr[lastKey] = (val === 'true');
            else curr[lastKey] = val;
        });

        this.saveState(data);
        window.App?.showToast?.("Cambios manuales guardados", "success");
    }

    async exportJSON() {
        const currentData = this.getCurrentState();
        const jsonData = JSON.stringify(currentData, null, 4);
        const fileName = "VN_Produccion_" + new Date().toISOString().split('T')[0] + ".json";
        
        try {
            // Intentar guardado directo (File System API)
            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({ 
                    suggestedName: fileName, 
                    types: [{ description: 'Archivo JSON', accept: { 'application/json': ['.json'] } }] 
                });
                const writable = await handle.createWritable();
                await writable.write(jsonData);
                await writable.close();
                
                // Actualizar originalJSON al guardar (Consolidar)
                this.originalJSON = JSON.parse(JSON.stringify(currentData));
                this.updateUI();
                
                window.App?.showToast?.("Archivo JSON guardado y consolidado correctamente", "success");
                return;
            }
        } catch(e) {
            if (e.name === 'AbortError') return;
            console.warn("No se pudo usar FileSystem API:", e);
        }

        // Fallback: Descarga tradicional
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        window.App?.showToast?.("JSON generado en tu carpeta de Descargas", "success");
    }

    async syncSupabase() {
        window.App?.showToast?.("Sincronización simulada (Faltan API Keys)", "info");
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.jsonRefactorer = new JSONRefactorer();
        window.jsonRefactorer.init();
    }, 200);
});
