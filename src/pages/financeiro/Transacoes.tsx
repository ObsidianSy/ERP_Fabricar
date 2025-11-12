import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import {
    transacoesAPI,
    contasAPI,
    categoriasAPI,
    Transacao,
    Conta,
    Categoria,
    TipoTransacaoFrontend,
    frontendParaBackend,
    backendParaFrontend
} from '@/lib/financeiro';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUpDown, Plus, Check, X, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function TransacoesPage() {
    const [transacoes, setTransacoes] = useState<Transacao[]>([]);
    const [contas, setContas] = useState<Conta[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogAberto, setDialogAberto] = useState(false);

    // Filtros
    const [filtros, setFiltros] = useState({
        conta_id: '',
        tipo: '' as TipoTransacaoFrontend | '',
        status: '',
        data_inicio: '',
        data_fim: ''
    });

    // Formulário (usa tipos do frontend: receita/despesa)
    const [formData, setFormData] = useState({
        tipo: 'despesa' as TipoTransacaoFrontend,
        conta_id: '',
        conta_destino_id: '',
        categoria_id: '',
        descricao: '',
        valor: 0,
        data_transacao: new Date().toISOString().split('T')[0],
        observacoes: ''
    });

    useEffect(() => {
        carregarDados();
    }, [filtros]);

    const carregarDados = async () => {
        try {
            setLoading(true);
            const [contasData, categoriasData] = await Promise.all([
                contasAPI.listar(),
                categoriasAPI.listar()
            ]);
            setContas(contasData.filter(c => c.ativo));
            setCategorias(categoriasData);

            // Converter tipos do frontend para backend
            const filtrosBackend: any = {
                conta_id: filtros.conta_id || undefined,
                tipo: filtros.tipo ? frontendParaBackend(filtros.tipo) : undefined,
                status: filtros.status || undefined,
                data_inicio: filtros.data_inicio || undefined,
                data_fim: filtros.data_fim || undefined
            };

            const transacoesData = await transacoesAPI.listar(filtrosBackend);
            setTransacoes(transacoesData);
        } catch (error: any) {
            toast.error('Erro ao carregar dados', { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const abrirDialogNovo = () => {
        setFormData({
            tipo: 'despesa',
            conta_id: '',
            conta_destino_id: '',
            categoria_id: '',
            descricao: '',
            valor: 0,
            data_transacao: new Date().toISOString().split('T')[0],
            observacoes: ''
        });
        setDialogAberto(true);
    };

    const salvarTransacao = async () => {
        try {
            if (!formData.conta_id || !formData.descricao || formData.valor <= 0) {
                toast.error('Preencha todos os campos obrigatórios');
                return;
            }

            if (formData.tipo === 'transferencia' && !formData.conta_destino_id) {
                toast.error('Selecione a conta de destino para transferência');
                return;
            }

            // Converter tipo do frontend para backend
            const payload = {
                descricao: formData.descricao,
                valor: formData.valor,
                tipo: frontendParaBackend(formData.tipo),
                data_transacao: formData.data_transacao,
                conta_id: formData.conta_id,
                conta_destino_id: formData.tipo === 'transferencia' ? formData.conta_destino_id : undefined,
                categoria_id: formData.categoria_id || undefined,
                observacoes: formData.observacoes || undefined
            };

            await transacoesAPI.criar(payload);
            toast.success('Transação criada com sucesso!');
            setDialogAberto(false);
            await carregarDados();
        } catch (error: any) {
            toast.error('Erro ao salvar transação', { description: error.message });
        }
    };

    const liquidarTransacao = async (id: string, descricao: string) => {
        if (!confirm(`Confirmar liquidação de "${descricao}"?`)) return;

        try {
            await transacoesAPI.liquidar(id);
            toast.success('Transação liquidada!');
            await carregarDados();
        } catch (error: any) {
            toast.error('Erro ao liquidar', { description: error.message });
        }
    };

    const deletarTransacao = async (id: string, descricao: string) => {
        if (!confirm(`Excluir "${descricao}"?`)) return;

        try {
            await transacoesAPI.deletar(id);
            toast.success('Transação excluída!');
            await carregarDados();
        } catch (error: any) {
            toast.error('Erro ao excluir', { description: error.message });
        }
    };

    const getTipoIcon = (tipo: string) => {
        const tipoFront = backendParaFrontend(tipo as any);
        if (tipoFront === 'receita') return <TrendingUp className="h-4 w-4 text-green-500" />;
        if (tipoFront === 'despesa') return <TrendingDown className="h-4 w-4 text-red-500" />;
        return <ArrowUpDown className="h-4 w-4 text-blue-500" />;
    };

    const getTipoColor = (tipo: string) => {
        const tipoFront = backendParaFrontend(tipo as any);
        if (tipoFront === 'receita') return 'text-green-600';
        if (tipoFront === 'despesa') return 'text-red-600';
        return 'text-blue-600';
    };

    const getStatusBadge = (status: string) => {
        if (status === 'liquidado') return <Badge className="bg-green-500">Liquidada</Badge>;
        if (status === 'cancelado') return <Badge variant="secondary">Cancelada</Badge>;
        return <Badge variant="outline">Pendente</Badge>;
    };

    const getContaNome = (contaId: string) => contas.find(c => c.id === contaId)?.nome || '-';
    const getCategoriaNome = (catId: string | undefined) => {
        if (!catId) return '-';
        return categorias.find(c => c.id === catId)?.nome || '-';
    };

    // Calcular totais
    const transacoesCredito = transacoes.filter(t => t.tipo === 'credito' && t.status === 'liquidado');
    const transacoesDebito = transacoes.filter(t => t.tipo === 'debito' && t.status === 'liquidado');

    const totalReceitas = transacoesCredito.reduce((sum, t) => sum + parseFloat(String(t.valor || 0)), 0);
    const totalDespesas = transacoesDebito.reduce((sum, t) => sum + parseFloat(String(t.valor || 0)), 0);
    const saldoPeriodo = totalReceitas - totalDespesas;

    if (loading) {
        return <div className="container mx-auto p-6">Carregando...</div>;
    }

    return (
        <Layout>
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Transações</h1>
                        <p className="text-muted-foreground">Gerencie receitas, despesas e transferências</p>
                    </div>

                    <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
                        <DialogTrigger asChild>
                            <Button onClick={abrirDialogNovo}>
                                <Plus className="h-4 w-4 mr-2" />
                                Nova Transação
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Nova Transação</DialogTitle>
                                <DialogDescription>Registre uma receita, despesa ou transferência</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div>
                                    <Label>Tipo *</Label>
                                    <Select
                                        value={formData.tipo}
                                        onValueChange={(value: TipoTransacaoFrontend) =>
                                            setFormData({ ...formData, tipo: value, conta_destino_id: '' })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="receita">💰 Receita</SelectItem>
                                            <SelectItem value="despesa">💸 Despesa</SelectItem>
                                            <SelectItem value="transferencia">🔄 Transferência</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Conta {formData.tipo === 'transferencia' ? 'Origem' : ''} *</Label>
                                        <Select value={formData.conta_id} onValueChange={v => setFormData({ ...formData, conta_id: v })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {contas.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        {c.nome}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {formData.tipo === 'transferencia' ? (
                                        <div>
                                            <Label>Conta Destino *</Label>
                                            <Select
                                                value={formData.conta_destino_id}
                                                onValueChange={v => setFormData({ ...formData, conta_destino_id: v })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {contas.filter(c => c.id !== formData.conta_id).map(c => (
                                                        <SelectItem key={c.id} value={c.id}>
                                                            {c.nome}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        <div>
                                            <Label>Categoria</Label>
                                            <Select value={formData.categoria_id} onValueChange={v => setFormData({ ...formData, categoria_id: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categorias
                                                        .filter(c => c.tipo === frontendParaBackend(formData.tipo))
                                                        .map(cat => (
                                                            <SelectItem key={cat.id} value={cat.id}>
                                                                {cat.icone} {cat.nome}
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <Label>Descrição *</Label>
                                    <Input
                                        value={formData.descricao}
                                        onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                                        placeholder="Ex: Salário, Aluguel, etc."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Valor *</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.valor}
                                            onChange={e => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>

                                    <div>
                                        <Label>Data *</Label>
                                        <Input
                                            type="date"
                                            value={formData.data_transacao}
                                            onChange={e => setFormData({ ...formData, data_transacao: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label>Observação</Label>
                                    <Textarea
                                        value={formData.observacoes}
                                        onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                                        placeholder="Informações adicionais..."
                                        rows={3}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1" onClick={() => setDialogAberto(false)}>
                                        Cancelar
                                    </Button>
                                    <Button className="flex-1" onClick={salvarTransacao}>
                                        Criar Transação
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Filtros */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div>
                                <Label>Tipo</Label>
                                <Select
                                    value={filtros.tipo || 'todos'}
                                    onValueChange={(value: any) => setFiltros({ ...filtros, tipo: value === 'todos' ? '' : value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos</SelectItem>
                                        <SelectItem value="receita">Receita</SelectItem>
                                        <SelectItem value="despesa">Despesa</SelectItem>
                                        <SelectItem value="transferencia">Transferência</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Conta</Label>
                                <Select
                                    value={filtros.conta_id || 'todas'}
                                    onValueChange={(value) => setFiltros({ ...filtros, conta_id: value === 'todas' ? '' : value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Todas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todas">Todas</SelectItem>
                                        {contas.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Data Início</Label>
                                <Input
                                    type="date"
                                    value={filtros.data_inicio}
                                    onChange={(e) => setFiltros({ ...filtros, data_inicio: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label>Data Fim</Label>
                                <Input
                                    type="date"
                                    value={filtros.data_fim}
                                    onChange={(e) => setFiltros({ ...filtros, data_fim: e.target.value })}
                                />
                            </div>

                            <div className="flex items-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setFiltros({ conta_id: '', tipo: '', status: '', data_inicio: '', data_fim: '' })}
                                    className="w-full"
                                >
                                    Limpar
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Cards de Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-1">
                                <TrendingUp className="h-4 w-4 text-green-500" />
                                Receitas Liquidadas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalReceitas)}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {transacoesCredito.length} transações
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-1">
                                <TrendingDown className="h-4 w-4 text-red-500" />
                                Despesas Liquidadas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalDespesas)}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {transacoesDebito.length} transações
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Saldo</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${saldoPeriodo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(saldoPeriodo)}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Lista */}
                <Card>
                    <CardHeader>
                        <CardTitle>Transações ({transacoes.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {transacoes.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">Nenhuma transação encontrada</div>
                        ) : (
                            <div className="space-y-2">
                                {transacoes.map(t => (
                                    <div key={t.id} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-4 flex-1">
                                            {getTipoIcon(t.tipo)}
                                            <div className="flex-1">
                                                <div className="font-medium">{t.descricao}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {getContaNome(t.conta_id)}
                                                    {t.conta_destino_id && ` → ${getContaNome(t.conta_destino_id)}`}
                                                    {' • '}
                                                    {getCategoriaNome(t.categoria_id)}
                                                    {' • '}
                                                    {formatDate(t.data_transacao)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className={`text-lg font-bold ${getTipoColor(t.tipo)}`}>
                                                {t.tipo === 'debito' && '-'}
                                                {formatCurrency(t.valor)}
                                            </div>

                                            {getStatusBadge(t.status)}

                                            {t.status === 'previsto' && (
                                                <Button size="sm" variant="outline" onClick={() => liquidarTransacao(t.id, t.descricao)}>
                                                    <Check className="h-4 w-4 mr-1" />
                                                    Liquidar
                                                </Button>
                                            )}

                                            <Button size="sm" variant="outline" onClick={() => deletarTransacao(t.id, t.descricao)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
}
