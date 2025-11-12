import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ValueDisplayProps {
    value: number | string;
    showTrend?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

/**
 * Componente para exibir valores monetários formatados
 * com indicação visual de positivo/negativo
 */
export function ValueDisplay({
    value,
    showTrend = false,
    size = "md",
    className
}: ValueDisplayProps) {
    // Converter para número se for string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    // Verificar se é NaN
    if (isNaN(numValue)) {
        return <span className="text-muted-foreground">R$ 0,00</span>;
    }

    const isPositive = numValue > 0;
    const isNegative = numValue < 0;
    const isZero = numValue === 0;

    // Formatar valor
    const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Math.abs(numValue));

    // Classes de tamanho
    const sizeClasses = {
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg font-semibold"
    };

    // Classes de cor
    const colorClass = isPositive
        ? "text-green-600 dark:text-green-500"
        : isNegative
            ? "text-red-600 dark:text-red-500"
            : "text-muted-foreground";

    // Ícone de tendência
    const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

    return (
        <div className={cn("flex items-center gap-1", className)}>
            {showTrend && !isZero && (
                <TrendIcon className={cn("w-4 h-4", colorClass)} />
            )}
            <span className={cn(sizeClasses[size], colorClass)}>
                {isNegative && '-'}
                {formatted}
            </span>
        </div>
    );
}
