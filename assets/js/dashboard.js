// dashboard.js - Handles Chart.js and Dashboard Stats

const Dashboard = {
    chartDepts: null,
    chartVars: null,

    render(data) {
        if (!data || data.length === 0) return;

        // 1. Calcular Stats Globales
        const totalEmps = data.length;
        let sumHoras = 0;
        let sumVars = 0;
        let sumComps = 0;
        
        const deptsCount = {};
        const deptsVars = {};
        const catsCount = {};

        data.forEach(d => {
            // Stats basicos
            // Horas Registradas a veces puede venir con una 'h' en el texto.
            let hrs = parseFloat(d['Horas Registradas']) || parseFloat(d['total_hrs_fichadas']) || 0;
            if(Number.isNaN(hrs)) hrs = 0;
            sumHoras += hrs;
            
            sumVars += parseFloat(d['Variable']) || 0;
            sumComps += parseFloat(d['COMPLEMENTO']) || parseFloat(d['FRIO']) || 0; // sumar los dos

            // Depts agrupacion
            const dept = d['Depart.'] || d['department_group'] || 'Desconocido';
            if(!deptsCount[dept]) deptsCount[dept] = 0;
            if(!deptsVars[dept]) deptsVars[dept] = 0;
            
            deptsCount[dept] += 1;
            deptsVars[dept] += parseFloat(d['Variable']) || 0;

            const cat = d['CATEGORIA'] || d['Cat. prof.'] || 'Desconocida';
            if(!catsCount[cat]) catsCount[cat] = 0;
            catsCount[cat] += 1;
        });

        // Actualizar UI top stats
        document.getElementById('dash-total-emps').textContent = totalEmps;
        document.getElementById('dash-avg-hrs').textContent = totalEmps > 0 ? (sumHoras / totalEmps).toFixed(1) : '0';
        document.getElementById('dash-total-variables').textContent = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(sumVars);
        document.getElementById('dash-total-comps').textContent = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(sumComps);

        // 2. Render Charts
        this.renderDeptsChart(deptsCount);
        this.renderCatsChart(catsCount);
        this.renderVarsChart(deptsVars);
    },

    renderDeptsChart(deptsCount) {
        const ctx = document.getElementById('chart-depts');
        if(this.chartDepts) this.chartDepts.destroy();

        // Ordenar por tamaño
        const sorted = Object.entries(deptsCount).sort((a,b) => b[1] - a[1]);
        
        const palette = ['#bef264', '#a3e635', '#84cc16', '#65a30d', '#4d7c0f', '#3f6212', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#a855f7', '#7e22ce', '#3b82f6', '#1d4ed8'];
        const bgColors = sorted.map((_, i) => palette[i % palette.length]);

        this.chartDepts = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sorted.map(k => k[0]),
                datasets: [{
                    data: sorted.map(k => k[1]),
                    backgroundColor: bgColors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        display: true,
                        labels: { color: '#a1a1aa', font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 15 }
                    }
                },
                cutout: '75%'
            }
        });
    },

    renderCatsChart(catsCount) {
        const ctx = document.getElementById('chart-categories');
        if(!ctx) return;
        if(this.chartCats) this.chartCats.destroy();

        const sorted = Object.entries(catsCount).sort((a,b) => b[1] - a[1]);
        const palette = ['#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#38bdf8', '#fbbf24', '#f59e0b', '#d97706'];
        const bgColors = sorted.map((_, i) => palette[i % palette.length]);

        this.chartCats = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sorted.map(k => k[0]),
                datasets: [{
                    data: sorted.map(k => k[1]),
                    backgroundColor: bgColors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        display: sorted.length <= 15,
                        labels: { color: '#a1a1aa', font: { family: 'Inter' } }
                    }
                },
                cutout: '75%'
            }
        });
    },

    renderVarsChart(deptsVars) {
        const ctx = document.getElementById('chart-variables');
        if(this.chartVars) this.chartVars.destroy();

        // Ordenar top 5
        const sorted = Object.entries(deptsVars)
            .filter(a => a[1] > 0)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 8);
        
        this.chartVars = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(k => k[0].substring(0,10) + '...'), // truncate
                datasets: [{
                    label: 'Variables Agregadas (€)',
                    data: sorted.map(k => k[1]),
                    backgroundColor: '#bef264',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#a1a1aa' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#a1a1aa' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
};

window.Dashboard = Dashboard;
