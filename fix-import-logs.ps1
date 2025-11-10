# Script para adicionar logs de debug na função de importação

$filePath = "src\pages\Estoque.tsx"
$content = Get-Content $filePath -Raw -Encoding UTF8

# Substituir a seção de importação de produtos
$oldCode = @'
      // IMPORTAR PRODUTOS (Aba "Estoque")
      if (abaEstoque) {
        console.log('🚀 Importando produtos da aba:', abaEstoque);
        const worksheetProdutos = workbook.Sheets[abaEstoque];
        const dadosProdutos = XLSX.utils.sheet_to_json(worksheetProdutos);
        
        console.log(`📦 ${dadosProdutos.length} produtos encontrados`);

        for (const row of dadosProdutos as any[]) {
          try {
            const sku = row.SKU || row.sku;
            const nome = row['Nome Produto'] || row['Nome do Produto'] || row.nome;
            const categoria = row.Categoria || row.categoria;
            const tipoProduto = row['Tipo Produto'] || row['Tipo'] || row.tipo_produto || 'Fabricado';
            const quantidade = Number(row['Quantidade Atual'] || row.Quantidade || row.quantidade || 0);
            const unidade = row['Unidade de Medida'] || row.Unidade || row.unidade_medida || 'UN';
            const preco = Number(row['Preço Unitário'] || row['Preco Unitario'] || row.preco_unitario || 0);

            // Validação básica
            if (!sku || !nome) {
              errosDetalhados.push(`Produto sem SKU ou Nome: ${JSON.stringify(row).substring(0, 100)}`);
              errosProdutos++;
              continue;
            }
'@

$newCode = @'
      // IMPORTAR PRODUTOS (Aba "Estoque")
      if (abaEstoque) {
        console.log('🚀 Importando produtos da aba:', abaEstoque);
        const worksheetProdutos = workbook.Sheets[abaEstoque];
        const dadosProdutos = XLSX.utils.sheet_to_json(worksheetProdutos);
        
        console.log(`📦 Total de linhas encontradas: ${dadosProdutos.length}`);
        console.log('📦 Primeiras 3 linhas para análise:', dadosProdutos.slice(0, 3));
        console.log('📦 Nomes das colunas:', dadosProdutos.length > 0 ? Object.keys(dadosProdutos[0]) : []);

        let linhaAtual = 0;
        for (const row of dadosProdutos as any[]) {
          linhaAtual++;
          try {
            const sku = row.SKU || row.sku;
            const nome = row['Nome Produto'] || row['Nome do Produto'] || row.nome;
            
            // Validação básica COM LOG DETALHADO
            if (!sku || !nome) {
              console.warn(`⚠️ Linha ${linhaAtual}: Produto ignorado - SKU="${sku}", Nome="${nome}"`);
              console.warn(`   Dados da linha:`, row);
              errosDetalhados.push(`Linha ${linhaAtual}: Produto sem SKU ou Nome`);
              errosProdutos++;
              continue;
            }
            
            const categoria = row.Categoria || row.categoria;
            const tipoProduto = row['Tipo Produto'] || row['Tipo'] || row.tipo_produto || 'Fabricado';
            const quantidade = Number(row['Quantidade Atual'] || row.Quantidade || row.quantidade || 0);
            const unidade = row['Unidade de Medida'] || row.Unidade || row.unidade_medida || 'UN';
            const preco = Number(row['Preço Unitário'] || row['Preco Unitario'] || row.preco_unitario || 0);
'@

$newContent = $content -replace [regex]::Escape($oldCode), $newCode

if ($newContent -ne $content) {
    $newContent | Set-Content $filePath -Encoding UTF8 -NoNewline
    Write-Host "✅ Logs de debug adicionados com sucesso!" -ForegroundColor Green
} else {
    Write-Host "❌ Não foi possível encontrar o código para substituir" -ForegroundColor Red
    Write-Host "Tentando abordagem alternativa..." -ForegroundColor Yellow
}
