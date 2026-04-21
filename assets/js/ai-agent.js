// ai-agent.js - Agente Asistente Financiero Especializado en HR
// Funciona 100% sobre la base de datos viva (CSV en memoria). No tiene relación con JSON.

const AIAgent = {
    init() {
        const form = document.getElementById('ai-form');
        const input = document.getElementById('ai-input');

        if (!form || !input) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;

            this.addMessage(text, 'user');
            input.value = '';

            const typingId = this.addMessage('Analizando proyecciones...', 'ai', true);

            setTimeout(() => {
                this.removeMessage(typingId);
                const response = this.analyzeHR(text);
                this.addMessage(response, 'ai');
            }, 600 + Math.random() * 800);
        });
    },

    addMessage(text, sender, isTyping = false) {
        const container = document.getElementById('ai-messages');
        if (!container) return;
        
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
                    <i data-lucide="calculator" class="w-4 h-4 text-lime-400"></i>
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

    /**
     * Motor de Análisis Financiero y RRHH
     * Trabaja directamente sobre los datos CSV cargados en window.App.data
     */
    analyzeHR(query) {
        const data = window.App ? window.App.data : [];
        if (!data || data.length === 0) {
            return `No hay registros en la base de datos de <b>Personal</b>. Por favor, <b>Vincula tu archivo CSV</b> primero en el panel superior.`;
        }
        
        const q = query.toLowerCase();

        // Registrar la consuta en el log principal de la App.
        if (window.App && window.App.addSystemLog) {
            window.App.addSystemLog("Consulta Financiera S.A.L.I.X", query);
        }

        // --- LÓGICA ESPECIAL PARA CAMBIO DE CATEGORÍAS ---
        // Ej: "cambiar de categoría I a la categoría G"
        const catChangeMatch = q.match(/cambiar?\s+(?:a\s+los\s+trabajadores\s+)?(?:de\s+(?:la\s+)?categor[ií]a\s+)?([a-z0-9]+)\s+a\s+(?:la\s+)?categor[ií]a\s+([a-z0-9]+)/i) || q.match(/cambiar?\s+(?:de\s+(?:la\s+)?categor[ií]a\s+)?([a-z0-9]+)\s+a\s+(?:la\s+)?categor[ií]a\s+([a-z0-9]+)\s+(?:a\s+los\s+trabajadores)/i);
        
        if (catChangeMatch) {
            const currentCat = catChangeMatch[1].toUpperCase();
            const targetCat = catChangeMatch[2].toUpperCase();

            const oldGroup = data.filter(d => (d['CATEGORIA'] || d['Cat. prof.'] || '').toUpperCase() === currentCat);
            const targetGroup = data.filter(d => (d['CATEGORIA'] || d['Cat. prof.'] || '').toUpperCase() === targetCat);

            if (oldGroup.length === 0) return `No hay trabajadores actualmente en la Categoría <b>${currentCat}</b>.`;

            let targetSalary = 0;
            if (targetGroup.length > 0) {
                // Sacar salario medio base de la categoría destino
                let sumTarget = 0;
                targetGroup.forEach(e => sumTarget += (parseFloat(e['Categoria a APLICAR']) || 0));
                targetSalary = sumTarget / targetGroup.length;
            } else {
                return `La Categoría de destino <b>${targetCat}</b> no existe en la empresa o nadie la tiene asignada, por lo que no es posible estimar su salario base de salto directo.`;
            }

            let currentCost = 0;
            let projectedCost = 0;

            oldGroup.forEach(emp => {
                let actual = parseFloat(emp['Categoria a APLICAR']) || 0;
                currentCost += actual;
                // Proyección: Asumen el sueldo base de su nueva categoría
                projectedCost += targetSalary;
            });

            const diffImpact = projectedCost - currentCost;

            return `
                <div class="space-y-3">
                    <p class="font-semibold text-lime-400">Proyección Salarial: Salto de Categoría</p>
                    <div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1 mt-2">
                        <p class="text-xs text-zinc-400">Parámetros de reestructuración masiva:</p>
                        <p>Trabajadores promocionados: <b>${oldGroup.length} empleados</b> de Cat. <b>${currentCat}</b></p>
                        <p>Sueldo Base Cat. Destino (<b>${targetCat}</b>): <b>${this.formatCurrency(targetSalary)} media</b></p>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-center mt-3">
                        <div class="bg-zinc-900 border border-zinc-700/50 rounded-lg p-2">
                            <span class="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">Coste Actual (${currentCat})</span>
                            <span>${this.formatCurrency(currentCost)}</span>
                        </div>
                        <div class="bg-zinc-900 border border-zinc-700/50 rounded-lg p-2">
                            <span class="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">C. Proyectado (${targetCat})</span>
                            <span>${this.formatCurrency(projectedCost)}</span>
                        </div>
                    </div>
                    <div class="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
                        <span class="font-bold">Impacto Bruto Mensual (Solo Base):</span>
                        <span class="text-red-400 font-bold tracking-tight">${diffImpact > 0 ? '+' : ''}${this.formatCurrency(diffImpact)}</span>
                    </div>
                </div>
            `;
        }

        // 1. Extraer los parámetros matemáticos. (%) o (€)
        const numMatch = q.match(/(\d+(?:\.\d+)?)\s*(%|€)?/);
        let amount = 0;
        let isPercentage = false;

        if (numMatch) {
            amount = parseFloat(numMatch[1].replace(',', '.'));
            if (q.includes('%')) isPercentage = true;
        }

        // 2. Identificar el área de coste / Campo financiero
        let targetField = null;
        if (q.includes('categor') || q.includes('sueldo')) targetField = 'Categoria a APLICAR';
        else if (q.includes('complemento')) targetField = 'COMPLEMENTO';
        else if (q.includes('grupo')) targetField = 'GRUPO';
        else if (q.includes('frio') || q.includes('frío')) targetField = 'FRIO';
        else if (q.includes('variable')) targetField = 'Variable';

        // 3. Evaluar Departamento de destino
        let targetDept = null;
        const allDepts = [...new Set(data.filter(d => d['Depart.']).map(d => String(d['Depart.']).toLowerCase()))];
        for (let dept of allDepts) {
            if (q.includes(dept)) {
                targetDept = dept;
                break;
            }
        }

        // --- LÓGICA DE RESPUESTA A PREGUNTAS GENERALES ---
        if (!targetField && amount === 0) {
            // Preguntas como "¿Cuántos empleados hay?" o "¿Cuánto gastamos en el departamento de almacenaje?"
            if (q.includes('cuanto') || q.includes('cuánt') || q.includes('gasto') || q.includes('total')) {
                const affected = data.filter(d => !targetDept || String(d['Depart.']).toLowerCase() === targetDept);
                if (affected.length === 0) return `No he encontrado datos del departamento <b>${targetDept}</b>.`;
                
                let sumCostes = 0;
                affected.forEach(emp => {
                    sumCostes += (parseFloat(emp['Categoria a APLICAR']) || 0);
                    sumCostes += (parseFloat(emp['COMPLEMENTO']) || 0);
                    sumCostes += (parseFloat(emp['GRUPO']) || 0);
                    sumCostes += (parseFloat(emp['FRIO']) || 0);
                    sumCostes += (parseFloat(emp['Variable']) || 0);
                });
                return `Hay <b>${affected.length} empleados</b> ${targetDept ? 'en ' + targetDept.toUpperCase() : 'en la empresa'}.<br/>El coste salarial base total asociado a esa muestra es de <b>${this.formatCurrency(sumCostes)}</b> netos al mes aproximados.`;
            }

            return `No detecto una orden financiera clara. Para realizar simulaciones, dime qué incrementar: <br><span class="text-lime-300">Ejemplo: "Sube un 5% el campo Frío para el departamento Logística"</span> o pruebas de subida sectorial como <span class="text-lime-300">"cambiar de la categoría I a la categoría G a los trabajadores"</span>.`;
        }

        // --- LÓGICA DE SIMULACIÓN FINANCIERA CLÁSICA (WHAT-IF) ---

        // Filtrar masa salarial
        const targetEmployees = data.filter(d => {
            if (!targetDept) return true; // Aplica a toda la empresa
            return String(d['Depart.']).toLowerCase() === targetDept;
        });

        if (targetEmployees.length === 0) {
            return `He analizado la plantilla pero no encuentro a nadie en el departamento especificado.`;
        }

        // Ejecutar algoritmo de impacto de costes
        let currentCost = 0;
        let projectedCost = 0;

        targetEmployees.forEach(emp => {
            let val = parseFloat(emp[targetField]) || 0;
            currentCost += val;

            if (isPercentage) {
                projectedCost += val + (val * (amount / 100));
            } else {
                projectedCost += val + amount;
            }
        });

        const diffImpact = projectedCost - currentCost;

        return `
            <div class="space-y-3">
                <p class="font-semibold text-lime-400">Proyección Salarial Completada</p>
                <div class="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1 mt-2">
                    <p class="text-xs text-zinc-400">Parámetros detectados:</p>
                    <p>Masa salarial: <b>${targetEmployees.length} empleados</b> ${targetDept ? `(${targetDept.toUpperCase()})` : '(Global)'}</p>
                    <p>Concepto Nominal: <b>${targetField}</b></p>
                    <p>Fluctuación: <b>+${amount}${isPercentage ? '%' : '€'} p.p.</b></p>
                </div>
                <div class="grid grid-cols-2 gap-2 text-center mt-3">
                    <div class="bg-zinc-900 border border-zinc-700/50 rounded-lg p-2">
                        <span class="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">Coste Actual</span>
                        <span>${this.formatCurrency(currentCost)}</span>
                    </div>
                    <div class="bg-zinc-900 border border-zinc-700/50 rounded-lg p-2">
                        <span class="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">Coste Proyectado</span>
                        <span>${this.formatCurrency(projectedCost)}</span>
                    </div>
                </div>
                <div class="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
                    <span class="font-bold">Impacto a Asumir:</span>
                    <span class="text-red-400 font-bold tracking-tight">${diffImpact > 0 ? '+' : ''}${this.formatCurrency(diffImpact)}</span>
                </div>
            </div>
        `;
    },

    formatCurrency(value) {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
    }
};

window.addEventListener('DOMContentLoaded', () => AIAgent.init());
