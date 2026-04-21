// gemini-service.js - Servicio centralizado para la API de Google Gemini
// Modelo: gemini-2.0-flash (rápido, potente y gratuito en capa free-tier)

const GeminiService = {
    API_BASE: 'https://generativelanguage.googleapis.com/v1beta/models',
    MODEL: 'gemini-2.0-flash',
    _apiKey: null,

    /**
     * Inicializa el servicio: carga la API Key desde localStorage
     * y bindea los eventos del modal de configuración.
     */
    init() {
        this._apiKey = localStorage.getItem('gemini_api_key') || null;
        this.bindSettingsEvents();
        this.updateStatusIndicator();
    },

    /**
     * Devuelve true si hay una API Key configurada.
     */
    isConfigured() {
        return !!this._apiKey && this._apiKey.trim().length > 10;
    },

    /**
     * Guarda una nueva API Key.
     */
    setApiKey(key) {
        this._apiKey = key ? key.trim() : null;
        if (this._apiKey) {
            localStorage.setItem('gemini_api_key', this._apiKey);
        } else {
            localStorage.removeItem('gemini_api_key');
        }
        this.updateStatusIndicator();
    },

    /**
     * Retorna la API Key actual (o null).
     */
    getApiKey() {
        return this._apiKey;
    },

    /**
     * Actualiza el indicador visual del estado de la conexión IA.
     */
    updateStatusIndicator() {
        const dot = document.getElementById('gemini-status-dot');
        const label = document.getElementById('gemini-status-label');
        const keyPreview = document.getElementById('gemini-key-preview');

        if (dot) {
            dot.className = this.isConfigured()
                ? 'w-2 h-2 rounded-full bg-lime-400 animate-pulse'
                : 'w-2 h-2 rounded-full bg-red-400';
        }
        if (label) {
            label.textContent = this.isConfigured()
                ? `Gemini 2.0 Flash — Conectado`
                : 'IA No Configurada';
            label.className = this.isConfigured()
                ? 'text-xs text-lime-400 font-medium'
                : 'text-xs text-red-400 font-medium';
        }
        if (keyPreview) {
            if (this.isConfigured()) {
                const k = this._apiKey;
                keyPreview.textContent = k.substring(0, 6) + '••••••' + k.substring(k.length - 4);
            } else {
                keyPreview.textContent = 'Sin clave';
            }
        }
    },

    /**
     * Bindea los eventos del modal de configuración de API Key.
     */
    bindSettingsEvents() {
        const btnOpen = document.getElementById('btn-gemini-settings');
        const modal = document.getElementById('gemini-settings-modal');
        const btnClose = document.getElementById('btn-close-gemini-settings');
        const btnSave = document.getElementById('btn-save-gemini-key');
        const btnClear = document.getElementById('btn-clear-gemini-key');
        const btnTest = document.getElementById('btn-test-gemini-key');
        const input = document.getElementById('gemini-api-key-input');

        if (btnOpen && modal) {
            btnOpen.addEventListener('click', () => {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                if (input && this._apiKey) {
                    input.value = this._apiKey;
                }
            });
        }

        if (btnClose && modal) {
            btnClose.addEventListener('click', () => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            });
        }

        if (btnSave && input) {
            btnSave.addEventListener('click', () => {
                const key = input.value.trim();
                if (!key) {
                    window.App?.showToast?.('Introduce una API Key válida.', 'warning');
                    return;
                }
                this.setApiKey(key);
                window.App?.showToast?.('API Key de Gemini guardada correctamente.', 'success');
                modal?.classList.add('hidden');
                modal?.classList.remove('flex');
            });
        }

        if (btnClear) {
            btnClear.addEventListener('click', () => {
                this.setApiKey(null);
                if (input) input.value = '';
                window.App?.showToast?.('API Key eliminada. La IA trabajará en modo local.', 'info');
            });
        }

        if (btnTest) {
            btnTest.addEventListener('click', async () => {
                if (!this.isConfigured()) {
                    // Intentar guardar primero lo que haya en el input
                    const key = input?.value.trim();
                    if (key) this.setApiKey(key);
                }
                if (!this.isConfigured()) {
                    window.App?.showToast?.('Primero guarda una API Key.', 'warning');
                    return;
                }

                btnTest.disabled = true;
                btnTest.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin mr-1"></i> Probando...';
                if (window.lucide) lucide.createIcons({ root: btnTest });

                try {
                    const result = await this.generate('Responde únicamente con la palabra "OK" si puedes leer este mensaje.');
                    if (result && result.toLowerCase().includes('ok')) {
                        window.App?.showToast?.('✅ Conexión con Gemini exitosa. La IA está lista.', 'success');
                    } else {
                        window.App?.showToast?.('⚠️ Respuesta inesperada de Gemini: ' + (result || 'vacía'), 'warning');
                    }
                } catch (err) {
                    window.App?.showToast?.('❌ Error de conexión: ' + err.message, 'error');
                }

                btnTest.disabled = false;
                btnTest.innerHTML = '<i data-lucide="zap" class="w-4 h-4 mr-1"></i> Probar Conexión';
                if (window.lucide) lucide.createIcons({ root: btnTest });
            });
        }
    },

    /**
     * Llamada principal a la API de Gemini.
     * @param {string} prompt - El prompt completo a enviar.
     * @param {object} options - Opciones adicionales (temperature, maxTokens, etc.)
     * @returns {string} - La respuesta textual de Gemini.
     */
    async generate(prompt, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('API Key de Gemini no configurada. Ve a Ajustes > Configurar IA.');
        }

        const temperature = options.temperature ?? 0.3;
        const maxOutputTokens = options.maxOutputTokens ?? 8192;

        const url = `${this.API_BASE}/${this.MODEL}:generateContent?key=${this._apiKey}`;

        const body = {
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                temperature,
                maxOutputTokens,
                topP: 0.95,
                topK: 40,
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            const errorMsg = errorBody?.error?.message || `HTTP ${response.status}`;
            throw new Error(`Gemini API Error: ${errorMsg}`);
        }

        const data = await response.json();

        // Extraer texto de la respuesta
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            throw new Error('Gemini devolvió una respuesta vacía.');
        }

        return text.trim();
    },

    /**
     * Genera una transformación JSON usando Gemini.
     * Le pasa el contexto (JSON actual) y la instrucción del usuario.
     * Devuelve el JSON transformado.
     */
    async transformJSON(jsonData, instruction, isGlobal = false) {
        const jsonStr = JSON.stringify(jsonData, null, 2);
        const truncated = jsonStr.length > 15000 ? jsonStr.substring(0, 15000) + '\n... [truncado]' : jsonStr;

        const prompt = `Eres un asistente experto en transformación de datos JSON. 
Tu tarea es aplicar la siguiente instrucción del usuario al JSON proporcionado y devolver ÚNICAMENTE el JSON resultante, sin explicaciones ni formato markdown.

## REGLAS ESTRICTAS:
1. Devuelve SOLO el JSON puro, sin bloques de código (\`\`\`), sin texto adicional.
2. Mantén la estructura original del JSON intacta excepto donde la instrucción requiera cambios.
3. Si la instrucción no aplica a algún campo, déjalo sin cambios.
4. Respeta los tipos de datos (números como números, strings como strings).
5. Si hay un array de objetos, aplica la transformación a TODOS los elementos que correspondan.

## INSTRUCCIÓN DEL USUARIO:
"${instruction}"

## MODO:
${isGlobal ? 'GLOBAL — Aplica a todo el documento completo.' : 'NODO ESPECÍFICO — Aplica solo al valor proporcionado.'}

## JSON A TRANSFORMAR:
${truncated}

Responde ÚNICAMENTE con el JSON resultante:`;

        const rawResponse = await this.generate(prompt, { temperature: 0.1 });

        // Limpiar la respuesta: a veces Gemini la envuelve en bloques de código
        let cleaned = rawResponse.trim();
        
        // Remover bloques de código markdown si existen
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.slice(7);
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.slice(3);
        }
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.slice(0, -3);
        }
        cleaned = cleaned.trim();

        try {
            return JSON.parse(cleaned);
        } catch (parseErr) {
            // Segundo intento: pedir a Gemini que corrija
            throw new Error(`Gemini devolvió un JSON inválido. Intenta reformular la instrucción.\n\nRespuesta parcial: ${cleaned.substring(0, 200)}...`);
        }
    },

    /**
     * Genera una respuesta de chat contextualizada para RRHH/Salarial.
     */
    async chatHR(query, employeeData) {
        // Preparar resumen estadístico de los datos
        let contextSummary = 'No hay datos cargados.';
        if (employeeData && employeeData.length > 0) {
            const totalEmps = employeeData.length;
            const depts = [...new Set(employeeData.map(d => d['Depart.'] || 'Desconocido'))];
            const sampleFields = Object.keys(employeeData[0]).filter(k => k !== 'uuid' && k !== 'foto').slice(0, 10);
            
            // Calcular algunos agregados
            const numericFields = ['GRUPO', 'COMPLEMENTO', 'FRIO', 'Variable', 'Categoria a APLICAR'];
            const totals = {};
            numericFields.forEach(f => {
                const sum = employeeData.reduce((acc, e) => acc + (parseFloat(e[f]) || 0), 0);
                if (sum > 0) totals[f] = sum;
            });

            contextSummary = `
Base de datos: ${totalEmps} empleados.
Departamentos: ${depts.join(', ')}.
Campos disponibles: ${sampleFields.join(', ')}.
Totales calculados: ${JSON.stringify(totals)}.
Muestra (3 primeros registros): ${JSON.stringify(employeeData.slice(0, 3), null, 1)}`;
        }

        const prompt = `Eres "S.A.L.I.X.", un agente analítico de gestión salarial y RRHH para la empresa Verdnatura.
Tu rol es responder preguntas sobre datos de empleados, analizar costes salariales, y simular el impacto de incrementos.

## CONTEXTO DE DATOS ACTUALES:
${contextSummary}

## REGLAS:
1. Responde en español, de forma concisa y profesional.
2. Usa datos reales de la base cuando sea posible.
3. Para cálculos, muestra siempre: el campo modificado, cuántos empleados afecta, coste actual vs proyectado, y el impacto económico.
4. Formatea las cantidades en euros con formato español (ej: 1.234,56 €).
5. Si no tienes datos suficientes, dilo claramente.
6. Puedes usar HTML básico para dar formato: <b>, <br>, <span class="text-lime-400">, etc.
7. NO uses bloques de código markdown.

## PREGUNTA DEL USUARIO:
"${query}"

Responde directamente:`;

        return await this.generate(prompt, { temperature: 0.4, maxOutputTokens: 2048 });
    }
};

// Inicializar al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
    GeminiService.init();
    window.GeminiService = GeminiService;
});
