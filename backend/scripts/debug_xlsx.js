const XLSX = require('xlsx');

const wb = XLSX.readFile('Vendas Fabrica 2025.xlsx');
const ws = wb.Sheets['nov'];
const data = XLSX.utils.sheet_to_json(ws, {header: 1, range: 0, defval: ''});

console.log('Total de linhas:', data.length);
console.log('\nPrimeiras 30 linhas:\n');

data.slice(0, 30).forEach((row, i) => {
  console.log(`Linha ${i}:`, JSON.stringify(row));
});
