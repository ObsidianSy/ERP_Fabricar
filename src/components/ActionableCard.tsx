import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ActionableCardProps {
    title: string;
    value: number | string;
    icon: ReactNode;
    status?: "success" | "error" | "warning" | "info" | "default";
    actions?: {
        label: string;
        icon?: ReactNode;
        onClick: () => void;
        variant?: "default" | "outline" | "ghost";
    }[];
    className?: string;
}

/**
 * Card com título, valor e ações opcionais
 * Usado para exibir métricas com status visual
 */
export function ActionableCard({
    title,
    value,
    icon,
    status = "default",
    actions,
    className
}: ActionableCardProps) {
    // Cores baseadas no status
    const statusColors = {
        success: "text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950",
        error: "text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-950",
        warning: "text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-950",
        info: "text-blue-600 dark:text-blue-500 bg-blue-50 dark:bg-blue-950",
        default: "text-muted-foreground bg-muted"
    };

    // Formatar valor se for número
    const displayValue = typeof value === 'number'
        ? value.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        })
        : value;

    return (
        <Card className={className}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <div className={cn("p-2 rounded-lg", statusColors[status])}>
                    {icon}
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold mb-4">{displayValue}</div>
                {actions && actions.length > 0 && (
                    <div className="flex gap-2">
                        {actions.map((action, index) => (
                            <Button
                                key={index}
                                variant={action.variant || "outline"}
                                size="sm"
                                onClick={action.onClick}
                                className="w-full"
                            >
                                {action.icon}
                                {action.label}
                            </Button>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
