const XLSX = require('xlsx');
const path = require('path');

const arquivo = path.resolve(process.argv[2] || '../Vendas Fabrica 2025.xlsx');
const ABA = 'nov';

const wb = XLSX.readFile(arquivo);
if (!wb.SheetNames.includes(ABA)) {
  console.error('Aba not found:', wb.SheetNames.join(', '));
  process.exit(1);
}
const ws = wb.Sheets[ABA];
const dados = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

let totalLines = 0;
let totalQuantidade = 0;
const skus = new Set();

for (let i = 3; i < dados.length; i++) {
  const row = dados[i];
  if (!row || !row[3]) continue; // coluna Codigo (SKU) index 3
  const sku = (row[3] || '').toString().trim();
  const quantidadeRaw = row[4]; // index 4
  const quantidade = Number(quantidadeRaw) || 0;
  if (!sku || quantidade <= 0) continue;
  totalLines++;
  totalQuantidade += quantidade;
  skus.add(sku);
}

console.log('Linhas com venda válidas:', totalLines);
console.log('Soma total das quantidades:', totalQuantidade);
console.log('SKUs distintos vendidos:', skus.size);
console.log('Lista dos 10 SKUs mais frequentes (amostra):');

// contar frequência
const freq = {};
for (let i = 3; i < dados.length; i++) {
  const row = dados[i];
  if (!row || !row[3]) continue;
  const sku = (row[3] || '').toString().trim();
  const quantidade = Number(row[4]) || 0;
  if (!sku || quantidade <= 0) continue;
  freq[sku] = (freq[sku] || 0) + quantidade;
}

const top = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,10);
console.table(top.map(([sku, q])=>({ sku, quantidade: q })));
