import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
    status: "pending" | "completed" | "cancelled" | "overdue" | "active" | "inactive";
    className?: string;
}

const statusConfig = {
    pending: {
        label: "Pendente",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400 border-yellow-200"
    },
    completed: {
        label: "Concluído",
        className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400 border-green-200"
    },
    cancelled: {
        label: "Cancelado",
        className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400 border-red-200"
    },
    overdue: {
        label: "Vencido",
        className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400 border-red-200"
    },
    active: {
        label: "Ativo",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400 border-blue-200"
    },
    inactive: {
        label: "Inativo",
        className: "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-400 border-gray-200"
    }
};

/**
 * Badge com cores e labels padronizados para status
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
    const config = statusConfig[status];

    return (
        <Badge
            variant="outline"
            className={cn(config.className, className)}
        >
            {config.label}
        </Badge>
    );
}
