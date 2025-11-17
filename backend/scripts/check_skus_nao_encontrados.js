const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

const skusNaoEncontrados = [
  'H106 PTO', 'H106', 'H110', 'H110-DR', 'H208', 'H208-DR', 'H209', 'H209-DR',
  'H211', 'H211-DR', 'H212-GRG', 'H301 PRETO P', 'H301 PRETO M', 'H301 PRETO G',
  'H301 MARROM P', 'H301 MARROM M', 'H301 MARROM G', 'H302 PRETO P', 'H302 PRETO M',
  'H302 PRETO G', 'H302 MARROM P', 'H302 MARROM M', 'H302 MARROM G', 'H303 P',
  'H303 M', 'H303 G', 'H401', 'H403', 'H403-DR', 'H407', 'H408', 'H408-DR',
  'H409', 'H409-DR', 'H417', 'H417-PTO', 'H434', 'H434-PTO', 'H401 MAR', 'H407 MAR',
  'H507', 'H508', 'H509', 'H510', 'H511', 'H512', 'DESK PTO 20X20', 'DESK MAR 20X20',
  'DESK PTO 90X40', 'DESK MAR 90X40', 'DESK PTO 100X47', 'DESK MAR 100X47',
  'CH200-PTO-33/34', 'CH200-PTO-35/36', 'CH200-PTO-37/38', 'CH200-PTO-39/40',
  'CH202-PTO-41/42', 'CH202-PTO-43/44', 'CH200-BCO-33/34', 'CH200-BCO-35/36',
  'CH200-BCO-37/38', 'CH200-BCO-39/40', 'CH202-BCO-41/42', 'CH202-BCO-43/44',
  'CH200-RSA-33/34', 'CH200-RSA-35/36', 'CH200-RSA-37/38', 'CH200-RSA-39/40',
  'CH200-AZL-33/34', 'CH200-AZL-35/36', 'CH200-AZL-37/38', 'CH200-AZL-39/40',
  'CH200-PNK-33/34', 'CH200-PNK-35/36', 'CH200-PNK-37/38', 'CH200-PNK-39/40',
  'CH204-BGE-33/34', 'CH204-BGE-35/36', 'CH204-BGE-37/38', 'CH204-BGE-39/40',
  'CH206-BGE-41/42', 'CH206-BGE-43/44', 'CH204-PTO-33/34', 'CH204-PTO-35/36',
  'CH204-PTO-37/38', 'CH204-PTO-39/40', 'CH206-PTO-41', 'CH206-PTO-43/44'
];

async function verificar() {
  console.log(`\n🔍 Verificando ${skusNaoEncontrados.length} SKUs no banco...\n`);

  const encontrados = [];
  const naoExistem = [];
  const semelhantes = [];

  for (const sku of skusNaoEncontrados) {
    // 1. Busca exata (case-insensitive)
    const resultExato = await pool.query(
      'SELECT sku, nome, quantidade_atual FROM obsidian.produtos WHERE UPPER(sku) = UPPER($1)',
      [sku]
    );

    if (resultExato.rows.length > 0) {
      const prod = resultExato.rows[0];
      encontrados.push({
        skuBuscado: sku,
        skuReal: prod.sku,
        nome: prod.nome,
        qtd: prod.quantidade_atual
      });
      continue;
    }

    // 2. Busca similar (remover espaços, remover hífen extra)
    const skuLimpo = sku.replace(/\s+/g, '').replace(/-+/g, '-');
    const resultSimilar = await pool.query(
      `SELECT sku, nome, quantidade_atual FROM obsidian.produtos 
       WHERE UPPER(REPLACE(REPLACE(sku, ' ', ''), '-', '')) = UPPER(REPLACE(REPLACE($1, ' ', ''), '-', ''))`,
      [sku]
    );

    if (resultSimilar.rows.length > 0) {
      const prod = resultSimilar.rows[0];
      semelhantes.push({
        skuBuscado: sku,
        skuReal: prod.sku,
        nome: prod.nome,
        qtd: prod.quantidade_atual
      });
      continue;
    }

    // 3. Não existe mesmo
    naoExistem.push(sku);
  }

  console.log(`\n✅ ENCONTRADOS (grafia diferente) - ${encontrados.length}:`);
  encontrados.forEach(p => {
    console.log(`   "${p.skuBuscado}" → "${p.skuReal}" (${p.nome}) qtd=${p.qtd}`);
  });

  console.log(`\n🔄 SEMELHANTES (sem espaços/hífens) - ${semelhantes.length}:`);
  semelhantes.forEach(p => {
    console.log(`   "${p.skuBuscado}" → "${p.skuReal}" (${p.nome}) qtd=${p.qtd}`);
  });

  console.log(`\n❌ NÃO EXISTEM NO BANCO - ${naoExistem.length}:`);
  naoExistem.forEach(sku => {
    console.log(`   ${sku}`);
  });

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Encontrados (case diferente): ${encontrados.length}`);
  console.log(`   🔄 Semelhantes (formatação): ${semelhantes.length}`);
  console.log(`   ❌ Não existem: ${naoExistem.length}`);
  console.log(`   📦 Total verificado: ${skusNaoEncontrados.length}`);

  await pool.end();
}

verificar();
