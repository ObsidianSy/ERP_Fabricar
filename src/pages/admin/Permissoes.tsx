import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, User, Save, X, AlertCircle, CheckCircle2 } from 'lucide-react';
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
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [permissoesDisponiveis, setPermissoesDisponiveis] = useState<Permissao[]>([]);
    const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);
    const [permissoesSelecionadas, setPermissoesSelecionadas] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);

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
    };

    // Agrupar permissões por categoria
    const permissoesPorCategoria = (permissoesDisponiveis || []).reduce((acc, permissao) => {
        const categoria = permissao.categoria || 'Outras';
        if (!acc[categoria]) {
            acc[categoria] = [];
        }
        acc[categoria].push(permissao);
        return acc;
    }, {} as Record<string, Permissao[]>);

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
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Gerenciar Permissões</h1>
                    <p className="text-muted-foreground">
                        Controle o acesso dos usuários às funcionalidades do sistema
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lista de usuários */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Usuários
                        </CardTitle>
                        <CardDescription>
                            Selecione um usuário para gerenciar permissões
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {usuarios.map(usuario => (
                            <Button
                                key={usuario.id}
                                variant={usuarioSelecionado?.id === usuario.id ? 'default' : 'outline'}
                                className="w-full justify-start h-auto py-3"
                                onClick={() => selecionarUsuario(usuario)}
                            >
                                <div className="flex flex-col items-start gap-1 w-full">
                                    <div className="flex items-center justify-between w-full">
                                        <span className="font-medium">{usuario.nome}</span>
                                        <Badge variant={usuario.cargo === 'adm' ? 'default' : 'secondary'}>
                                            {usuario.cargo}
                                        </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{usuario.email}</span>
                                    <span className="text-xs">
                                        {usuario.total_permissoes} permissõe{usuario.total_permissoes !== 1 && 's'}
                                    </span>
                                </div>
                            </Button>
                        ))}
                    </CardContent>
                </Card>

                {/* Painel de permissões */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>
                            {usuarioSelecionado ? (
                                <div className="flex items-center justify-between">
                                    <span>Permissões de {usuarioSelecionado.nome}</span>
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
                                        >
                                            <Save className="h-4 w-4 mr-1" />
                                            {salvando ? 'Salvando...' : 'Salvar'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                'Selecione um usuário'
                            )}
                        </CardTitle>
                        <CardDescription>
                            {usuarioSelecionado ? (
                                <>
                                    Marque as permissões que o usuário deve ter.
                                    {usuarioSelecionado.cargo === 'adm' && (
                                        <Alert className="mt-2">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                Este usuário é <strong>Administrador</strong> e tem acesso total ao sistema
                                                independente das permissões marcadas.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </>
                            ) : (
                                'Nenhum usuário selecionado'
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!usuarioSelecionado ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>Selecione um usuário para gerenciar suas permissões</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(permissoesPorCategoria).map(([categoria, permissoes]) => (
                                    <div key={categoria} className="space-y-3">
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            {categoria}
                                            <Badge variant="outline">{permissoes.length}</Badge>
                                        </h3>
                                        <Separator />
                                        <div className="grid grid-cols-1 gap-3">
                                            {permissoes.map(permissao => (
                                                <div
                                                    key={permissao.id}
                                                    className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                                                >
                                                    <Checkbox
                                                        id={`permissao-${permissao.id}`}
                                                        checked={permissoesSelecionadas.has(permissao.id)}
                                                        onCheckedChange={() => togglePermissao(permissao.id)}
                                                    />
                                                    <div className="flex-1 space-y-1">
                                                        <label
                                                            htmlFor={`permissao-${permissao.id}`}
                                                            className="text-sm font-medium leading-none cursor-pointer"
                                                        >
                                                            {permissao.nome}
                                                        </label>
                                                        {permissao.descricao && (
                                                            <p className="text-xs text-muted-foreground">
                                                                {permissao.descricao}
                                                            </p>
                                                        )}
                                                        {permissao.rota && (
                                                            <p className="text-xs text-muted-foreground font-mono">
                                                                {permissao.rota}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {permissoesSelecionadas.has(permissao.id) && (
                                                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
