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
        // Ampliamos significativamente el limite, Gemini Flash soporta un mega-contexto nativo
        const truncated = jsonStr.length > 500000 ? jsonStr.substring(0, 500000) + '\n... [truncado por exceso de memoria]' : jsonStr;

        const prompt = `Eres un asistente experto en programación y estructuras de datos JSON. 
Tu única tarea es aplicar la siguiente instrucción al JSON proporcionado y devolver ÚNICAMENTE el JSON resultante, sin explicaciones, de forma que sea 100% válido sintácticamente.

## REGLAS ESTRICTAS:
1. Devuelve SOLO texto en formato JSON válido, sin bloques de código markdown (\`\`\`), y sin ningún comentario inicial o final.
2. Mantén la estructura original y claves intactas excepto donde la instrucción te pida modificarlas.
3. Si es un array o lista, asegúrate de aplicar el cambio masivamente a todos los elementos que cumplan la condición.
4. Mantén los tipos de datos correctos (números no deben ir en comillas si originalmente no estaban, los booleanos son true/false, etc).

## INSTRUCCIÓN DEL USUARIO:
"${instruction}"

## MODO:
${isGlobal ? 'MODO GLOBAL — Debes iterar y aplicar a todo el documento.' : 'MODO LOCAL — Aplica solo al nodo específico que se muesta.'}

## JSON A TRANSFORMAR:
${truncated}

Responde ÚNICAMENTE con el objeto JSON resultante:`;

        const rawResponse = await this.generate(prompt, { temperature: 0.1, maxOutputTokens: 8192 });

        let cleaned = rawResponse.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
        else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
        if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
        cleaned = cleaned.trim();

        try {
            return JSON.parse(cleaned);
        } catch (parseErr) {
            throw new Error(`Gemini devolvió un JSON inválido sintácticamente. Intenta reformular la instrucción de forma más sencilla.\n\nRespuesta parcial: ${cleaned.substring(0, 200)}...`);
        }
    },

    /**
     * Genera una respuesta de chat analítico para Inteligencia de Costes RRHH (S.A.L.I.X).
     */
    async chatHR(query, employeeData) {
        // En lugar de resumir, aprovechamos el contexto extenso de Gemini y le pasamos los datos puros.
        // Se limpian solo cosas superfluas como UUIDs para ahorrar tokens.
        let rawData = '[]';
        if (employeeData && employeeData.length > 0) {
            const cleanArray = employeeData.map(d => {
                const copy = {...d};
                delete copy.uuid;
                delete copy.foto;
                return copy;
            });
            rawData = JSON.stringify(cleanArray);
        }

        const prompt = `Eres "S.A.L.I.X.", el Analista IA de Gestión Salarial y Recursos Humanos de la empresa Verdnatura.
Analizas los datos vivos de la nómina y respondes dudas sobre cálculos o simulaciones de impactos económicos.

## DATOS EN TIEMPO REAL (JSON EXPORTADO DEL CSV DE TRABAJADORES):
${rawData}

## REGLAS ESTRICTAS PARA TUS RESPUESTAS:
1. Eres un experto contable de RRHH. Respondes SIEMPRE en español, con un tono analítico, directo y profesional.
2. Posees la base de datos completa arriba. Debes iterar exactamente sobre las filas del JSON para dar datos reales (quién está en cada departamento, cuál es la suma de los valores, etc).
3. Si se te pide calcular una simulación ("Baja un 10% el FRÍO al grupo COMPRAS"), haz la matemática mentalmente sobre cada trabajador afectado y expón el resultado.
4. Muestra SIEMPRE en estos casos:
   - A cuántas personas afecta.
   - Coste de ese concepto actual frente al Coste proyectado (Sumatorio).
   - Impacto económico (Diferencia total mensual).
5. Usa formato de moneda española (€) y utiliza negritas para nombres y totales clave.
6. Devuelve formato simple legible en HTML (puedes usar <b>, <br>, <span class="text-lime-400 font-bold"> para pintar verde datos positivos, <span class="text-red-400 font-bold"> para rojos/costes). Sin formato markdown de bloques (\`\`\`).

## PREGUNTA O INSTRUCCIÓN DEL SUPERVISOR:
"${query}"

Redacta tu análisis:`;

        return await this.generate(prompt, { temperature: 0.2, maxOutputTokens: 2048 });
    }
};

// Inicializar al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
    GeminiService.init();
    window.GeminiService = GeminiService;
});
