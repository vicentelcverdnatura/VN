/**
 * VINUX - Agente IA Interno (V-Intel NLP Universal eXecutor)
 * Desarrollado mediante código propio para la gestión heurística e interpretación
 * de lenguaje natural orientada a estructuras JSON, sin usar APIs.
 * 
 * Capacidades:
 * - Sustitución léxica compleja.
 * - Operaciones matemáticas sobre campos numéricos.
 * - Mutación estructural (Añadir labels, Renombrar labels, Eliminar labels).
 * - Búsqueda profunda y preservación de sintaxis original.
 */
class VINUXAgent {
    constructor() {
        this.name = 'VINUX';
        this.version = '1.0';
    }

    /**
     * Motor principal interpretativo.
     * Analiza la instrucción y decide la estrategia de mutación sobre la estructura JSON.
     * @param {Object|Array} data - El JSON original.
     * @param {string} instruction - Frase en lenguaje natural.
     * @returns {Object|Array} - Clon del JSON modificado de forma segura.
     */
    process(data, instruction) {
        if (!data || !instruction) return data;
        
        // Trabajamos siempre sobre una copia oscura para salvaguardar la sintaxis
        const clone = JSON.parse(JSON.stringify(data));
        const inst = instruction.trim().toLowerCase();

        // 1. Análisis de intención (Intent Detection)
        const isAddLabel = /a[ñn]ad(?:ir|e)|agrega(?:r)?|inserta(?:r)?/i.test(inst) && /(?:label|clave|propiedad|campo)/i.test(inst);
        const isRenameLabel = /(?:renombra|cambia el nombre|modifica.+label)/i.test(inst);
        const isDeleteLabel = /(?:elimina|borra|quita).*?(?:label|clave|propiedad|campo)/i.test(inst);
        const isMath = /(?:suma|resta|multiplica|divide|incrementa|aumenta|reduce|porcentaje|%)/i.test(inst) && /\d/.test(inst);
        const isReplace = /(?:sustituye|cambia|reemplaza).*?(?:por|con|a)/i.test(inst);
        const isRestructure = /(?:estructura|agrupa|aplana|desglosa)/i.test(inst);

        // -- Ejecución en Cascada Heurística --

        if (isAddLabel) {
            return this._handleAddLabel(clone, inst);
        }

        if (isRenameLabel) {
            return this._handleRenameLabel(clone, inst);
        }

        if (isDeleteLabel) {
            return this._handleDeleteLabel(clone, inst);
        }

        if (isRestructure) {
            return this._handleRestructure(clone, inst);
        }

        // Si es una operación sobre valores y no estructural, iteramos en profundidad
        return this._deepTraverseAndMutate(clone, inst, { isMath, isReplace });
    }

    // -------------------------------------------------------------
    // MUTADORES ESTRUCTURALES (Labels y Arquitectura)
    // -------------------------------------------------------------

    _handleAddLabel(data, inst) {
        // Ej: "añade un label llamado 'estado' con valor 'activo'"
        // Ej: "añade la clave 'IVA' con valor 21"
        const labelMatch = inst.match(/(?:label|clave|propiedad|campo)\s+(?:llamado\s+|llamad[ao]\s+)?["'«]?([^"'»\s]+)["'»]?/i);
        const valMatch = inst.match(/(?:con\s+valor|que\s+valga)\s+["'«]?([^"'»]+)["'»]?/i);

        if (labelMatch) {
            const newKey = labelMatch[1].trim();
            let newVal = valMatch ? valMatch[1].trim() : null;

            // Type coercion inferido
            if (newVal !== null && !isNaN(newVal.replace(',', '.'))) newVal = parseFloat(newVal.replace(',', '.'));
            if (newVal === 'true') newVal = true;
            if (newVal === 'false') newVal = false;

            return this._applyToAllObjects(data, (obj) => {
                obj[newKey] = newVal;
            });
        }
        return data;
    }

    _handleRenameLabel(data, inst) {
        // Ej: "renombra el label 'sueldo' a 'salario'"
        const match = inst.match(/(?:renombra|cambia el nombre(?: de(?:l| la)?)?)\s+(?:label|clave|campo\s+)?["'«]?([^"'»]+)["'»]?\s+(?:por|a)\s+["'«]?([^"'»]+)["'»]?/i);
        if (match) {
            const oldKey = match[1].trim();
            const newKey = match[2].trim();
            
            return this._applyToAllObjects(data, (obj) => {
                if (obj.hasOwnProperty(oldKey)) {
                    obj[newKey] = obj[oldKey];
                    // Mantener el orden de sintaxis
                    delete obj[oldKey];
                }
            });
        }
        return data;
    }

    _handleDeleteLabel(data, inst) {
        // Ej: "elimina el campo 'foto'"
        const match = inst.match(/(?:elimina|borra|quita)\s+(?:(?:el|la)\s+)?(?:label|clave|campo\s+)?["'«]?([^"'»]+)["'»]?/i);
        if (match) {
            const keyToDel = match[1].trim();
            return this._applyToAllObjects(data, (obj) => {
                if (obj.hasOwnProperty(keyToDel)) {
                    delete obj[keyToDel];
                }
            });
        }
        return data; // fallback
    }

    _handleRestructure(data, inst) {
        // Interpreta reestructuraciones complejas como agrupar por cierto campo o aplanar
        if (inst.includes('aplana') || inst.includes('flatten')) {
            if (Array.isArray(data)) {
                return data.map(obj => this._flattenObject(obj));
            }
            return this._flattenObject(data);
        }
        
        let arr = Array.isArray(data) ? data : [data];
        const groupMatch = inst.match(/(?:agrupa|estructura).*?(?:por|seg[uú]n)\s+(?:el\s+)?(?:campo|label\s+)?["'«]?([^"'»]+)["'»]?/i);
        if (groupMatch) {
            const groupBy = groupMatch[1].trim();
            const result = {};
            arr.forEach(item => {
                const key = item[groupBy] || 'Sin Grupo';
                if (!result[key]) result[key] = [];
                result[key].push(item);
            });
            return result;
        }

        return data;
    }

    // -------------------------------------------------------------
    // MUTADORES LÉXICOS Y MATEMÁTICOS (Recorriendo todo el AS-Tree)
    // -------------------------------------------------------------

    _deepTraverseAndMutate(node, inst, intent) {
        if (Array.isArray(node)) {
            return node.map(item => this._deepTraverseAndMutate(item, inst, intent));
        } else if (node !== null && typeof node === 'object') {
            const result = {};
            for (const key of Object.keys(node)) {
                result[key] = this._deepTraverseAndMutate(node[key], inst, intent);
            }
            return result;
        } else {
            // Valor literal (Hoja)
            return this._mutateValue(node, inst, intent);
        }
    }

    _mutateValue(currentValue, inst, intent) {
        const isStr = typeof currentValue === 'string';
        const isNum = typeof currentValue === 'number';

        if (intent.isReplace && isStr) {
            const rxReplace = /(?:sustituye|cambia|reemplaza)\s+(?:el\s+|la\s+|todo\s+)?["'«]?(.+?)["'»]?\s+(?:por|a|con)\s+["'«]?([^"'»]*)["'»]?/i;
            const m = inst.match(rxReplace);
            if (m) {
                const find = m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape
                const rep = m[2];
                // Caso "sustituye XX por YY". Evalúa globalmente
                if (currentValue.toLowerCase().includes(m[1].toLowerCase())) {
                    return currentValue.replace(new RegExp(find, 'gi'), rep);
                }
            }
        }

        if (intent.isMath && isNum) {
            // "%"
            const pctUpMatch = inst.match(/(?:increment(?:a|ar)|sub(?:e|ir)|aument(?:a|ar))[^0-9]+(\d+[\.,]?\d*)\s*%/);
            if (pctUpMatch) return Number((currentValue * (1 + parseFloat(pctUpMatch[1].replace(',', '.')) / 100)).toFixed(4));
            
            const pctDownMatch = inst.match(/(?:reduc(?:e|ir)|baj(?:a|ar)|desconta(?:r))[^0-9]+(\d+[\.,]?\d*)\s*%/);
            if (pctDownMatch) return Number((currentValue * (1 - parseFloat(pctDownMatch[1].replace(',', '.')) / 100)).toFixed(4));
            
            // Operaciones absolutas
            const addMatch = inst.match(/(?:suma(?:r|le)?)\s+([\d\.,]+)/);
            if (addMatch) return Number((currentValue + parseFloat(addMatch[1].replace(',', '.'))).toFixed(4));
            
            const mulMatch = inst.match(/(?:multiplica(?:r)?)\s+(?:por\s+)?([\d\.,]+)/);
            if (mulMatch) return Number((currentValue * parseFloat(mulMatch[1].replace(',', '.'))).toFixed(4));
        }

        // 4. TRANSFORMACIONES DE TEXTO BÁSICAS
        if (isStr) {
            if (inst.includes('mayúscula') || inst.includes('uppercase')) return currentValue.toUpperCase();
            if (inst.includes('minúscula') || inst.includes('lowercase')) return currentValue.toLowerCase();
            if (inst.includes('capitaliz')) return currentValue.replace(/\b\w/g, c => c.toUpperCase());
            if (inst.includes('quita espacios') || inst.includes('limpia espacios')) return currentValue.replace(/\s+/g, '').trim();
        }

        return currentValue; // No change
    }

    // -------------------------------------------------------------
    // HELPERS ESTRUCTURALES
    // -------------------------------------------------------------

    /** Iterador universal para arrays y recubrimientos (Wrappers) */
    _applyToAllObjects(data, fn) {
        if (Array.isArray(data)) {
            data.forEach(item => {
                if (item && typeof item === 'object') fn(item);
            });
            return data;
        } else if (data && typeof data === 'object') {
            fn(data);
            return data;
        }
        return data; // Literal no mutable como Object
    }

    /** Flattening de sub-objetos */
    _flattenObject(obj, prefix = '') {
        return Object.keys(obj).reduce((acc, k) => {
            const pre = prefix.length ? prefix + '_' : '';
            if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
                Object.assign(acc, this._flattenObject(obj[k], pre + k));
            } else {
                acc[pre + k] = obj[k];
            }
            return acc;
        }, {});
    }

    // -------------------------------------------------------------
    // INTELIGENCIA ANALÍTICA HR (S.A.L.I.X Integrado)
    // -------------------------------------------------------------

    /**
     * Motor analítico para RRHH.
     * Recibe la base de datos completa de trabajadores y contesta simulaciones.
     */
    simulateHR(query, data) {
        if (!data || data.length === 0) return "La base de datos está vacía. Por favor, sincroniza el archivo CSV primero.";
        
        const q = query.toLowerCase();

        // 1. Extraer parámetro numérico para % o €
        const numMatch = q.match(/(\d+(?:\.\d+)?)\s*(%|€)?/);
        let number = 0;
        let isPct = false;

        if (numMatch) {
            number = parseFloat(numMatch[1].replace(',', '.'));
            if (q.includes('%')) isPct = true;
        }

        // 2. Reconocer campo objetivo
        let field = null;
        if (q.includes('categoria') || q.includes('sueldo')) field = 'Categoria a APLICAR';
        else if (q.includes('complemento')) field = 'COMPLEMENTO';
        else if (q.includes('grupo')) field = 'GRUPO';
        else if (q.includes('frio') || q.includes('frío')) field = 'FRIO';
        else if (q.includes('variable')) field = 'Variable';

        // 3. Reconocer departamento objetivo
        let matchedDept = null;
        const depts = [...new Set(data.filter(d => d['Depart.']).map(d => String(d['Depart.']).toLowerCase()))];
        for (let dpt of depts) {
            if (q.includes(dpt)) {
                matchedDept = dpt;
                break;
            }
        }

        if (!field || number === 0) {
            return `No he podido deducir los parámetros matemáticos exactos en tu frase. Intenta algo como:<br> <span class="text-lime-300">"Calcula una subida del 5% del Complemento para Almacenaje."</span>`;
        }

        // 4. Filtrar targets
        const targets = data.filter(d => {
            if (!matchedDept) return true; // Todos
            return String(d['Depart.']).toLowerCase() === matchedDept;
        });

        if (targets.length === 0) {
            return `He explorado la base de datos y no encontré ningún empleado en el departamento '${matchedDept}'.`;
        }

        // 5. Ejecutar simulación matemática
        let costoActual = 0;
        let costoProyectado = 0;

        targets.forEach(t => {
            let actual = parseFloat(t[field]) || 0;
            costoActual += actual;

            if (isPct) {
                costoProyectado += actual + (actual * (number / 100));
            } else {
                costoProyectado += actual + number;
            }
        });

        const diferencia = costoProyectado - costoActual;
        const formatE = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);

        return `
            Análisis heurístico (Motor VINUX) finalizado:<br><br>
            • <b>Afecto:</b> ${targets.length} empleados ${matchedDept ? `en <b>${matchedDept.toUpperCase()}</b>` : 'en toda la plantilla'}.<br>
            • <b>Campo modificado:</b> ${field}<br>
            • <b>Aumento/Decremento:</b> ${number}${isPct ? '%' : '€'} por empleado<br><br>
            <b>Coste Mensual Base:</b> ${formatE(costoActual)}<br>
            <b>Coste Estimado Total:</b> ${formatE(costoProyectado)}<br><br>
            <span class="text-lime-400 font-bold">Impacto Económico Directo: +${formatE(diferencia)} / mes</span>
        `;
    }
}

// Inicialización autoejecutable
window.VINUX = new VINUXAgent();
