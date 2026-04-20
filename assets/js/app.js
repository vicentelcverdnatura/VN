// app.js - Main Application Controller

const App = {
    data: [], // Almacén local en memoria una vez sacado de IndexedDB
    currentPage: 1,
    itemsPerPage: 100,
    filteredData: [],

    historyUndo: [],
    historyRedo: [],
    systemLog: [], // Memoria en cadena de eventos
    fileHandle: null, // Para guardar sobrescribiendo

    async init() {
        try {
            await window.DB.init();

            // Check if we have data
            this.data = await window.DB.getAll();
            this.filteredData = [...this.data];

            this.bindNavigation();
            this.bindUploadEvents();
            this.bindSearchAndPagination();
            this.bindGlobalMod();
            this.bindTopBarActions(); // Nuevo enlace para exportar, guardar, deshacer, rehacer
            this.bindHistoryLogger(); // Activa el panel de Control Interno

            this.addSystemLog('Sistema Inicializado', 'El Agente Salarial se ha cargado en memoria local correctamente.');

            if (this.data.length > 0) {
                this.refreshUI();
            } else {
                this.showToast('No hay datos. Carga datos.csv para comenzar.', 'warning');
            }
        } catch (e) {
            console.error("App init error:", e);
            this.showToast('Error accediendo a la base de datos local.', 'error');
        }
    },

    bindNavigation() {
        const navBtns = document.querySelectorAll('.nav-item');
        const views = document.querySelectorAll('main section');
        const titleH = document.getElementById('header-title');

        navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update styling
                navBtns.forEach(b => {
                    b.classList.remove('bg-lime-500/10', 'text-lime-400');
                    b.classList.add('text-zinc-400', 'hover:bg-zinc-800/50', 'hover:text-zinc-100');
                    let icon = b.querySelector('svg') || b.querySelector('i');
                    if (icon) {
                        icon.classList.remove('text-lime-400');
                        icon.classList.add('group-hover:text-white');
                    }
                });

                btn.classList.add('bg-lime-500/10', 'text-lime-400');
                btn.classList.remove('text-zinc-400', 'hover:bg-zinc-800/50', 'hover:text-zinc-100');
                let activeIcon = btn.querySelector('svg') || btn.querySelector('i');
                if (activeIcon) {
                    activeIcon.classList.add('text-lime-400');
                    activeIcon.classList.remove('group-hover:text-white');
                }

                // Switch View
                const targetViewId = btn.getAttribute('data-target');
                views.forEach(v => {
                    if (v.id === targetViewId) {
                        v.classList.remove('hidden');
                        v.classList.add('animate-slide-up');
                        if (v.id === 'view-dashboard') {
                            v.classList.remove('flex', 'flex-col');
                            v.classList.add('block');
                        } else {
                            v.classList.remove('block');
                            v.classList.add('flex', 'flex-col');
                        }
                    } else {
                        v.classList.add('hidden');
                        v.classList.remove('flex', 'flex-col', 'block', 'animate-slide-up');
                    }
                });

                // Update Title
                if (targetViewId === 'view-dashboard') {
                    titleH.textContent = "Visión General";
                    if (window.Dashboard) window.Dashboard.render(this.data);
                }
                if (targetViewId === 'view-database') {
                    titleH.textContent = "Base de Datos Personal";
                    this.refreshUI(); // Forzar repintado dinámico al entrar
                }
                if (targetViewId === 'view-ai') titleH.textContent = "Agente S.A.L.I.X.";
                if (targetViewId === 'view-json-refactor') titleH.textContent = "Refactorizador de JSON (AI)";
                if (targetViewId === 'view-history') titleH.textContent = "Control Interno";
            });
        });
    },

    bindTopBarActions() {
        const btnExport = document.getElementById('btn-export-csv');
        const btnSave = document.getElementById('btn-save-file');
        const btnUndo = document.getElementById('btn-undo');
        const btnRedo = document.getElementById('btn-redo');

        if (btnExport) btnExport.addEventListener('click', () => this.exportCSV());
        if (btnSave) btnSave.addEventListener('click', () => this.saveToOriginalFile());

        if (btnUndo) btnUndo.addEventListener('click', () => this.undoAction());
        if (btnRedo) btnRedo.addEventListener('click', () => this.redoAction());
    },

    bindHistoryLogger() {
        const btnDl = document.getElementById('btn-download-history');
        if (btnDl) {
            btnDl.addEventListener('click', () => {
                if (this.systemLog.length === 0) return this.showToast('Log vacío', 'warning');

                let textContent = "=== REGISTRO DEL SISTEMA (LOG MAESTRO) ===\n";
                textContent += `Generado el: ${new Date().toLocaleString()}\n\n`;
                this.systemLog.forEach(log => {
                    textContent += `[${log.time}] - ${log.action}\n`;
                    if (log.details) textContent += `    > ${log.details}\n`;
                });

                const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `session_log_${Date.now()}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
        }
    },

    addSystemLog(action, details = '') {
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        const logEntry = { time: timeStr, action, details, timestamp: now };

        // Agregar al inicio del array (más reciente primero)
        this.systemLog.unshift(logEntry);

        // Inject in DOM si container existe
        const container = document.getElementById('history-log-container');
        if (container) {
            const div = document.createElement('div');
            div.className = "flex justify-between items-start p-4 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group";
            div.innerHTML = `
                <div class="flex-1">
                    <p class="text-sm font-semibold text-zinc-200 group-hover:text-lime-400 transition-colors">${action}</p>
                    ${details ? `<p class="text-xs text-zinc-500 mt-1">${details}</p>` : ''}
                </div>
                <div class="shrink-0 ml-4 py-1 flex items-center">
                    <span class="text-xs font-mono text-zinc-600 font-bold bg-zinc-900 rounded-md px-2 py-1 border border-zinc-800">${timeStr}</span>
                </div>
            `;
            container.prepend(div);
        }
    },

    pushHistoryState() {
        // Guarda un clon inmutable del estado exacto antes del cambio
        const snap = JSON.parse(JSON.stringify(this.data));
        this.historyUndo.push(snap);
        this.historyRedo = []; // Al hacer un nuevo cambio el futuro se borra
        if (this.historyUndo.length > 20) this.historyUndo.shift(); // Límite de 20 para no colapsar RAM
        this.updateHistoryButtons();
    },

    updateHistoryButtons() {
        const btnUndo = document.getElementById('btn-undo');
        const btnRedo = document.getElementById('btn-redo');
        if (btnUndo) {
            btnUndo.disabled = this.historyUndo.length === 0;
            if (window.lucide) lucide.createIcons(); // Reactiva estílos SVG de lucide si fue desactivado
        }
        if (btnRedo) btnRedo.disabled = this.historyRedo.length === 0;
    },

    async undoAction() {
        if (this.historyUndo.length === 0) return;
        const currentSnap = JSON.parse(JSON.stringify(this.data));
        this.historyRedo.push(currentSnap);
        const prevSnap = this.historyUndo.pop();

        this.data = prevSnap;
        this.filteredData = [...this.data];
        await window.DB.insertBatch(this.data);
        this.refreshUI();
        this.updateHistoryButtons();
        this.showToast('Acción Deshecha', 'success');
        this.addSystemLog('Deshacer Acción', 'Se retrocedió el estado de los datos al paso anterior.');
    },

    async redoAction() {
        if (this.historyRedo.length === 0) return;
        const currentSnap = JSON.parse(JSON.stringify(this.data));
        this.historyUndo.push(currentSnap);
        const nextSnap = this.historyRedo.pop();

        this.data = nextSnap;
        this.filteredData = [...this.data];
        await window.DB.insertBatch(this.data);
        this.refreshUI();
        this.updateHistoryButtons();
        this.showToast('Acción Rehecha', 'success');
        this.addSystemLog('Rehacer Acción', 'Se avanzó el estado de los datos hacia adelante nuevamente.');
    },

    async exportCSV() {
        try {
            // Convertimos la base de datos a formato CSV eliminando la columna uuid interna
            const exportData = this.data.map(row => {
                const clone = { ...row };
                delete clone.uuid; // No exportar el identificador interno falso
                delete clone.foto;
                return clone;
            });
            const csvText = Papa.unparse(exportData, { delimiter: ',' });

            const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Copia_Exportada_${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            this.showToast('Archivo CSV Exportado', 'success');
            this.addSystemLog('Exportación Manual Descargada', 'Se descargó exitosamente el archivo "Copia_Exportada_.csv".');
        } catch (e) {
            console.error(e);
            this.showToast('Error al exportar CSV', 'error');
        }
    },

    async saveToOriginalFile() {
        try {
            const exportData = this.data.map(row => {
                const clone = { ...row };
                delete clone.uuid;
                return clone;
            });
            const csvText = Papa.unparse(exportData, { delimiter: ',' });

            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'TRABAJADORES.csv',
                    types: [{
                        description: 'CSV File',
                        accept: { 'text/csv': ['.csv'] },
                    }],
                });
                const writable = await handle.createWritable();
                // Escribir el BOM UTF-8 y luego el texto para que Excel lo lea bien
                await writable.write("\uFEFF" + csvText);
                await writable.close();
                this.showToast('Sobrescrito Satistactoriamente', 'success');
                this.addSystemLog('Sobrescritura Local (Save)', 'Archivo local TRABAJADORES.csv actualizado empleando la File System Access API.');
            } else {
                this.exportCSV(); // Fallback temporal a descargas clásicas
                this.showToast('Navegador incompatible con guardado directo. Se ha descargado un archivo.', 'warning');
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error(e);
                this.showToast('Fallo al sobrescribir archivo', 'error');
            }
        }
    },

    bindUploadEvents() {
        const btnSync = document.getElementById('btn-sync');
        const fileInput = document.getElementById('csv-file-input');

        btnSync.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true, // Auto convert numbers
                encoding: "UTF-8",
                complete: async (results) => {
                    const numberCols = ['h.', 'Horas Registradas', 'GRUPO', 'COMPLEMENTO', 'FRIO', 'Variable'];
                    const requiredCols = ['id', 'Nombre'];
                    const logs = [];
                    const cleanData = [];
                    let errorsCount = 0;

                    logs.push(`=== REPORTE DE IMPORTACIÓN: ${new Date().toLocaleString()} ===`);

                    results.data.forEach((row, index) => {
                        const rowNum = index + 2;
                        let rowHasFatalError = false;

                        // Validar campos requeridos mínimos
                        for (let col of requiredCols) {
                            if (row[col] === undefined || row[col] === null || row[col] === '') {
                                logs.push(`[Línea ${rowNum}] Error Fatal: Falta el campo requerido '${col}'. Fila omitida.`);
                                rowHasFatalError = true;
                                errorsCount++;
                            }
                        }

                        if (rowHasFatalError) return; // Saltarse la fila, pero continuar con el resto

                        // Limpiar y validar tipos
                        numberCols.forEach(f => {
                            if (row[f] !== undefined) {
                                let val = row[f];
                                if (!val && val !== 0) val = 0;

                                if (typeof val === 'string') {
                                    val = parseFloat(val.replace(',', '.'));
                                }

                                if (isNaN(val)) {
                                    logs.push(`[Línea ${rowNum}] Type Mismatch corregido: '${f}' contenía texto. Asignado a 0.`);
                                    row[f] = 0;
                                    errorsCount++;
                                } else {
                                    row[f] = val;
                                }
                            } else {
                                if (f === 'Variable') row[f] = 0;
                            }
                        });

                        row.uuid = window.DB.generateUUID();
                        cleanData.push(row);
                    });

                    logs.push(`\nImportación finalizada. Filas procesadas exitosamente: ${cleanData.length}`);
                    if (errorsCount === 0) logs.push(`Estado: PERFECTO. Cero errores detectados.`);

                    logs.push(`\n=== DIAGNÓSTICO PROFUNDO: ESTRUCTURA DE LA FILA 1 ===`);
                    if (cleanData.length > 0) {
                        logs.push(`Columnas extraídas: ${Object.keys(cleanData[0]).join(', ')}`);
                        logs.push(JSON.stringify(cleanData[0], null, 2));
                    }

                    const logText = logs.join('\n');
                    const fileName = `import_log_${new Date().getTime()}.txt`;

                    // Descarga directa sin preguntar (Direct to Downloads)
                    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    // Insertar SIEMPRE en base de datos para no dejar pantallas vacías
                    try {
                        await window.DB.insertBatch(cleanData);
                        this.data = cleanData;
                        this.filteredData = [...this.data];
                        this.refreshUI();
                        this.showToast(errorsCount > 0 ? `Datos cargados con ${errorsCount} advertencias automáticas` : 'Datos cargados exitosamente!', errorsCount > 0 ? 'warning' : 'success');
                        this.addSystemLog('Importación CSV Completa', `Archivo procesado: ${file.name}. Total Filas = ${cleanData.length}. Correcciones = ${errorsCount}.`);
                    } catch (err) {
                        console.error(err);
                        this.showToast('Error al insertar a BD Local', 'error');
                    }
                }
            });
            fileInput.value = ''; // reset
        });
    },

    bindSearchAndPagination() {
        const searchInput = document.getElementById('search-input');
        const deptSelect = document.getElementById('filter-dept');
        const catSelect = document.getElementById('filter-cat');
        const btnPrev = document.getElementById('btn-prev-page');
        const btnNext = document.getElementById('btn-next-page');

        const filterData = () => {
            const query = searchInput.value.toLowerCase();
            const deptFilter = deptSelect.value;
            const catFilter = catSelect.value;

            this.filteredData = this.data.filter(row => {
                const queryText = Object.values(row).join(' ').toLowerCase();
                const dept = (row['Depart.'] || row['department_group'] || '-');
                const cat = (row['CATEGORIA'] || row['Cat. prof.'] || '-');

                const matchName = queryText.includes(query);
                const matchDept = deptFilter === 'ALL' || dept === deptFilter;
                const matchCat = catFilter === 'ALL' || cat === catFilter;

                return matchName && matchDept && matchCat;
            });
            this.currentPage = 1;
            this.renderTable();
        };

        searchInput.addEventListener('input', filterData);
        deptSelect.addEventListener('change', filterData);
        catSelect.addEventListener('change', filterData);

        btnPrev.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderTable();
            }
        });

        btnNext.addEventListener('click', () => {
            const maxPage = Math.ceil(this.filteredData.length / this.itemsPerPage);
            if (this.currentPage < maxPage) {
                this.currentPage++;
                this.renderTable();
            }
        });
    },

    bindGlobalMod() {
        const btnModal = document.getElementById('btn-global-edit');
        const modal = document.getElementById('global-modal');
        const btnClose = document.getElementById('btn-close-modal');
        const btnApply = document.getElementById('btn-apply-mod');
        const modDeptSelect = document.getElementById('mod-dept');

        btnModal.addEventListener('click', () => {
            // Populate logic
            const depts = new Set();
            this.data.forEach(d => {
                if (d['Depart.']) depts.add(d['Depart.']);
            });

            let options = '<option value="ALL">Todos los departamentos</option>';
            [...depts].sort().forEach(dept => {
                options += `<option value="${dept}">${dept}</option>`;
            });
            modDeptSelect.innerHTML = options;

            modal.classList.remove('hidden');
        });

        btnClose.addEventListener('click', () => modal.classList.add('hidden'));

        btnApply.addEventListener('click', async () => {
            this.pushHistoryState(); // Guarda estado antes de modificacion masiva

            const dept = document.getElementById('mod-dept').value;
            const field = document.getElementById('mod-field').value;
            const op = document.getElementById('mod-op').value;
            const val = parseFloat(document.getElementById('mod-val').value) || 0;

            const targets = this.data.filter(d => dept === 'ALL' || d['Depart.'] === dept);
            let changesAplied = 0;

            targets.forEach(t => {
                let current = parseFloat(t[field]) || 0;
                if (op === 'add') current += val;
                if (op === 'sub') current -= val;
                if (op === 'set') current = val;
                if (op === 'pct') current = current + (current * (val / 100)); // Incrementar x%

                t[field] = current;
                changesAplied++;
            });

            if (changesAplied > 0) {
                await window.DB.updateBatch(targets);
                this.refreshUI();
                this.showToast(`Modificados ${changesAplied} registros en BD.`, 'success');
                this.addSystemLog('Operación Global', `Operación (${op}) con valor (${val}) a [${field}] completada. Aplicado a ${changesAplied} registros.`);
                modal.classList.add('hidden');
            }
        });
    },

    refreshUI() {
        this.populateFilters();
        this.renderTable();
        if (window.Dashboard) window.Dashboard.render(this.data);
    },

    populateFilters() {
        const deptSelect = document.getElementById('filter-dept');
        const catSelect = document.getElementById('filter-cat');

        const depts = new Set();
        const cats = new Set();

        this.data.forEach(d => {
            const dp = d['Depart.'] || d['department_group'];
            const ct = d['CATEGORIA'] || d['Cat. prof.'];
            if (dp) depts.add(dp);
            if (ct) cats.add(ct);
        });

        let deptOptions = '<option value="ALL">Todos los Dptos</option>';
        [...depts].sort().forEach(d => deptOptions += `<option value="${d}">${d}</option>`);
        if (deptSelect) deptSelect.innerHTML = deptOptions;

        let catOptions = '<option value="ALL">Todas las Categorías</option>';
        [...cats].sort().forEach(c => catOptions += `<option value="${c}">${c}</option>`);
        if (catSelect) catSelect.innerHTML = catOptions;
    },

    renderTable() {
        const thead = document.getElementById('table-head');
        const tbody = document.getElementById('table-body');
        const tfoot = document.getElementById('table-foot');
        const info = document.getElementById('table-entries-info');
        const btnPrev = document.getElementById('btn-prev-page');
        const btnNext = document.getElementById('btn-next-page');

        if (thead) thead.innerHTML = '';
        if (tbody) tbody.innerHTML = '';
        if (tfoot) tfoot.innerHTML = '';

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const slice = this.filteredData.slice(start, end);

        let keys = [];
        if (this.data.length > 0) {
            keys = Object.keys(this.data[0]).filter(k => k !== 'uuid' && k !== 'foto');

            let theadHtml = '<tr>';
            keys.forEach(k => {
                theadHtml += `<th class="px-6 py-4 font-medium">${k}</th>`;
            });
            theadHtml += '</tr>';
            if (thead) thead.innerHTML = theadHtml;
        }

        try {
            if (slice.length === 0) {
                if (tbody) tbody.innerHTML = `<tr><td colspan="${keys.length || 9}" class="px-6 py-12 text-center text-zinc-500 bg-zinc-900/50">
                    <i data-lucide="ghost" class="w-12 h-12 text-zinc-700 mx-auto mb-3"></i>
                    <p class="text-lg font-bold text-white">No hay datos disponibles en la vista</p>
                    <p class="text-sm mt-2">Diagnóstico interno: DataTotal=${this.data.length} | Filtrados=${this.filteredData.length}</p>
                </td></tr>`;
                if (window.lucide) lucide.createIcons();
            } else {
                let fragment = document.createDocumentFragment();
                slice.forEach(row => {
                    const tr = document.createElement('tr');
                    let trContent = '';
                    keys.forEach(k => {
                        let val = row[k] === null || row[k] === undefined ? '' : row[k];
                        let safeVal = typeof val === 'string' ? val.replace(/"/g, '&quot;') : val;
                        trContent += `<td class="px-2 py-2 text-zinc-300">
                            <input type="text" data-uuid="${row.uuid}" data-field="${k}" class="w-full min-w-[100px] bg-transparent border-none focus:bg-zinc-800/80 focus:ring-1 focus:ring-lime-500 rounded px-2 py-1 text-zinc-300 table-cell-edit" value="${safeVal}">
                        </td>`;
                    });
                    tr.innerHTML = trContent;
                    fragment.appendChild(tr);
                });
                if (tbody) tbody.appendChild(fragment);

                // Bind change events
                const inputs = tbody.querySelectorAll('.table-cell-edit');
                inputs.forEach(input => {
                    input.addEventListener('change', async (e) => {
                        this.pushHistoryState(); // Guarda estado antes de actualizar

                        const uuid = e.target.getAttribute('data-uuid');
                        const field = e.target.getAttribute('data-field');
                        let newVal = e.target.value;

                        const record = this.data.find(d => d.uuid === uuid);
                        if (record) {
                            if (typeof record[field] === 'number' || (typeof record[field] === 'string' && record[field] !== '' && !isNaN(Number(record[field].replace(',', '.'))))) {
                                let parsed = parseFloat(newVal.replace(',', '.'));
                                if (!isNaN(parsed)) {
                                    newVal = parsed;
                                    e.target.value = newVal;
                                }
                            }
                            record[field] = newVal;
                            const fRecord = this.filteredData.find(d => d.uuid === uuid);
                            if (fRecord) fRecord[field] = newVal;

                            try {
                                await window.DB.updateBatch([record]);
                                this.calculateAndRenderFooters(keys);
                                if (window.Dashboard) window.Dashboard.render(this.data);
                                this.showToast('Cambios guardados', 'success');
                                this.addSystemLog('Modificación Celda', `Celda actualiza: [${field}] Trabajador: [${record.Nombre || uuid}]. Nuevo valor: ${newVal}`);
                            } catch (err) {
                                this.showToast('Error al guardar', 'error');
                            }
                        }
                    });
                });
            }

            // Contabilidad Footer
            this.calculateAndRenderFooters(keys);

            // Pagination info
            if (info) info.textContent = `Mostrando ${start + 1} - ${Math.min(end, this.filteredData.length)} de ${this.filteredData.length} registros`;

            if (btnPrev) btnPrev.disabled = this.currentPage === 1;
            if (btnNext) btnNext.disabled = end >= this.filteredData.length;

        } catch (errorR) {
            console.error("Error crítico en RenderTable:", errorR);
            if (tbody) tbody.innerHTML = `<tr><td class="text-red-500 text-center p-8">Error al procesar los datos de la Base de Datos. Contactar administrador.</td></tr>`;
        }
    },

    calculateAndRenderFooters(keys) {
        if (!keys || keys.length === 0) return;

        let sumColumns = ['Horas Registradas', 'total_hrs_fichadas', 'h.', 'GRUPO', 'COMPLEMENTO', 'FRIO', 'Variable'];
        let totals = {};
        keys.forEach(k => totals[k] = 0);

        this.filteredData.forEach(d => {
            keys.forEach(k => {
                if (sumColumns.includes(k)) {
                    let h = parseFloat(d[k]) || 0;
                    totals[k] += h;
                }
            });
        });

        const formatE = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);

        const tfoot = document.getElementById('table-foot');
        if (!tfoot) return;

        let trHtml = '<tr>';
        keys.forEach((k, idx) => {
            if (idx === 0) {
                trHtml += `<td class="px-6 py-4 text-right font-bold text-zinc-300">TOTALES:</td>`;
            } else if (sumColumns.includes(k)) {
                let isEuros = ['GRUPO', 'COMPLEMENTO', 'FRIO', 'Variable'].includes(k);
                let text = isEuros ? formatE(totals[k]) : totals[k].toFixed(2) + ' h';
                trHtml += `<td class="px-6 py-4 text-left font-bold text-lime-400 tabular-nums">${text}</td>`;
            } else {
                trHtml += `<td></td>`;
            }
        });
        trHtml += '</tr>';

        tfoot.innerHTML = trHtml;
    },

    showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');

        let colorClass = 'bg-zinc-800 border-zinc-700';
        let icon = '<i data-lucide="info" class="w-4 h-4 text-zinc-400 mr-2"></i>';

        if (type === 'success') {
            colorClass = 'bg-lime-500/10 border-lime-500/30 text-lime-400';
            icon = '<i data-lucide="check-circle" class="w-4 h-4 mr-2"></i>';
        } else if (type === 'error') {
            colorClass = 'bg-red-500/10 border-red-500/30 text-red-400';
            icon = '<i data-lucide="alert-circle" class="w-4 h-4 mr-2"></i>';
        }

        toast.className = `flex items-center px-4 py-3 border rounded-xl shadow-lg backdrop-blur-md animate-slide-up ${colorClass}`;
        toast.innerHTML = `${icon} <span class="text-sm font-medium">${msg}</span>`;

        container.appendChild(toast);
        lucide.createIcons();

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

window.App = App;
