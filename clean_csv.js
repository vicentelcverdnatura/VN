const fs = require('fs');

const inputFile = 'TRABAJADORES.csv';
const outputFile = 'TRABAJADORES_CORREGIDO.csv';

console.log(`Iniciando limpieza del archivo: ${inputFile}...`);

// Leemos el archivo CSV
let data;
try {
    data = fs.readFileSync(inputFile, 'utf-8');
} catch (err) {
    console.error(`Error al leer el archivo ${inputFile}. Asegúrate de ejecutar este script en la misma carpeta.`);
    process.exit(1);
}

const lines = data.split('\n');
if (lines.length === 0) {
    console.log('El archivo está vacío.');
    process.exit(1);
}

const headers = lines[0].split(',');

// Buscar el índice de la columna problemática
const colIndex = headers.indexOf('Categoria a APLICAR');

if (colIndex === -1) {
    console.log('Error: No se encontró la columna "Categoria a APLICAR" en el encabezado del CSV.');
    process.exit(1);
}

let correctedLines = [lines[0]];
let correctionsCount = 0;

for (let i = 1; i < lines.length; i++) {
    let row = lines[i];
    if (!row.trim()) continue; // saltar líneas vacías o espacios finales

    // Parseo por comas básico
    let vals = row.split(',');
    
    if (vals.length > colIndex) {
        let val = vals[colIndex].trim();
        
        // Si el valor no es un número y contiene caracteres alfabéticos (no es string vacío y falla a Float)
        if (val !== '' && isNaN(parseFloat(val))) {
            vals[colIndex] = '0'; // Forzamos un 0 numérico para el parseador backend
            correctionsCount++;
        }
    }
    
    correctedLines.push(vals.join(','));
}

fs.writeFileSync(outputFile, correctedLines.join('\n'), 'utf-8');

console.log('----------------------------------------------------');
console.log(`¡Saneamiento Completado Exitosamente!`);
console.log(`Registros procesados: ${lines.length - 1}`);
console.log(`Celdas corregidas de Type Mismatch: ${correctionsCount}`);
console.log(`Archivo generado: ${outputFile}`);
console.log('----------------------------------------------------');
console.log('Ya puedes proceder a subir TRABAJADORES_CORREGIDO.csv al sistema.');
