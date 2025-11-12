import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cartoesAPI } from "@/lib/financeiro";
import { toast } from "sonner";
import { useAccounts } from "@/hooks/useAccounts";

interface NewCardModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export default function NewCardModal({ open, onOpenChange, onSuccess }: NewCardModalProps) {
    const { activeAccounts } = useAccounts();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        apelido: "",
        bandeira: "Visa",
        ultimos_digitos: "",
        limite: 0,
        dia_fechamento: 1,
        dia_vencimento: 10,
        conta_pagamento_id: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.dia_vencimento <= formData.dia_fechamento) {
            toast.error("Data de vencimento deve ser depois do fechamento");
            return;
        }

        try {
            setLoading(true);
            await cartoesAPI.criar(formData);
            toast.success("Cartão criado com sucesso!");
            onOpenChange(false);
            onSuccess();
            // Reset form
            setFormData({
                apelido: "",
                bandeira: "Visa",
                ultimos_digitos: "",
                limite: 0,
                dia_fechamento: 1,
                dia_vencimento: 10,
                conta_pagamento_id: ""
            });
        } catch (error: any) {
            toast.error("Erro ao criar cartão", {
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
                    <DialogTitle>Novo Cartão de Crédito</DialogTitle>
                    <DialogDescription>
                        Adicione um novo cartão para controlar suas faturas.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="apelido">Apelido do Cartão</Label>
                        <Input
                            id="apelido"
                            placeholder="Ex: Mastercard Black"
                            value={formData.apelido}
                            onChange={(e) => setFormData({ ...formData, apelido: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="bandeira">Bandeira</Label>
                            <Select
                                value={formData.bandeira}
                                onValueChange={(value) => setFormData({ ...formData, bandeira: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Visa">Visa</SelectItem>
                                    <SelectItem value="Mastercard">Mastercard</SelectItem>
                                    <SelectItem value="Elo">Elo</SelectItem>
                                    <SelectItem value="American Express">American Express</SelectItem>
                                    <SelectItem value="Hipercard">Hipercard</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="digitos">Últimos 4 Dígitos</Label>
                            <Input
                                id="digitos"
                                placeholder="1234"
                                maxLength={4}
                                value={formData.ultimos_digitos}
                                onChange={(e) => setFormData({ ...formData, ultimos_digitos: e.target.value.replace(/\D/g, '') })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="limite">Limite do Cartão</Label>
                        <Input
                            id="limite"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.limite}
                            onChange={(e) => setFormData({ ...formData, limite: parseFloat(e.target.value) || 0 })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="fechamento">Dia de Fechamento</Label>
                            <Input
                                id="fechamento"
                                type="number"
                                min="1"
                                max="31"
                                value={formData.dia_fechamento}
                                onChange={(e) => setFormData({ ...formData, dia_fechamento: parseInt(e.target.value) || 1 })}
                                required
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="vencimento">Dia de Vencimento</Label>
                            <Input
                                id="vencimento"
                                type="number"
                                min="1"
                                max="31"
                                value={formData.dia_vencimento}
                                onChange={(e) => setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) || 10 })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="conta">Conta de Pagamento (opcional)</Label>
                        <Select
                            value={formData.conta_pagamento_id}
                            onValueChange={(value) => setFormData({ ...formData, conta_pagamento_id: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione uma conta" />
                            </SelectTrigger>
                            <SelectContent>
                                {activeAccounts.map((conta) => (
                                    <SelectItem key={conta.id} value={conta.id}>
                                        {conta.nome}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" disabled={loading}>
                            {loading ? "Criando..." : "Criar Cartão"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
