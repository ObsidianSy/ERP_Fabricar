import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { contasAPI } from "@/lib/financeiro";
import { toast } from "sonner";

interface NewAccountModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export default function NewAccountModal({ open, onOpenChange, onSuccess }: NewAccountModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nome: "",
        tipo: "corrente",
        saldo_inicial: 0,
        banco: "",
        agencia: "",
        conta_numero: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setLoading(true);
            await contasAPI.criar(formData);
            toast.success("Conta criada com sucesso!");
            onOpenChange(false);
            onSuccess();
            // Reset form
            setFormData({
                nome: "",
                tipo: "corrente",
                saldo_inicial: 0,
                banco: "",
                agencia: "",
                conta_numero: ""
            });
        } catch (error: any) {
            toast.error("Erro ao criar conta", {
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nova Conta</DialogTitle>
                    <DialogDescription>
                        Adicione uma nova conta para controlar seu dinheiro.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="nome">Nome da Conta</Label>
                        <Input
                            id="nome"
                            placeholder="Ex: Banco do Brasil"
                            value={formData.nome}
                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="tipo">Tipo</Label>
                        <Select
                            value={formData.tipo}
                            onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="corrente">Conta Corrente</SelectItem>
                                <SelectItem value="poupanca">Poupança</SelectItem>
                                <SelectItem value="investimento">Investimento</SelectItem>
                                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                <SelectItem value="carteira">Carteira Digital</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="saldo">Saldo Inicial</Label>
                        <Input
                            id="saldo"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.saldo_inicial}
                            onChange={(e) => setFormData({ ...formData, saldo_inicial: parseFloat(e.target.value) || 0 })}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="banco">Banco (opcional)</Label>
                        <Input
                            id="banco"
                            placeholder="Ex: Banco do Brasil"
                            value={formData.banco}
                            onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="agencia">Agência</Label>
                            <Input
                                id="agencia"
                                placeholder="0000"
                                value={formData.agencia}
                                onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="conta">Conta</Label>
                            <Input
                                id="conta"
                                placeholder="00000-0"
                                value={formData.conta_numero}
                                onChange={(e) => setFormData({ ...formData, conta_numero: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" disabled={loading}>
                            {loading ? "Criando..." : "Criar Conta"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
