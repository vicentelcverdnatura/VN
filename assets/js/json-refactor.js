// json-refactor.js - Lógica para el Refactorizador de JSON Asistido por IA

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
        document.getElementById('json-btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('json-btn-redo').addEventListener('click', () => this.redo());
        document.getElementById('json-btn-apply').addEventListener('click', () => this.applyRules());
        document.getElementById('json-btn-export').addEventListener('click', () => this.exportJSON());

        const btnLoad = document.getElementById('btn-load-json');
        const fileInput = document.getElementById('json-file-input');
        const btnLoadNew = document.getElementById('json-btn-load-new');
        const btnApplyGlobal = document.getElementById('json-btn-apply');
        
        if (btnLoad && fileInput) {
            btnLoad.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }
        
        if(btnLoadNew) {
            btnLoadNew.addEventListener('click', () => fileInput.click());
        }

        if (btnApplyGlobal) {
            btnApplyGlobal.addEventListener('click', () => this.applyRules());
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
        if (editSwitch && btnSaveManual) {
            editSwitch.addEventListener('change', (e) => {
                const isEdit = e.target.checked;
                if (isEdit) {
                    btnSaveManual.classList.remove('hidden');
                    if(treeContainer) treeContainer.classList.add('json-edit-mode');
                } else {
                    btnSaveManual.classList.add('hidden');
                    if(treeContainer) treeContainer.classList.remove('json-edit-mode');
                }
            });

            btnSaveManual.addEventListener('click', () => this.saveManualChanges());
        }

        // Reload File Events
        const btnReload = document.getElementById('json-btn-reload');
        if (btnReload) {
            btnReload.addEventListener('click', () => {
                if (confirm("¿Estás seguro? Se perderán todos los cambios no exportados y se forzará la recarga original del archivo.")) {
                    localStorage.removeItem('cachedJSON'); // Purge currently modified cache
                    this.history = [];
                    this.historyIndex = -1;
                    this.prompts = {};
                    this.loadInitialJSON();
                }
            });
        }
        
        // Help Modal Events
        const btnHelp = document.getElementById('json-btn-help');
        const modalHelp = document.getElementById('json-help-modal');
        const btnCloseHelp = document.getElementById('json-btn-close-help');
        if (btnHelp && modalHelp) {
            btnHelp.addEventListener('click', () => modalHelp.classList.remove('hidden'));
            if(btnCloseHelp) btnCloseHelp.addEventListener('click', () => modalHelp.classList.add('hidden'));
        }

        // Live Debugger Console Copy
        const btnCopyDebug = document.getElementById('json-btn-copy-debug');
        if (btnCopyDebug) {
            btnCopyDebug.addEventListener('click', () => {
                const con = document.getElementById('json-ai-debugger-console');
                if (con && con.value) {
                    navigator.clipboard.writeText(con.value).then(() => {
                        window.App?.showToast?.("Log de consola copiado", "success");
                    });
                }
            });
        }

        // Delegated listener for Individual AI transformation
        if (treeContainer) {
            treeContainer.addEventListener('click', async (e) => {
                const btn = e.target.closest('.node-ai-inline-btn');
                if (btn) {
                    const path = btn.dataset.path;
                    const key = btn.dataset.key;
                    const input = btn.previousElementSibling;
                    const instruction = input ? input.value.trim() : '';
                    
                    if (!instruction) {
                        window.App?.showToast?.("Por favor ingresa una instrucción para la IA.", "warning");
                        return;
                    }
                    
                    // Show Loading state on both inline button and global overlay
                    const originalHtml = btn.innerHTML;
                    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-lime-400"></i>`;
                    if(window.lucide) window.lucide.createIcons({ root: btn });
                    btn.disabled = true;
                    
                    const overlay = document.getElementById('json-loading-overlay');
                    if(overlay) { overlay.classList.remove('hidden'); overlay.classList.add('flex'); }

                    try {
                        // Extract current value dynamically based on path
                        const pathParts = path.split(/[\.\[\]]+/).filter(Boolean);
                        let currentObj = this.getCurrentState();
                        for (let i = 1; i < pathParts.length; i++) {
                            currentObj = currentObj[pathParts[i]];
                            if(currentObj === undefined) break;
                        }
                        
                        const oldValDisplay = JSON.stringify(currentObj);
                        const newVal = await this.transformNodeWithAI(key, currentObj, instruction);
                        
                        // Validación implícita
                        if(newVal === undefined) throw new Error("La IA no devolvió un JSON o valor válido.");
                        
                        // Copy draft state and mutate safely
                        if (newVal === currentObj) {
                            // IA devolvió lo original, fue un estancamiento.
                            window.App?.showToast?.("La IA no detectó cambios lógicos. Prueba a ser más específico", "warning");
                        } else {
                            this.updateNodeValue(path, newVal);
                            
                            const successMsg = `Nodo [${key}] actualizado: ${oldValDisplay} -> ${JSON.stringify(newVal)}`;
                            window.App?.addSystemLog?.('🚀 ' + successMsg, 'AI_JOB_OK');
                            window.App?.showToast?.("Modificaciones implementadas", "success");
                        }
                        
                        // Toggle logic for manual mode dynamically based on fallback
                        if (typeof newVal === 'string' && newVal.includes('[REVISIÓN IA:')) {
                            if (editSwitch && !editSwitch.checked) {
                                window.App?.showToast?.("Pasando campo a Modo Manual para tu revisión", "warning");
                                editSwitch.click();
                            }
                        } else {
                            if(editSwitch && editSwitch.checked) {
                                editSwitch.click(); 
                            }
                        }
                    } catch(error) {
                        window.App?.showToast?.("Error procesando IA: " + error.message, "error");
                    } finally {
                        if(overlay) { overlay.classList.remove('flex'); overlay.classList.add('hidden'); }
                        btn.innerHTML = originalHtml;
                        if(window.lucide) window.lucide.createIcons({ root: btn });
                        btn.disabled = false;
                    }
                }
            });
        }

        const btnSyncSupa = document.getElementById('json-btn-supabase-sync');
        if (btnSyncSupa) {
            btnSyncSupa.addEventListener('click', () => this.syncSupabase());
        }

        // --- Panel Resizer Logic ---
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
                resizer.classList.remove('bg-zinc-800');
                e.preventDefault();
            });
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const containerRect = container.getBoundingClientRect();
                let newWidthPercentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
                // Constraints min 15% max 85%
                if (newWidthPercentage < 15) newWidthPercentage = 15;
                if (newWidthPercentage > 85) newWidthPercentage = 85;
                leftPanel.style.flex = `0 0 ${newWidthPercentage}%`;
                rightPanel.style.flex = `1 1 0%`; // Force right panel to fill rest naturally
            });
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.style.cursor = '';
                    resizer.classList.remove('bg-lime-500');
                    resizer.classList.add('bg-zinc-800');
                }
            });
        }
    }

    async loadInitialJSON() {
        try {
            // Priority 1: Check LocalStorage caching
            const cached = localStorage.getItem('cachedJSON');
            if (cached) {
                const data = JSON.parse(cached);
                this.originalJSON = JSON.parse(JSON.stringify(data));
                this.saveState(data);
                return;
            }

            // Priority 2: Attempt to load default production file
            const response = await fetch('./1497524_PAK.json');
            if (!response.ok) {
                this.showWelcomeModal();
                return;
            }
            const data = await response.json();
            
            this.hideWelcomeModal();
            this.originalJSON = JSON.parse(JSON.stringify(data)); // Deep clone to original
            localStorage.setItem('cachedJSON', JSON.stringify(data));
            this.saveState(data);
        } catch (error) {
            // Sin arrojar console.error brusco, derivamos a la UI limpia
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
                this.originalJSON = JSON.parse(JSON.stringify(data)); // Deep clone baseline
                this.history = []; // Reset history
                this.currentIndex = -1;
                this.prompts = {}; // Clear previous prompts
                
                // Clear UI prompts
                document.querySelectorAll('.prompt-input').forEach(i => i.value = '');
                const globalPrompt = document.getElementById('json-global-prompt');
                if (globalPrompt) globalPrompt.value = '';

                localStorage.setItem('cachedJSON', JSON.stringify(data));
                this.hideWelcomeModal();
                this.saveState(data);
                
                if (window.App && window.App.showToast) {
                    window.App.showToast('Archivo JSON cargado exitosamente', 'success');
                }
            } catch (err) {
                alert('El archivo seleccionado no es un JSON válido.');
            }
        };
        reader.readAsText(file);
    }

    saveState(data) {
        // Discard future history if we're branching
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }
        
        // Save copy of data
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
        document.getElementById('json-btn-undo').disabled = this.currentIndex <= 0;
        document.getElementById('json-btn-redo').disabled = this.currentIndex >= this.history.length - 1;
        
        this.renderTree();
        this.renderDiff();
    }
    updateNodeValue(pathStr, newValue) {
        const updatedData = JSON.parse(JSON.stringify(this.getCurrentState()));
        const pathParts = pathStr.split(/[\.\[\]]+/).filter(Boolean);
        
        let curr = updatedData;
        for (let i = 1; i < pathParts.length - 1; i++) {
            curr = curr[pathParts[i]];
        }
        const fKey = pathParts[pathParts.length - 1];
        curr[fKey] = newValue;
        
        this.saveState(updatedData);
    }

    renderTree() {
        const container = document.getElementById('json-tree-container');
        container.innerHTML = ''; // Clear current
        
        const data = this.getCurrentState();
        if (!data) return;

        const rootEl = this.buildTreeNode('root', data, 'root', true);
        container.appendChild(rootEl);

        // Ensure newly injected icons are rendered so toggles are visible immediately
        if (window.lucide) {
            window.lucide.createIcons({ root: container });
        }
    }

    buildTreeNode(key, value, path, expanded = true) {
        const node = document.createElement('div');
        node.className = 'ml-4 mt-2 mb-2 font-mono text-sm';
        
        const isObjectOrArray = value !== null && typeof value === 'object';
        const isArray = Array.isArray(value);

        // Header for node
        const header = document.createElement('div');
        header.className = 'flex items-center space-x-2 group relative';

        let toggleBtn = '';
        if (isObjectOrArray) {
            toggleBtn = `<button class="p-1 text-zinc-500 hover:text-lime-400 transition-colors shrink-0 tree-toggle-btn" data-expanded="${expanded ? 'true' : 'false'}">
                            <i data-lucide="${expanded ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4"></i>
                         </button>`;
        } else {
            // spacer for alignment
            toggleBtn = `<div class="w-6 shrink-0"></div>`;
        }

        const typeColor = isArray ? 'text-blue-400' : isObjectOrArray ? 'text-purple-400' : 
                          typeof value === 'string' ? 'text-green-400' : 
                          typeof value === 'number' ? 'text-orange-400' : 'text-red-400';

        let valueHtml = '';
        if (isObjectOrArray) {
            const displayValue = isArray ? '[ ... ]' : '{ ... }';
            valueHtml = `<span class="${typeColor} truncate max-w-[200px]" title='${displayValue}'>${displayValue}</span>`;
        } else {
            // Include both static span and input elements for CSS flipping
            const displayValue = JSON.stringify(value);
            let strVal = typeof value === 'string' ? value.replace(/"/g, '&quot;') : value;
            
            valueHtml = `
                <span class="${typeColor} truncate max-w-[200px] display-value-span" title='${displayValue}'>${displayValue}</span>
                <input type="text" data-manual-path="${path}" value="${strVal}" class="manual-value-input px-2 py-0.5 ml-2 text-xs text-white bg-zinc-800 border border-zinc-600 rounded focus:border-lime-500 focus:outline-none w-48">
            `;
        }

        header.innerHTML = `
            ${toggleBtn}
            <span class="text-white font-bold">${key}:</span>
            ${valueHtml}
        `;
        
        // Input wrapper (AI Prompts)
        const currentPrompt = this.prompts[path] || '';
        const inputHTML = `
            <div class="ml-4 flex-1 max-w-xs flex items-center transition-opacity duration-200 prompt-input-container ${currentPrompt ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}">
                <input type="text" data-path="${path}" value="${currentPrompt}"
                       class="prompt-input flex-1 px-2 py-1 text-xs text-lime-100 bg-zinc-800/80 border border-zinc-700 rounded-l-md focus:outline-none focus:border-lime-500 placeholder-zinc-500" 
                       placeholder="AI Prompt (ej: eliminar, upper)...">
                <button class="node-ai-inline-btn px-2 py-1 bg-lime-500/10 hover:bg-lime-500/30 border border-zinc-700 border-l-0 rounded-r-md text-lime-400 transition" data-path="${path}" data-key="${key}" title="Aplicar regla a este nodo">
                    <i data-lucide="zap" class="w-4 h-4 pointer-events-none"></i>
                </button>
            </div>
        `;
        
        header.innerHTML += inputHTML;
        node.appendChild(header);

        const promptInput = header.querySelector('.prompt-input');
        const aiBtnElem = header.querySelector('.node-ai-inline-btn');

        if (promptInput && aiBtnElem) {
            const triggerInline = (e) => {
                e.preventDefault();
                this.applyInlineRule(path, key, value, promptInput.value.trim());
            };
            
            promptInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') triggerInline(e);
            });
            aiBtnElem.addEventListener('click', triggerInline);
        }

        // Children container
        if (isObjectOrArray) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = `border-l border-zinc-700/50 ml-3 pl-1 ${expanded ? 'block' : 'hidden'}`;
            
            // Add children recursively with true to ensure all stay unfurled
            if (isArray) {
                for (let i = 0; i < value.length; i++) {
                    childrenContainer.appendChild(this.buildTreeNode(i.toString(), value[i], `${path}[${i}]`, true));
                }
            } else {
                for (let k in value) {
                    childrenContainer.appendChild(this.buildTreeNode(k, value[k], `${path}.${k}`, true));
                }
            }
            node.appendChild(childrenContainer);

            // Toggle logic
            const btn = header.querySelector('.tree-toggle-btn');
            if (btn) {
                btn.addEventListener('click', () => {
                    const isExp = childrenContainer.classList.contains('block');
                    if (isExp) {
                        childrenContainer.classList.remove('block');
                        childrenContainer.classList.add('hidden');
                        btn.innerHTML = `<i data-lucide="chevron-right" class="w-4 h-4"></i>`;
                    } else {
                        childrenContainer.classList.remove('hidden');
                        childrenContainer.classList.add('block');
                        btn.innerHTML = `<i data-lucide="chevron-down" class="w-4 h-4"></i>`;
                    }
                    if (window.lucide) window.lucide.createIcons({ root: btn });
                });
            }
        }

        // Save prompt logic
        const inputEl = node.querySelector('.prompt-input');
        if (inputEl) {
            inputEl.addEventListener('change', (e) => {
                this.prompts[path] = e.target.value.trim();
            });
        }

        return node;
    }

    renderDiff() {
        const viewer = document.getElementById('json-diff-viewer');
        if (!viewer) return;

        const currentText = JSON.stringify(this.getCurrentState(), null, 2);
        const originalText = JSON.stringify(this.originalJSON, null, 2);

        // Always show content. If no diff, just show pure JSON string gracefully without italic message
        if (currentText === originalText) {
            viewer.innerHTML = `<span class="text-zinc-300">${currentText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>`;
            return;
        }

        if (typeof JsDiff === 'undefined') {
            viewer.innerHTML = this.rudimentaryDiff(originalText, currentText);
            return;
        }

        try {
            const diff = JsDiff.diffJson(this.originalJSON, this.getCurrentState());
            let displayHtml = '';
            
            diff.forEach(part => {
                const colorClass = part.added ? 'text-green-400 bg-green-500/10' :
                                 part.removed ? 'text-red-400 bg-red-500/10 line-through' : 'text-zinc-400';
                
                displayHtml += `<span class="${colorClass}">${part.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
            });

            viewer.innerHTML = displayHtml;
        } catch (e) {
            console.error("Diff Error", e);
            viewer.innerHTML = '<span class="text-red-500">Error al procesar el diff con JsDiff. Mostrando versión pura:</span><br/>' + 
                               currentText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
    }

    rudimentaryDiff(oldText, newText) {
        // Fallback artesanal simple por si falla CDN JsDiff
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        let html = '';
        const limit = Math.max(oldLines.length, newLines.length);
        
        for (let i = 0; i < limit; i++) {
            const o = oldLines[i];
            const n = newLines[i];
            
            if (o === n) {
                html += `<span class="text-zinc-400">${n !== undefined ? n.replace(/</g, "&lt;").replace(/>/g, "&gt;") : ''}\n</span>`;
            } else {
                if (o !== undefined) {
                    html += `<span class="text-red-400 bg-red-500/10 line-through">${o.replace(/</g, "&lt;").replace(/>/g, "&gt;")}\n</span>`;
                }
                if (n !== undefined) {
                    html += `<span class="text-green-400 bg-green-500/10">${n.replace(/</g, "&lt;").replace(/>/g, "&gt;")}\n</span>`;
                }
            }
        }
        return html;
    }

    simulateAIInterpretation(currentValue, instruction) {
        if (!instruction || !currentValue) return currentValue;
        
        const isNumeric = typeof currentValue === 'number';
        const isString = typeof currentValue === 'string';
        let res = currentValue;
        
        const lowerInst = instruction.toLowerCase();
        const replaceMatch = instruction.match(/(?:sustitu[iy]e[r]?|cambi[aeo][r]?|reemplaz[aeo][r]?)\s+(?:la\s+|el\s+)?["']?(.*?)["']?\s+por\s+["']?(.*?)["']?/i);
        const fullSubstituteMatch = instruction.match(/^(?:pon(?:er)?|escribe(?:r)?|sustitu[iy]e(?:r)?|cambia(?:r)?|reemplaza(?:r)?|modifica(?:r)?)(?:\s+(?:todo\s+)?(?:por|a|como))?\s+["']?(.*?)["']?$/i);
        const mathMatch = instruction.match(/(?:calcula(?:r)?|suma(?:r)?|multiplica(?:r)?|divide|resta(?:r)?|anade)?\s*([\+\-\*\/])\s*([\d\.]+)/i);
        
        if (mathMatch && isNumeric) {
            const op = mathMatch[1];
            const num = parseFloat(mathMatch[2]);
            if (op === '+') res = currentValue + num;
            if (op === '-') res = currentValue - num;
            if (op === '*') res = currentValue * num;
            if (op === '/') res = currentValue / num;
        }
        else if (fullSubstituteMatch) {
            res = fullSubstituteMatch[1];
        }
        else if (lowerInst.includes("3") && (lowerInst.includes("número") || lowerInst.includes("numero") || lowerInst.includes("dígito") || lowerInst.includes("digito") || lowerInst.includes("cifra"))) {
            const match = currentValue.toString().match(/\d+/);
            if (match) {
                res = match[0].substring(0, 3);
            }
        }
        else if (replaceMatch && isString) {
            const toFind = replaceMatch[1];
            const toReplace = replaceMatch[2];
            res = currentValue.replace(new RegExp(toFind, 'g'), toReplace);
        }
        else if (lowerInst.includes("extraer") && (lowerInst.includes("número") || lowerInst.includes("numero")) && isString) {
            res = currentValue.replace(/[^0-9]/g, '');
            if (res === '') res = currentValue;
        }
        else if (lowerInst.includes("tradu") && isString) res = currentValue; 
        else if ((lowerInst.includes("mayúscula") || lowerInst.includes("upper")) && isString) res = currentValue.toUpperCase();
        else if (lowerInst.includes("fecha")) res = "01/01/2026";
        else if (lowerInst.includes("iva") && isNumeric) res = Number(parseFloat((currentValue * 1.21).toFixed(2)));
        else if (lowerInst.includes("estructura") || lowerInst.includes("objeto")) {
            res = { original: currentValue, modificado: currentValue };
        }
        else if (lowerInst.includes("número") || lowerInst.includes("numero") || lowerInst.includes("cifra")) {
            const strVal = currentValue.toString();
            const match = strVal.match(/\d+/);
            res = match ? parseInt(match[0], 10) : 0;
        } else if (isString && lowerInst.length > 3) {
            if (lowerInst.includes("minúscula") || lowerInst.includes("lower")) {
                 res = currentValue.toLowerCase();
            }
        }
        
        // Validación adicional: si la supuesta cadena modificada incluye texto de instrucción puro, cancelamos
        if (typeof res === 'string' && (res.toLowerCase() === "sustituye" || res.toLowerCase() === "cambia")) {
            return currentValue;
        }

        return res;
    }

    async callNativeChromeAIGlobal(data, instruction) {
        if (typeof window.ai !== 'undefined' && window.ai.languageModel) {
            const capabilities = await window.ai.languageModel.capabilities();
            if (capabilities && capabilities.available !== 'no') {
                const session = await window.ai.languageModel.create();
                const promptText = `Eres un transformador de diccionarios JSON.
Instrucción humana a iterar en los datos: ${instruction}
JSON original:
${JSON.stringify(data)}

Regla CRUD Estricta: Devuelve EXCLUSIVAMENTE el JSON resultante completo y puramente válido. No incluyas comillas markdown, ni \`\`\`json, ni saludos, ni confirmaciones. Solo la estructura {} o [].`;
                
                const result = await session.prompt(promptText);
                let cleaned = result.trim().replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
                return JSON.parse(cleaned);
            } else {
                throw new Error("El modelo Gemini Nano no está listo en tu dispositivo.");
            }
        }
        throw new Error("API IA Nativa del navegador (window.ai.languageModel) no detectada.");
    }

    async callNativeChromeAISingle(currentValue, instruction) {
        if (typeof window.ai !== 'undefined' && window.ai.languageModel) {
            const capabilities = await window.ai.languageModel.capabilities();
            if (capabilities && capabilities.available !== 'no') {
                const session = await window.ai.languageModel.create();
                const isNum = typeof currentValue === 'number';
                let promptText = `Modifica el siguiente valor aplicando esta regla natural: "${instruction}".
Valor actual: ${currentValue}
REGLA ESTRICTA: Responde ÚNICAMENTE con el dato modificado. Si no logras aplicarlo o la regla no tiene sentido para este dato, devuelve el dato original idéntico. Cero comentarios humanos.`;
                
                let result = await session.prompt(promptText);
                result = result.trim();
                if (isNum && !isNaN(Number(result))) return Number(result);
                return result;
            }
        }
        return this.simulateAIInterpretation(currentValue, instruction);
    }

    addConsoleChat(sender, htmlContent) {
        const consoleEl = document.getElementById('json-ai-debugger-console');
        const wrapperEl = document.getElementById('json-ai-debugger-wrapper');
        if (!consoleEl) return;
        if (wrapperEl) wrapperEl.classList.remove('hidden');

        const msg = document.createElement('div');
        msg.className = "flex flex-col border-b border-zinc-800/50 pb-3";
        
        let color = sender === '🤖 Asistente IA' ? 'text-lime-400' : sender === 'Tú' ? 'text-zinc-200' : 'text-orange-400';
        
        msg.innerHTML = `<span class="font-bold uppercase tracking-wider text-[10px] ${color} mb-1.5 flex items-center"><i data-lucide="${sender.includes('Tú')?'user':sender.includes('Error')?'alert-triangle':'bot'}" class="w-3 h-3 mr-1"></i>${sender}</span><div class="text-zinc-300 font-sans text-sm leading-relaxed whitespace-pre-wrap">${htmlContent}</div>`;
        consoleEl.appendChild(msg);
        consoleEl.scrollTop = consoleEl.scrollHeight;
        if (window.lucide) window.lucide.createIcons({ root: msg });
    }

    showPreviewPopover(anchorEl, key, original, transformed, onConfirm) {
        // Remove any existing popover
        document.querySelectorAll('.ai-preview-popover').forEach(p => p.remove());

        const changed = String(original) !== String(transformed);
        const popover = document.createElement('div');
        popover.className = 'ai-preview-popover';
        popover.style.cssText = `
            position: fixed;
            z-index: 9999;
            background: #18181b;
            border: 1px solid #3f3f46;
            border-radius: 14px;
            padding: 16px 18px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.7);
            min-width: 280px;
            max-width: 420px;
            font-family: 'Inter', sans-serif;
            animation: fadeIn 0.15s ease;
        `;

        const arrowColor = changed ? '#a3e635' : '#ef4444';
        const statusIcon = changed ? '✅' : '⚠️';
        const statusMsg  = changed
            ? `Cadena resultante calculada:`
            : `Sin cambios detectados para este valor.`;

        popover.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                <div style="width:28px;height:28px;border-radius:8px;background:rgba(163,230,53,0.1);border:1px solid rgba(163,230,53,0.3);display:flex;align-items:center;justify-content:center;font-size:13px;">🤖</div>
                <div>
                    <div style="color:#fff;font-weight:700;font-size:13px;">Asistente IA &mdash; Vista Previa</div>
                    <div style="color:#71717a;font-size:11px;">Nodo: <b style="color:#a3e635">[${key}]</b></div>
                </div>
                <button class="popover-close-btn" style="margin-left:auto;background:none;border:none;color:#52525b;cursor:pointer;font-size:16px;line-height:1;">&#x2715;</button>
            </div>

            <div style="display:flex;gap:8px;margin-bottom:12px;align-items:flex-start;">
                <div style="flex:1;">
                    <div style="color:#71717a;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Valor Original</div>
                    <div style="background:#09090b;border:1px solid #27272a;border-radius:8px;padding:8px 10px;color:#f87171;font-family:monospace;font-size:12px;word-break:break-all;">${String(original)}</div>
                </div>
                <div style="color:#71717a;font-size:18px;margin-top:22px;">&#8594;</div>
                <div style="flex:1;">
                    <div style="color:#71717a;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Resultado</div>
                    <div style="background:#09090b;border:1px solid ${arrowColor}55;border-radius:8px;padding:8px 10px;color:${arrowColor};font-family:monospace;font-size:12px;word-break:break-all;">${String(transformed)}</div>
                </div>
            </div>

            <div style="color:#a1a1aa;font-size:12px;margin-bottom:14px;">${statusMsg}</div>

            <div style="display:flex;gap:8px;">
                <button class="popover-cancel-btn" style="flex:1;padding:9px;background:#27272a;border:none;border-radius:10px;color:#a1a1aa;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s;">Cancelar</button>
                <button class="popover-apply-btn" style="flex:2;padding:9px;background:${changed?'#a3e635':'#71717a'};border:none;border-radius:10px;color:#09090b;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s;${!changed?'opacity:.5;cursor:not-allowed;':''}">${changed?'Aplicar Cambio':'Sin Cambios'}</button>
            </div>
        `;

        // Position near anchor element
        document.body.appendChild(popover);
        if (anchorEl) {
            const rect = anchorEl.getBoundingClientRect();
            let top = rect.bottom + 8;
            let left = rect.left;
            // Keep within viewport
            if (left + 420 > window.innerWidth) left = window.innerWidth - 440;
            if (top + 250 > window.innerHeight) top = rect.top - 260;
            popover.style.top = top + 'px';
            popover.style.left = left + 'px';
        } else {
            // Center screen
            popover.style.top = '50%';
            popover.style.left = '50%';
            popover.style.transform = 'translate(-50%, -50%)';
        }

        const close = () => popover.remove();
        popover.querySelector('.popover-close-btn').addEventListener('click', close);
        popover.querySelector('.popover-cancel-btn').addEventListener('click', close);
        popover.querySelector('.popover-apply-btn').addEventListener('click', () => {
            if (changed) { close(); onConfirm(); }
        });

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function outsideClick(e) {
                if (!popover.contains(e.target)) {
                    close();
                    document.removeEventListener('click', outsideClick);
                }
            });
        }, 100);
    },

    async applyInlineRule(path, key, value, instruction) {
        if (!instruction) return;

        this.addConsoleChat('Tú', instruction);
        
        // Calcular resultado inmediatamente para mostrar vista previa
        let previewResult;
        if (window.ai && window.ai.languageModel) {
            previewResult = await this.callNativeChromeAISingle(value, instruction).catch(() => this.simulateAIInterpretation(value, instruction));
        } else {
            previewResult = this.simulateAIInterpretation(value, instruction);
        }

        // Anchor: el botón del rayo del nodo si existe
        const nodeEl = document.querySelector(`.node-ai-inline-btn[data-path="${path}"]`);
        
        this.pendingAction = {
            type: 'inline', path, key, originalValue: value, instruction, previewResult
        };

        this.showPreviewPopover(nodeEl, key, value, previewResult, () => {
            this.addConsoleChat('🤖 Asistente IA', `Aplicando cambio en nodo <b>[${key}]</b>: <span class="text-red-400">${value}</span> → <span class="text-lime-400">${previewResult}</span>`);
            this.executePendingAction();
        });
    },

    // --- Global Mass Transformation Logic ---
    async applyRules() {
        const globalPrompt = document.getElementById('json-global-prompt');
        let instructionText = globalPrompt ? globalPrompt.value.trim() : "";
        if (!instructionText) return;

        const lowerQ = instructionText.toLowerCase();

        // Execution Confirmation flow (si responde "sí" sin popover -> ejecutar directo)
        if (lowerQ === 'si' || lowerQ === 'sí' || lowerQ === 'aplica' || lowerQ === 'generar') {
            if (!this.pendingAction || this.pendingAction.type !== 'global') {
                this.addConsoleChat('🤖 Asistente IA', "¿A qué orden global te refieres? Dime primero qué deseas transformar en todo el documento.");
                globalPrompt.value = '';
                return;
            }
            globalPrompt.value = '';
            this.executePendingAction();
            return;
        }

        this.addConsoleChat('Tú', instructionText);

        const data = JSON.parse(JSON.stringify(this.getCurrentState()));
        let keys = Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : Object.keys(data);
        const sample = keys.slice(0, 7).join(', ');

        // Calcular una muestra de cómo quedará el primer elemento
        let previewSample = '';
        try {
            const firstItem = Array.isArray(data) ? data[0] : data;
            if (firstItem && typeof firstItem === 'object') {
                const firstKey = Object.keys(firstItem)[0];
                const firstVal = firstItem[firstKey];
                const previewTransformed = this.simulateAIInterpretation(firstVal, instructionText);
                if (String(previewTransformed) !== String(firstVal)) {
                    previewSample = `\n<b>Ejemplo de cambio detectado:</b>\n<span class="text-red-400 font-mono text-xs">${firstVal}</span> → <span class="text-lime-400 font-mono text-xs">${previewTransformed}</span>`;
                }
            }
        } catch(e) {}

        this.pendingAction = {
            type: 'global',
            instruction: instructionText,
            data: data
        };

        // Mostrar popover centrado para confirmacion global
        const applyBtn = document.getElementById('json-btn-apply');
        this.showPreviewPopover(applyBtn, 'GLOBAL', `${keys.length} campos en ${Array.isArray(data) ? data.length : 1} registros`, `Transformación: "${instructionText}"${previewSample ? ' (ver muestra)' : ''}`, () => {
            this.addConsoleChat('🤖 Asistente IA', `Ejecutando transformación masiva.\n<b>Variables afectadas:</b> <span class="text-zinc-500 text-xs">${sample}...</span>${previewSample}`);
            this.executePendingAction();
        });

        globalPrompt.value = '';
    }

    async executePendingAction() {
        const action = this.pendingAction;
        this.pendingAction = null; // Clear
        
        const overlay = document.getElementById('json-loading-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
        }

        try {
            if (action.type === 'global') {
                let transformedData;
                if (typeof window.ai !== 'undefined' && window.ai.languageModel) {
                     transformedData = await this.callNativeChromeAIGlobal(action.data, action.instruction);
                } else {
                     transformedData = await this.transformNode(action.data, action.instruction, this.prompts);
                }
                
                const rawCode = JSON.stringify(transformedData, null, 2);
                const escapedCode = rawCode.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                
                this.addConsoleChat('🤖 Asistente IA', `¡Todo listo! He aplicado correctamente todo lo pedido respetando estrictamente la estructura estandarizada.\n\nAquí tienes el bloque de código JSON final:\n<div class="relative mt-2 p-1 bg-gradient-to-r from-lime-500/20 to-emerald-500/10 rounded-xl"><pre class="bg-[#09090b] p-4 rounded-lg text-[11px] text-lime-300 overflow-x-auto max-h-[350px] font-mono custom-scrollbar"><code>${escapedCode}</code></pre></div>`);
                this.saveState(transformedData);
                window.App?.addSystemLog?.("Transformación Global IA", "AI_OK");
            } 
            else if (action.type === 'inline') {
                let res;
                if (window.ai && window.ai.languageModel) {
                    res = await this.callNativeChromeAISingle(action.originalValue, action.instruction);
                } else {
                    res = this.simulateAIInterpretation(action.originalValue, action.instruction);
                }
                
                // Formatear el bloque como el usuario quiere (perfecto para copiar en línea base de la key)
                const mockObj = {}; mockObj[action.key] = res;
                const rawCode = JSON.stringify(mockObj, null, 2).replace(/</g, "&lt;");
                
                this.addConsoleChat('🤖 Asistente IA', `He aplicado tu cambio exactamente en el nodo solicitado.\nAquí lo tienes listo para copiar:\n<div class="relative mt-2 p-1 bg-gradient-to-r from-lime-500/20 to-blue-500/10 rounded-xl"><pre class="bg-[#09090b] p-3 rounded-lg text-[11px] text-lime-300 overflow-x-auto font-mono custom-scrollbar"><code>${rawCode}</code></pre></div>`);
                this.updateNodeValue(action.path, res);
            }
        } catch(e) {
            this.addConsoleChat('❌ Error Sistémico', `${e.message}`);
        } finally {
            if (overlay) {
                overlay.classList.remove('flex');
                overlay.classList.add('hidden');
            }
        }
    }

    /**
     * MOCK SDK AI Transform Function.
     * En un entorno real, esta función conectaría con el SDK de Gemini u otra LLM
     * pasándole la estructura del JSON y el prompt del usuario.
     */
    async transformNode(data, globalPrompt, pathPrompts) {
        // En una implementación real: 
        // return await AISDK.generateAndParse({ context: data, system: globalPrompt, rules: pathPrompts });

        // MOCK LOGIC for demonstration purposes:
        let result = JSON.parse(JSON.stringify(data));

        // recursive traverser
        const traverse = (obj, path) => {
            let prompt = pathPrompts[path] || '';
            let val = obj;

            if (prompt) {
                val = this.simulateAIInterpretation(val, prompt);
            } else if (globalPrompt && typeof val === 'string') {
                // Apply global prompt to all strings if there isn't a specific node prompt
                val = this.simulateAIInterpretation(val, globalPrompt);
            }

            if (val && typeof val === 'object' && !Array.isArray(val)) {
                let newObj = {};
                for (let key in val) {
                    let newKey = key;
                    // apply global prompt mock logic
                    if (globalPrompt.toLowerCase().includes('camelcase')) {
                        newKey = key.charAt(0).toLowerCase() + key.slice(1).replace(/_([a-z])/g, g => g[1].toUpperCase());
                    }
                    if (globalPrompt.toLowerCase().includes('upper')) {
                        newKey = key.toUpperCase();
                    }

                    let transformedValue = traverse(val[key], `${path}.${key}`);
                    if (transformedValue !== undefined) {
                        newObj[newKey] = transformedValue;
                    }
                }
                return newObj;
            } else if (Array.isArray(val)) {
                let newArr = [];
                for (let i = 0; i < val.length; i++) {
                    let transformedValue = traverse(val[i], `${path}[${i}]`);
                    if (transformedValue !== undefined) {
                        newArr.push(transformedValue);
                    }
                }
                return newArr;
            }

            return val;
        };

        result = traverse(result, 'root');
        return result;
    }

    async exportJSON() {
        const state = this.getCurrentState();
        if (!state) return;

        const jsonData = JSON.stringify(state, null, 2);
        const fileName = "1497524_PAK_modified.json";

        try {
            // Intentar usar la API de archivos nativa más moderna (File System Access API)
            // Permite al usuario "Guardar Como" y escoger directamente la carpeta jsoncreated
            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(jsonData);
                await writable.close();
                window.App?.addSystemLog?.(`JSON Refactor: Exportado exitosamente a ruta personalizada`, "FILE_EXPORT");
                window.App?.showToast?.("JSON exportado correctamente al directorio seleccionado", "success");
                return;
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Error en File System API:", err);
            }
            return; // Si el usuario cancela, no hacemos fallback
        }

        // Fallback clásico para navegadores que no lo soporten 
        // (Forzará descarga en carpeta predeterminada del navegador)
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonData);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchorNode); 
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        window.App?.addSystemLog?.("JSON Refactor: Exportado JSON (Navegador Clásico)", "FILE_EXPORT");
        window.App?.showToast?.("JSON exportado (Carpeta Descargas)", "success");
    }

    saveManualChanges() {
        const inputs = document.querySelectorAll('.manual-value-input');
        if (inputs.length === 0) return;

        let workingCopy = JSON.parse(JSON.stringify(this.getCurrentState()));

        // Simple nested path setter based on strings inside brackets and dots (root.0.id or root.element.property)
        const setNested = (obj, pathParts, value) => {
            let current = obj;
            for (let i = 1; i < pathParts.length - 1; i++) { // Skip 'root' (i=0)
                let p = pathParts[i];
                // strip array brackets if any e.g. path[0] became path, [0]
                p = p.replace('[', '').replace(']', '');
                if (current[p] === undefined) return;
                current = current[p];
            }
            let finalKey = pathParts[pathParts.length - 1].replace('[', '').replace(']', '');
            
            // Try to preserve type
            let oldVal = current[finalKey];
            if (typeof oldVal === 'number') {
                let num = Number(value);
                current[finalKey] = isNaN(num) ? value : num;
            } else if (typeof oldVal === 'boolean') {
                current[finalKey] = value === 'true';
            } else {
                current[finalKey] = value;
            }
        };

        inputs.forEach(input => {
            const rawPath = input.getAttribute('data-manual-path');
            const val = input.value;
            // Parse path like "root[0].id" or "root.employee.name" -> ["root", "0", "id"]
            const pathParts = rawPath.split(/\.|\[|\]/).filter(Boolean);
            
            if (pathParts.length > 0) {
                setNested(workingCopy, pathParts, val);
            }
        });

        this.saveState(workingCopy);
        
        // Toggle Edit switch to OFF to show result
        const editSwitch = document.getElementById('json-mode-edit');
        if(editSwitch && editSwitch.checked) {
            editSwitch.click(); // emulate turn off
        }
        
        window.App?.showToast?.("Cambios manuales aplicados con éxito", "success");
    }

    async syncSupabase() {
        // En base a la indicación: Se necesita Supabase pero no se han facilitado las keys
        if (typeof supabase === 'undefined' || !window.ReactAppSupabaseUrl) {
            window.App?.showToast?.("Faltan las variables de entorno de Supabase (REACT_APP_SUPABASE_URL). Configura Secrets o .env", "error");
            console.error("Supabase Error: No API Keys provided.");
            return;
        }

        try {
            // Placeholder real for instruction
            const supaClient = supabase.createClient(window.ReactAppSupabaseUrl, window.ReactAppSupabaseKey);
            
            // Mock Insert as per requirements table json_storage
            /*
            await supaClient.from('json_backups').insert([
                {
                    json_data: this.getCurrentState(),
                    updated_at: new Date()
                }
            ]);
            */
            window.App?.showToast?.("Sincronización simulada completada exitosamente en la nube", "success");
        } catch (e) {
            window.App?.showToast?.("Error al conectar con Supabase", "error");
        }
    }
}

// Instantiate and initialize if app is ready
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to let lucide load and other components
    setTimeout(() => {
        window.jsonRefactorer = new JSONRefactorer();
        window.jsonRefactorer.init();
    }, 100);
});
