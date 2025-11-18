
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { api } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import { salvarProduto, gerarSkuProduto } from "@/services/n8nIntegration";

const EstoqueProduto = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  
  const [formData, setFormData] = useState({
    sku: "",
    nomeProduto: "",
    categoria: "",
    tipoProduto: "",
    quantidadeAtual: 0,
    unidadeMedida: "",
    precoUnitario: 0
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [controladoPorCustos, setControladoPorCustos] = useState(false);
  
  // Listas predefinidas
  const categorias = ["Roupas", "Acessórios", "DTF", "Personalizados"];
  const tiposProduto = ["Camiseta", "Blusa", "Caneca", "Adesivo", "DTF", "Outro"];
  const unidadesMedida = ["un", "kg", "g", "m", "cm", "l", "ml"];

  useEffect(() => {
    const carregarProduto = async () => {
      if (!isEditing || !id) return;
      try {
        const produto = await api.get<any>(`/estoque/${id}`);
        if (produto) {
          setFormData({
            sku: produto.sku || "",
            nomeProduto: produto.nome || "",
            categoria: produto.categoria || "",
            tipoProduto: produto.tipo_produto || "",
            quantidadeAtual: Number(produto.quantidade_atual) || 0,
            unidadeMedida: produto.unidade_medida || "",
            precoUnitario: Number(produto.preco_unitario) || 0,
          });
        }
      } catch (err) {
        console.error('Erro ao carregar produto para edição:', err);
      }
    };
    carregarProduto();
  }, [id, isEditing]);

  // Verifica se o produto está sendo gerenciado pela página de Custos
  useEffect(() => {
    const verificarCustos = async () => {
      if (!isEditing || !formData.sku) {
        setControladoPorCustos(false);
        return;
      }

      try {
        const resp = await api.get<any[]>('/receita-produto/custos/calcular');
        const lista = Array.isArray(resp) ? resp : [];
        const encontrado = lista.some(p => (p.sku_produto || p.sku) === formData.sku);
        setControladoPorCustos(Boolean(encontrado));
      } catch (err) {
        console.error('Erro ao verificar se produto é controlado por Custos:', err);
        setControladoPorCustos(false);
      }
    };

    verificarCustos();
  }, [isEditing, formData.sku]);

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nomeProduto || !formData.categoria || !formData.tipoProduto || formData.precoUnitario <= 0) {
      toast.error("Erro", {
        description: "Preencha todos os campos obrigatórios"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const produtoData = {
        "SKU": formData.sku || gerarSkuProduto(formData.categoria),
        "Nome Produto": formData.nomeProduto,
        "Categoria": formData.categoria,
        "Tipo Produto": formData.tipoProduto,
        "Quantidade Atual": formData.quantidadeAtual,
        "Unidade de Medida": formData.unidadeMedida,
        "Preço Unitário": formData.precoUnitario
      };

      const sucesso = await salvarProduto(produtoData);

      if (sucesso) {
        toast.success(isEditing ? "Produto atualizado" : "Produto cadastrado", {
          description: `${formData.nomeProduto} foi ${isEditing ? "atualizado" : "adicionado"} ao estoque`
        });
        navigate("/estoque");
      } else {
        toast.error("Erro", {
          description: "Não foi possível salvar o produto. Tente novamente."
        });
      }
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      toast.error("Erro", {
        description: "Erro inesperado ao salvar produto"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            {isEditing ? "Editar" : "Novo"} Produto
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input 
                  id="sku" 
                  value={formData.sku}
                  onChange={(e) => handleChange("sku", e.target.value)}
                  placeholder="Ex: ROUP-001 (deixe vazio para gerar automaticamente)"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="nomeProduto">Nome Produto *</Label>
                <Input 
                  id="nomeProduto" 
                  value={formData.nomeProduto}
                  onChange={(e) => handleChange("nomeProduto", e.target.value)}
                  placeholder="Ex: Camiseta Básica Branca P"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria *</Label>
                <Select 
                  value={formData.categoria}
                  onValueChange={(value) => handleChange("categoria", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((categoria) => (
                      <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tipoProduto">Tipo Produto *</Label>
                <Select 
                  value={formData.tipoProduto}
                  onValueChange={(value) => handleChange("tipoProduto", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposProduto.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quantidadeAtual">Quantidade Atual {!isEditing && "*"}</Label>
                <Input 
                  id="quantidadeAtual" 
                  type="number"
                  min="0"
                  value={formData.quantidadeAtual}
                  onChange={(e) => handleChange("quantidadeAtual", parseInt(e.target.value) || 0)}
                  placeholder="Ex: 10"
                  disabled={isEditing}
                  required={!isEditing}
                />
                {isEditing && (
                  <p className="text-xs text-muted-foreground">Use a função de entrada de estoque para alterar a quantidade</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="unidadeMedida">Unidade de Medida</Label>
                <Select 
                  value={formData.unidadeMedida}
                  onValueChange={(value) => handleChange("unidadeMedida", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidadesMedida.map((unidade) => (
                      <SelectItem key={unidade} value={unidade}>{unidade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="precoUnitario">Preço Unitário (R$) *</Label>
                {controladoPorCustos ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-not-allowed">
                        <Input
                          id="precoUnitario"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={formData.precoUnitario}
                          placeholder="Gerenciado por Custos de Produtos"
                          disabled
                          readOnly
                          className="cursor-not-allowed opacity-60 bg-muted"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="font-semibold">🔒 Campo bloqueado</p>
                      <p className="text-xs mt-1">Este preço é gerenciado pela página "Custos de Produtos". Altere o valor lá para atualizar o estoque.</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Input
                    id="precoUnitario"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={formData.precoUnitario}
                    onChange={(e) => handleChange("precoUnitario", parseFloat(e.target.value) || 0)}
                    placeholder="Ex: 29.90"
                    required
                  />
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate("/estoque")}>
                Cancelar
              </Button>
              <Button type="submit" className="btn-gradient" disabled={isLoading}>
                {isLoading ? "Salvando..." : (isEditing ? "Atualizar" : "Cadastrar")} Produto
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default EstoqueProduto;
