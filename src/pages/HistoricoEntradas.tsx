import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Layout from "@/components/Layout";
import { History, Filter, Download, Calendar, Package, Box, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { consultarDados } from "@/services/n8nIntegration";
import { formatDate, formatQuantity } from "@/utils/formatters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EntradaHistorico {
  id: number;
  data_hora: string;
  sku: string;
  nome: string;
  tipo: string;
  tipo_formatado: string;
  quantidade: number;
  origem_tabela?: string;
  origem_id?: string;
  observacao?: string;
}

interface Stats {
  entradas_materia_prima: {
    total: number;
    quantidade_total: number;
  };
  entradas_produtos: {
    total: number;
    quantidade_total: number;
  };
}

const HistoricoEntradas = () => {
  const [entradas, setEntradas] = useState<EntradaHistorico[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroSku, setFiltroSku] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  
  // Paginação
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  // Buscar histórico
  const buscarHistorico = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filtroTipo !== "todos") {
        params.append("tipo", filtroTipo);
      }
      if (filtroSku) {
        params.append("sku", filtroSku);
      }
      if (filtroDataInicio) {
        params.append("data_inicio", filtroDataInicio);
      }
      if (filtroDataFim) {
        params.append("data_fim", filtroDataFim);
      }

      const response = await consultarDados(`/historico-entradas?${params.toString()}`);
      
      if (response?.data) {
        setEntradas(response.data);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotal(response.pagination?.total || 0);
      } else {
        setEntradas([]);
        setTotalPages(1);
        setTotal(0);
      }
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      toast.error("Erro ao carregar histórico de entradas");
      setEntradas([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Buscar estatísticas
  const buscarStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filtroDataInicio) params.append("data_inicio", filtroDataInicio);
      if (filtroDataFim) params.append("data_fim", filtroDataFim);

      const response = await consultarDados(`/historico-entradas/stats?${params.toString()}`);
      
      if (response) {
        setStats(response);
      }
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      setStats(null);
    }
  };

  // Aplicar filtros
  const aplicarFiltros = () => {
    setPage(1);
    buscarHistorico();
    buscarStats();
  };

  // Limpar filtros
  const limparFiltros = () => {
    setFiltroTipo("todos");
    setFiltroSku("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
    setPage(1);
  };

  // Exportar para Excel
  const exportarExcel = async () => {
    try {
      toast.info("Preparando exportação...");
      
      const params = new URLSearchParams({ page: "1", limit: "10000" });
      if (filtroTipo !== "todos") params.append("tipo", filtroTipo);
      if (filtroSku) params.append("sku", filtroSku);
      if (filtroDataInicio) params.append("data_inicio", filtroDataInicio);
      if (filtroDataFim) params.append("data_fim", filtroDataFim);

      const response = await consultarDados(`/historico-entradas?${params.toString()}`);
      
      if (response.data && response.data.length > 0) {
        const dadosExportacao = response.data.map((entrada: EntradaHistorico) => ({
          "Data/Hora": new Date(entrada.data_hora).toLocaleString("pt-BR"),
          "SKU": entrada.sku,
          "Nome": entrada.nome,
          "Tipo": entrada.tipo_formatado,
          "Quantidade": entrada.quantidade,
          "Observação": entrada.observacao || "-",
        }));

        const XLSX = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(dadosExportacao);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Histórico Entradas");
        XLSX.writeFile(wb, `historico_entradas_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        toast.success("Exportação concluída!");
      } else {
        toast.warning("Nenhum dado para exportar");
      }
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar dados");
    }
  };

  useEffect(() => {
    buscarHistorico();
    buscarStats();
  }, [page]);

  return (
    <Layout>
      <div className="container mx-auto space-y-8 py-6">
        {/* ============================================
            HEADER PRINCIPAL
        ============================================ */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-6 border-l-4 border-primary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-primary rounded-xl p-3 shadow-lg">
                <History className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Histórico de Entradas</h1>
                <p className="text-muted-foreground text-base mt-1">
                  📊 Visualize todas as movimentações de entrada no seu estoque
                </p>
              </div>
            </div>
            <Button onClick={exportarExcel} size="lg" className="gap-2 shadow-md hover:shadow-lg transition-all">
              <Download className="h-5 w-5" />
              <span className="font-semibold">Exportar</span>
            </Button>
          </div>
        </div>

        {/* ============================================
            CARDS DE RESUMO (ESTATÍSTICAS)
        ============================================ */}
        {stats && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Card 1: Produtos */}
            <Card className="relative overflow-hidden border-2 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -mr-16 -mt-16"></div>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/10 p-3 rounded-lg">
                      <Package className="h-6 w-6 text-blue-500" />
                    </div>
                    <CardDescription className="text-base font-medium">Produtos</CardDescription>
                  </div>
                </div>
                <CardTitle className="text-5xl font-black mt-3">{stats.entradas_produtos.total}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-green-500/10 rounded-lg p-3 flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total adicionado</p>
                    <p className="text-xl font-bold text-green-600">{formatQuantity(stats.entradas_produtos.quantidade_total)} unidades</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Matéria-Prima */}
            <Card className="relative overflow-hidden border-2 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full -mr-16 -mt-16"></div>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-500/10 p-3 rounded-lg">
                      <Box className="h-6 w-6 text-orange-500" />
                    </div>
                    <CardDescription className="text-base font-medium">Matéria-Prima</CardDescription>
                  </div>
                </div>
                <CardTitle className="text-5xl font-black mt-3">{stats.entradas_materia_prima.total}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-green-500/10 rounded-lg p-3 flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total adicionado</p>
                    <p className="text-xl font-bold text-green-600">{formatQuantity(stats.entradas_materia_prima.quantidade_total)} unidades</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============================================
            FILTROS DE BUSCA
        ============================================ */}
        <Card className="border-2 shadow-md">
          <CardHeader className="bg-muted/30 border-b-2">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Filter className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Buscar Entradas</CardTitle>
                <CardDescription className="mt-1">Refine sua busca usando os filtros abaixo</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Filtro Tipo */}
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <span className="text-primary">●</span>
                    Tipo de Entrada
                  </label>
                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger className="h-11 border-2 hover:border-primary transition-colors">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">
                        <div className="flex items-center gap-2">
                          <span>Todos os tipos</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="produto">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-500" />
                          <span>Produtos</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="materia_prima">
                        <div className="flex items-center gap-2">
                          <Box className="h-4 w-4 text-orange-500" />
                          <span>Matéria-Prima</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro SKU */}
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <span className="text-primary">●</span>
                    SKU do Produto
                  </label>
                  <Input
                    placeholder="Ex: B701, H421..."
                    value={filtroSku}
                    onChange={(e) => setFiltroSku(e.target.value)}
                    className="h-11 border-2 hover:border-primary transition-colors"
                  />
                </div>

                {/* Data Início */}
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Data Início
                  </label>
                  <Input
                    type="date"
                    value={filtroDataInicio}
                    onChange={(e) => setFiltroDataInicio(e.target.value)}
                    className="h-11 border-2 hover:border-primary transition-colors"
                  />
                </div>

                {/* Data Fim */}
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Data Fim
                  </label>
                  <Input
                    type="date"
                    value={filtroDataFim}
                    onChange={(e) => setFiltroDataFim(e.target.value)}
                    className="h-11 border-2 hover:border-primary transition-colors"
                  />
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-2">
                <Button onClick={aplicarFiltros} size="lg" className="gap-2 flex-1 md:flex-initial shadow-md">
                  <Filter className="h-5 w-5" />
                  <span className="font-semibold">Buscar</span>
                </Button>
                <Button onClick={limparFiltros} variant="outline" size="lg" className="gap-2 border-2">
                  <X className="h-5 w-5" />
                  <span className="font-semibold">Limpar Tudo</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================
            TABELA DE RESULTADOS
        ============================================ */}
        <Card className="border-2 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/20 border-b-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-black">Registros Encontrados</CardTitle>
                <CardDescription className="text-base mt-1.5">
                  {loading ? "Carregando..." : (
                    <>
                      <span className="font-bold text-primary">{total}</span> {total === 1 ? "entrada registrada" : "entradas registradas"}
                    </>
                  )}
                </CardDescription>
              </div>
              
              {/* Paginação no Header */}
              {totalPages > 1 && (
                <div className="flex items-center gap-3 bg-background/50 rounded-lg p-2 border-2">
                  <span className="text-sm font-semibold text-muted-foreground px-2">
                    Página {page} de {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="h-9 px-4 font-semibold"
                    >
                      ← Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      className="h-9 px-4 font-semibold"
                    >
                      Próxima →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary"></div>
                  <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-4 border-primary opacity-20"></div>
                </div>
                <p className="text-lg font-semibold text-muted-foreground mt-6">Carregando histórico...</p>
              </div>
            ) : entradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <div className="bg-muted/30 rounded-full p-6 mb-6">
                  <History className="h-16 w-16 text-muted-foreground/30" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Nenhuma entrada encontrada</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Tente ajustar os filtros de busca ou registre novas entradas no estoque
                </p>
                <Button onClick={limparFiltros} variant="outline" className="mt-6 gap-2">
                  <X className="h-4 w-4" />
                  Limpar Filtros
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40 border-b-2">
                      <TableHead className="font-bold text-foreground h-14">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Data/Hora
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-foreground">SKU</TableHead>
                      <TableHead className="font-bold text-foreground">Nome do Item</TableHead>
                      <TableHead className="font-bold text-foreground">Tipo</TableHead>
                      <TableHead className="text-right font-bold text-foreground">Quantidade</TableHead>
                      <TableHead className="font-bold text-foreground">Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entradas.map((entrada, index) => (
                      <TableRow 
                        key={entrada.id} 
                        className={`
                          hover:bg-muted/60 transition-colors border-b
                          ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                        `}
                      >
                        <TableCell className="font-mono text-sm font-semibold whitespace-nowrap">
                          {new Date(entrada.data_hora).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded font-mono font-bold text-sm">
                            {entrada.sku}
                          </code>
                        </TableCell>
                        
                        <TableCell className="font-medium max-w-md">
                          {entrada.nome || <span className="text-muted-foreground italic">Sem nome</span>}
                        </TableCell>
                        
                        <TableCell>
                          <Badge 
                            variant={entrada.tipo === "entrada_mp" ? "secondary" : "default"}
                            className="font-semibold text-sm px-3 py-1.5 gap-1.5"
                          >
                            {entrada.tipo === "entrada_mp" ? (
                              <>
                                <Box className="h-3.5 w-3.5" />
                                Matéria-Prima
                              </>
                            ) : (
                              <>
                                <Package className="h-3.5 w-3.5" />
                                Produto
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1 bg-green-500/10 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-md font-bold">
                            <TrendingUp className="h-4 w-4" />
                            +{formatQuantity(entrada.quantidade)}
                          </div>
                        </TableCell>
                        
                        <TableCell className="max-w-xs">
                          <span className="text-sm text-muted-foreground line-clamp-2">
                            {entrada.observacao || <span className="italic">-</span>}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default HistoricoEntradas;
