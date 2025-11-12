import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, Upload, HelpCircle } from "lucide-react";

interface QuickActionsProps {
    context: "accounts" | "cards" | "transactions" | "invoices";
    onRefresh: () => void;
}

/**
 * Barra de ações rápidas no rodapé das páginas
 */
export function QuickActions({ context, onRefresh }: QuickActionsProps) {
    const actions = {
        accounts: [
            { icon: RefreshCw, label: "Atualizar", onClick: onRefresh },
            { icon: Download, label: "Exportar", onClick: () => { } },
            { icon: HelpCircle, label: "Ajuda", onClick: () => { } }
        ],
        cards: [
            { icon: RefreshCw, label: "Atualizar", onClick: onRefresh },
            { icon: Download, label: "Exportar", onClick: () => { } },
            { icon: HelpCircle, label: "Ajuda", onClick: () => { } }
        ],
        transactions: [
            { icon: RefreshCw, label: "Atualizar", onClick: onRefresh },
            { icon: Download, label: "Exportar", onClick: () => { } },
            { icon: Upload, label: "Importar", onClick: () => { } },
            { icon: HelpCircle, label: "Ajuda", onClick: () => { } }
        ],
        invoices: [
            { icon: RefreshCw, label: "Atualizar", onClick: onRefresh },
            { icon: Download, label: "Exportar", onClick: () => { } },
            { icon: HelpCircle, label: "Ajuda", onClick: () => { } }
        ]
    };

    const currentActions = actions[context];

    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Ações rápidas
                    </p>
                    <div className="flex gap-2">
                        {currentActions.map((action, index) => (
                            <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                onClick={action.onClick}
                            >
                                <action.icon className="w-4 h-4 mr-2" />
                                {action.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
