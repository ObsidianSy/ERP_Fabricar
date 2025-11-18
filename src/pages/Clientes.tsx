
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import Layout from "@/components/Layout";
import { formatCurrencyAbbreviated, toNumber } from "@/utils/formatters";
import { formatarDocumento, formatarTelefone } from "@/utils/validators";
import { Edit, Plus, Search, Trash, Users, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { consultarClientes, atualizarClienteDrop } from "@/services/n8nIntegration";
import ClienteForm from "@/components/forms/ClienteForm";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { useDebounce } from "@/hooks/useDebounce";

interface Cliente {
  "ID Cliente": string;
  "Nome": string;
  "Documento": string;
  "Telefone": string;
  "Email": string;
  "Observações": string;
  "Total Comprado": number;
  "Total Pago": number;
  "Total atual": number;
  "is_cliente_drop"?: boolean; // Flag Cliente Drop
}
import { useApiDataWithFilters } from "@/hooks/useApiDataWithFilters";

const Clientes = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingClienteId, setLoadingClienteId] = useState<string | null>(null); // Estado para toggle
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const navigate = useNavigate();

  // Dados agregados por período
  const { data: vendas } = useApiDataWithFilters('Vendas');
  const { data: pagamentos } = useApiDataWithFilters('Pagamentos');

  // Debounce search to improve performance
  const debouncedBusca = useDebounce(busca, 300);

  // Helper para normalizar nomes
  const norm = (s?: string) => (s ?? "").trim().toLowerCase();

  // Totais agregados por cliente no período
  const totalVendasPorCliente = useMemo(() => {
    const map: Record<string, number> = {};
    if (!vendas) return map;
    (vendas as any[]).forEach((v: any) => {
      const nome = v['Nome Cliente'] || v['Cliente'];
      if (!nome) return;
      const key = norm(nome);
      map[key] = (map[key] ?? 0) + toNumber(v['Valor Total'] ?? v['Preço Total'] ?? v['Total']);
    });
    return map;
  }, [vendas]);

  const totalPagamentosPorCliente = useMemo(() => {
    const map: Record<string, number> = {};
    if (!pagamentos) return map;
    (pagamentos as any[]).forEach((p: any) => {
      const nome = p['Nome Cliente'] || p['Cliente'];
      if (!nome) return;
      const key = norm(nome);
      map[key] = (map[key] ?? 0) + toNumber(p['Valor'] ?? p['Valor Pago']);
    });
    return map;
  }, [pagamentos]);

  useEffect(() => {
    carregarClientes();
  }, []);

  const carregarClientes = async () => {
    setIsLoading(true);
    try {
      const dadosClientes = await consultarClientes();
      
      if (dadosClientes && dadosClientes.length > 0) {
        const clientesFormatados = dadosClientes.map((item: any, index: number) => {
          // Gerar um ID único se não existir
          const id = item["ID Cliente"] || item.id || item["Nome"] || `cliente-${index + 1}`;
          
          return {
            "ID Cliente": id,
            "Nome": item["Nome"] || item["Cliente"] || item.nome || '',
            "Documento": item["Documento"] || item.documento || '',
            "Telefone": item["Telefone"] || item["Telefone / WhatsApp"] || item.telefone || '',
            "Email": item["Email"] || item["E-mail"] || item.email || '',
            "Observações": item["Observações"] || item.observacoes || '',
            "Total Comprado": toNumber(item["Total Comprado"]),
            "Total Pago": toNumber(item["Total Pago"]),
            "Total atual": toNumber(item["Total atual"]),
            "is_cliente_drop": item.is_cliente_drop || false // Flag Cliente Drop
          };
        });
        
        setClientes(clientesFormatados);
        toast.success("Clientes carregados", {
          description: `${clientesFormatados.length} clientes encontrados`
        });
      } else {
        setClientes([]);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error("Erro ao carregar clientes", {
        description: "Tente novamente mais tarde"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter clients based on search
  const clientesFiltrados = useMemo(() => {
    if (!debouncedBusca) return clientes;
    
    const searchLower = debouncedBusca.toLowerCase();
    return clientes.filter(cliente => 
      cliente["Nome"].toLowerCase().includes(searchLower) ||
      cliente["Email"].toLowerCase().includes(searchLower) ||
      cliente["Telefone"].includes(debouncedBusca) ||
      cliente["Documento"].includes(debouncedBusca)
    );
  }, [clientes, debouncedBusca]);

  // Pagination
  const paginatedClientes = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return clientesFiltrados.slice(startIndex, endIndex);
  }, [clientesFiltrados, currentPage, pageSize]);

  const totalPages = Math.ceil(clientesFiltrados.length / pageSize);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedBusca]);

  // Função para alternar Cliente Drop
  const handleToggleDrop = async (clienteId: string, nomeCliente: string, isCurrentlyDrop: boolean, event: React.MouseEvent) => {
    event.stopPropagation(); // Impede navegação ao clicar no toggle
    setLoadingClienteId(clienteId);
    try {
      const success = await atualizarClienteDrop(clienteId, !isCurrentlyDrop);
      if (success) {
        // Atualizar estado local sem recarregar página
        setClientes(prev => prev.map(c => 
          c["ID Cliente"] === clienteId 
            ? { ...c, "is_cliente_drop": !isCurrentlyDrop }
            : c
        ));
        toast.success(`${nomeCliente} ${!isCurrentlyDrop ? 'marcado' : 'desmarcado'} como Cliente Drop`);
      } else {
        toast.error('Erro ao atualizar Cliente Drop');
      }
    } catch (error) {
      console.error('Erro ao atualizar Cliente Drop:', error);
      toast.error('Erro ao atualizar Cliente Drop');
    } finally {
      setLoadingClienteId(null);
    }
  };


  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">Gestão de Clientes</h2>
            <p className="text-muted-foreground mt-1">
              {clientes.length} clientes cadastrados
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Novo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <ClienteForm onSuccess={() => carregarClientes()} />
              </DialogContent>
            </Dialog>
            <Button 
              onClick={carregarClientes}
              variant="outline"
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="flex w-full items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar cliente por nome, email, telefone ou documento..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex space-x-4">
                    <Skeleton className="h-12 w-full" />
                  </div>
                ))}
              </div>
            ) : clientesFiltrados.length === 0 ? (
              <EmptyState
                icon={<Users className="h-12 w-12" />}
                title={busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                description={busca ? "Tente buscar com outros termos" : "Comece cadastrando seu primeiro cliente"}
                action={
                  !busca && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Cadastrar Cliente
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <ClienteForm onSuccess={() => carregarClientes()} />
                      </DialogContent>
                    </Dialog>
                  )
                }
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-center">Cliente Drop</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="hidden lg:table-cell">Observações</TableHead>
                      <TableHead className="text-right">Total Comprado</TableHead>
                      <TableHead className="text-right">Total Pago</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClientes.map((cliente) => {
                      const key = norm(cliente["Nome"]);
                      const totalCompradoAgregado = totalVendasPorCliente[key];
                      const totalPagoAgregado = totalPagamentosPorCliente[key];

                      // Calcular quantidade total de itens vendidos para esse cliente
                      const vendasCliente = (vendas || []) as any[];
                      const quantidadeTotalItens = vendasCliente
                        .filter((v: any) => norm(v['Nome Cliente'] || v['Cliente']) === key)
                        .reduce((total: number, v: any) => total + (toNumber(v['Quantidade Vendida']) || 0), 0);

                      // Se Cliente Drop, adicionar R$5 por item ao total comprado
                      const markupDrop = cliente["is_cliente_drop"] ? quantidadeTotalItens * 5 : 0;
                      
                      const totalComprado = ((totalCompradoAgregado ?? toNumber(cliente["Total Comprado"])) || 0) + markupDrop;
                      const totalPago = (totalPagoAgregado ?? toNumber(cliente["Total Pago"])) || 0;
                      const saldo = totalComprado - totalPago;

                      return (
                        <TableRow 
                          key={cliente["ID Cliente"]} 
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/cliente/${cliente["ID Cliente"]}`)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {cliente["Nome"]}
                              {cliente["is_cliente_drop"] && (
                                <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                                  DROP
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Switch
                                checked={cliente["is_cliente_drop"]}
                                onCheckedChange={(checked) => handleToggleDrop(
                                  cliente["ID Cliente"], 
                                  cliente["Nome"], 
                                  cliente["is_cliente_drop"] || false,
                                  { stopPropagation: () => {} } as any
                                )}
                                onClick={(e) => e.stopPropagation()}
                                disabled={loadingClienteId === cliente["ID Cliente"]}
                                aria-label="Cliente Drop"
                              />
                              <span className="text-xs text-muted-foreground">
                                {cliente["is_cliente_drop"] ? '+R$5' : 'OFF'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {cliente["Documento"] ? formatarDocumento(cliente["Documento"]) : '-'}
                          </TableCell>
                          <TableCell>
                            {cliente["Telefone"] ? formatarTelefone(cliente["Telefone"]) : '-'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {cliente["Email"] || '-'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell max-w-xs truncate">
                            {cliente["Observações"] || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="outline" className="text-green-600 border-green-200">
                                {formatCurrencyAbbreviated(totalComprado)}
                              </Badge>
                              {cliente["is_cliente_drop"] && markupDrop > 0 && (
                                <span className="text-xs text-blue-600">
                                  (+R${markupDrop.toFixed(2)} Drop)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="text-blue-600 border-blue-200">
                              {formatCurrencyAbbreviated(totalPago)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant={saldo > 0 ? "destructive" : saldo < 0 ? "secondary" : "outline"}
                            >
                              {formatCurrencyAbbreviated(saldo)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                
                {totalPages > 1 && (
                  <DataTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={clientesFiltrados.length}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Clientes;
