import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { faturasAPI } from "@/lib/financeiro";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useAccounts } from "@/hooks/useAccounts";
import { Calendar, CreditCard, DollarSign } from "lucide-react";

interface PayInvoiceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    faturaId: string;
    valorTotal: number;
    cartaoNome: string;
    competencia: string;
    contaPagamentoId?: string;
}

export default function PayInvoiceModal({
    open,
    onOpenChange,
    onSuccess,
    faturaId,
    valorTotal,
    cartaoNome,
    competencia,
    contaPagamentoId
}: PayInvoiceModalProps) {
    const { activeAccounts } = useAccounts();
    const [loading, setLoading] = useState(false);
    const [tipoPagamento, setTipoPagamento] = useState<"total" | "parcial">("total");
    const [formData, setFormData] = useState({
        valor_pago: valorTotal,
        data_pagamento: new Date().toISOString().split('T')[0],
        conta_id: contaPagamentoId || ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.conta_id) {
            toast.error("Selecione uma conta para pagamento");
            return;
        }

        if (formData.valor_pago <= 0 || formData.valor_pago > valorTotal) {
            toast.error("Valor inválido", {
                description: `Digite um valor entre R$ 0,01 e ${formatCurrency(valorTotal)}`
            });
            return;
        }

        try {
            setLoading(true);
            await faturasAPI.pagar(faturaId, {
                data_pagamento: formData.data_pagamento,
                valor_pago: tipoPagamento === "parcial" ? formData.valor_pago : undefined
            });

            toast.success("Fatura paga com sucesso!", {
                description: `Valor: ${formatCurrency(formData.valor_pago)}`
            });

            onOpenChange(false);
            onSuccess();
        } catch (error: any) {
            toast.error("Erro ao pagar fatura", {
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Pagar Fatura
                    </DialogTitle>
                    <DialogDescription>
                        <div className="space-y-1 mt-2">
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                <span className="font-medium">{cartaoNome}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <Calendar className="h-3 w-3" />
                                <span>Competência: {competencia}</span>
                            </div>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Tipo de Pagamento */}
                    <div className="space-y-2">
                        <Label>Tipo de Pagamento</Label>
                        <RadioGroup value={tipoPagamento} onValueChange={(value: any) => {
                            setTipoPagamento(value);
                            if (value === "total") {
                                setFormData({ ...formData, valor_pago: valorTotal });
                            }
                        }}>
                            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                                <RadioGroupItem value="total" id="total" />
                                <Label htmlFor="total" className="flex-1 cursor-pointer">
                                    <div className="font-medium">Pagamento Total</div>
                                    <div className="text-sm text-muted-foreground">
                                        {formatCurrency(valorTotal)}
                                    </div>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                                <RadioGroupItem value="parcial" id="parcial" />
                                <Label htmlFor="parcial" className="flex-1 cursor-pointer">
                                    <div className="font-medium">Pagamento Parcial</div>
                                    <div className="text-sm text-muted-foreground">
                                        Pagar um valor diferente
                                    </div>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Valor (se parcial) */}
                    {tipoPagamento === "parcial" && (
                        <div className="space-y-2">
                            <Label htmlFor="valor">Valor a Pagar</Label>
                            <Input
                                id="valor"
                                type="number"
                                step="0.01"
                                max={valorTotal}
                                value={formData.valor_pago}
                                onChange={(e) => setFormData({ ...formData, valor_pago: parseFloat(e.target.value) || 0 })}
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Máximo: {formatCurrency(valorTotal)}
                            </p>
                        </div>
                    )}

                    {/* Conta */}
                    <div className="space-y-2">
                        <Label htmlFor="conta">Conta para Débito</Label>
                        <Select
                            value={formData.conta_id}
                            onValueChange={(value) => setFormData({ ...formData, conta_id: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a conta" />
                            </SelectTrigger>
                            <SelectContent>
                                {activeAccounts.map((conta) => (
                                    <SelectItem key={conta.id} value={conta.id}>
                                        {conta.nome} - {formatCurrency(conta.saldo_inicial)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Data */}
                    <div className="space-y-2">
                        <Label htmlFor="data">Data do Pagamento</Label>
                        <Input
                            id="data"
                            type="date"
                            value={formData.data_pagamento}
                            onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                            required
                        />
                    </div>

                    {/* Resumo */}
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Valor da fatura:</span>
                            <span className="font-medium">{formatCurrency(valorTotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Será pago:</span>
                            <span className="font-bold text-green-600">
                                {formatCurrency(formData.valor_pago)}
                            </span>
                        </div>
                        {tipoPagamento === "parcial" && formData.valor_pago < valorTotal && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Restante:</span>
                                <span className="font-medium text-orange-600">
                                    {formatCurrency(valorTotal - formData.valor_pago)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Botões */}
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1"
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" disabled={loading}>
                            {loading ? "Processando..." : "Confirmar Pagamento"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
