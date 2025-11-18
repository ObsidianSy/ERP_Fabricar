import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import Layout from "@/components/Layout";
import { ProductsDataTable } from "@/components/tables/ProductsDataTable";
import { RawMaterialsDataTable } from "@/components/tables/RawMaterialsDataTable";
import { Plus, Package, RefreshCw, Settings, ArrowUp, MoreHorizontal, TrendingUp, TrendingDown, AlertTriangle, Download, Upload, Camera, History } from "lucide-react";
import { toast } from "sonner";
import { consultarDados } from "@/services/n8nIntegration";
import ProdutoForm from "@/components/forms/ProdutoForm";
import * as XLSX from 'xlsx';
import { Input } from "@/components/ui/input";
import MateriaPrimaForm from "@/components/forms/MateriaPrimaForm";
import EntradaProdutoForm from "@/components/forms/EntradaProdutoForm";
import EntradaMateriaPrimaForm from "@/components/forms/EntradaMateriaPrimaForm";
import { API_BASE_URL } from "@/config/api";

import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProductDetailsModal } from "@/components/ProductDetailsModal";
import { formatCurrency, formatQuantity, formatNumber } from "@/utils/formatters";
import { useProducts } from "@/hooks/useProducts";
import { useTableFilters } from "@/hooks/useTableFilters";

interface ProdutoAcabado {
  sku?: string;
  nome?: string;
  categoria?: string;
  tipo_produto?: string;
  quantidade?: number;
  unidade_medida?: string;
  preco_unitario?: number;
  // Campos da API
  SKU?: string;
  "Nome Produto"?: string;
  "Categoria"?: string;
  "Tipo Produto"?: string;
  "Quantidade Atual"?: number;
  "Unidade de Medida"?: string;
  "Preço Unitário"?: number;
}

interface MateriaPrima {
  id?: number;
  sku_mp?: string;
  nome?: string;
  categoria?: string;
  quantidade_atual?: number;
  unidade_medida?: string;
  custo_unitario?: number;
  // Campos legados (para compatibilidade)
  sku_materia_prima?: string;
  nome_materia_prima?: string;
  categoria_mp?: string;
  quantidade_mp?: number;
  unidade_mp?: string;
  custo_unitario_mp?: number;
  "SKU Matéria-Prima"?: string;
  "Nome Matéria-Prima"?: string;
  "Categoria MP"?: string;
  "Quantidade Atual"?: number;
  "Unidade de Medida"?: string;
  "Custo Unitário"?: number;
}

const Estoque = () => {
  const [activeTab, setActiveTab] = useState("estoque");
  const [viewMode, setViewMode] = useState<"produtos" | "materias-primas">("produtos");
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [editingProduct, setEditingProduct] = useState<ProdutoAcabado | null>(null);
  const [editingMateriaPrima, setEditingMateriaPrima] = useState<MateriaPrima | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProdutoAcabado | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchCategoria, setSearchCategoria] = useState("");
  const [searchTipo, setSearchTipo] = useState("");
  const navigate = useNavigate();

  // Use custom hook for products - sem auto-refresh para melhor performance
  const {
    products: produtosAcabados,
    stats,
    categories: categorias,
    types: tipos,
    isLoading,
    refresh: refreshProducts
  } = useProducts({
    autoLoad: true
  });

  // Use custom hook for filters
  const {
    filteredData: filteredProdutosAcabados,
    filters,
    setQuantityFilter,
    setCategoryFilter,
    setTypeFilter
  } = useTableFilters(produtosAcabados, {
    quantityField: (p: any) => p.quantidade || p["Quantidade Atual"] || 0,
    categoryField: (p: any) => p.categoria || p["Categoria"],
    typeField: (p: any) => p.tipo_produto || p["Tipo Produto"]
  });

  // Memoize matérias-primas loading
  const carregarMateriaPrima = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/materia-prima`);

      if (!response.ok) {
        throw new Error('Erro ao buscar matérias-primas');
      }

      const dadosMateriaPrima = await response.json();
      console.log('Dados de matéria-prima recebidos:', dadosMateriaPrima);

      if (dadosMateriaPrima && dadosMateriaPrima.length > 0) {
        setMateriasPrimas(dadosMateriaPrima);
        toast.success("Matéria-prima carregada", {
          description: `${dadosMateriaPrima.length} itens encontrados`
        });
      } else {
        setMateriasPrimas([]);
        toast.info("Nenhuma matéria-prima encontrada");
      }
    } catch (error) {
      console.error('Erro ao carregar matéria-prima:', error);
      toast.error("Erro ao carregar matéria-prima");
    }
  }, []);

  // Load matérias-primas on mount
  useEffect(() => {
    carregarMateriaPrima();
  }, [carregarMateriaPrima]);

  // Memoize filtered matérias-primas
  const filteredMateriasPrimas = useMemo(() => {
    return materiasPrimas.filter(item => {
      const quantidade = item.quantidade_atual ?? item.quantidade_mp ?? item["Quantidade Atual"] ?? 0;

      const matchesQuantity = filters.quantity === "todos" ? true :
        filters.quantity === "sem-estoque" ? quantidade === 0 :
          filters.quantity === "estoque-baixo" ? quantidade > 0 && quantidade < 10 :
            filters.quantity === "em-estoque" ? quantidade >= 10 : true;

      return matchesQuantity;
    });
  }, [materiasPrimas, filters.quantity]);

  // Calcular estatísticas de matérias-primas
  const materiaPrimaStats = useMemo(() => {
    let totalValue = 0;
    let lowStock = 0;
    let outOfStock = 0;

    materiasPrimas.forEach(mp => {
      const quantidade = mp.quantidade_atual ?? mp.quantidade_mp ?? mp["Quantidade Atual"] ?? 0;
      const custoUnitario = mp.custo_unitario ?? mp.custo_unitario_mp ?? mp["Custo Unitário"] ?? 0;

      totalValue += quantidade * custoUnitario;

      if (quantidade === 0) {
        outOfStock++;
      } else if (quantidade < 10) {
        lowStock++;
      }
    });

    return {
      totalValue,
      lowStock,
      outOfStock
    };
  }, [materiasPrimas]); const carregarDados = useCallback(() => {
    refreshProducts();
    carregarMateriaPrima();
  }, [refreshProducts, carregarMateriaPrima]);

  const handleNovoProduto = () => {
    navigate("/estoque/novo");
  };

  const exportarParaExcel = useCallback(() => {
    try {
      const dadosParaExportar = activeTab === "estoque"
        ? filteredProdutosAcabados.map(p => ({
          'SKU': p.SKU || p.sku || '',
          'Nome do Produto': p["Nome Produto"] || p.nome || '',
          'Categoria': p["Categoria"] || p.categoria || '',
          'Tipo': p["Tipo Produto"] || p.tipo_produto || '',
          'Quantidade': p["Quantidade Atual"] || p.quantidade || 0,
          'Unidade': p["Unidade de Medida"] || p.unidade_medida || '',
          // Preferir preco_unitario para refletir ajustes da página de Custos
          'Preço Unitário': p.preco_unitario || p["Preço Unitário"] || 0,
          'Valor Total': (p["Quantidade Atual"] || p.quantidade || 0) * (p.preco_unitario || p["Preço Unitário"] || 0)
        }))
        : filteredMateriasPrimas.map(mp => ({
          'SKU': mp["SKU Matéria-Prima"] || mp.sku_materia_prima || '',
          'Nome da Matéria-Prima': mp["Nome Matéria-Prima"] || mp.nome_materia_prima || '',
          'Categoria': mp["Categoria MP"] || mp.categoria_mp || '',
          'Quantidade': mp["Quantidade Atual"] || mp.quantidade_mp || 0,
          'Unidade': mp["Unidade de Medida"] || mp.unidade_mp || '',
          'Custo Unitário': mp["Custo Unitário"] || mp.custo_unitario_mp || 0,
          'Valor Total': (mp["Quantidade Atual"] || mp.quantidade_mp || 0) * (mp["Custo Unitário"] || mp.custo_unitario_mp || 0)
        }));

      if (dadosParaExportar.length === 0) {
        toast.warning("Nenhum dado para exportar");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeTab === "estoque" ? "Produtos" : "Matéria-Prima");

      const fileName = activeTab === "estoque"
        ? `estoque_produtos_${new Date().toISOString().split('T')[0]}.xlsx`
        : `estoque_materiaprima_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(wb, fileName);

      toast.success("Exportação concluída", {
        description: `${dadosParaExportar.length} itens exportados para ${fileName}`
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error("Erro ao exportar planilha");
    }
  }, [activeTab, filteredProdutosAcabados, filteredMateriasPrimas]);

  const importarDeExcel = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      console.log('📊 Abas disponíveis:', workbook.SheetNames);

      // Buscar aba "Estoque" para produtos
      const abaEstoque = workbook.SheetNames.find(name =>
        name.toLowerCase().includes('estoque') &&
        !name.toLowerCase().includes('materia') &&
        !name.toLowerCase().includes('prima')
      );

      // Buscar aba "Estoque_Materia_Prima" para matéria-prima
      const abaMateriaPrima = workbook.SheetNames.find(name =>
        name.toLowerCase().includes('estoque') &&
        (name.toLowerCase().includes('materia') || name.toLowerCase().includes('prima'))
      );

      console.log('📦 Aba Produtos encontrada:', abaEstoque);
      console.log('🧱 Aba Matéria-Prima encontrada:', abaMateriaPrima);

      // Mostrar TODAS as abas para debug
      console.log('🔍 Análise de todas as abas:');
      workbook.SheetNames.forEach(name => {
        const hasEstoque = name.toLowerCase().includes('estoque');
        const hasMateria = name.toLowerCase().includes('materia');
        const hasPrima = name.toLowerCase().includes('prima');
        console.log(`  - "${name}": estoque=${hasEstoque}, materia=${hasMateria}, prima=${hasPrima}`);
      });

      let sucessosProdutos = 0;
      let errosProdutos = 0;
      let sucessosMP = 0;
      let errosMP = 0;
      const errosDetalhados: string[] = [];

      // IMPORTAR PRODUTOS (Aba "Estoque")
      if (abaEstoque) {
        console.log('🚀 Importando produtos da aba:', abaEstoque);
        const worksheetProdutos = workbook.Sheets[abaEstoque];
        const dadosProdutos = XLSX.utils.sheet_to_json(worksheetProdutos);

        console.log(`📦 Total de linhas encontradas: ${dadosProdutos.length}`);
        console.log('📦 Primeiras 3 linhas para análise:', dadosProdutos.slice(0, 3));
        console.log('📦 Nomes das colunas:', dadosProdutos.length > 0 ? Object.keys(dadosProdutos[0]) : []);

        // LOG ADICIONAL: Mostrar TODAS as chaves da primeira linha
        if (dadosProdutos.length > 0) {
          console.log('🔍 PRIMEIRA LINHA COMPLETA:');
          Object.keys(dadosProdutos[0]).forEach(key => {
            console.log(`   "${key}" = "${dadosProdutos[0][key]}"`);
          });
        }

        let linhaAtual = 0;
        for (const row of dadosProdutos as any[]) {
          linhaAtual++;
          try {
            // Tentar diferentes variações de nomes de colunas
            const sku = row.SKU ||
              row.sku ||
              row['Código'] ||
              row.codigo ||
              row['CÓDIGO'] ||
              row.__EMPTY;  // ← Índice 0 (primeira coluna)

            const nome = row['Nome Produto'] ||
              row['Nome do Produto'] ||
              row['Nome'] ||
              row.nome ||
              row['Descrição'] ||
              row['Descricao'] ||
              row.descricao ||
              row['NOME'] ||
              row['DESCRIÇÃO'] ||
              row.__EMPTY_1;  // ← Índice 1 (segunda coluna)

            // Validação básica COM LOG DETALHADO
            if (!sku || !nome) {
              console.warn(`⚠️ Linha ${linhaAtual}: Produto ignorado - SKU="${sku}", Nome="${nome}"`);
              console.warn(`   Colunas disponíveis:`, Object.keys(row));
              console.warn(`   VALORES DAS COLUNAS:`, JSON.stringify(row, null, 2));
              errosDetalhados.push(`Linha ${linhaAtual}: Produto sem SKU ou Nome`);
              errosProdutos++;
              continue;
            }

            const categoria = row.Categoria || row.categoria || row.__EMPTY_2;  // ← Coluna 3
            const tipoProduto = row['Tipo Produto'] || row['Tipo'] || row.tipo_produto || row.__EMPTY_3 || 'Fabricado';  // ← Coluna 4
            const quantidade = Number(row['Quantidade Atual'] || row.Quantidade || row.quantidade || row.__EMPTY_4 || 0);  // ← Coluna 5
            const unidade = row['Unidade de Medida'] || row.Unidade || row.unidade_medida || 'UN';
            const preco = Number(row['Preço Unitário'] || row['Preco Unitario'] || row.preco_unitario || row.__EMPTY_6 || 0);  // ← Coluna 7

            const payload = {
              sku,
              nome_produto: nome,
              categoria,
              tipo_produto: tipoProduto,
              quantidade_atual: quantidade,
              unidade_medida: unidade,
              preco_unitario: preco,
              componentes: []
            };

            console.log(`📦 Processando produto: ${sku} - ${nome}`);

            // Tentar PUT primeiro (atualizar), se falhar, usar POST (criar)
            let response = await fetch(`${API_BASE_URL}/api/estoque/${sku}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            // Se retornou 404, produto não existe, então criar
            if (response.status === 404) {
              console.log(`ℹ️ ${sku}: Não existe, criando novo produto...`);
              response = await fetch(`${API_BASE_URL}/api/estoque`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
            }

            if (response.ok) {
              sucessosProdutos++;
              console.log(`✅ Produto ${sku}: Sucesso`);
            } else {
              const errorMsg = await response.text();
              errosDetalhados.push(`Produto ${sku}: ${errorMsg.substring(0, 200)}`);
              errosProdutos++;
              console.error(`❌ Produto ${sku}: Erro`, errorMsg);
            }
          } catch (error: any) {
            errosDetalhados.push(`Produto ${row.SKU || 'desconhecido'}: ${error.message}`);
            errosProdutos++;
            console.error('❌ Erro ao processar produto:', error);
          }
        }
      }

      // IMPORTAR MATÉRIA-PRIMA (Aba "Estoque_Materia_Prima")
      if (abaMateriaPrima) {
        console.log('🚀 Importando matérias-primas da aba:', abaMateriaPrima);
        const worksheetMP = workbook.Sheets[abaMateriaPrima];
        const dadosMP = XLSX.utils.sheet_to_json(worksheetMP);

        console.log(`🧱 Total de linhas encontradas: ${dadosMP.length}`);
        console.log('🧱 Primeiras 3 linhas para análise:', dadosMP.slice(0, 3));
        console.log('🧱 Nomes das colunas:', dadosMP.length > 0 ? Object.keys(dadosMP[0]) : []);

        // LOG ADICIONAL: Mostrar TODAS as chaves da primeira linha
        if (dadosMP.length > 0) {
          console.log('🔍 PRIMEIRA LINHA DE MATÉRIA-PRIMA COMPLETA:');
          Object.keys(dadosMP[0]).forEach(key => {
            console.log(`   "${key}" = "${dadosMP[0][key]}"`);
          });
        }

        let linhaMPAtual = 0;
        for (const row of dadosMP as any[]) {
          linhaMPAtual++;
          try {
            // Tentar diferentes variações de nomes de colunas (COM HÍFEN!)
            const sku = row['SKU Matéria-Prima'] ||
              row['SKU Materia-Prima'] ||
              row['SKU MP'] ||
              row.SKU ||
              row.sku ||
              row['Código'] ||
              row.codigo ||
              row.__EMPTY;  // ← Índice 0 (primeira coluna)

            const nome = row['Nome Matéria-Prima'] ||  // ← COM HÍFEN!
              row['Nome Materia-Prima'] ||
              row['Nome MP'] ||
              row['Descrição'] ||
              row['Descricao'] ||
              row['Nome'] ||
              row.nome ||
              row.descricao ||
              row['NOME'] ||
              row['DESCRIÇÃO'] ||
              row.__EMPTY_1;  // ← Índice 1 (segunda coluna)

            // Validação básica COM LOG DETALHADO
            if (!sku || !nome) {
              console.warn(`⚠️ Linha ${linhaMPAtual}: Matéria-Prima ignorada - SKU="${sku}", Nome="${nome}"`);
              console.warn(`   Colunas disponíveis:`, Object.keys(row));
              console.warn(`   VALORES DAS COLUNAS:`, JSON.stringify(row, null, 2));
              errosDetalhados.push(`Linha ${linhaMPAtual}: Matéria-Prima sem SKU ou Nome`);
              errosMP++;
              continue;
            }

            const categoria = row['Categoria MP'] || row.Categoria || row.categoria || row.__EMPTY_2;  // ← Coluna 3
            const quantidade = Number(row['Quantidade Atual'] || row.Quantidade || row.quantidade || row.__EMPTY_3 || 0);  // ← Coluna 4
            const unidade = row['Unidade de Medida'] || row.Unidade || row.unidade_medida || row.__EMPTY_4 || 'UN';  // ← Coluna 5
            const custo = Number(row['Custo Unitário'] || row['Custo Unitario'] || row.custo_unitario || row.__EMPTY_5 || 0);  // ← Coluna 6

            const payload = {
              sku_materia_prima: sku,
              nome: nome,  // ← Backend espera "nome", não "nome_materia_prima"
              categoria,
              quantidade_atual: quantidade,
              unidade_medida: unidade,
              custo_unitario: custo  // ← Backend espera "custo_unitario", não "preco_unitario"
            };

            console.log(`🧱 Processando matéria-prima: ${sku} - ${nome}`);

            // Tentar PUT primeiro (atualizar), se falhar, usar POST (criar)
            let response = await fetch(`${API_BASE_URL}/api/materia-prima/${sku}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            // Se retornou 404, matéria-prima não existe, então criar
            if (response.status === 404) {
              console.log(`ℹ️ MP ${sku}: Não existe, criando nova matéria-prima...`);
              response = await fetch(`${API_BASE_URL}/api/materia-prima`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
            }

            if (response.ok) {
              sucessosMP++;
              console.log(`✅ Matéria-Prima ${sku}: Sucesso`);
            } else {
              const errorMsg = await response.text();
              errosDetalhados.push(`MP ${sku}: ${errorMsg.substring(0, 200)}`);
              errosMP++;
              console.error(`❌ MP ${sku}: Erro`, errorMsg);
            }
          } catch (error: any) {
            errosDetalhados.push(`MP ${row.SKU || 'desconhecido'}: ${error.message}`);
            errosMP++;
            console.error('❌ Erro ao processar matéria-prima:', error);
          }
        }
      }

      // Exibir resultado consolidado
      const totalSucessos = sucessosProdutos + sucessosMP;
      const totalErros = errosProdutos + errosMP;

      console.log('📊 RESUMO DA IMPORTAÇÃO:');
      console.log(`   ✅ Produtos importados: ${sucessosProdutos}`);
      console.log(`   ❌ Produtos com erro: ${errosProdutos}`);
      console.log(`   ✅ Matérias-primas importadas: ${sucessosMP}`);
      console.log(`   ❌ Matérias-primas com erro: ${errosMP}`);
      console.log(`   🎯 Total de sucessos: ${totalSucessos}`);
      console.log(`   ⚠️  Total de erros: ${totalErros}`);

      if (errosDetalhados.length > 0) {
        console.error('❌ Erros na importação:', errosDetalhados);
      }

      if (!abaEstoque && !abaMateriaPrima) {
        toast.error("Abas não encontradas", {
          description: "A planilha deve ter as abas 'Estoque' e/ou 'Estoque_Materia_Prima'",
          duration: 5000
        });
      } else if (totalSucessos > 0) {
        const detalhes = [
          sucessosProdutos > 0 ? `${sucessosProdutos} produtos` : null,
          sucessosMP > 0 ? `${sucessosMP} matérias-primas` : null
        ].filter(Boolean).join(' e ');

        toast.success("Importação concluída!", {
          description: `✅ ${detalhes} importados${totalErros > 0 ? ` | ❌ ${totalErros} com erro` : ''}`,
          duration: 5000
        });
      } else {
        toast.error("Nenhum item importado", {
          description: `${totalErros} erros encontrados. Verifique o console para detalhes.`,
          duration: 5000
        });
      }

      // Recarregar dados após importação
      if (totalSucessos > 0) {
        await refreshProducts();
        await carregarMateriaPrima();
      }

    } catch (error) {
      console.error('Erro ao importar:', error);
      toast.error("Erro ao importar planilha", {
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
    } finally {
      setIsImporting(false);
      // Limpar o input file para permitir reimportar o mesmo arquivo
      event.target.value = '';
    }
  }, [refreshProducts, carregarMateriaPrima]);

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Estoque</h1>
            <p className="text-sm text-muted-foreground">
              {produtosAcabados.length} produtos • {materiasPrimas.length} matérias-prima
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/fotos-produtos')}
              className="gap-2"
            >
              <Camera className="w-4 h-4" />
              Gerenciar Fotos
            </Button>

            {/* Botão de Ajuda para Importação */}
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 border-blue-300 hover:bg-blue-50">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span className="text-blue-600 font-medium">Formato Excel</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader className="pb-4 border-b">
                  <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                    Formato da Planilha Excel
                  </DialogTitle>
                  <DialogDescription className="text-base">
                    Guia completo para importar e atualizar produtos via Excel
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                  {/* Seção: Nome da Aba */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-5 rounded-xl border border-purple-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-purple-600 rounded-md">
                        <Package className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-bold text-lg text-purple-900">Aba: "Estoque"</h3>
                      <Badge className="bg-purple-600">Produtos Acabados</Badge>
                    </div>
                    <p className="text-sm text-purple-700">Use esta aba para produtos finais prontos para venda</p>
                  </div>

                  {/* Seção: Colunas */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Obrigatórias */}
                    <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <h4 className="font-bold text-red-900">Obrigatórias</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5"></div>
                          <div>
                            <code className="bg-red-100 px-2 py-1 rounded text-sm font-semibold text-red-900">SKU</code>
                            <p className="text-xs text-red-700 mt-1">Código único do produto</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5"></div>
                          <div>
                            <code className="bg-red-100 px-2 py-1 rounded text-sm font-semibold text-red-900">Nome Produto</code>
                            <p className="text-xs text-red-700 mt-1">Nome/descrição</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Opcionais */}
                    <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Settings className="w-5 h-5 text-blue-600" />
                        <h4 className="font-bold text-blue-900">Opcionais (Atualizáveis)</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 bg-yellow-100 p-2 rounded-lg border border-yellow-300">
                          <TrendingUp className="w-4 h-4 text-yellow-700 mt-0.5" />
                          <div>
                            <code className="bg-yellow-200 px-2 py-1 rounded text-sm font-bold text-yellow-900">Preço Unitário</code>
                            <p className="text-xs text-yellow-800 mt-1 font-medium">⭐ Atualiza o preço</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                          <code className="bg-blue-100 px-2 py-1 rounded text-xs font-medium text-blue-900">Quantidade Atual</code>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                          <code className="bg-blue-100 px-2 py-1 rounded text-xs font-medium text-blue-900">Categoria</code>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                          <code className="bg-blue-100 px-2 py-1 rounded text-xs font-medium text-blue-900">Tipo Produto</code>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                          <code className="bg-blue-100 px-2 py-1 rounded text-xs font-medium text-blue-900">Unidade de Medida</code>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Como Funciona */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-5 rounded-xl border-2 border-green-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-green-600 rounded-md">
                        <Settings className="w-4 h-4 text-white" />
                      </div>
                      <h4 className="font-bold text-lg text-green-900">Como funciona</h4>
                    </div>
                    <div className="grid gap-3">
                      <div className="flex items-start gap-3 bg-white p-3 rounded-lg">
                        <div className="p-1.5 bg-blue-100 rounded-md shrink-0">
                          <RefreshCw className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">SKU já existe</p>
                          <p className="text-xs text-gray-600">→ <strong>ATUALIZA</strong> os dados (incluindo preço)</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-white p-3 rounded-lg">
                        <div className="p-1.5 bg-green-100 rounded-md shrink-0">
                          <Plus className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">SKU não existe</p>
                          <p className="text-xs text-gray-600">→ <strong>CRIA</strong> novo produto</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-white p-3 rounded-lg">
                        <div className="p-1.5 bg-gray-100 rounded-md shrink-0">
                          <AlertTriangle className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Campos em branco</p>
                          <p className="text-xs text-gray-600">→ <strong>NÃO ALTERA</strong> (mantém valor anterior)</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Exemplo */}
                  <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-5 rounded-xl border-2 border-orange-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-orange-600 rounded-md">
                        <Package className="w-4 h-4 text-white" />
                      </div>
                      <h4 className="font-bold text-lg text-orange-900">Exemplo de planilha</h4>
                    </div>
                    <div className="overflow-x-auto bg-white rounded-lg shadow-inner">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gradient-to-r from-orange-100 to-yellow-100">
                            <th className="border border-orange-300 px-4 py-2 text-left font-bold text-orange-900">SKU</th>
                            <th className="border border-orange-300 px-4 py-2 text-left font-bold text-orange-900">Nome Produto</th>
                            <th className="border border-orange-300 px-4 py-2 text-right font-bold text-orange-900">Preço Unitário</th>
                            <th className="border border-orange-300 px-4 py-2 text-right font-bold text-orange-900">Quantidade</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="hover:bg-orange-50 transition-colors">
                            <td className="border border-orange-200 px-4 py-2 font-mono text-gray-700">ATR-001</td>
                            <td className="border border-orange-200 px-4 py-2 text-gray-700">Aterrorizador Azul</td>
                            <td className="border border-orange-200 px-4 py-2 text-right font-bold text-green-700">R$ 45,50</td>
                            <td className="border border-orange-200 px-4 py-2 text-right text-gray-700">100</td>
                          </tr>
                          <tr className="hover:bg-orange-50 transition-colors">
                            <td className="border border-orange-200 px-4 py-2 font-mono text-gray-700">CH-202</td>
                            <td className="border border-orange-200 px-4 py-2 text-gray-700">Chinelo Preto</td>
                            <td className="border border-orange-200 px-4 py-2 text-right font-bold text-green-700">R$ 32,00</td>
                            <td className="border border-orange-200 px-4 py-2 text-right text-gray-700">50</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <div className="relative">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={importarDeExcel}
                disabled={isImporting}
                className="hidden"
                id="import-excel"
              />
              <label htmlFor="import-excel">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isImporting}
                  className="gap-2 cursor-pointer"
                  asChild
                >
                  <span>
                    <Upload className={`w-4 h-4 ${isImporting ? 'animate-bounce' : ''}`} />
                    {isImporting ? 'Importando...' : 'Importar Excel'}
                  </span>
                </Button>
              </label>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={exportarParaExcel}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/historico-entradas')}
              className="gap-2"
            >
              <History className="w-4 h-4" />
              Histórico Entradas
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <ProdutoForm onSuccess={refreshProducts} />
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <Dialog>
                  <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Matéria-Prima
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <MateriaPrimaForm onSuccess={() => carregarMateriaPrima()} />
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <ArrowUp className="w-4 h-4 mr-2" />
                      Entrada Produto
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <EntradaProdutoForm onSuccess={refreshProducts} />
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <ArrowUp className="w-4 h-4 mr-2" />
                      Entrada MP
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <EntradaMateriaPrimaForm onSuccess={() => carregarMateriaPrima()} />
                  </DialogContent>
                </Dialog>

                <DropdownMenuItem onClick={() => navigate('/receita-produto')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Receitas
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={carregarDados} disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats aprimorados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">
                  {viewMode === "produtos" ? produtosAcabados.length : materiasPrimas.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  {viewMode === "produtos" ? "Produtos" : "Matérias-Primas"}
                </p>
              </div>
            </div>
          </div>

          <div
            className="bg-card rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setViewMode(viewMode === "produtos" ? "materias-primas" : "produtos")}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-xl font-semibold text-foreground">
                  {formatCurrency(viewMode === "produtos" ? stats.totalValue : materiaPrimaStats.totalValue)}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Valor {viewMode === "produtos" ? "Produtos" : "MP"}
                  <span className="text-xs opacity-50">(clique p/ alternar)</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-yellow-500/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">
                  {viewMode === "produtos" ? stats.lowStock : materiaPrimaStats.lowStock}
                </p>
                <p className="text-xs text-muted-foreground">Estoque Baixo</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">
                  {viewMode === "produtos" ? stats.outOfStock : materiaPrimaStats.outOfStock}
                </p>
                <p className="text-xs text-muted-foreground">Sem Estoque</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              Filtros:
            </Badge>
            <Select value={filters.quantity} onValueChange={setQuantityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filtrar por quantidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os produtos</SelectItem>
                <SelectItem value="sem-estoque">Sem estoque (0)</SelectItem>
                <SelectItem value="estoque-baixo">Estoque baixo (&lt;10)</SelectItem>
                <SelectItem value="em-estoque">Em estoque (≥10)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={filters.category} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <div className="sticky top-0 bg-background p-2 border-b z-10">
                <Input
                  placeholder="Buscar categoria..."
                  value={searchCategoria}
                  onChange={(e) => setSearchCategoria(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
                      e.currentTarget.dispatchEvent(event);
                    } else if (e.key === 'Enter') {
                      e.stopPropagation();
                    } else {
                      e.stopPropagation();
                    }
                  }}
                  className="h-8"
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <SelectItem value="todas">Todas categorias</SelectItem>
                {categorias
                  .filter(categoria => 
                    categoria.toLowerCase().includes(searchCategoria.toLowerCase())
                  )
                  .map(categoria => (
                    <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
                  ))}
              </div>
            </SelectContent>
          </Select>

          <Select value={filters.type} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <div className="sticky top-0 bg-background p-2 border-b z-10">
                <Input
                  placeholder="Buscar tipo..."
                  value={searchTipo}
                  onChange={(e) => setSearchTipo(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
                      e.currentTarget.dispatchEvent(event);
                    } else if (e.key === 'Enter') {
                      e.stopPropagation();
                    } else {
                      e.stopPropagation();
                    }
                  }}
                  className="h-8"
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {tipos
                  .filter(tipo => 
                    tipo.toLowerCase().includes(searchTipo.toLowerCase())
                  )
                  .map(tipo => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
              </div>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          // Sincronizar viewMode com a aba selecionada
          setViewMode(value === "estoque" ? "produtos" : "materias-primas");
        }} className="w-full">
          <TabsList className="bg-muted/50 border border-border/50">
            <TabsTrigger value="estoque" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Produtos Acabados ({produtosAcabados.length})
            </TabsTrigger>
            <TabsTrigger value="materia-prima" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Matéria-Prima ({materiasPrimas.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="estoque" className="mt-6">
            <ProductsDataTable
              produtos={filteredProdutosAcabados}
              onEdit={setEditingProduct}
              onRefresh={refreshProducts}
              onViewDetails={setSelectedProduct}
            />
          </TabsContent>

          <TabsContent value="materia-prima" className="mt-6">
            <RawMaterialsDataTable
              materiasPrimas={filteredMateriasPrimas}
              onEdit={setEditingMateriaPrima}
              onRefresh={carregarMateriaPrima}
            />
          </TabsContent>
        </Tabs>

        {/* Dialog para editar produto */}
        <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <DialogContent className="max-w-4xl">
            {editingProduct && (
              <ProdutoForm
                produto={{
                  SKU: editingProduct.SKU || editingProduct.sku,
                  "Nome Produto": editingProduct["Nome Produto"] || editingProduct.nome,
                  "Categoria": editingProduct["Categoria"] || editingProduct.categoria,
                  "Tipo Produto": editingProduct["Tipo Produto"] || editingProduct.tipo_produto,
                  "Quantidade Atual": editingProduct["Quantidade Atual"] || editingProduct.quantidade,
                  "Unidade de Medida": editingProduct["Unidade de Medida"] || editingProduct.unidade_medida,
                  "Preço Unitário": editingProduct["Preço Unitário"] || editingProduct.preco_unitario
                }}
                onSuccess={() => {
                  setEditingProduct(null);
                  refreshProducts();
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog para editar matéria-prima */}
        <Dialog open={!!editingMateriaPrima} onOpenChange={() => setEditingMateriaPrima(null)}>
          <DialogContent className="max-w-4xl">
            {editingMateriaPrima && (
              <MateriaPrimaForm
                materiaPrima={{
                  sku: editingMateriaPrima.sku_mp || editingMateriaPrima.sku_materia_prima || editingMateriaPrima["SKU Matéria-Prima"],
                  nome: editingMateriaPrima.nome || editingMateriaPrima.nome_materia_prima || editingMateriaPrima["Nome Matéria-Prima"],
                  categoria: editingMateriaPrima.categoria || editingMateriaPrima.categoria_mp || editingMateriaPrima["Categoria MP"],
                  quantidade: editingMateriaPrima.quantidade_atual ?? editingMateriaPrima.quantidade_mp ?? editingMateriaPrima["Quantidade Atual"],
                  unidade_medida: editingMateriaPrima.unidade_medida || editingMateriaPrima.unidade_mp || editingMateriaPrima["Unidade de Medida"],
                  custo_unitario: editingMateriaPrima.custo_unitario ?? editingMateriaPrima.custo_unitario_mp ?? editingMateriaPrima["Custo Unitário"]
                }}
                onSuccess={() => {
                  setEditingMateriaPrima(null);
                  carregarMateriaPrima();
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de detalhes do produto */}
        <ProductDetailsModal
          produto={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onEdit={(produto) => {
            setSelectedProduct(null);
            setEditingProduct(produto);
          }}
        />
      </div>
    </Layout>
  );
};

export default Estoque;