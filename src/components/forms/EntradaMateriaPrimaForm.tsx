import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { consultarDados } from "@/services/n8nIntegration";

interface MateriaPrimaOption {
  "SKU MatériaPrima": string;
  "Nome MatériaPrima": string;
}

interface EntradaMateriaPrimaFormProps {
  onSuccess?: () => void;
}

export default function EntradaMateriaPrimaForm({ onSuccess }: EntradaMateriaPrimaFormProps) {
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrimaOption[]>([]);
  const [formData, setFormData] = useState({
    skuMateriaPrima: "",
    nomeMateriaPrima: "",
    quantidadeAdicionar: "",
    observacao: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    carregarMateriasPrimas();
  }, []);

  const carregarMateriasPrimas = async () => {
    try {
      const dados = await consultarDados("Estoque_MateriaPrima");

      // Tenta descobrir o campo correto de SKU automaticamente
      let campoSKU = null;
      let campoNome = null;
      if (Array.isArray(dados) && dados.length > 0) {
        const chaves = Object.keys(dados[0]);
        campoSKU = chaves.find(c => c.toLowerCase().includes('sku'));
        campoNome = chaves.find(c => c.toLowerCase().includes('nome'));
      }

      // Filtro dinâmico baseado nos campos detectados
      let dadosFiltrados = [];
      if (campoSKU && campoNome) {
        dadosFiltrados = dados.filter(item => item[campoSKU] && item[campoNome]);
      }
      
      // Remove duplicates by SKU
      const skusUnicos = new Map();
      if (campoSKU && campoNome) {
        for (const item of dadosFiltrados) {
          const sku = item[campoSKU];
          if (!skusUnicos.has(sku)) {
            skusUnicos.set(sku, item);
          }
        }
      }
      const materiasUnicas = Array.from(skusUnicos.values());
      console.log("Matérias-primas únicas:", materiasUnicas);
      setMateriasPrimas(materiasUnicas);
    } catch (error) {
      console.error("Erro ao carregar matérias-primas:", error);
      toast.error("Erro ao carregar lista de matérias-primas");
    }
  };

  const handleSKUChange = (sku: string) => {
    const materiaPrima = materiasPrimas.find(mp => mp["SKU MatériaPrima"] === sku);
    setFormData(prev => ({
      ...prev,
      skuMateriaPrima: sku,
      nomeMateriaPrima: materiaPrima?.["Nome MatériaPrima"] || ""
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.skuMateriaPrima || !formData.quantidadeAdicionar) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const quantidade = Number.parseInt(formData.quantidadeAdicionar);
    if (Number.isNaN(quantidade) || quantidade <= 0) {
      toast.error("Quantidade deve ser um número maior que zero");
      return;
    }

    setIsSubmitting(true);

    try {
      // Post direto para o backend local: /api/materia-prima/entrada
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const url = `${apiUrl}/api/materia-prima/entrada`;

      const body = {
        sku_mp: formData.skuMateriaPrima,
        quantidade,
        observacao: formData.observacao || ''
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        toast.success('Entrada de matéria-prima registrada com sucesso!');
        setFormData({ skuMateriaPrima: '', nomeMateriaPrima: '', quantidadeAdicionar: '', observacao: '' });
        onSuccess?.();
      } else {
        const errText = await response.text();
        console.error('Erro na resposta do servidor:', response.status, errText);
        throw new Error('Erro na resposta do servidor');
      }
    } catch (error) {
      console.error('Erro ao registrar entrada:', error);
      toast.error('Erro ao registrar entrada de matéria-prima');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle>Entrada de Matéria-Prima no Estoque</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="skuMateriaPrima">SKU da Matéria-Prima *</Label>
          <Select value={formData.skuMateriaPrima} onValueChange={handleSKUChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o SKU da matéria-prima" />
            </SelectTrigger>
            <SelectContent>
              {materiasPrimas.map((materiaPrima) => (
                <SelectItem key={materiaPrima["SKU MatériaPrima"]} value={materiaPrima["SKU MatériaPrima"]}>
                  {materiaPrima["SKU MatériaPrima"]} - {materiaPrima["Nome MatériaPrima"]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nomeMateriaPrima">Nome da Matéria-Prima</Label>
          <Input
            id="nomeMateriaPrima"
            value={formData.nomeMateriaPrima}
            disabled
            placeholder="Nome será preenchido automaticamente"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantidadeAdicionar">Quantidade a Adicionar *</Label>
          <Input
            id="quantidadeAdicionar"
            type="number"
            min="1"
            value={formData.quantidadeAdicionar}
            onChange={(e) => handleInputChange("quantidadeAdicionar", e.target.value)}
            placeholder="Digite a quantidade a adicionar"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="observacao">Observação</Label>
          <Textarea
            id="observacao"
            value={formData.observacao}
            onChange={(e) => handleInputChange("observacao", e.target.value)}
            placeholder="Observações sobre esta entrada (opcional)"
          />
        </div>

        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Registrando..." : "Registrar Entrada"}
        </Button>
      </form>
    </div>
  );
}