import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { cartoesAPI, contasAPI, Cartao, Conta } from '@/lib/financeiro';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import CreditCardDisplay from '@/components/CreditCardDisplay';
import CircularProgress from '@/components/CircularProgress';
import AddPurchaseModal from '@/components/AddPurchaseModal';

export default function CartoesPage() {
    const [cartoes, setCartoes] = useState<Cartao[]>([]);
    const [contas, setContas] = useState<Conta[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogAberto, setDialogAberto] = useState(false);
    const [cartaoEditando, setCartaoEditando] = useState<Cartao | null>(null);
    const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
    const [cartaoSelecionado, setCartaoSelecionado] = useState<Cartao | null>(null);
    const [viewingCard, setViewingCard] = useState<Cartao | null>(null);

    const [formData, setFormData] = useState({
        apelido: '',
        bandeira: '',
        ultimos_digitos: '',
        limite: 0,
        dia_vencimento: 10,
        dia_fechamento: 5,
        conta_pagamento_id: ''
    });

    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        try {
            setLoading(true);
            const [cartoesData, contasData] = await Promise.all([
                cartoesAPI.listar(),
                contasAPI.listar()
            ]);
            setCartoes(cartoesData);
            setContas(contasData.filter(c => c.ativo));
        } catch (error: any) {
            toast.error('Erro ao carregar dados', { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const abrirDialogNovo = () => {
        setCartaoEditando(null);
        setFormData({
            apelido: '',
            bandeira: '',
            ultimos_digitos: '',
            limite: 0,
            dia_vencimento: 10,
            dia_fechamento: 5,
            conta_pagamento_id: ''
        });
        setDialogAberto(true);
    };

    const abrirModalCompra = (cartao: Cartao) => {
        setCartaoSelecionado(cartao);
        setPurchaseModalOpen(true);
    };

    const visualizarCartao = (cartao: Cartao) => {
        setViewingCard(cartao);
    };

    const abrirDialogEditar = (cartao: Cartao) => {
        setCartaoEditando(cartao);
        setFormData({
            apelido: cartao.apelido,
            bandeira: cartao.bandeira || '',
            ultimos_digitos: cartao.ultimos_digitos || '',
            limite: cartao.limite,
            dia_vencimento: cartao.dia_vencimento,
            dia_fechamento: cartao.dia_fechamento,
            conta_pagamento_id: cartao.conta_pagamento_id || ''
        });
        setDialogAberto(true);
    };

    const salvarCartao = async () => {
        try {
            if (formData.dia_vencimento <= formData.dia_fechamento) {
                toast.error('Validação', {
                    description: 'O dia de vencimento deve ser posterior ao dia de fechamento'
                });
                return;
            }

            const payload = {
                ...formData,
                conta_pagamento_id: formData.conta_pagamento_id || undefined
            };

            if (cartaoEditando) {
                await cartoesAPI.atualizar(cartaoEditando.id, payload);
                toast.success('Cartão atualizado com sucesso!');
            } else {
                await cartoesAPI.criar(payload);
                toast.success('Cartão criado com sucesso!');
            }

            setDialogAberto(false);
            await carregarDados();
        } catch (error: any) {
            toast.error('Erro ao salvar cartão', { description: error.message });
        }
    };

    const deletarCartao = async (id: string, apelido: string) => {
        if (!confirm(`Tem certeza que deseja excluir o cartão "${apelido}"?`)) return;

        try {
            await cartoesAPI.deletar(id);
            toast.success('Cartão excluído com sucesso!');
            await carregarDados();
        } catch (error: any) {
            toast.error('Erro ao excluir cartão', { description: error.message });
        }
    };

    const toggleAtivo = async (cartao: Cartao) => {
        try {
            await cartoesAPI.atualizar(cartao.id, { ativo: !cartao.ativo });
            toast.success(`Cartão ${!cartao.ativo ? 'ativado' : 'desativado'} com sucesso!`);
            await carregarDados();
        } catch (error: any) {
            toast.error('Erro ao alterar status', { description: error.message });
        }
    };

    const getContaNome = (contaId: string | undefined) => {
        if (!contaId) return 'Não vinculado';
        return contas.find(c => c.id === contaId)?.nome || 'Conta não encontrada';
    };

    const limiteDisponivel = (cartao: Cartao) => {
        const limite = parseFloat(String(cartao.limite || 0));
        const utilizado = parseFloat(String(cartao.limite_utilizado || 0));
        return limite - utilizado;
    };

    const percentualUtilizado = (cartao: Cartao) => {
        const limite = parseFloat(String(cartao.limite || 0));
        if (limite === 0) return 0;
        const utilizado = parseFloat(String(cartao.limite_utilizado || 0));
        return (utilizado / limite) * 100;
    };

    // Formatar percentual para exibição
    const formatPercentual = (percentual: number): string => {
        if (percentual === 0) return '0%';
        if (percentual < 0.01) return '<0.01%';
        if (percentual < 1) return percentual.toFixed(2) + '%';
        return percentual.toFixed(0) + '%';
    };

    if (loading) {
        return <div className="container mx-auto p-6">Carregando...</div>;
    }

    return (
        <Layout>
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <CreditCard className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Cartões de Crédito</h1>
                            <p className="text-muted-foreground">Gerencie seus cartões e limites</p>
                        </div>
                    </div>

                    <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
                        <DialogTrigger asChild>
                            <Button onClick={abrirDialogNovo}>
                                <Plus className="h-4 w-4 mr-2" />
                                Novo Cartão
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{cartaoEditando ? 'Editar Cartão' : 'Novo Cartão'}</DialogTitle>
                                <DialogDescription>Preencha os dados do cartão de crédito</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="apelido">Nome do Cartão *</Label>
                                    <Input
                                        id="apelido"
                                        value={formData.apelido}
                                        onChange={e => setFormData({ ...formData, apelido: e.target.value })}
                                        placeholder="Ex: Nubank Roxinho"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="bandeira">Bandeira</Label>
                                        <Select
                                            value={formData.bandeira}
                                            onValueChange={value => setFormData({ ...formData, bandeira: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="visa">Visa</SelectItem>
                                                <SelectItem value="mastercard">Mastercard</SelectItem>
                                                <SelectItem value="elo">Elo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="ultimos_digitos">Últimos 4 dígitos</Label>
                                        <Input
                                            id="ultimos_digitos"
                                            value={formData.ultimos_digitos}
                                            onChange={e => setFormData({ ...formData, ultimos_digitos: e.target.value })}
                                            placeholder="1234"
                                            maxLength={4}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="limite">Limite do Cartão *</Label>
                                    <Input
                                        id="limite"
                                        type="number"
                                        step="0.01"
                                        value={formData.limite}
                                        onChange={e => setFormData({ ...formData, limite: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="dia_fechamento">Dia Fechamento *</Label>
                                        <Input
                                            id="dia_fechamento"
                                            type="number"
                                            min="1"
                                            max="28"
                                            value={formData.dia_fechamento}
                                            onChange={e => setFormData({ ...formData, dia_fechamento: parseInt(e.target.value) || 1 })}
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="dia_vencimento">Dia Vencimento *</Label>
                                        <Input
                                            id="dia_vencimento"
                                            type="number"
                                            min="1"
                                            max="31"
                                            value={formData.dia_vencimento}
                                            onChange={e => setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) || 1 })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="conta_pagamento_id">Conta para Pagamento</Label>
                                    <Select
                                        value={formData.conta_pagamento_id}
                                        onValueChange={value => setFormData({ ...formData, conta_pagamento_id: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {contas.map(conta => (
                                                <SelectItem key={conta.id} value={conta.id}>
                                                    {conta.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1" onClick={() => setDialogAberto(false)}>
                                        Cancelar
                                    </Button>
                                    <Button className="flex-1" onClick={salvarCartao} disabled={!formData.apelido || formData.limite <= 0}>
                                        {cartaoEditando ? 'Salvar' : 'Criar'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <Tabs defaultValue="grade" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="grade">Visualização em Grade</TabsTrigger>
                        <TabsTrigger value="lista">Visualização em Lista</TabsTrigger>
                        <TabsTrigger value="visual">Cartões 3D</TabsTrigger>
                    </TabsList>

                    {/* Visualização em Grade (Original) */}
                    <TabsContent value="grade" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {cartoes.map(cartao => {
                                const disponivel = limiteDisponivel(cartao);
                                const percentual = percentualUtilizado(cartao);

                                return (
                                    <Card key={cartao.id} className={!cartao.ativo ? 'opacity-60' : ''}>
                                        <CardHeader>
                                            <div className="flex items-center gap-2 mb-1">
                                                <CardTitle className="text-lg">{cartao.apelido}</CardTitle>
                                                {!cartao.ativo && <Badge variant="secondary">Inativo</Badge>}
                                            </div>
                                            <CardDescription>
                                                {cartao.bandeira && <span className="capitalize">{cartao.bandeira}</span>}
                                                {cartao.ultimos_digitos && <span> •••• {cartao.ultimos_digitos}</span>}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm text-muted-foreground">Limite disponível</div>
                                                    <div className="text-xl font-bold">{formatCurrency(disponivel)}</div>
                                                </div>
                                                <CircularProgress value={percentual} size={70} />
                                            </div>

                                            <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${percentual > 80 ? 'bg-red-500' : percentual > 50 ? 'bg-yellow-500' : 'bg-green-500'
                                                        }`}
                                                    style={{ width: `${Math.min(percentual, 100)}%` }}
                                                />
                                            </div>

                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Utilizado: {formatCurrency(cartao.limite_utilizado || 0)}</span>
                                                <span>{formatPercentual(percentual)}</span>
                                            </div>

                                            <div className="text-xs text-muted-foreground">
                                                Limite total: {formatCurrency(cartao.limite)}
                                            </div>

                                            <div className="text-sm space-y-1 pt-2 border-t">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Fecha dia:</span>
                                                    <span className="font-medium">{cartao.dia_fechamento}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Vence dia:</span>
                                                    <span className="font-medium">{cartao.dia_vencimento}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Conta:</span>
                                                    <span className="font-medium text-xs">{getContaNome(cartao.conta_pagamento_id)}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 pt-2">
                                                <Button variant="outline" size="sm" className="flex-1" onClick={() => abrirModalCompra(cartao)}>
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    Compra
                                                </Button>
                                                <Button variant="outline" size="sm" className="flex-1" onClick={() => abrirDialogEditar(cartao)}>
                                                    <Edit className="h-3 w-3 mr-1" />
                                                    Editar
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => toggleAtivo(cartao)}>
                                                    {cartao.ativo ? '🔒' : '🔓'}
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => deletarCartao(cartao.id, cartao.apelido)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {cartoes.length === 0 && (
                                <Card className="col-span-full">
                                    <CardContent className="text-center py-12">
                                        <p className="text-muted-foreground mb-4">Nenhum cartão cadastrado ainda.</p>
                                        <Button onClick={abrirDialogNovo}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Criar Primeiro Cartão
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>

                    {/* Visualização em Lista */}
                    <TabsContent value="lista" className="space-y-2">
                        {cartoes.map(cartao => {
                            const disponivel = limiteDisponivel(cartao);
                            const percentual = percentualUtilizado(cartao);

                            return (
                                <Card key={cartao.id} className={!cartao.ativo ? 'opacity-60' : ''}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4 flex-1">
                                                <CircularProgress value={percentual} size={60} />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-semibold text-lg">{cartao.apelido}</h3>
                                                        {!cartao.ativo && <Badge variant="secondary">Inativo</Badge>}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {cartao.bandeira} •••• {cartao.ultimos_digitos} •
                                                        Fecha dia {cartao.dia_fechamento} • Vence dia {cartao.dia_vencimento}
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-2 text-sm">
                                                        <div>
                                                            <span className="text-muted-foreground">Disponível: </span>
                                                            <span className="font-bold text-green-600">{formatCurrency(disponivel)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Limite: </span>
                                                            <span className="font-medium">{formatCurrency(cartao.limite)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Usado: </span>
                                                            <span className="font-medium">{formatPercentual(percentual)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => visualizarCartao(cartao)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => abrirModalCompra(cartao)}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => abrirDialogEditar(cartao)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => deletarCartao(cartao.id, cartao.apelido)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}

                        {cartoes.length === 0 && (
                            <Card>
                                <CardContent className="text-center py-12">
                                    <p className="text-muted-foreground mb-4">Nenhum cartão cadastrado ainda.</p>
                                    <Button onClick={abrirDialogNovo}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Criar Primeiro Cartão
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Visualização 3D dos Cartões */}
                    <TabsContent value="visual" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {cartoes.map(cartao => (
                                <div key={cartao.id} className="space-y-4">
                                    <CreditCardDisplay
                                        apelido={cartao.apelido}
                                        bandeira={cartao.bandeira || 'Visa'}
                                        ultimos_digitos={cartao.ultimos_digitos || '0000'}
                                        size="lg"
                                    />
                                    <Card>
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <div className="text-sm text-muted-foreground">Limite Disponível</div>
                                                    <div className="text-2xl font-bold">
                                                        {formatCurrency(limiteDisponivel(cartao))}
                                                    </div>
                                                </div>
                                                <CircularProgress value={percentualUtilizado(cartao)} size={70} />
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" className="flex-1" onClick={() => abrirModalCompra(cartao)}>
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    Nova Compra
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => abrirDialogEditar(cartao)}>
                                                    <Edit className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            ))}

                            {cartoes.length === 0 && (
                                <Card className="col-span-full">
                                    <CardContent className="text-center py-12">
                                        <p className="text-muted-foreground mb-4">Nenhum cartão cadastrado ainda.</p>
                                        <Button onClick={abrirDialogNovo}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Criar Primeiro Cartão
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Modals */}
                {cartaoSelecionado && (
                    <AddPurchaseModal
                        open={purchaseModalOpen}
                        onOpenChange={setPurchaseModalOpen}
                        onSuccess={carregarDados}
                        cartaoId={cartaoSelecionado.id}
                        cartaoNome={cartaoSelecionado.apelido}
                    />
                )}

                {/* Dialog Visualizar Cartão */}
                {viewingCard && (
                    <Dialog open={!!viewingCard} onOpenChange={() => setViewingCard(null)}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Cartão de Crédito</DialogTitle>
                            </DialogHeader>
                            <div className="flex items-center justify-center p-4">
                                <CreditCardDisplay
                                    apelido={viewingCard.apelido}
                                    bandeira={viewingCard.bandeira || 'Visa'}
                                    ultimos_digitos={viewingCard.ultimos_digitos || '0000'}
                                    size="lg"
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        </Layout>
    );
}
