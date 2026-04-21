// ai-agent.js - Lógica matemática predictiva para el chatbot

const AIAgent = {
    init() {
        const form = document.getElementById('ai-form');
        const input = document.getElementById('ai-input');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;

            this.addMessage(text, 'user');
            input.value = '';

            // Simular pensando
            const typingId = this.addMessage('Analizando...', 'ai', true);

            setTimeout(async () => {
                this.removeMessage(typingId);
                const response = await this.processIntent(text);
                this.addMessage(response, 'ai');
            }, 800 + Math.random() * 1000); // 0.8 a 1.8 segs de delay
        });
    },

    addMessage(text, sender, isTyping = false) {
        const container = document.getElementById('ai-messages');
        const msgWrapper = document.createElement('div');
        const id = 'msg-' + Date.now();
        msgWrapper.id = id;

        if (sender === 'user') {
            msgWrapper.className = 'flex items-start justify-end';
            msgWrapper.innerHTML = `
                <div class="mr-4 p-4 rounded-2xl rounded-tr-none bg-lime-500/20 border border-lime-500/30 text-sm text-lime-100 max-w-[80%] animate-slide-up">
                    <p>${text}</p>
                </div>
                <div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700">
                    <span class="text-xs font-bold text-zinc-400">VL</span>
                </div>
            `;
        } else {
            msgWrapper.className = 'flex items-start max-w-[80%]';
            msgWrapper.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-lime-500/10 flex items-center justify-center shrink-0 border border-lime-500/30">
                    <i data-lucide="bot" class="w-4 h-4 text-lime-400"></i>
                </div>
                <div class="ml-4 p-4 rounded-2xl rounded-tl-none bg-zinc-800/80 border border-zinc-700 text-sm text-zinc-200 animate-slide-up ${isTyping ? 'animate-pulse' : ''}">
                    <p>${text}</p>
                </div>
            `;
        }

        container.appendChild(msgWrapper);
        if (window.lucide) lucide.createIcons({ root: msgWrapper });

        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        return id;
    },

    removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    },

    async processIntent(query) {
        const isJsonView = !document.getElementById('json-refactor-view')?.classList.contains('hidden');
        
        if (isJsonView) {
            return await this.processJsonIntent(query);
        } else {
            return this.processHrIntent(query);
        }
    },

    async processJsonIntent(query) {
        const jsonRef = window.jsonRefactorer;
        if (!jsonRef) return "El Refactorizador JSON no está inicializado.";
        
        const data = jsonRef.getCurrentState();
        if (!data || Object.keys(data).length === 0) {
            return "Por favor, carga un archivo JSON inicial. Analizaré su estructura y las labels detectadas para poder asistirte.";
        }

        const lowerQ = query.toLowerCase();
        
        // Fase de Confirmación y Generación de Código
        if (lowerQ === 'si' || lowerQ === 'sí' || lowerQ === 'aplica' || lowerQ === 'adelante' || lowerQ === 'generar') {
            if (!this.lastInstruction) {
                return "¿A qué orden te refieres? Dime primero qué deseas cambiar en el JSON.";
            }
            
            // Re-ejecutar transformaciones globalmente en memoria (sin afectar el view de la app principal obligatoriamente, solo generamos código)
            // Utilizando el iterador base del objeto
            let resultData;
            try {
                resultData = await jsonRef.transformNode(data, this.lastInstruction, {});
            } catch(e) {
                resultData = data; 
            }
            
            const rawCode = JSON.stringify(resultData, null, 2);
            const escapedCode = rawCode.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            
            this.lastInstruction = null; // reset
            return `¡Orden procesada! He respetado la sintaxis original y generado los cambios masivos a partir de tu instrucción.<br><br>Aquí tienes el código JSON perfecto para copiar y pegar:<br><br>
                <div class="relative mt-2">
                    <pre class="bg-[#09090b] border border-zinc-700/50 p-3 rounded-lg overflow-x-auto text-[10px] sm:text-xs text-lime-300 font-mono scrollbar-hide max-h-64"><code>${escapedCode}</code></pre>
                </div>`;
        }
        
        // Fase Analítica e Identificación 
        this.lastInstruction = query;
        let keys = [];
        if (Array.isArray(data) && data.length > 0) {
            keys = Object.keys(data[0]);
        } else if (typeof data === 'object') {
            keys = Object.keys(data);
        }
        
        let sample = keys.slice(0, 5).join(', ');
        if(keys.length > 5) sample += '...';
        
        return `
            He analizado la estructura de tu JSON.<br><br>
            <b>Labels detectadas:</b><br><span class="text-zinc-400 font-mono text-xs">${sample || 'Ninguna reconocible'}</span><br><br>
            Entiendo tu orden:<br><span class="text-lime-300 italic">"${query}"</span><br><br>
            ¿Deseas que aplique estos cambios masivos y genere el código JSON resultante perfecto para copiar y pegar? Responde <b>"Sí"</b>.
        `;
    },

    async processHrIntent(query) {
        // Usar Gemini si está configurado
        if (window.GeminiService && window.GeminiService.isConfigured()) {
            try {
                const data = window.App ? window.App.data : [];
                return await window.GeminiService.chatHR(query, data);
            } catch (err) {
                console.warn('Gemini chat error, falling back to local HR engine:', err);
                // Continuar silenciosamente hacia el fallback local si Gemini falla
            }
        }
        
        // Fallback local:
        return this._processHrIntentLocal(query);
    },

    _processHrIntentLocal(query) {
        query = query.toLowerCase();
        const data = window.App ? window.App.data : [];
        if (data.length === 0) return "La base de datos está vacía. Por favor, sincroniza el archivo CSV primero.";

        // Extraer numero para % o euros fijos
        const numMatch = query.match(/(\d+(?:\.\d+)?)\s*(%|€)?/);
        let number = 0;
        let isPct = false;

        if (numMatch) {
            number = parseFloat(numMatch[1]);
            if (query.includes('%')) isPct = true;
        }

        // Reconocer campo
        let field = null;
        if (query.includes('categoria a aplicar') || query.includes('sueldo')) field = 'Categoria a APLICAR';
        else if (query.includes('complemento')) field = 'COMPLEMENTO';
        else if (query.includes('grupo')) field = 'GRUPO';
        else if (query.includes('frio') || query.includes('frío')) field = 'FRIO';
        else if (query.includes('variable')) field = 'Variable';

        // Reconocer departamento
        let matchedDept = null;
        const depts = [...new Set(data.filter(d => d['Depart.']).map(d => String(d['Depart.']).toLowerCase()))];
        for (let dpt of depts) {
            if (query.includes(dpt)) {
                matchedDept = dpt;
                break;
            }
        }

        if (!field || number === 0) {
            return `No he podido deducir los parámetros exactos. Intenta algo como: <b>"Calcula una subida del 5% del Complemento para Almacenaje."</b>`;
        }

        // Filtrar targets
        const targets = data.filter(d => {
            if (!matchedDept) return true; // Todos
            return String(d['Depart.']).toLowerCase() === matchedDept;
        });

        if (targets.length === 0) {
            return `No encontré ningún empleado en el departamento '${matchedDept}'.`;
        }

        // Ejecutar simulacion matematica
        let costoActual = 0;
        let costoProyectado = 0;

        targets.forEach(t => {
            let actual = parseFloat(t[field]) || 0;
            costoActual += actual;

            if (isPct) {
                costoProyectado += actual + (actual * (number / 100));
            } else {
                // Sube directo eu
                costoProyectado += actual + number;
            }
        });

        const diferencia = costoProyectado - costoActual;
        const formatE = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);

        return `
            He analizado el escenario:<br><br>
            • <b>Afecto:</b> ${targets.length} empleados ${matchedDept ? `en <b>${matchedDept.toUpperCase()}</b>` : 'en total'}.<br>
            • <b>Campo modificado:</b> ${field}<br>
            • <b>Incremento paramétrico:</b> ${number}${isPct ? '%' : '€'} por empleado<br><br>
            <b>Coste Mensual Actual:</b> ${formatE(costoActual)}<br>
            <b>Coste Proyectado:</b> ${formatE(costoProyectado)}<br><br>
            <span class="text-lime-400 font-bold">Impacto Económico Directo: +${formatE(diferencia)}</span>
        `;
    }
};

window.addEventListener('DOMContentLoaded', () => AIAgent.init());
