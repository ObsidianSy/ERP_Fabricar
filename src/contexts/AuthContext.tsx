import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '@/config/api';

interface Usuario {
    id: string;
    nome: string;
    email: string;
    cargo: 'adm' | 'operador';
}

interface Permissao {
    id: number;
    chave: string;
    nome: string;
    categoria?: string;
    rota?: string;
}

interface AuthContextType {
    usuario: Usuario | null;
    token: string | null;
    permissoes: Permissao[];
    isAuthenticated: boolean;
    loading: boolean;
    isAdmin: () => boolean;
    hasPermission: (chavePermissao: string) => boolean;
    hasAnyPermission: (chavesPermissoes: string[]) => boolean;
    login: (token: string, usuario: Usuario) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [permissoes, setPermissoes] = useState<Permissao[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Buscar permissões do usuário
    const carregarPermissoes = async (tokenUsuario: string, usuarioId: string) => {
        try {
            const response = await fetch(getApiUrl(`/api/permissoes/usuario/${usuarioId}`), {
                headers: {
                    'Authorization': `Bearer ${tokenUsuario}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const permissoesUsuario = data.data?.permissoes || [];
                setPermissoes(permissoesUsuario);
                localStorage.setItem('permissoes', JSON.stringify(permissoesUsuario));
            }
        } catch (error) {
            console.error('Erro ao carregar permissões:', error);
            setPermissoes([]);
        }
    };

    // Verificar se já tem token salvo ao carregar
    useEffect(() => {
        const verificarAutenticacao = async () => {
            const tokenSalvo = localStorage.getItem('token');
            const usuarioSalvo = localStorage.getItem('usuario');
            const permissoesSalvas = localStorage.getItem('permissoes');

            if (tokenSalvo && usuarioSalvo) {
                try {
                    // Verificar se token ainda é válido
                    const response = await fetch(getApiUrl('/api/auth/verify'), {
                        headers: {
                            'Authorization': `Bearer ${tokenSalvo}`
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const usuarioData = data.usuario;
                        setToken(tokenSalvo);
                        setUsuario(usuarioData);

                        // Carregar permissões salvas ou buscar novas
                        if (permissoesSalvas) {
                            setPermissoes(JSON.parse(permissoesSalvas));
                        }
                        // Sempre recarregar permissões do servidor para garantir atualização
                        await carregarPermissoes(tokenSalvo, usuarioData.id);
                    } else {
                        // Token inválido, limpar
                        localStorage.removeItem('token');
                        localStorage.removeItem('usuario');
                        localStorage.removeItem('permissoes');
                    }
                } catch (error) {
                    console.error('Erro ao verificar autenticação:', error);
                    localStorage.removeItem('token');
                    localStorage.removeItem('usuario');
                    localStorage.removeItem('permissoes');
                }
            }

            setLoading(false);
        };

        verificarAutenticacao();
    }, []);

    const login = (novoToken: string, novoUsuario: Usuario) => {
        setToken(novoToken);
        setUsuario(novoUsuario);
        localStorage.setItem('token', novoToken);
        localStorage.setItem('usuario', JSON.stringify(novoUsuario));

        // Carregar permissões após login
        carregarPermissoes(novoToken, novoUsuario.id);
    };

    const logout = () => {
        setToken(null);
        setUsuario(null);
        setPermissoes([]);
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        localStorage.removeItem('permissoes');
        navigate('/login');
    };

    const isAdmin = () => {
        return usuario?.cargo === 'adm';
    };

    // Verificar se o usuário tem uma permissão específica
    const hasPermission = (chavePermissao: string): boolean => {
        // Admin tem todas as permissões
        if (isAdmin()) return true;

        return permissoes.some(p => p.chave === chavePermissao);
    };

    // Verificar se o usuário tem pelo menos uma das permissões
    const hasAnyPermission = (chavesPermissoes: string[]): boolean => {
        // Admin tem todas as permissões
        if (isAdmin()) return true;

        return chavesPermissoes.some(chave => hasPermission(chave));
    };

    return (
        <AuthContext.Provider
            value={{
                usuario,
                token,
                permissoes,
                isAuthenticated: !!token,
                loading,
                isAdmin,
                hasPermission,
                hasAnyPermission,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
}
