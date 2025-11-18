import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, DollarSign, Package, TrendingUp, ChevronDown, ChevronUp, Edit, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandler';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface MateriaPrimaItem {
  sku_mp: string;
  nome_mp: string;
  quantidade: number;
  unidade_medida: string;
  custo_unitario_mp: number;
  unit_price_effective?: number;
  preco_por_100?: number;
  um_mp?: string;
  custo_total_item: number;
}

interface ProdutoCusto {
  sku_produto: string;
  nome_produto: string;
  categoria: string;
  unidade_medida: string;
  preco_unitario: number;
  custo_total_producao: number;
  materias_primas: MateriaPrimaItem[];
}

type SortField = 'sku_produto' | 'nome_produto' | 'categoria' | 'custo_total_producao' | 'preco_unitario' | 'margem';
type SortDirection = 'asc' | 'desc' | null;

const CustosProdutos = () => {
  const [produtos, setProdutos] = useState<ProdutoCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Modal de edição
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<ProdutoCusto | null>(null);
  const [precoEditado, setPrecoEditado] = useState("");
  const [salvando, setSalvando] = useState(false);
  
  // Ordenação
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  useEffect(() => {
    carregarCustos();
  }, []);

  const carregarCustos = async () => {
    setLoading(true);
    try {
      const response = await api.get<ProdutoCusto[]>('/receita-produto/custos/calcular');
      // A função api.get já retorna o JSON direto (não vem em response.data)
      setProdutos(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Erro ao carregar custos:', error);
      toast.error(`Erro ao carregar custos: ${getErrorMessage(error)}`);
      setProdutos([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (sku: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(sku)) {
      newExpanded.delete(sku);
    } else {
      newExpanded.add(sku);
    }
    setExpandedRows(newExpanded);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Ciclo: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const abrirModalEdicao = (produto: ProdutoCusto) => {
    setProdutoEditando(produto);
    setPrecoEditado(produto.preco_unitario.toString());
    setEditModalOpen(true);
  };

  const fecharModalEdicao = () => {
    setEditModalOpen(false);
    setProdutoEditando(null);
    setPrecoEditado("");
  };

  const salvarEdicao = async () => {
    if (!produtoEditando) return;
    
    const novoPreco = parseFloat(precoEditado);
    if (isNaN(novoPreco) || novoPreco < 0) {
      toast.error("Preço inválido");
      return;
    }

    setSalvando(true);
    try {
      await api.put(`/receita-produto/produto/${produtoEditando.sku_produto}/preco`, { 
        preco_unitario: novoPreco 
      });
      
      // Atualizar localmente
      setProdutos(prevProdutos => 
        prevProdutos.map(p => 
          p.sku_produto === produtoEditando.sku_produto 
            ? { ...p, preco_unitario: novoPreco }
            : p
        )
      );
      
      fecharModalEdicao();
      toast.success("Preço atualizado com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      toast.error(`Erro ao salvar: ${getErrorMessage(error)}`);
    } finally {
      setSalvando(false);
    }
  };

  const produtosFiltrados = (produtos || []).filter(produto =>
    produto.nome_produto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.sku_produto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Aplicar ordenação
  const produtosOrdenados = [...produtosFiltrados].sort((a, b) => {
    if (!sortField || !sortDirection) return 0;
    
    let valorA: string | number;
    let valorB: string | number;
    
    if (sortField === 'margem') {
      valorA = calcularMargem(Number(a.preco_unitario), Number(a.custo_total_producao));
      valorB = calcularMargem(Number(b.preco_unitario), Number(b.custo_total_producao));
    } else {
      valorA = a[sortField];
      valorB = b[sortField];
    }
    
    // Converter para número se for numérico
    if (typeof valorA === 'string' && !isNaN(Number(valorA))) {
      valorA = Number(valorA);
      valorB = Number(valorB);
    }
    
    if (valorA < valorB) return sortDirection === 'asc' ? -1 : 1;
    if (valorA > valorB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0);
  };

  const calcularMargem = (precoVenda: number, custoProducao: number) => {
    if (precoVenda === 0) return 0;
    return ((precoVenda - custoProducao) / precoVenda) * 100;
  };

  const totalCustoProducao = (produtos || []).reduce((sum, p) => sum + Number(p.custo_total_producao || 0), 0);
  const totalPrecoVenda = (produtos || []).reduce((sum, p) => sum + Number(p.preco_unitario || 0), 0);
  const margemMedia = (produtos || []).length > 0
    ? (produtos || []).reduce((sum, p) => sum + calcularMargem(Number(p.preco_unitario || 0), Number(p.custo_total_producao || 0)), 0) / produtos.length
    : 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Custos de Produtos</h1>
            <p className="text-muted-foreground mt-1">
              Visualize o custo de produção calculado com base nas matérias-primas
            </p>
          </div>
        </div>

        {/* Cards de Resumo - Design Premium */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/20 dark:bg-blue-800/20 rounded-full -mr-16 -mt-16"></div>
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-xl bg-blue-500 dark:bg-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total de Produtos</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-4xl font-bold text-blue-900 dark:text-blue-100 mb-1">{(produtos || []).length}</div>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                com receitas cadastradas
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/20 dark:bg-amber-800/20 rounded-full -mr-16 -mt-16"></div>
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-xl bg-amber-500 dark:bg-amber-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">Custo Médio</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-4xl font-bold text-amber-900 dark:text-amber-100 mb-1">
                {formatarMoeda((produtos || []).length > 0 ? totalCustoProducao / produtos.length : 0)}
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                custo de produção por unidade
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/20 dark:bg-green-800/20 rounded-full -mr-16 -mt-16"></div>
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-xl bg-green-500 dark:bg-green-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Preço Médio</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-4xl font-bold text-green-900 dark:text-green-100 mb-1">
                {formatarMoeda((produtos || []).length > 0 ? totalPrecoVenda / produtos.length : 0)}
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                preço de venda configurado
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200/20 dark:bg-purple-800/20 rounded-full -mr-16 -mt-16"></div>
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-xl bg-purple-500 dark:bg-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Margem Média</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-4xl font-bold text-purple-900 dark:text-purple-100 mb-1">
                {margemMedia.toFixed(1)}%
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                de lucro bruto nos produtos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por nome, SKU ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Produtos - Design Premium */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Produtos com Receitas</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {produtosOrdenados.length} produto{produtosOrdenados.length !== 1 ? 's' : ''} encontrado{produtosOrdenados.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {sortField && (
                <Badge variant="secondary" className="font-medium px-3 py-1.5">
                  Ordenado por: {sortField === 'sku_produto' ? 'SKU' : 
                                 sortField === 'nome_produto' ? 'Nome' :
                                 sortField === 'categoria' ? 'Categoria' :
                                 sortField === 'custo_total_producao' ? 'Custo' :
                                 sortField === 'preco_unitario' ? 'Preço' : 'Margem'}
                  {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
                <p className="mt-4 text-muted-foreground font-medium">Carregando custos...</p>
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold mb-2">Nenhum produto encontrado</p>
                <p className="text-sm text-muted-foreground">Tente ajustar os filtros de busca</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/30 border-b-2">
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead className="min-w-[120px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 font-semibold hover:bg-background/80 -ml-4"
                          onClick={() => handleSort('sku_produto')}
                        >
                          SKU
                          {sortField === 'sku_produto' && (
                            sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                          )}
                          {sortField !== 'sku_produto' && <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />}
                        </Button>
                      </TableHead>
                      <TableHead className="min-w-[300px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 font-semibold hover:bg-background/80 -ml-4"
                          onClick={() => handleSort('nome_produto')}
                        >
                          Nome do Produto
                          {sortField === 'nome_produto' && (
                            sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                          )}
                          {sortField !== 'nome_produto' && <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />}
                        </Button>
                      </TableHead>
                      <TableHead className="min-w-[140px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 font-semibold hover:bg-background/80 -ml-4"
                          onClick={() => handleSort('categoria')}
                        >
                          Categoria
                          {sortField === 'categoria' && (
                            sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                          )}
                          {sortField !== 'categoria' && <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right min-w-[150px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 font-semibold hover:bg-background/80 w-full justify-end"
                          onClick={() => handleSort('custo_total_producao')}
                        >
                          Custo Produção
                          {sortField === 'custo_total_producao' && (
                            sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                          )}
                          {sortField !== 'custo_total_producao' && <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right min-w-[150px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 font-semibold hover:bg-background/80 w-full justify-end"
                          onClick={() => handleSort('preco_unitario')}
                        >
                          Preço Venda
                          {sortField === 'preco_unitario' && (
                            sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                          )}
                          {sortField !== 'preco_unitario' && <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right min-w-[120px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 font-semibold hover:bg-background/80 w-full justify-end"
                          onClick={() => handleSort('margem')}
                        >
                          Margem
                          {sortField === 'margem' && (
                            sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                          )}
                          {sortField !== 'margem' && <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />}
                        </Button>
                      </TableHead>
                      <TableHead className="text-center font-semibold min-w-[120px]">Status</TableHead>
                      <TableHead className="w-[80px] text-center font-semibold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtosOrdenados.map((produto) => {
                      const isExpanded = expandedRows.has(produto.sku_produto);
                      const margem = calcularMargem(Number(produto.preco_unitario), Number(produto.custo_total_producao));
                      const custoProducao = Number(produto.custo_total_producao);
                      const precoVenda = Number(produto.preco_unitario);

                      return (
                        <>
                          <TableRow 
                            key={produto.sku_produto} 
                            onClick={() => toggleRow(produto.sku_produto)}
                            className="cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent hover:shadow-md border-b group"
                          >
                            <TableCell className="py-5">
                              <div className="h-8 w-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-primary" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-5">
                              <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-2 rounded-lg inline-flex items-center gap-2 font-mono text-sm font-bold shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-primary"></span>
                                {produto.sku_produto}
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold py-5 text-base group-hover:text-primary transition-colors">
                              {produto.nome_produto}
                            </TableCell>
                            <TableCell className="py-5">
                              {produto.categoria && (
                                <Badge variant="outline" className="font-medium px-3 py-1 shadow-sm">
                                  {produto.categoria}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right py-5">
                              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 px-4 py-2 rounded-lg font-bold text-base text-amber-700 dark:text-amber-400 shadow-sm">
                                <span className="text-xs opacity-70">R$</span>
                                {formatarMoeda(custoProducao).replace('R$', '').trim()}
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-5">
                              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 px-4 py-2 rounded-lg font-bold text-base text-green-700 dark:text-green-400 shadow-sm">
                                <span className="text-xs opacity-70">R$</span>
                                {formatarMoeda(precoVenda).replace('R$', '').trim()}
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-5">
                              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-base shadow-sm ${
                                margem > 30 
                                  ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 text-blue-700 dark:text-blue-400' 
                                  : margem > 15 
                                    ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                                    : 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/20 text-red-700 dark:text-red-400'
                              }`}>
                                {margem.toFixed(1)}%
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-5">
                              {custoProducao > 0 ? (
                                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 px-4 py-2 rounded-lg font-semibold shadow-sm">
                                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                  Calculado
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-lg font-medium text-muted-foreground shadow-sm">
                                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                                  Sem custo
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-center py-5">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalEdicao(produto);
                                }}
                                className="h-10 w-10 rounded-lg hover:bg-primary/10 hover:text-primary hover:shadow-md transition-all duration-200"
                                title="Editar preço"
                              >
                                <Edit className="h-5 w-5" />
                              </Button>
                            </TableCell>
                          </TableRow>

                          {/* Linha Expandida com Matérias-Primas */}
                          {isExpanded && produto.materias_primas && produto.materias_primas.length > 0 && (
                            <TableRow>
                              <TableCell colSpan={10} className="bg-gradient-to-r from-muted/50 to-transparent p-0 border-b">
                                <div className="p-8">
                                  <div className="flex items-center gap-3 mb-6">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                      <Package className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-base">Composição da Receita</h4>
                                      <p className="text-sm text-muted-foreground">
                                        {produto.materias_primas.length} matéria{produto.materias_primas.length !== 1 ? 's' : ''}-prima{produto.materias_primas.length !== 1 ? 's' : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="grid gap-3">
                                    {produto.materias_primas.map((mp) => (
                                      <div
                                        key={mp.sku_mp}
                                        className="group flex justify-between items-center p-5 rounded-xl border bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-200"
                                      >
                                        <div className="flex items-center gap-4 flex-1">
                                          <div className="w-1 h-14 bg-gradient-to-b from-primary to-primary/30 rounded-full"></div>
                                          <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold shadow-sm">
                                            {mp.sku_mp}
                                          </div>
                                          <span className="font-semibold text-base flex-1 group-hover:text-primary transition-colors">
                                            {mp.nome_mp}
                                          </span>
                                          <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 px-4 py-2 rounded-lg shadow-sm">
                                            <span className="font-bold text-blue-700 dark:text-blue-400">
                                              {mp.quantidade}
                                            </span>
                                            <span className="text-sm text-blue-600 dark:text-blue-500">
                                              {mp.unidade_medida}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-6 ml-6">
                                          <div className="text-right">
                                            <p className="text-xs text-muted-foreground mb-1">Preço unitário</p>
                                            <span className="text-sm font-medium text-muted-foreground">
                                              {mp.um_mp === 'M' && mp.unidade_medida === 'CM' 
                                                ? `${formatarMoeda(Number(mp.custo_unitario_mp))} / 100 CM`
                                                : `${formatarMoeda(Number(mp.unit_price_effective ?? mp.custo_unitario_mp))} / ${mp.unidade_medida}`
                                              }
                                            </span>
                                          </div>
                                          <div className="h-12 w-px bg-border"></div>
                                          <div className="text-right min-w-[120px]">
                                            <p className="text-xs text-muted-foreground mb-1">Custo total</p>
                                            <span className="text-lg font-bold text-amber-700 dark:text-amber-400">
                                              {formatarMoeda(Number(mp.custo_total_item))}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Edição */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Editar Produto</DialogTitle>
                <DialogDescription>
                  Ajuste o preço de venda e veja o impacto imediato na margem e lucro por unidade.
                </DialogDescription>
              </DialogHeader>

              {produtoEditando && (
                <div className="grid gap-4 py-4">
                  {/* Top: Identificação */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 p-2 bg-primary/10 rounded-md">
                      <Package className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-muted-foreground">SKU</div>
                      <div className="font-mono font-semibold text-lg">{produtoEditando.sku_produto}</div>
                      <div className="text-sm text-muted-foreground mt-1">{produtoEditando.nome_produto}</div>
                    </div>
                  </div>

                  {/* Dados principais em cards compactos */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="text-xs text-muted-foreground">Custo Produção</div>
                      <div className="font-bold text-amber-600 text-lg mt-1">{formatarMoeda(Number(produtoEditando.custo_total_producao))}</div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <div className="text-xs text-muted-foreground">Preço Atual</div>
                      <div className="font-bold text-green-700 text-lg mt-1">{formatarMoeda(Number(produtoEditando.preco_unitario))}</div>
                    </div>
                    <div className="p-3 rounded-lg" style={{background: 'linear-gradient(90deg, rgba(59,130,246,0.05), rgba(59,130,246,0.02))'}}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-muted-foreground">Margem Atual</div>
                          <div className="font-bold text-base mt-1">
                            <Badge variant={calcularMargem(Number(produtoEditando.preco_unitario), Number(produtoEditando.custo_total_producao)) > 30 ? "default" : "secondary"} className="text-sm">
                              {calcularMargem(Number(produtoEditando.preco_unitario), Number(produtoEditando.custo_total_producao)).toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">&nbsp;</div>
                      </div>
                    </div>
                  </div>

                  {/* Entrada de preço com prefixo e explicações */}
                  <div className="space-y-2">
                    <Label htmlFor="preco_venda" className="text-sm font-medium">Novo Preço de Venda</Label>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-3 py-2 bg-background border rounded-l-md text-sm text-muted-foreground">R$</span>
                      <Input
                        id="preco_venda"
                        type="number"
                        step="0.01"
                        min="0"
                        value={precoEditado}
                        onChange={(e) => setPrecoEditado(e.target.value)}
                        className="text-lg font-semibold rounded-r-md"
                        placeholder="0,00"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Digite o novo preço e confira a margem e lucro estimados abaixo.</p>
                  </div>

                  {/* Resultados em tempo real */}
                  {precoEditado && !isNaN(parseFloat(precoEditado)) && (
                    <div className="p-4 bg-muted rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">Nova Margem</div>
                        <Badge variant={calcularMargem(parseFloat(precoEditado), Number(produtoEditando.custo_total_producao)) > 30 ? "default" : (calcularMargem(parseFloat(precoEditado), Number(produtoEditando.custo_total_producao)) > 15 ? 'secondary' : 'destructive')}>
                          {calcularMargem(parseFloat(precoEditado), Number(produtoEditando.custo_total_producao)).toFixed(1)}%
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">Lucro por Unidade</div>
                        <div className="font-semibold text-green-600">{formatarMoeda(parseFloat(precoEditado) - Number(produtoEditando.custo_total_producao))}</div>
                      </div>

                      {/* Aviso quando preço menor que custo */}
                      {parseFloat(precoEditado) < Number(produtoEditando.custo_total_producao) && (
                        <div className="text-sm text-destructive">
                          Atenção: o novo preço está abaixo do custo de produção — pode gerar prejuízo.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={fecharModalEdicao} disabled={salvando}>
                  Cancelar
                </Button>
                <Button onClick={salvarEdicao} disabled={salvando} className="bg-primary hover:bg-primary/90">
                  {salvando ? "Salvando..." : "Salvar alterações"}
                </Button>
              </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CustosProdutos;
