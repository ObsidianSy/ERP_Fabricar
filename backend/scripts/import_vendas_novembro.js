/**
 * Script de importação de vendas de Novembro
 * 
 * REGRAS:
 * - Aba: "NOV" apenas
 * - Data: Se vazio, usar última data válida
 * - Cliente "Obsidian" → "obsidian ecom" no sistema
 * - Formato de valores: R$ X,XX → converter para decimal
 * 
 * USO:
 * node backend/scripts/import_vendas_novembro.js <caminho_arquivo.xlsx>
 */

const XLSX = require('xlsx');
const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Carregar variáveis de ambiente do backend
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Configurações
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const ABA_ALVO = 'nov';
const CLIENTE_MAP = {
  'Obsidian': 'Obsidian Ecom',
  'BMT': 'BMT'
};

// Pool de conexão com o banco (usando config do backend)
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

// Helper: converter valor R$ X,XX para decimal
function parseValorBR(valor) {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  
  return parseFloat(
    valor.toString()
      .replace('R$', '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim()
  );
}

// Helper: converter data DD.MM ou DD/MM ou Excel serial para YYYY-MM-DD
function parseData(dataStr, ano = 2025) {
  if (!dataStr) return null;
  
  // Se já é Date object do XLSX
  if (dataStr instanceof Date) {
    return dataStr.toISOString().split('T')[0];
  }
  
  // Se é número (Excel serial date)
  if (typeof dataStr === 'number') {
    // Excel serial date (dias desde 01/01/1900)
    const excelEpoch = new Date(1899, 11, 30); // 30/12/1899
    const date = new Date(excelEpoch.getTime() + dataStr * 86400000);
    return date.toISOString().split('T')[0];
  }
  
  const str = dataStr.toString().trim();
  
  // Formato DD.MM ou DD/MM
  const match = str.match(/^(\d{1,2})[./](\d{1,2})$/);
  if (match) {
    const dia = match[1].padStart(2, '0');
    const mes = match[2].padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  
  return null;
}

// Helper: normalizar cliente
function normalizarCliente(cliente) {
  if (!cliente) return 'Obsidian Ecom';
  
  const clienteStr = cliente.toString().trim();
  return CLIENTE_MAP[clienteStr] || clienteStr;
}

// Helper: buscar client_id no banco
async function getClientId(nomeCliente) {
  try {
    const result = await pool.query(
      'SELECT id FROM obsidian.clientes WHERE UPPER(nome) = UPPER($1) LIMIT 1',
      [nomeCliente]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    
    console.warn(`⚠️  Cliente "${nomeCliente}" não encontrado no banco.`);
    return null;
  } catch (error) {
    console.error(`❌ Erro ao buscar cliente "${nomeCliente}":`, error.message);
    return null;
  }
}

// Processar planilha
async function importarVendas(arquivoPath) {
  console.log(`📊 Lendo planilha: ${arquivoPath}`);
  
  const workbook = XLSX.readFile(arquivoPath);
  
  if (!workbook.SheetNames.includes(ABA_ALVO)) {
    throw new Error(`Aba "${ABA_ALVO}" não encontrada. Abas disponíveis: ${workbook.SheetNames.join(', ')}`);
  }
  
  const worksheet = workbook.Sheets[ABA_ALVO];
  const dados = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  console.log(`📋 Total de linhas na aba "${ABA_ALVO}": ${dados.length}`);
  
  // Cabeçalho está na linha 2 (índice 2)
  const cabecalho = dados[2];
  console.log(`📌 Cabeçalho detectado (linha 2):`, cabecalho);
  
  // Colunas fixas baseadas na estrutura da planilha
  const colData = 1;
  const colCliente = 2;
  const colCodigo = 3;
  const colQuantidade = 4;
  const colValorUnt = 5;
  const colTotal = 6;
  
  console.log(`\n🗂️  Mapeamento de colunas:`);
  console.log(`   Data: coluna ${colData}`);
  console.log(`   Cliente: coluna ${colCliente}`);
  console.log(`   Código (SKU): coluna ${colCodigo}`);
  console.log(`   Quantidade: coluna ${colQuantidade}`);
  console.log(`   Valor Unitário: coluna ${colValorUnt}`);
  console.log(`   Total: coluna ${colTotal}\n`);
  
  // Processar linhas (começar da linha 3, que é índice 3)
  const vendas = [];
  let ultimaDataValida = null;
  let linhaPulada = 0;
  
  for (let i = 3; i < dados.length; i++) {
    const linha = dados[i];
    
    if (!linha || linha.length === 0 || !linha[colCodigo]) {
      linhaPulada++;
      continue;
    }
    
    // Processar data (propagar se vazio)
    let dataVenda = parseData(linha[colData]);
    if (!dataVenda && ultimaDataValida) {
      dataVenda = ultimaDataValida;
    } else if (dataVenda) {
      ultimaDataValida = dataVenda;
    }
    
    if (!dataVenda) {
      console.warn(`⚠️  Linha ${i + 1}: Data inválida e sem data anterior para propagar. Pulando.`);
      linhaPulada++;
      continue;
    }
    
    const cliente = normalizarCliente(linha[colCliente]);
    const sku = linha[colCodigo]?.toString().trim();
    const quantidade = parseFloat(linha[colQuantidade]) || 0;
    const precoUnitario = parseValorBR(linha[colValorUnt]);
    const valorTotal = parseValorBR(linha[colTotal]);
    
    if (!sku || quantidade <= 0) {
      console.warn(`⚠️  Linha ${i + 1}: SKU vazio ou quantidade inválida. Pulando.`);
      linhaPulada++;
      continue;
    }
    
    vendas.push({
      data_venda: dataVenda,
      nome_cliente: cliente,
      sku_produto: sku,
      quantidade_vendida: quantidade,
      preco_unitario: precoUnitario,
      valor_total: valorTotal,
      canal: 'Planilha Manual',
      pedido_uid: `IMPORT_NOV_${dataVenda}_${sku}_${i}`,
      status_venda: 'concluido'
    });
  }
  
  console.log(`\n✅ Vendas processadas: ${vendas.length}`);
  console.log(`⏭️  Linhas puladas: ${linhaPulada}\n`);
  
  if (vendas.length === 0) {
    console.log('❌ Nenhuma venda para importar.');
    return;
  }
  
  // Pré-visualização
  console.log('🔍 Pré-visualização (primeiras 5 vendas):');
  console.table(vendas.slice(0, 5));
  
  // Buscar client_ids dos clientes únicos
  console.log('\n🔍 Buscando IDs dos clientes no banco...\n');
  const clientesUnicos = [...new Set(vendas.map(v => v.nome_cliente))];
  const clienteIdMap = {};
  
  for (const nomeCliente of clientesUnicos) {
    const clientId = await getClientId(nomeCliente);
    if (clientId) {
      clienteIdMap[nomeCliente] = clientId;
      console.log(`   ✅ ${nomeCliente} → ID ${clientId}`);
    } else {
      console.log(`   ❌ ${nomeCliente} → NÃO ENCONTRADO`);
    }
  }
  
  // Filtrar vendas com cliente válido
  const vendasValidas = vendas.filter(v => clienteIdMap[v.nome_cliente]);
  const vendasInvalidas = vendas.length - vendasValidas.length;
  
  if (vendasInvalidas > 0) {
    console.log(`\n⚠️  ${vendasInvalidas} vendas serão puladas por cliente não encontrado.`);
  }
  
  if (vendasValidas.length === 0) {
    console.log('\n❌ Nenhuma venda com cliente válido para importar.');
    await pool.end();
    return;
  }
  
  // Confirmar antes de importar
  console.log(`\n⚠️  ATENÇÃO: Você está prestes a importar ${vendasValidas.length} vendas.`);
  console.log('   Pressione CTRL+C para cancelar ou aguarde 5 segundos...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Importar via API
  console.log('🚀 Iniciando importação via API...\n');
  
  let sucesso = 0;
  let erros = 0;
  const erroLog = [];
  
  for (let i = 0; i < vendasValidas.length; i++) {
    const venda = vendasValidas[i];
    const clientId = clienteIdMap[venda.nome_cliente];
    
    try {
      const payload = {
        data_venda: venda.data_venda,
        nome_cliente: venda.nome_cliente,
        items: [{
          sku_produto: venda.sku_produto,
          quantidade_vendida: venda.quantidade_vendida,
          preco_unitario: venda.preco_unitario,
          nome_produto: venda.sku_produto
        }],
        canal: venda.canal,
        pedido_uid: venda.pedido_uid,
        client_id: clientId
      };
      
      const response = await axios.post(`${API_BASE_URL}/api/vendas`, payload);
      
      console.log(`✅ [${i + 1}/${vendasValidas.length}] ${venda.data_venda} - ${venda.sku_produto} x${venda.quantidade_vendida} (cliente: ${venda.nome_cliente})`);
      sucesso++;
      
    } catch (error) {
      console.error(`❌ [${i + 1}/${vendasValidas.length}] Erro ao importar ${venda.sku_produto}:`, error.response?.data || error.message);
      erros++;
      erroLog.push({
        linha: i + 1,
        venda,
        erro: error.response?.data || error.message
      });
    }
  }
  
  // Relatório final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RELATÓRIO DE IMPORTAÇÃO');
  console.log('='.repeat(60));
  console.log(`✅ Sucesso: ${sucesso}`);
  console.log(`❌ Erros: ${erros}`);
  console.log(`📋 Total processado: ${vendasValidas.length}`);
  
  if (erroLog.length > 0) {
    console.log('\n❌ Detalhes dos erros:');
    console.table(erroLog);
  }
  
  console.log('\n✨ Importação concluída!\n');
  
  // Fechar conexão com o banco
  await pool.end();
}

// Executar
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Uso: node import_vendas_novembro.js <caminho_arquivo.xlsx>');
  process.exit(1);
}

const arquivoPath = path.resolve(args[0]);

importarVendas(arquivoPath)
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('💥 Erro fatal:', err);
    await pool.end();
    process.exit(1);
  });
