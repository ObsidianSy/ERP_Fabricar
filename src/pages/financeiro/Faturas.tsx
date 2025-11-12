import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { faturasAPI, cartoesAPI, Fatura, Cartao } from '@/lib/financeiro';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Plus, DollarSign, Calendar, ShoppingBag, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import PayInvoiceModal from '@/components/PayInvoiceModal';
import AddPurchaseModal from '@/components/AddPurchaseModal';
import CircularProgress from '@/components/CircularProgress';

export default function FaturasPage() {
    const [faturas, setFaturas] = useState<Fatura[]>([]);
    const [faturasOriginal, setFaturasOriginal] = useState<Fatura[]>([]); // Guardar dados originais
    const [cartoes, setCartoes] = useState<Cartao[]>([]);
    const [loading, setLoading] = useState(true);
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [faturaAtual, setFaturaAtual] = useState<Fatura | null>(null);
    const [cartaoAtual, setCartaoAtual] = useState<Cartao | null>(null);

    // Filtros
    const [filtros, setFiltros] = useState({
        cartao_id: '',
        competencia: '', // AAAA-MM
        status: ''
    });

    useEffect(() => {
        carregarDados();
    }, []);

    useEffect(() => {
        aplicarFiltros();
    }, [filtros, faturasOriginal]);

    const aplicarFiltros = () => {
        let resultado = [...faturasOriginal];

        if (filtros.cartao_id) {
            resultado = resultado.filter(f => f.cartao_id === filtros.cartao_id);
        }

        if (filtros.competencia) {
            resultado = resultado.filter(f => f.competencia === filtros.competencia);
        }

        if (filtros.status) {
            resultado = resultado.filter(f => f.status === filtros.status);
        }

        setFaturas(resultado);
    };

    const carregarDados = async () => {
        try {
            setLoading(true);
            const [faturasData, cartoesData] = await Promise.all([
                faturasAPI.listar(),
                cartoesAPI.listar()
            ]);
            setFaturasOriginal(faturasData);
            setFaturas(faturasData);
            setCartoes(cartoesData.filter(c => c.ativo));
        } catch (error: any) {
            toast.error('Erro ao carregar dados', { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const abrirModalPagar = (fatura: Fatura) => {
        setFaturaAtual(fatura);
        setPayModalOpen(true);
    };

    const abrirModalCompra = (cartao: Cartao) => {
        setCartaoAtual(cartao);
        setPurchaseModalOpen(true);
    };

    const fecharFatura = async (id: string) => {
        if (!confirm('Fechar esta fatura? Ela não poderá mais ser editada.')) return;

        try {
            await faturasAPI.fechar(id);
            toast.success('Fatura fechada com sucesso!');
            await carregarDados();
        } catch (error: any) {
            toast.error('Erro ao fechar fatura', { description: error.message });
        }
    };

    const getStatusBadge = (status: string) => {
        if (status === 'paga') return <Badge className="bg-green-500">Paga</Badge>;
        if (status === 'fechada') return <Badge className="bg-blue-500">Fechada</Badge>;
        if (status === 'vencida') return <Badge variant="destructive">Vencida</Badge>;
        return <Badge variant="outline">Aberta</Badge>;
    };

    const getCartaoNome = (cartaoId: string) => {
        return cartoes.find(c => c.id === cartaoId)?.apelido || 'Cartão não encontrado';
    };

    const getCartao = (cartaoId: string) => {
        return cartoes.find(c => c.id === cartaoId);
    };

    const formatCompetencia = (competencia: string) => {
        const [ano, mes] = competencia.split('-');
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${meses[parseInt(mes) - 1]}/${ano}`;
    };

    // Agrupar faturas por status
    const faturasAbertas = faturas.filter(f => f.status === 'aberta');
    const faturasFechadas = faturas.filter(f => f.status === 'fechada' || f.status === 'vencida');
    const faturasPagas = faturas.filter(f => f.status === 'paga');

    // Faturas pagas no mês atual
    const mesAtual = new Date().toISOString().slice(0, 7); // AAAA-MM
    const faturasPagasMes = faturasPagas.filter(f => {
        if (!f.data_pagamento) return false;
        return f.data_pagamento.startsWith(mesAtual);
    });

    // Cálculos (convertendo para número)
    const totalAberto = faturasAbertas.reduce((sum, f) => sum + parseFloat(String(f.valor_total || 0)), 0);
    const totalFechado = faturasFechadas.reduce((sum, f) => sum + parseFloat(String(f.valor_total || 0)), 0);
    const totalPagoMes = faturasPagasMes.reduce((sum, f) => sum + parseFloat(String(f.valor_pago || 0)), 0);

    // Formatar data ISO para brasileiro
    const formatarData = (dataISO: string): string => {
        if (!dataISO) return '-';
        try {
            const data = new Date(dataISO);
            return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return dataISO;
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-96">
                    <div className="text-muted-foreground">Carregando faturas...</div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="container mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <CreditCard className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Faturas de Cartão</h1>
                            <p className="text-muted-foreground">Gerencie as faturas dos seus cartões de crédito</p>
                        </div>
                    </div>
                </div>

                {/* Filtros */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <Label>Cartão</Label>
                                <Select
                                    value={filtros.cartao_id || 'todos'}
                                    onValueChange={(value) => setFiltros({ ...filtros, cartao_id: value === 'todos' ? '' : value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos os cartões" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos os cartões</SelectItem>
                                        {cartoes.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.apelido}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Competência (Mês/Ano)</Label>
                                <Input
                                    type="month"
                                    value={filtros.competencia}
                                    onChange={(e) => setFiltros({ ...filtros, competencia: e.target.value })}
                                    placeholder="Selecione o mês"
                                />
                            </div>

                            <div>
                                <Label>Status</Label>
                                <Select
                                    value={filtros.status || 'todos'}
                                    onValueChange={(value) => setFiltros({ ...filtros, status: value === 'todos' ? '' : value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos os status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos os status</SelectItem>
                                        <SelectItem value="aberta">Aberta</SelectItem>
                                        <SelectItem value="fechada">Fechada</SelectItem>
                                        <SelectItem value="vencida">Vencida</SelectItem>
                                        <SelectItem value="paga">Paga</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setFiltros({ cartao_id: '', competencia: '', status: '' })}
                                    className="w-full"
                                >
                                    Limpar Filtros
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Cards Resumo */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-1">
                                <ShoppingBag className="h-4 w-4" />
                                Faturas Abertas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(totalAberto)}</div>
                            <p className="text-xs text-muted-foreground mt-1">{faturasAbertas.length} faturas</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-1">
                                <DollarSign className="h-4 w-4 text-orange-500" />
                                A Pagar
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalFechado)}</div>
                            <p className="text-xs text-muted-foreground mt-1">{faturasFechadas.length} faturas</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-1">
                                <TrendingUp className="h-4 w-4 text-green-500" />
                                Pago no Mês
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPagoMes)}</div>
                            <p className="text-xs text-muted-foreground mt-1">{faturasPagasMes.length} faturas</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="abertas" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="abertas">
                            Abertas ({faturasAbertas.length})
                        </TabsTrigger>
                        <TabsTrigger value="fechadas">
                            A Pagar ({faturasFechadas.length})
                        </TabsTrigger>
                        <TabsTrigger value="pagas">
                            Pagas ({faturasPagas.length})
                        </TabsTrigger>
                        <TabsTrigger value="cartoes">
                            Cartões ({cartoes.length})
                        </TabsTrigger>
                    </TabsList>

                    {/* Faturas Abertas */}
                    <TabsContent value="abertas" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {faturasAbertas.map(fatura => {
                                const cartao = getCartao(fatura.cartao_id);
                                const valorTotal = parseFloat(String(fatura.valor_total || 0));
                                const limite = cartao ? parseFloat(String(cartao.limite || 0)) : 0;
                                const percentualUsado = limite > 0 ? (valorTotal / limite) * 100 : 0;

                                return (
                                    <Card key={fatura.id}>
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-lg">{getCartaoNome(fatura.cartao_id)}</CardTitle>
                                                {getStatusBadge(fatura.status)}
                                            </div>
                                            <CardDescription>
                                                <Calendar className="h-3 w-3 inline mr-1" />
                                                {formatCompetencia(fatura.competencia)}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-2xl font-bold">{formatCurrency(fatura.valor_total)}</div>
                                                    {cartao && (
                                                        <div className="text-xs text-muted-foreground">
                                                            Limite: {formatCurrency(cartao.limite)}
                                                        </div>
                                                    )}
                                                </div>
                                                {cartao && (
                                                    <CircularProgress value={percentualUsado} size={80} />
                                                )}
                                            </div>

                                            <div className="text-sm space-y-1 border-t pt-3">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Fecha:</span>
                                                    <span>{formatarData(fatura.data_fechamento)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Vence:</span>
                                                    <span>{formatarData(fatura.data_vencimento)}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 pt-2">
                                                {cartao && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1"
                                                        onClick={() => abrirModalCompra(cartao)}
                                                    >
                                                        <Plus className="h-3 w-3 mr-1" />
                                                        Compra
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    onClick={() => fecharFatura(fatura.id)}
                                                >
                                                    Fechar
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {faturasAbertas.length === 0 && (
                                <Card className="col-span-full">
                                    <CardContent className="text-center py-12 text-muted-foreground">
                                        Nenhuma fatura aberta
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>

                    {/* Faturas Fechadas/A Pagar */}
                    <TabsContent value="fechadas" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {faturasFechadas.map(fatura => {
                                const cartao = getCartao(fatura.cartao_id);

                                return (
                                    <Card key={fatura.id}>
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-lg">{getCartaoNome(fatura.cartao_id)}</CardTitle>
                                                {getStatusBadge(fatura.status)}
                                            </div>
                                            <CardDescription>
                                                <Calendar className="h-3 w-3 inline mr-1" />
                                                {formatCompetencia(fatura.competencia)}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div>
                                                <div className="text-2xl font-bold">{formatCurrency(fatura.valor_total)}</div>
                                            </div>

                                            <div className="text-sm space-y-1 border-t pt-3">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Vence:</span>
                                                    <span className="font-medium">{formatarData(fatura.data_vencimento)}</span>
                                                </div>
                                            </div>

                                            <Button
                                                variant={fatura.status === 'vencida' ? 'destructive' : 'default'}
                                                size="sm"
                                                className="w-full"
                                                onClick={() => abrirModalPagar(fatura)}
                                            >
                                                <DollarSign className="h-3 w-3 mr-1" />
                                                {fatura.status === 'vencida' ? 'Pagar Atrasado' : 'Pagar Fatura'}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {faturasFechadas.length === 0 && (
                                <Card className="col-span-full">
                                    <CardContent className="text-center py-12 text-muted-foreground">
                                        Nenhuma fatura a pagar
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>

                    {/* Faturas Pagas */}
                    <TabsContent value="pagas" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {faturasPagas.map(fatura => (
                                <Card key={fatura.id}>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg">{getCartaoNome(fatura.cartao_id)}</CardTitle>
                                            {getStatusBadge(fatura.status)}
                                        </div>
                                        <CardDescription>
                                            <Calendar className="h-3 w-3 inline mr-1" />
                                            {formatCompetencia(fatura.competencia)}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Valor:</span>
                                            <span className="font-medium">{formatCurrency(fatura.valor_total)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Pago:</span>
                                            <span className="font-bold text-green-600">{formatCurrency(fatura.valor_pago)}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {faturasPagas.length === 0 && (
                                <Card className="col-span-full">
                                    <CardContent className="text-center py-12 text-muted-foreground">
                                        Nenhuma fatura paga ainda
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>

                    {/* Cartões */}
                    <TabsContent value="cartoes" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {cartoes.map(cartao => {
                                const faturasCartao = faturas.filter(f => f.cartao_id === cartao.id);
                                const totalGasto = faturasCartao.reduce((sum, f) => sum + parseFloat(String(f.valor_total || 0)), 0);
                                const limite = parseFloat(String(cartao.limite || 0));
                                const percentualLimite = limite > 0 ? (totalGasto / limite) * 100 : 0;

                                return (
                                    <Card key={cartao.id}>
                                        <CardHeader>
                                            <CardTitle className="text-lg">{cartao.apelido}</CardTitle>
                                            <CardDescription>
                                                {cartao.bandeira} •••• {cartao.ultimos_digitos}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm text-muted-foreground">Limite Total</div>
                                                    <div className="text-xl font-bold">{formatCurrency(cartao.limite)}</div>
                                                </div>
                                                <CircularProgress value={percentualLimite} size={80} />
                                            </div>

                                            <div className="text-sm space-y-1 border-t pt-3">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Usado:</span>
                                                    <span className="font-medium">{formatCurrency(totalGasto)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Disponível:</span>
                                                    <span className="font-bold text-green-600">
                                                        {formatCurrency(cartao.limite - totalGasto)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Faturas:</span>
                                                    <span>{faturasCartao.length}</span>
                                                </div>
                                            </div>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full"
                                                onClick={() => abrirModalCompra(cartao)}
                                            >
                                                <Plus className="h-3 w-3 mr-1" />
                                                Nova Compra
                                            </Button>
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {cartoes.length === 0 && (
                                <Card className="col-span-full">
                                    <CardContent className="text-center py-12 text-muted-foreground">
                                        Nenhum cartão cadastrado
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Modals */}
                {faturaAtual && (
                    <PayInvoiceModal
                        open={payModalOpen}
                        onOpenChange={setPayModalOpen}
                        onSuccess={carregarDados}
                        faturaId={faturaAtual.id}
                        valorTotal={faturaAtual.valor_total}
                        cartaoNome={getCartaoNome(faturaAtual.cartao_id)}
                        competencia={formatCompetencia(faturaAtual.competencia)}
                        contaPagamentoId={getCartao(faturaAtual.cartao_id)?.conta_pagamento_id}
                    />
                )}

                {cartaoAtual && (
                    <AddPurchaseModal
                        open={purchaseModalOpen}
                        onOpenChange={setPurchaseModalOpen}
                        onSuccess={carregarDados}
                        cartaoId={cartaoAtual.id}
                        cartaoNome={cartaoAtual.apelido}
                    />
                )}
            </div>
        </Layout>
    );
}
