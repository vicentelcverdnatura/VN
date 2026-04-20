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

        const currentText = JSON.stringify(this.getCurrentState(), null, 2);
        const originalText = JSON.stringify(this.originalJSON, null, 2);

        if (currentText === originalText) {
            viewer.innerHTML = `<span class="text-zinc-500">${currentText.replace(/</g, "&lt;")}</span>`;
            return;
        }

        if (typeof JsDiff === 'undefined') {
            viewer.textContent = currentText;
            return;
        }

        try {
            const diff = JsDiff.diffJson(this.originalJSON, this.getCurrentState());
            let html = '';
            diff.forEach(part => {
                const color = part.added ? 'text-green-400 bg-green-500/10' : 
                              part.removed ? 'text-red-400 bg-red-500/10 line-through' : 'text-zinc-400';
                html += `<span class="${color}">${part.value.replace(/</g, "&lt;")}</span>`;
            });
            viewer.innerHTML = html;
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

        this.addConsoleChat('Tú', `Para <b>${key}</b>: "${instruction}"`);
        
        try {
            let previewResult;
            // Try simulated local logic first for speed
            previewResult = this.simulateInterpretation(originalValue, instruction);
            
            // If local didn't change and instruction is complex, try AI
            if (previewResult === originalValue && instruction.length > 5) {
                this.addConsoleChat('🤖 Asistente IA', "Consultando modelo Gemini para interpretación compleja...");
                previewResult = await this.callAI(originalValue, instruction);
            }

            this.showPreviewPopover(anchorEl, key, originalValue, previewResult, () => {
                this.updateNodeValue(path, previewResult);
                this.addConsoleChat('🤖 Asistente IA', `Cambio aplicado en <b>${key}</b>.`);
                window.App?.showToast?.("Cambio aplicado", "success");
            });

        } catch (err) {
            this.addConsoleChat('Error', err.message);
        }
    }

    async applyRules() {
        const input = document.getElementById('json-global-prompt');
        const instruction = input?.value.trim();
        if (!instruction) return;

        const data = this.getCurrentState();
        this.addConsoleChat('Tú (Global)', instruction);
        
        const overlay = document.getElementById('json-loading-overlay');
        overlay?.classList.remove('hidden');
        overlay?.classList.add('flex');

        try {
            const result = await this.callAI(data, instruction, true);
            overlay?.classList.remove('flex');
            overlay?.classList.add('hidden');

            this.showPreviewPopover(null, 'GLOBAL', 'Documento Completo', `Transformación Aplicada: "${instruction}"`, () => {
                this.saveState(result);
                this.addConsoleChat('🤖 Asistente IA', "Transformación global completada satisfactoriamente.");
                if (input) input.value = '';
            });
        } catch (err) {
            overlay?.classList.remove('flex');
            overlay?.classList.add('hidden');
            this.addConsoleChat('Error', err.message);
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

    async callAI(context, instruction, isGlobal = false) {
        // Safe detection of the AI engine (names vary between Chrome versions)
        const aiEngine = window.ai?.languageModel || window.ai?.assistant;

        if (!aiEngine) {
            if (isGlobal) {
                console.warn("IA Local no detectada. Usando fallback de simulación básica para Global.");
                return context; // For global, we strictly return context if no real AI
            }
            return this.simulateInterpretation(context, instruction);
        }

        try {
            const capabilities = await aiEngine.capabilities();
            if (capabilities.available === 'no') {
                throw new Error("Modelo no descargado o no disponible.");
            }

            const session = await aiEngine.create();
            const prompt = isGlobal 
                ? `Transforma este JSON según la regla: "${instruction}". Devuelve SOLO el JSON resultante.\nJSON:\n${JSON.stringify(context)}`
                : `Modifica el valor "${context}" con la regla: "${instruction}". Responde SOLO el valor modificado.`;
            
            const response = await session.prompt(prompt);
            let cleaned = response.trim().replace(/^```json/, "").replace(/```$/, "").trim();
            
            try {
                return isGlobal ? JSON.parse(cleaned) : cleaned;
            } catch (e) {
                return cleaned;
            }
        } catch (err) {
            console.error("AI Model Error:", err);
            return isGlobal ? context : this.simulateInterpretation(context, instruction);
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

        // Close on click outside
        const outside = (e) => {
            if (!popover.contains(e.target) && !anchor.contains(e.target)) {
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
        const data = JSON.stringify(this.getCurrentState(), null, 4);
        const fileName = "VN_Refactored_" + new Date().getTime() + ".json";
        
        try {
            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: [{ accept: { 'application/json': ['.json'] } }] });
                const writable = await handle.createWritable();
                await writable.write(data);
                await writable.close();
                window.App?.showToast?.("Exportado con éxito", "success");
                return;
            }
        } catch(e) {}

        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.App?.showToast?.("Descargado en carpeta Descargas", "success");
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
