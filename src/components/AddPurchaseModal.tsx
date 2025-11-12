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
import { Textarea } from "@/components/ui/textarea";
import { faturasAPI } from "@/lib/financeiro";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useCategories } from "@/hooks/useCategories";
import { ShoppingBag, CreditCard } from "lucide-react";

interface AddPurchaseModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    cartaoId: string;
    cartaoNome: string;
}

export default function AddPurchaseModal({
    open,
    onOpenChange,
    onSuccess,
    cartaoId,
    cartaoNome
}: AddPurchaseModalProps) {
    const { despesas } = useCategories();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        descricao: "",
        valor_total: 0,
        parcelas: 1,
        data_compra: new Date().toISOString().split('T')[0],
        categoria_id: "",
        observacoes: ""
    });

    const valorParcela = formData.valor_total / formData.parcelas;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.descricao || formData.valor_total <= 0) {
            toast.error("Preencha todos os campos obrigatórios");
            return;
        }

        if (formData.parcelas < 1 || formData.parcelas > 24) {
            toast.error("Número de parcelas inválido (1-24)");
            return;
        }

        try {
            setLoading(true);
            await faturasAPI.adicionarItem({
                cartao_id: cartaoId,
                descricao: formData.descricao,
                valor_total: formData.valor_total,
                data_compra: formData.data_compra,
                parcelas: formData.parcelas,
                categoria_id: formData.categoria_id || undefined,
                observacoes: formData.observacoes || undefined
            });

            toast.success(
                formData.parcelas > 1
                    ? `Compra parcelada em ${formData.parcelas}x adicionada!`
                    : "Compra adicionada à fatura!",
                {
                    description: `${formData.parcelas}x de ${formatCurrency(valorParcela)}`
                }
            );

            onOpenChange(false);
            onSuccess();

            // Reset form
            setFormData({
                descricao: "",
                valor_total: 0,
                parcelas: 1,
                data_compra: new Date().toISOString().split('T')[0],
                categoria_id: "",
                observacoes: ""
            });
        } catch (error: any) {
            toast.error("Erro ao adicionar compra", {
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5" />
                        Nova Compra
                    </DialogTitle>
                    <DialogDescription>
                        <div className="flex items-center gap-2 mt-2">
                            <CreditCard className="h-4 w-4" />
                            <span className="font-medium">{cartaoNome}</span>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Descrição */}
                    <div className="space-y-2">
                        <Label htmlFor="descricao">Descrição da Compra *</Label>
                        <Input
                            id="descricao"
                            placeholder="Ex: Notebook Dell, Supermercado..."
                            value={formData.descricao}
                            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                            required
                        />
                    </div>

                    {/* Valor e Parcelas */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="valor">Valor Total *</Label>
                            <Input
                                id="valor"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={formData.valor_total}
                                onChange={(e) => setFormData({ ...formData, valor_total: parseFloat(e.target.value) || 0 })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="parcelas">Parcelas</Label>
                            <Input
                                id="parcelas"
                                type="number"
                                min="1"
                                max="24"
                                value={formData.parcelas}
                                onChange={(e) => setFormData({ ...formData, parcelas: parseInt(e.target.value) || 1 })}
                                required
                            />
                        </div>
                    </div>

                    {/* Info Parcelamento */}
                    {formData.parcelas > 1 && formData.valor_total > 0 && (
                        <div className="rounded-lg bg-muted p-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Valor de cada parcela:</span>
                                <span className="font-bold">{formatCurrency(valorParcela)}</span>
                            </div>
                        </div>
                    )}

                    {/* Data e Categoria */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="data">Data da Compra *</Label>
                            <Input
                                id="data"
                                type="date"
                                value={formData.data_compra}
                                onChange={(e) => setFormData({ ...formData, data_compra: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="categoria">Categoria</Label>
                            <Select
                                value={formData.categoria_id}
                                onValueChange={(value) => setFormData({ ...formData, categoria_id: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Opcional" />
                                </SelectTrigger>
                                <SelectContent>
                                    {despesas.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            {cat.icone} {cat.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Observações */}
                    <div className="space-y-2">
                        <Label htmlFor="obs">Observações (opcional)</Label>
                        <Textarea
                            id="obs"
                            placeholder="Informações adicionais..."
                            rows={2}
                            value={formData.observacoes}
                            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        />
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
                            {loading ? "Adicionando..." : "Adicionar Compra"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
