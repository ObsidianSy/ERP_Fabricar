import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AdminRouteProps {
    children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
    const { isAuthenticated, loading, isAdmin } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Carregando...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!isAdmin()) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center max-w-md p-6">
                    <div className="mb-4 text-6xl">🔒</div>
                    <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
                    <p className="text-muted-foreground mb-6">
                        Você não tem permissão para acessar esta página.
                        Apenas administradores podem visualizar esta área.
                    </p>
                    <a
                        href="/"
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                    >
                        Voltar para o início
                    </a>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
