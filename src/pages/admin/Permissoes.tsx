import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, User, Save, X, AlertCircle, CheckCircle2, Search, Filter, CheckSquare, Square, ArrowLeft, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';

interface Permissao {
    id: number;
    chave: string;
    nome: string;
    descricao?: string;
    categoria?: string;
    rota?: string;
}

interface Usuario {
    id: string;
    nome: string;
    email: string;
    cargo: string;
    permissoes: Permissao[];
    total_permissoes: number;
}

export default function PermissoesPage() {
    const navigate = useNavigate();
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [permissoesDisponiveis, setPermissoesDisponiveis] = useState<Permissao[]>([]);
    const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);
    const [permissoesSelecionadas, setPermissoesSelecionadas] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);

    // Estados dos filtros
    const [busca, setBusca] = useState('');
    const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');

    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        try {
            setLoading(true);
            console.log('🔄 Carregando dados de permissões...');

            const [usuariosRes, permissoesRes] = await Promise.all([
                api.get('/permissoes/usuarios'),
                api.get('/permissoes')
            ]);

            console.log('📦 Resposta usuários:', usuariosRes);
            console.log('📦 Resposta permissões:', permissoesRes);

            // O helper api.get() já retorna o JSON direto (sem wrapper)
            // Backend envia { success: true, data: [...] }
            const usuariosData = usuariosRes.data || [];
            const permissoesData = permissoesRes.data || [];

            console.log('👥 Usuários processados:', usuariosData.length);
            console.log('🔑 Permissões processadas:', permissoesData.length);

            setUsuarios(usuariosData);
            setPermissoesDisponiveis(permissoesData);
        } catch (error: any) {
            console.error('❌ Erro ao carregar dados:', error);
            toast.error('Erro ao carregar dados', {
                description: error.response?.data?.message || 'Erro ao conectar com o servidor'
            });
            // Garantir que não fique com arrays undefined
            setUsuarios([]);
            setPermissoesDisponiveis([]);
        } finally {
            setLoading(false);
        }
    };

    const selecionarUsuario = (usuario: Usuario) => {
        setUsuarioSelecionado(usuario);
        // Marcar permissões que o usuário já tem
        const idsPermissoes = new Set(usuario.permissoes.map(p => p.id));
        setPermissoesSelecionadas(idsPermissoes);
    };

    const togglePermissao = (permissaoId: number) => {
        const novasPermissoes = new Set(permissoesSelecionadas);
        if (novasPermissoes.has(permissaoId)) {
            novasPermissoes.delete(permissaoId);
        } else {
            novasPermissoes.add(permissaoId);
        }
        setPermissoesSelecionadas(novasPermissoes);
    };

    const salvarPermissoes = async () => {
        if (!usuarioSelecionado) return;

        try {
            setSalvando(true);

            // Enviar todas as permissões selecionadas
            await api.post(`/permissoes/usuario/${usuarioSelecionado.id}`, {
                permissaoIds: Array.from(permissoesSelecionadas)
            });

            toast.success('Permissões atualizadas!', {
                description: `Permissões de ${usuarioSelecionado.nome} foram atualizadas com sucesso`
            });

            // Recarregar dados
            await carregarDados();

            // Manter usuário selecionado atualizado
            const usuarioAtualizado = usuarios.find(u => u.id === usuarioSelecionado.id);
            if (usuarioAtualizado) {
                selecionarUsuario(usuarioAtualizado);
            }
        } catch (error: any) {
            toast.error('Erro ao salvar permissões', {
                description: error.response?.data?.message || 'Erro ao conectar com o servidor'
            });
        } finally {
            setSalvando(false);
        }
    };

    const cancelar = () => {
        setUsuarioSelecionado(null);
        setPermissoesSelecionadas(new Set());
        setBusca('');
        setCategoriaFiltro('todas');
    };

    const selecionarTodas = () => {
        if (!usuarioSelecionado) return;

        // Aplicar filtros antes de selecionar
        const permissoesFiltradas = filtrarPermissoes();
        const idsPermissoesFiltradas = new Set(permissoesFiltradas.map(p => p.id));

        setPermissoesSelecionadas(idsPermissoesFiltradas);
        toast.success(`${idsPermissoesFiltradas.size} permissões selecionadas`);
    };

    const desmarcarTodas = () => {
        setPermissoesSelecionadas(new Set());
        toast.info('Todas as permissões desmarcadas');
    };

    // Filtrar permissões baseado em busca e categoria
    const filtrarPermissoes = (): Permissao[] => {
        let filtradas = [...permissoesDisponiveis];

        // Filtro por categoria
        if (categoriaFiltro !== 'todas') {
            filtradas = filtradas.filter(p => p.categoria === categoriaFiltro);
        }

        // Filtro por busca (nome ou chave)
        if (busca.trim()) {
            const buscaLower = busca.toLowerCase().trim();
            filtradas = filtradas.filter(p =>
                p.nome.toLowerCase().includes(buscaLower) ||
                p.chave.toLowerCase().includes(buscaLower) ||
                (p.descricao && p.descricao.toLowerCase().includes(buscaLower))
            );
        }

        return filtradas;
    };

    // Agrupar permissões filtradas por categoria
    const permissoesFiltradas = filtrarPermissoes();
    const permissoesPorCategoria = permissoesFiltradas.reduce((acc, permissao) => {
        const categoria = permissao.categoria || 'Outras';
        if (!acc[categoria]) {
            acc[categoria] = [];
        }
        acc[categoria].push(permissao);
        return acc;
    }, {} as Record<string, Permissao[]>);

    // Listar todas as categorias disponíveis
    const categorias = Array.from(new Set(permissoesDisponiveis.map(p => p.categoria || 'Outras'))).sort();

    if (loading) {
        return (
            <div className="container mx-auto p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-muted rounded w-1/3" />
                    <div className="h-64 bg-muted rounded" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6 max-w-[1600px]">
            {/* Header com Botão Voltar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/')}
                        className="h-10 w-10"
                        title="Voltar ao Dashboard"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl">
                            <Shield className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Gerenciar Permissões</h1>
                            <p className="text-muted-foreground text-sm">
                                Controle o acesso dos usuários às funcionalidades do sistema
                            </p>
                        </div>
                    </div>
                </div>

                {/* Info Rápida */}
                <div className="hidden md:flex gap-4">
                    <div className="text-center px-4 py-2 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">{usuarios.length}</div>
                        <div className="text-xs text-muted-foreground">Usuários</div>
                    </div>
                    <div className="text-center px-4 py-2 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">{permissoesDisponiveis.length}</div>
                        <div className="text-xs text-muted-foreground">Permissões</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Lista de usuários - Sidebar */}
                <Card className="xl:col-span-1 h-fit sticky top-6">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <User className="h-5 w-5 text-primary" />
                            Usuários
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Selecione para editar permissões
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
                        {usuarios.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                <User className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                <p>Nenhum usuário encontrado</p>
                            </div>
                        ) : (
                            usuarios.map(usuario => (
                                <Button
                                    key={usuario.id}
                                    variant={usuarioSelecionado?.id === usuario.id ? 'default' : 'outline'}
                                    className="w-full justify-start h-auto py-3 px-3 transition-all"
                                    onClick={() => selecionarUsuario(usuario)}
                                >
                                    <div className="flex flex-col items-start gap-1.5 w-full">
                                        <div className="flex items-center justify-between w-full">
                                            <span className="font-semibold text-sm">{usuario.nome}</span>
                                            <Badge
                                                variant={usuario.cargo === 'adm' ? 'default' : 'secondary'}
                                                className="text-[10px] h-5"
                                            >
                                                {usuario.cargo === 'adm' ? 'Admin' : usuario.cargo.toUpperCase()}
                                            </Badge>
                                        </div>
                                        <span className="text-xs text-muted-foreground truncate w-full">
                                            {usuario.email}
                                        </span>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <Lock className="h-3 w-3 opacity-50" />
                                            <span className="text-xs font-medium">
                                                {usuario.total_permissoes} permissõe{usuario.total_permissoes !== 1 && 's'}
                                            </span>
                                        </div>
                                    </div>
                                </Button>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Painel de permissões - Main Content */}
                <Card className="xl:col-span-3">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl">
                                    {usuarioSelecionado ? (
                                        <div className="flex items-center gap-2">
                                            <span>Permissões de</span>
                                            <Badge variant="outline" className="text-base font-semibold px-3 py-1">
                                                {usuarioSelecionado.nome}
                                            </Badge>
                                        </div>
                                    ) : (
                                        'Selecione um usuário'
                                    )}
                                </CardTitle>
                                <CardDescription className="text-xs mt-1">
                                    {usuarioSelecionado ? (
                                        'Marque as permissões que o usuário deve ter acesso'
                                    ) : (
                                        'Escolha um usuário na lista ao lado para gerenciar permissões'
                                    )}
                                </CardDescription>
                            </div>

                            {usuarioSelecionado && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={cancelar}
                                        disabled={salvando}
                                    >
                                        <X className="h-4 w-4 mr-1" />
                                        Cancelar
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={salvarPermissoes}
                                        disabled={salvando}
                                        className="bg-primary hover:bg-primary/90"
                                    >
                                        <Save className="h-4 w-4 mr-1" />
                                        {salvando ? 'Salvando...' : 'Salvar Alterações'}
                                    </Button>
                                </div>
                            )}
                        </div>

                        {usuarioSelecionado?.cargo === 'adm' && (
                            <Alert className="mt-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                <AlertDescription className="text-amber-800 dark:text-amber-200 text-xs">
                                    <strong>Administrador do Sistema:</strong> Este usuário possui acesso total independente das permissões marcadas.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardHeader>
                    <CardContent>
                        {!usuarioSelecionado ? (
                            <div className="text-center py-20 text-muted-foreground">
                                <div className="inline-flex p-6 bg-muted/30 rounded-full mb-4">
                                    <Shield className="h-16 w-16 opacity-20" />
                                </div>
                                <p className="text-lg font-medium mb-2">Nenhum usuário selecionado</p>
                                <p className="text-sm">Selecione um usuário na lista ao lado para gerenciar suas permissões</p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Barra de Filtros Melhorada */}
                                <div className="bg-gradient-to-r from-muted/50 to-muted/30 p-4 rounded-xl border space-y-3">
                                    <div className="flex flex-col lg:flex-row gap-3">
                                        {/* Busca */}
                                        <div className="flex-1 relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Buscar por nome, chave ou descrição..."
                                                value={busca}
                                                onChange={(e) => setBusca(e.target.value)}
                                                className="pl-9 h-10 bg-background"
                                            />
                                        </div>

                                        {/* Filtro por Categoria */}
                                        <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                                            <SelectTrigger className="w-full lg:w-[220px] h-10 bg-background">
                                                <Filter className="h-4 w-4 mr-2 text-primary" />
                                                <SelectValue placeholder="Categoria" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todas">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-gradient-to-r from-primary to-primary/50"></div>
                                                        Todas as Categorias
                                                    </div>
                                                </SelectItem>
                                                {categorias.map(cat => (
                                                    <SelectItem key={cat} value={cat}>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-2 w-2 rounded-full bg-primary"></div>
                                                            {cat}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Botões de Ação */}
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={selecionarTodas}
                                            disabled={permissoesFiltradas.length === 0}
                                            className="flex-1 sm:flex-none h-9"
                                        >
                                            <CheckSquare className="h-4 w-4 mr-1.5" />
                                            Selecionar Todas
                                            {permissoesFiltradas.length > 0 && (
                                                <Badge variant="outline" className="ml-2 bg-background">
                                                    {permissoesFiltradas.length}
                                                </Badge>
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={desmarcarTodas}
                                            disabled={permissoesSelecionadas.size === 0}
                                            className="flex-1 sm:flex-none h-9"
                                        >
                                            <Square className="h-4 w-4 mr-1.5" />
                                            Desmarcar Todas
                                        </Button>

                                        {(busca || categoriaFiltro !== 'todas') && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setBusca('');
                                                    setCategoriaFiltro('todas');
                                                }}
                                                className="h-9"
                                            >
                                                <X className="h-4 w-4 mr-1.5" />
                                                Limpar Filtros
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Info de Seleção */}
                                {permissoesSelecionadas.size > 0 && (
                                    <Alert className="border-primary/20 bg-primary/5">
                                        <CheckCircle2 className="h-4 w-4 text-primary" />
                                        <AlertDescription className="text-sm">
                                            <strong>{permissoesSelecionadas.size}</strong> permissõe{permissoesSelecionadas.size !== 1 && 's'} selecionada{permissoesSelecionadas.size !== 1 && 's'}
                                            {permissoesFiltradas.length > 0 && ` de ${permissoesFiltradas.length} visíveis`}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {/* Lista de Permissões */}
                                <div className="max-h-[calc(100vh-450px)] overflow-y-auto pr-2 space-y-5">
                                    {Object.keys(permissoesPorCategoria).length === 0 ? (
                                        <div className="text-center py-16 text-muted-foreground">
                                            <div className="inline-flex p-6 bg-muted/30 rounded-full mb-4">
                                                <Search className="h-12 w-12 opacity-20" />
                                            </div>
                                            <p className="text-lg font-medium mb-2">Nenhuma permissão encontrada</p>
                                            <p className="text-sm mb-4">Tente ajustar os filtros de busca</p>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setBusca('');
                                                    setCategoriaFiltro('todas');
                                                }}
                                            >
                                                Limpar Filtros
                                            </Button>
                                        </div>
                                    ) : (
                                        Object.entries(permissoesPorCategoria).map(([categoria, permissoes]) => (
                                            <Card key={categoria} className="overflow-hidden border-l-4 border-l-primary/30">
                                                <CardHeader className="pb-3 bg-muted/30">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 bg-primary/10 rounded-md">
                                                                <Unlock className="h-4 w-4 text-primary" />
                                                            </div>
                                                            <h3 className="font-semibold text-base">{categoria}</h3>
                                                            <Badge variant="secondary" className="text-xs">
                                                                {permissoes.length}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    const idsCategoria = permissoes.map(p => p.id);
                                                                    const novas = new Set(permissoesSelecionadas);
                                                                    idsCategoria.forEach(id => novas.add(id));
                                                                    setPermissoesSelecionadas(novas);
                                                                }}
                                                                className="h-7 text-xs"
                                                            >
                                                                <CheckSquare className="h-3 w-3 mr-1" />
                                                                Marcar
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    const idsCategoria = new Set(permissoes.map(p => p.id));
                                                                    const novas = new Set(
                                                                        Array.from(permissoesSelecionadas).filter(id => !idsCategoria.has(id))
                                                                    );
                                                                    setPermissoesSelecionadas(novas);
                                                                }}
                                                                className="h-7 text-xs"
                                                            >
                                                                <Square className="h-3 w-3 mr-1" />
                                                                Limpar
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="pt-4 space-y-2">
                                                    {permissoes.map(permissao => (
                                                        <div
                                                            key={permissao.id}
                                                            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all group"
                                                        >
                                                            <Checkbox
                                                                id={`permissao-${permissao.id}`}
                                                                checked={permissoesSelecionadas.has(permissao.id)}
                                                                onCheckedChange={() => togglePermissao(permissao.id)}
                                                                className="mt-0.5"
                                                            />
                                                            <div className="flex-1 space-y-1 min-w-0">
                                                                <label
                                                                    htmlFor={`permissao-${permissao.id}`}
                                                                    className="text-sm font-medium leading-none cursor-pointer group-hover:text-primary transition-colors"
                                                                >
                                                                    {permissao.nome}
                                                                </label>
                                                                {permissao.descricao && (
                                                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                                                        {permissao.descricao}
                                                                    </p>
                                                                )}
                                                                <p className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded inline-block">
                                                                    {permissao.chave}
                                                                </p>
                                                            </div>
                                                            {permissoesSelecionadas.has(permissao.id) && (
                                                                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 animate-in zoom-in duration-200" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </CardContent>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
