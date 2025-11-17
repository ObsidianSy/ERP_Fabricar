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

// Dados do CSV
const dados = `H100,H101,9,"R$ 81,00"
H100,H102,8,"R$ 96,00"
H100,H103,15,"R$ 120,00"
H100,H104,16,"R$ 192,00"
H100,H105,2,"R$ 18,00"
H100,H106 PTO,24,"R$ 360,00"
H100,H106,13,"R$ 195,00"
H100,H107,29,"R$ 290,00"
H100,H108,9,"R$ 81,00"
H100,H109,15,"R$ 135,00"
H100,H110,6,"R$ 54,00"
H100,H110-DR,18,"R$ 180,00"
H100,H111,10,"R$ 100,00"
H101,H112,15,"R$ 180,00"
H102,H113,10,"R$ 120,00"
H100,H114,17,"R$ 255,00"
H100,H115,6,"R$ 114,00"
H100,H116,5,"R$ 45,00"
H100,H117,4,"R$ 36,00"
H100,H118,15,"R$ 210,00"
H100,H119,7,"R$ 63,00"
H100,H120,0,R$ -
H100,H121,15,"R$ 255,00"
H100,H122,21,"R$ 294,00"
H100,H123,0,R$ -
H100,H124,13,"R$ 156,00"
H200,H201,79,"R$ 2.291,00"
H200,H202,12,"R$ 288,00"
H200,H203,15,"R$ 225,00"
H200,H204,20,"R$ 580,00"
H200,H205,0,R$ -
H200,H206,5,"R$ 85,00"
H200,H207,5,"R$ 60,00"
H200,H208,4,"R$ 48,00"
H200,H208-DR,2,"R$ 24,00"
H200,H209,0,R$ -
H200,H209-DR,4,"R$ 52,00"
H200,H211,11,R$ -
H200,H211-DR,0,R$ -
H200,H212-GRG,0,R$ -
H200,H213,0,R$ -
H200,H214,0,R$ -
H200,H215,15,"R$ 300,00"
H200,H216,42,"R$ 1.008,00"
H200,H217,0,R$ -
H200,H218,-17,"-R$ 238,00"
H200,H219,20,"R$ 240,00"
H200,H220,2,"R$ 26,00"
H200,H221,5,"R$ 85,00"
H200,H222,4,"R$ 52,00"
H200,H223,0,R$ -
H200,H113,10,"R$ 120,00"
H200,H225,0,R$ -
H200,H226,0,R$ -
H200,H227,3,"R$ 60,00"
H200,H228,0,R$ -
H200,H229,7,"R$ 140,00"
H200,H230,2,"R$ 40,00"
H200,H231,9,"R$ 99,00"
H200,H232,9,"R$ 58,50"
H200,H233,4,"R$ 48,00"
H200,H234,0,R$ -
H200,H235,0,R$ -
H300,H301 PRETO P,1,"R$ 24,00"
H300,H301 PRETO M,68,"R$ 1.632,00"
H300,H301 PRETO G,1,"R$ 24,00"
H300,H301 MARROM P,106,"R$ 2.544,00"
H300,H301 MARROM M,36,"R$ 864,00"
H300,H301 MARROM G,95,"R$ 2.280,00"
H300,H302 PRETO P,137,"R$ 3.288,00"
H300,H302 PRETO M,118,"R$ 2.832,00"
H300,H302 PRETO G,89,"R$ 2.136,00"
H300,H302 MARROM P,5,"R$ 120,00"
H300,H302 MARROM M,36,"R$ 864,00"
H300,H302 MARROM G,13,"R$ 312,00"
H300,H303 P,0,R$ -
H300,H303 M,54,"R$ 1.296,00"
H300,H303 G,49,"R$ 1.176,00"
H400,H401,7,"R$ 98,00"
H400,H402,65,"R$ 780,00"
H400,H403,85,"R$ 935,00"
H400,H403-DR,17,"R$ 187,00"
H400,H404,48,"R$ 624,00"
H400,H405,0,R$ -
H400,H406,30,"R$ 390,00"
H400,H407,3,"R$ 48,00"
H400,H408,15,"R$ 210,00"
H400,H408-DR,1,"R$ 14,00"
H400,H409,20,"R$ 260,00"
H400,H409-DR,1,"R$ 13,00"
H400,H410,5,"R$ 50,00"
H400,H411,2,"R$ 18,00"
H400,H412,30,"R$ 450,00"
H400,H413,14,"R$ 196,00"
H400,H414,62,"R$ 992,00"
H400,H415,9,"R$ 81,00"
H400,H416,0,R$ -
H400,H417,12,"R$ 108,00"
H400,H417-PTO,15,"R$ 135,00"
H400,H418,0,R$ -
H400,H419,1,"R$ 7,00"
H400,H420,11,"R$ 132,00"
H400,H421,7,"R$ 105,00"
H400,H422,15,"R$ 210,00"
H400,H423,1,"R$ 14,00"
H400,H424,4,"R$ 52,00"
H400,H425,4,"R$ 56,00"
H400,H426,5,"R$ 45,00"
H400,H427,0,R$ -
H400,H428,0,R$ -
H400,H429,0,R$ -
H400,H430,0,R$ -
H400,H431,0,R$ -
H400,H432,20,"R$ 260,00"
H400,H433,9,"R$ 126,00"
H400,H434,4,"R$ 44,00"
H400,H434-PTO,5,"R$ 55,00"
H400,H435,5,"R$ 100,00"
H400,H436,4,"R$ 80,00"
H400,H437,3,"R$ 60,00"
H400,H401 MAR,2,"R$ 28,00"
H400,H407 MAR,0,R$ -
H500,H501,10,"R$ 80,00"
H500,H502,2,"R$ 14,00"
H500,H503,4,"R$ 28,00"
H500,H504,2,"R$ 12,00"
H500,H505,1,"R$ 8,00"
H500,H506,5,"R$ 45,00"
H500,H507,0,R$ -
H500,H508,0,R$ -
H500,H509,0,R$ -
H500,H510,0,R$ -
H500,H511,0,R$ -
H500,,0,R$ -
H500,H512,0,R$ -
H600,H601,30,"R$ 180,00"
H600,H602,16,"R$ 96,00"
H600,H603,0,R$ -
H600,H604,5,"R$ 30,00"
H600,H605,0,R$ -
H600,H606,0,R$ -
DESK,DESK PTO 20X20,0,R$ -
DESK,DESK MAR 20X20,0,R$ -
DESK,DESK PTO 90X40,0,R$ -
DESK,DESK MAR 90X40,0,R$ -
DESK,DESK PTO 100X47,0,R$ -
DESK,DESK MAR 100X47,0,R$ -
CH,CH200-PTO-33/34,0,R$ -
CH,CH200-PTO-35/36,0,R$ -
CH,CH200-PTO-37/38,0,R$ -
CH,CH200-PTO-39/40,0,R$ -
CH,CH202-PTO-41/42,0,R$ -
CH,CH202-PTO-43/44,0,R$ -
CH,CH200-BCO-33/34,0,R$ -
CH,CH200-BCO-35/36,0,R$ -
CH,CH200-BCO-37/38,0,R$ -
CH,CH200-BCO-39/40,0,R$ -
CH,CH202-BCO-41/42,0,R$ -
CH,CH202-BCO-43/44,0,R$ -
CH,CH200-RSA-33/34,0,R$ -
CH,CH200-RSA-35/36,0,R$ -
CH,CH200-RSA-37/38,0,R$ -
CH,CH200-RSA-39/40,0,R$ -
CH,CH200-AZL-33/34,0,R$ -
CH,CH200-AZL-35/36,0,R$ -
CH,CH200-AZL-37/38,0,R$ -
CH,CH200-AZL-39/40,0,R$ -
CH,CH200-PNK-33/34,0,R$ -
CH,CH200-PNK-35/36,0,R$ -
CH,CH200-PNK-37/38,0,R$ -
CH,CH200-PNK-39/40,0,R$ -
CH,CH204-BGE-33/34,0,R$ -
CH,CH204-BGE-35/36,0,R$ -
CH,CH204-BGE-37/38,0,R$ -
CH,CH204-BGE-39/40,0,R$ -
CH,CH206-BGE-41/42,0,R$ -
CH,CH206-BGE-43/44,0,R$ -
CH,CH204-PTO-33/34,0,R$ -
CH,CH204-PTO-35/36,0,R$ -
CH,CH204-PTO-37/38,0,R$ -
CH,CH204-PTO-39/40,-2,"-R$ 70,00"
CH,"CH206-PTO-41""",0,R$ -
CH,CH206-PTO-43/44,0,R$ -
pingente,P-01,0,R$ -
pingente,P-02,0,R$ -
pingente,P-03,0,R$ -
pingente,P-04,0,R$ -
pingente,P-05,0,R$ -
pingente,P-06,0,R$ -
pingente,P-07,0,R$ -
DESK,CASENOTE-PTO-37x28,0,R$ -
DESK,CASENOTE-MRR-37x28,0,R$ -
DESK,CASEOCULOS-MRR,0,R$ -
DESK,CASEOCULOS-PTO,0,R$ -
ENVIO,ENVIO,-67,"-R$ 134,00"`;

// Função para parsear valor R$
function parseValor(valorStr) {
  if (!valorStr || valorStr === 'R$ -' || valorStr.trim() === '') return 0;
  // Remove "R$", aspas duplas, e processa separadores
  const limpo = valorStr.replace(/"/g, '').replace('R$', '').trim();
  // Ex: "2.291,00" -> remove ponto (milhares), troca vírgula (decimal) por ponto
  const numero = limpo.replace(/\./g, '').replace(',', '.');
  const resultado = parseFloat(numero);
  return isNaN(resultado) ? 0 : resultado;
}

// Função para normalizar SKU (maiúscula, remover aspas duplas, corrigir formato DESK)
function normalizarSKU(sku) {
  if (!sku) return null;
  let normalizado = sku.trim().toUpperCase().replace(/"/g, '');
  
  // Corrigir formato DESK: "DESK PTO 20X20" -> "DESK-PTO-20X20"
  if (normalizado.startsWith('DESK ')) {
    normalizado = normalizado.replace(/\s+/g, '-');
  } else {
    normalizado = normalizado.replace(/\s+/g, ' ');
  }
  
  return normalizado;
}

async function atualizarEstoque() {
  const linhas = dados.split('\n').filter(l => l.trim());
  
  let atualizados = 0;
  let naoEncontrados = 0;
  let erros = 0;

  console.log(`\n📦 Processando ${linhas.length} linhas...\n`);

  for (const linha of linhas) {
    const partes = linha.split(',');
    if (partes.length < 4) continue;

    const sku = normalizarSKU(partes[1]);
    if (!sku) continue;

    const quantidade = parseInt(partes[2]) || 0;
    const valorTotal = parseValor(partes[3]);
    const precoUnitario = quantidade > 0 ? (valorTotal / quantidade) : 0;

    try {
      // Tentar encontrar o produto no banco (case-insensitive)
      const checkResult = await pool.query(
        'SELECT sku FROM obsidian.produtos WHERE UPPER(sku) = $1',
        [sku]
      );

      if (checkResult.rows.length === 0) {
        console.log(`⚠️  SKU não encontrado: ${sku}`);
        naoEncontrados++;
        continue;
      }

      const skuReal = checkResult.rows[0].sku;

      // Atualizar quantidade e preço
      const result = await pool.query(
        'UPDATE obsidian.produtos SET quantidade_atual = $1, preco_unitario = $2 WHERE sku = $3 RETURNING sku, quantidade_atual, preco_unitario',
        [quantidade, precoUnitario, skuReal]
      );

      if (result.rows.length > 0) {
        console.log(`✅ ${skuReal}: qtd=${quantidade}, preço=R$ ${precoUnitario.toFixed(2)}`);
        atualizados++;
      }
    } catch (error) {
      console.error(`❌ Erro ao processar ${sku}:`, error.message);
      erros++;
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Atualizados: ${atualizados}`);
  console.log(`   ⚠️  Não encontrados: ${naoEncontrados}`);
  console.log(`   ❌ Erros: ${erros}`);

  await pool.end();
}

atualizarEstoque();
