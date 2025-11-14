import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salvarReceitaProduto, consultarDados, gerarIdReceita, type ReceitaProdutoData } from "@/services/n8nIntegration";
import { sortBySKU } from "@/utils/sortUtils";

interface ReceitaProdutoFormProps {
  onSuccess?: () => void;
}

const ReceitaProdutoForm = ({ onSuccess }: ReceitaProdutoFormProps) => {
  const [formData, setFormData] = useState({
    skuProduto: "",
    skuMateriaPrima: "",
    quantidade: "",
    unidadeMedida: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchProduto, setSearchProduto] = useState("");
  const [searchMateriaPrima, setSearchMateriaPrima] = useState("");
  const [selectedIndexProduto, setSelectedIndexProduto] = useState(-1);
  const [selectedIndexMP, setSelectedIndexMP] = useState(-1);
  const itemRefsProduto = useRef<(HTMLDivElement | null)[]>([]);
  const itemRefsMP = useRef<(HTMLDivElement | null)[]>([]);
  const searchInputRefProduto = useRef<HTMLInputElement>(null);
  const searchInputRefMP = useRef<HTMLInputElement>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [dadosProdutos, dadosMateriaPrima] = await Promise.all([
        consultarDados('Estoque'),
        consultarDados('Estoque_MateriaPrima')
      ]);

      setProdutos(dadosProdutos || []);
      setMateriasPrimas(dadosMateriaPrima || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar produtos e matérias-primas");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const receitaData: ReceitaProdutoData = {
        "SKU Produto": formData.skuProduto,
        items: [{
          "SKU Matéria-Prima": formData.skuMateriaPrima,
          "Quantidade por Produto": parseFloat(formData.quantidade),
          "Unidade de Medida": formData.unidadeMedida || "UN"
        }]
      };

      const sucesso = await salvarReceitaProduto(receitaData);

      if (sucesso) {
        toast.success("Receita de produto cadastrada com sucesso!");
        // Reset form
        setFormData({
          skuProduto: "",
          skuMateriaPrima: "",
          quantidade: "",
          unidadeMedida: ""
        });
        onSuccess?.();
      } else {
        toast.error("Erro ao cadastrar receita de produto");
      }
    } catch (error) {
      console.error("Erro ao cadastrar receita:", error);
      toast.error("Erro ao cadastrar receita de produto");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Receita de Produto
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center py-8">
          <p>Carregando produtos e matérias-primas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          Receita de Produto
        </DialogTitle>
        <p className="text-muted-foreground">
          Configure quais matérias-primas são necessárias para fabricar cada produto
        </p>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="skuProduto">Produto *</Label>
            <Select value={formData.skuProduto} onValueChange={(value) => handleInputChange("skuProduto", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent
                onPointerDownOutside={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('.sticky') || target.closest('input')) {
                    e.preventDefault();
                  }
                }}
                onPointerMove={() => {
                  searchInputRefProduto.current?.focus();
                }}
              >
                <div className="sticky top-0 bg-background p-2 border-b z-10">
                  <Input
                    ref={searchInputRefProduto}
                    autoFocus
                    placeholder="Buscar por SKU ou nome..."
                    value={searchProduto}
                    onChange={(e) => {
                      setSearchProduto(e.target.value);
                      setSelectedIndexProduto(-1);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      const filteredProdutos = sortBySKU(produtos, (p) => p.SKU || p.sku || '').filter(produto => {
                        const sku = (produto.SKU || produto.sku || '').toLowerCase();
                        const nome = (produto["Nome Produto"] || produto.nome || '').toLowerCase();
                        const search = searchProduto.toLowerCase();
                        return sku.includes(search) || nome.includes(search);
                      });
                      
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const nextIndex = selectedIndexProduto + 1;
                        if (nextIndex < filteredProdutos.length) {
                          setSelectedIndexProduto(nextIndex);
                          itemRefsProduto.current[nextIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (selectedIndexProduto >= 0 && selectedIndexProduto < filteredProdutos.length) {
                          const produto = filteredProdutos[selectedIndexProduto];
                          handleInputChange("skuProduto", produto.SKU || produto.sku || '');
                        }
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const nextIndex = Math.min(selectedIndexProduto + 1, filteredProdutos.length - 1);
                        setSelectedIndexProduto(nextIndex);
                        itemRefsProduto.current[nextIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prevIndex = Math.max(selectedIndexProduto - 1, 0);
                        setSelectedIndexProduto(prevIndex);
                        itemRefsProduto.current[prevIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                      }
                    }}
                    className="h-8"
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {sortBySKU(produtos, (p) => p.SKU || p.sku || '').filter(produto => {
                    const sku = (produto.SKU || produto.sku || '').toLowerCase();
                    const nome = (produto["Nome Produto"] || produto.nome || '').toLowerCase();
                    const search = searchProduto.toLowerCase();
                    return sku.includes(search) || nome.includes(search);
                  }).map((produto, index) => {
                    const sku = produto.SKU || produto.sku || '';
                    const nome = produto["Nome Produto"] || produto.nome || '';
                    return (
                      <div
                        key={sku}
                        ref={(el) => itemRefsProduto.current[index] = el}
                        className={selectedIndexProduto === index ? 'bg-accent' : ''}
                      >
                        <SelectItem value={sku}>
                          {sku} - {nome}
                        </SelectItem>
                      </div>
                    );
                  })}
                </div>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skuMateriaPrima">Matéria-Prima *</Label>
            <Select value={formData.skuMateriaPrima} onValueChange={(value) => handleInputChange("skuMateriaPrima", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a matéria-prima" />
              </SelectTrigger>
              <SelectContent
                onPointerDownOutside={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('.sticky') || target.closest('input')) {
                    e.preventDefault();
                  }
                }}
                onPointerMove={() => {
                  searchInputRefMP.current?.focus();
                }}
              >
                <div className="sticky top-0 bg-background p-2 border-b z-10">
                  <Input
                    ref={searchInputRefMP}
                    autoFocus
                    placeholder="Buscar por SKU ou nome..."
                    value={searchMateriaPrima}
                    onChange={(e) => {
                      setSearchMateriaPrima(e.target.value);
                      setSelectedIndexMP(-1);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      const filteredMPs = sortBySKU(materiasPrimas, (mp) => mp["SKU Matéria-Prima"] || mp.sku_materia_prima || '').filter(mp => {
                        const codigo = (mp["SKU Matéria-Prima"] || mp.sku_materia_prima || '').toLowerCase();
                        const nome = (mp["Nome Matéria-Prima"] || mp.nome_materia_prima || '').toLowerCase();
                        const search = searchMateriaPrima.toLowerCase();
                        return codigo.includes(search) || nome.includes(search);
                      });
                      
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const nextIndex = selectedIndexMP + 1;
                        if (nextIndex < filteredMPs.length) {
                          setSelectedIndexMP(nextIndex);
                          itemRefsMP.current[nextIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (selectedIndexMP >= 0 && selectedIndexMP < filteredMPs.length) {
                          const mp = filteredMPs[selectedIndexMP];
                          handleInputChange("skuMateriaPrima", mp["SKU Matéria-Prima"] || mp.sku_materia_prima || '');
                        }
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const nextIndex = Math.min(selectedIndexMP + 1, filteredMPs.length - 1);
                        setSelectedIndexMP(nextIndex);
                        itemRefsMP.current[nextIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prevIndex = Math.max(selectedIndexMP - 1, 0);
                        setSelectedIndexMP(prevIndex);
                        itemRefsMP.current[prevIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                      }
                    }}
                    className="h-8"
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {sortBySKU(materiasPrimas, (mp) => mp["SKU Matéria-Prima"] || mp.sku_materia_prima || '').filter(mp => {
                    const codigo = (mp["SKU Matéria-Prima"] || mp.sku_materia_prima || '').toLowerCase();
                    const nome = (mp["Nome Matéria-Prima"] || mp.nome_materia_prima || '').toLowerCase();
                    const search = searchMateriaPrima.toLowerCase();
                    return codigo.includes(search) || nome.includes(search);
                  }).map((mp, index) => {
                    const codigo = mp["SKU Matéria-Prima"] || mp.sku_materia_prima || '';
                    const nome = mp["Nome Matéria-Prima"] || mp.nome_materia_prima || '';
                    return (
                      <div
                        key={codigo}
                        ref={(el) => itemRefsMP.current[index] = el}
                        className={selectedIndexMP === index ? 'bg-accent' : ''}
                      >
                        <SelectItem value={codigo}>
                          {codigo} - {nome}
                        </SelectItem>
                      </div>
                    );
                  })}
                </div>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantidade">Quantidade por Produto *</Label>
            <Input
              id="quantidade"
              type="number"
              value={formData.quantidade}
              onChange={(e) => handleInputChange("quantidade", e.target.value)}
              placeholder="Ex: 2"
              min="0.01"
              step="0.01"
              required
            />
            <p className="text-xs text-muted-foreground">
              Quantidade desta matéria-prima necessária para fabricar 1 unidade do produto
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unidadeMedida">Unidade de Medida</Label>
            <Select onValueChange={(value) => handleInputChange("unidadeMedida", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UN">Unidade (UN)</SelectItem>
                <SelectItem value="KG">Quilograma (KG)</SelectItem>
                <SelectItem value="G">Grama (G)</SelectItem>
                <SelectItem value="MT">Metro (MT)</SelectItem>
                <SelectItem value="CM">Centímetro (CM)</SelectItem>
                <SelectItem value="LT">Litro (LT)</SelectItem>
                <SelectItem value="ML">Mililitro (ML)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="submit"
            disabled={isSubmitting || !formData.skuProduto || !formData.skuMateriaPrima || !formData.quantidade}
            className="btn-gradient"
          >
            {isSubmitting ? "Cadastrando..." : "Cadastrar Receita"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ReceitaProdutoForm;