import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Lock, Mail, Sparkles } from 'lucide-react';
import { getApiUrl } from '@/config/api';

export default function Login() {
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();
    const { login: loginContext } = useAuth();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        console.log('🔐 Estado atual:', {
            emailState: email,
            senhaState: senha,
            emailLength: email?.length,
            senhaLength: senha?.length
        });

        const payload = { email, senha };
        console.log('📤 Payload sendo enviado:', payload);
        console.log('📤 Payload stringified:', JSON.stringify(payload));

        try {
            const response = await fetch(getApiUrl('/api/auth/login'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            console.log('📥 Response status:', response.status);

            const data = await response.json();
            console.log('📦 Response data:', data);

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao fazer login');
            }

            // Atualizar contexto de autenticação (isso salva no localStorage também)
            loginContext(data.token, data.usuario);

            toast({
                title: 'Login realizado!',
                description: `Bem-vindo, ${data.usuario.nome}!`,
            });

            // Redirecionar para página principal
            navigate('/');

        } catch (error: any) {
            toast({
                title: 'Erro no login',
                description: error.message || 'Credenciais inválidas',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex overflow-hidden" style={{ backgroundColor: '#0f172a' }}>
            {/* Seção da Imagem - Lado Esquerdo */}
            <div
                className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12"
                style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                }}
            >
                {/* Imagem de fundo com overlay */}
                <div className="absolute inset-0 overflow-hidden">
                    <img
                        src="/background.jpg"  // ✅ CORRETO
                        alt="Background"
                        className="w-full h-full object-cover"
                        style={{
                            opacity: 0.2,
                            filter: 'blur(0px)',
                        }}
                    />
                    <div
                        className="absolute inset-0"
                        style={{
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                        }}
                    />
                </div>

                {/* Conteúdo decorativo */}
                <div className="relative z-10 max-w-md text-center space-y-6">
                    <div className="flex justify-center mb-8">
                        <div
                            className="h-20 w-20 rounded-2xl flex items-center justify-center shadow-2xl"
                            style={{
                                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                                animation: 'pulse 3s ease-in-out infinite',
                            }}
                        >
                            <Sparkles className="h-10 w-10 text-white" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight">
                        Obs Fabrica
                    </h1>
                    <p className="text-lg text-gray-300 leading-relaxed">
                        Sistema completo de gestão industrial. Controle de estoque, produção, vendas e muito mais.
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-4">
                        <div className="h-1 w-12 rounded-full bg-gradient-to-r from-purple-500 to-blue-500" />
                        <div className="h-1 w-8 rounded-full bg-gray-600" />
                        <div className="h-1 w-8 rounded-full bg-gray-600" />
                    </div>
                </div>

                {/* Efeito de partículas decorativas */}
                <div className="absolute top-10 left-10 h-2 w-2 rounded-full bg-purple-400 animate-ping" />
                <div className="absolute bottom-20 right-20 h-3 w-3 rounded-full bg-blue-400 animate-pulse" />
                <div className="absolute top-1/3 right-10 h-2 w-2 rounded-full bg-purple-300 animate-ping" style={{ animationDelay: '1s' }} />
            </div>

            {/* Seção do Formulário - Lado Direito */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-12">
                <div
                    className="w-full max-w-md"
                    style={{
                        animation: 'slideInRight 0.6s ease-out',
                    }}
                >
                    <Card
                        className="border-0 shadow-2xl"
                        style={{
                            background: 'rgba(30, 41, 59, 0.8)',
                            backdropFilter: 'blur(20px)',
                        }}
                    >
                        <CardHeader className="space-y-3 pb-6">
                            <div className="flex justify-center mb-2">
                                <div
                                    className="h-16 w-16 rounded-xl flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                                    style={{
                                        background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                                    }}
                                >
                                    <Lock className="h-8 w-8 text-white" />
                                </div>
                            </div>
                            <CardTitle className="text-3xl text-center font-bold text-white">
                                Bem-vindo
                            </CardTitle>
                            <CardDescription className="text-center text-gray-300 text-base">
                                Entre com suas credenciais para acessar o sistema
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-gray-200 font-medium">
                                        Email
                                    </Label>
                                    <div className="relative group">
                                        <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400 transition-colors group-hover:text-purple-400" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="seu@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="pl-11 h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 transition-all"
                                            required
                                            autoFocus
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="senha" className="text-gray-200 font-medium">
                                        Senha
                                    </Label>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400 transition-colors group-hover:text-purple-400" />
                                        <Input
                                            id="senha"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            value={senha}
                                            onChange={(e) => setSenha(e.target.value)}
                                            className="pl-11 pr-11 h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500 transition-all"
                                            required
                                            disabled={loading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-3 text-gray-400 hover:text-purple-400 transition-colors"
                                            disabled={loading}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-5 w-5" />
                                            ) : (
                                                <Eye className="h-5 w-5" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-12 text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                                    style={{
                                        background: loading
                                            ? 'linear-gradient(135deg, #6b4ec4 0%, #2d6bb8 100%)'
                                            : 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                                    }}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Entrando...
                                        </span>
                                    ) : (
                                        'Entrar'
                                    )}
                                </Button>
                            </form>

                            <div className="pt-4 border-t border-slate-700">
                                <p className="text-center text-sm text-gray-400">
                                    Entre em contato com o administrador para recuperar sua senha
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Logo pequena para mobile */}
                    <div className="lg:hidden mt-8 text-center">
                        <p className="text-sm text-gray-400">Obs Fabrica © 2025</p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                
                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: scale(1.05);
                        opacity: 0.8;
                    }
                }
            `}</style>
        </div>
    );
}
