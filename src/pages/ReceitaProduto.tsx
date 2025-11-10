import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE_URL } from "@/config/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Search, Edit, Trash2, Package, Upload } from "lucide-react";
import { toast } from "sonner";
import { consultarDados, gerarIdMateriaPrima } from "@/services/n8nIntegration";
import * as XLSX from 'xlsx';

interface Produto {
  SKU: string;
  "Nome Produto": string;
  Categoria: string;
}

interface MateriaPrima {
  "SKU Matéria-Prima": string;
  "Nome Matéria-Prima": string;
  "Categoria MP": string;
  "Unidade de Medida": string;
  "Quantidade Atual": number;
  "Custo Unitário": number;
}

interface ReceitaItem {
  "SKU Produto": string;
  "SKU Matéria-Prima": string;
  "Quantidade por Produto": number;
  "Unidade de Medida"?: string;
}

interface ReceitaFormData {
  skuProduto: string;
  materiasPrimas: {
    skuMateriaPrima: string;
    quantidade: string;
    unidadeMedida: string;
  }[];
}

const ReceitaProduto = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [receitas, setReceitas] = useState<ReceitaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState<ReceitaFormData>({
    skuProduto: "",
    materiasPrimas: [{ skuMateriaPrima: "", quantidade: "", unidadeMedida: "" }]
  });

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState<ReceitaFormData>({
    skuProduto: "",
    materiasPrimas: [{ skuMateriaPrima: "", quantidade: "", unidadeMedida: "" }]
  });

  // Estados para gerenciamento de matérias-primas
  const [showMateriaPrimaDialog, setShowMateriaPrimaDialog] = useState(false);
  const [editingMateriaPrima, setEditingMateriaPrima] = useState<MateriaPrima | null>(null);
  const [materiaPrimaFormData, setMateriaPrimaFormData] = useState({
    sku: "",
    nome: "",
    categoria: "",
    unidadeMedida: "UN",
    quantidadeAtual: "0",
    custoUnitario: "0"
  });
  const [materiaPrimaSearchTerm, setMateriaPrimaSearchTerm] = useState("");

  // Funções helper definidas antes do useEffect
  const getProdutoNome = (sku: string) => {
    const produto = produtos.find(p => p.SKU === sku);
    return produto ? produto["Nome Produto"] : sku;
  };

  const getMateriaPrimaNome = (sku: string) => {
    const mp = materiasPrimas.find(m => m["SKU Matéria-Prima"] === sku);
    return mp ? mp["Nome Matéria-Prima"] : sku;
  };

  const getReceitasPorProduto = (skuProduto: string) => {
    return receitas.filter(receita => receita["SKU Produto"] === skuProduto);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [dadosProdutos, dadosMateriaPrima, dadosReceitas] = await Promise.all([
        consultarDados('Estoque'),
        fetch('http://localhost:3001/api/materia-prima').then(res => res.json()),
        fetch('http://localhost:3001/api/receita-produto').then(res => res.json())
      ]);

      setProdutos(Array.isArray(dadosProdutos) ? dadosProdutos : []);

      // Mapear dados da API para o formato esperado
      const materiaPrimasMapeadas = Array.isArray(dadosMateriaPrima)
        ? dadosMateriaPrima.map((mp: any) => ({
          "SKU Matéria-Prima": mp.sku_mp,
          "Nome Matéria-Prima": mp.nome,
          "Categoria MP": mp.categoria,
          "Unidade de Medida": mp.unidade_medida,
          "Quantidade Atual": parseFloat(mp.quantidade_atual) || 0,
          "Custo Unitário": parseFloat(mp.custo_unitario) || 0
        }))
        : [];

      setMateriasPrimas(materiaPrimasMapeadas);

      // Mapear receitas da API
      const receitasMapeadas: ReceitaItem[] = [];
      if (Array.isArray(dadosReceitas)) {
        dadosReceitas.forEach((receita: any) => {
          if (Array.isArray(receita.items)) {
            receita.items.forEach((item: any) => {
              receitasMapeadas.push({
                "SKU Produto": receita.sku_produto,
                "SKU Matéria-Prima": item.sku_mp,
                "Quantidade por Produto": parseFloat(item.quantidade_por_produto) || 0,
                "Unidade de Medida": item.unidade_medida
              });
            });
          }
        });
      }

      setReceitas(receitasMapeadas);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados. Tente novamente.");
      // Inicializar com arrays vazios em caso de erro
      setProdutos([]);
      setMateriasPrimas([]);
      setReceitas([]);
    } finally {
      setLoading(false);
    }
  };

  // Função para importar receitas de Excel
  const importarReceitasDeExcel = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      console.log('📊 Abas disponíveis:', workbook.SheetNames);

      // Buscar aba "Receita_Produto"
      const abaReceita = workbook.SheetNames.find(name =>
        name.toLowerCase().includes('receita')
      );

      if (!abaReceita) {
        toast.error("Aba não encontrada", {
          description: "A planilha deve ter uma aba chamada 'Receita_Produto'",
          duration: 5000
        });
        return;
      }

      console.log('📝 Aba Receita encontrada:', abaReceita);
      const worksheetReceita = workbook.Sheets[abaReceita];
      const dadosReceita = XLSX.utils.sheet_to_json(worksheetReceita);

      console.log(`📝 Total de linhas encontradas: ${dadosReceita.length}`);

      // Agrupar receitas por SKU do Produto
      const receitasPorProduto: { [key: string]: any[] } = {};
      let linhaAtual = 0;
      let sucessos = 0;
      let erros = 0;

      for (const row of dadosReceita as any[]) {
        linhaAtual++;
        try {
          // Ler dados da linha (suportando tanto cabeçalhos quanto __EMPTY)
          const skuProduto = row['SKU Produto'] || row.__EMPTY_1;
          const skuMateriaPrima = row['SKU Matéria-Prima'] || row['SKU Materia-Prima'] || row.__EMPTY_2;
          const quantidade = Number(row['Quantidade por Produto'] || row.__EMPTY_3 || 0);
          const unidade = row['Unidade de Medida'] || row.__EMPTY_4 || 'UN';

          // Validação básica
          if (!skuProduto || !skuMateriaPrima || quantidade <= 0) {
            console.warn(`⚠️ Linha ${linhaAtual}: Dados inválidos - Produto="${skuProduto}", MP="${skuMateriaPrima}", Qtd=${quantidade}`);
            erros++;
            continue;
          }

          // Agrupar por produto
          if (!receitasPorProduto[skuProduto]) {
            receitasPorProduto[skuProduto] = [];
          }

          receitasPorProduto[skuProduto].push({
            sku_mp: skuMateriaPrima,
            quantidade_por_produto: quantidade,
            unidade_medida: unidade
          });

          console.log(`✅ Linha ${linhaAtual}: ${skuProduto} → ${skuMateriaPrima} (${quantidade} ${unidade})`);
        } catch (error: any) {
          console.error(`❌ Erro na linha ${linhaAtual}:`, error);
          erros++;
        }
      }

      // Enviar receitas agrupadas para o backend
      console.log('📤 Enviando receitas agrupadas:', receitasPorProduto);

      const produtosComErro: string[] = [];
      const detalhesErros: { [key: string]: string } = {};

      for (const [skuProduto, componentes] of Object.entries(receitasPorProduto)) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/receita-produto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sku_produto: skuProduto,
              items: componentes
            })
          });

          if (response.ok) {
            sucessos += componentes.length;
            console.log(`✅ Receita do produto ${skuProduto} salva com sucesso`);
          } else {
            const errorText = await response.text();
            console.error(`❌ Erro ao salvar receita do produto ${skuProduto}:`, errorText);
            produtosComErro.push(skuProduto);
            detalhesErros[skuProduto] = errorText;
            erros += componentes.length;
          }
        } catch (error: any) {
          console.error(`❌ Erro ao salvar receita do produto ${skuProduto}:`, error);
          produtosComErro.push(skuProduto);
          detalhesErros[skuProduto] = error.message || 'Erro desconhecido';
          erros += componentes.length;
        }
      }

      // Log detalhado dos erros
      if (produtosComErro.length > 0) {
        console.error('❌ Produtos com erro:', produtosComErro);
        console.error('📋 Detalhes dos erros:', detalhesErros);
      }

      // Exibir resultado
      const totalProdutos = Object.keys(receitasPorProduto).length;
      if (sucessos > 0) {
        const mensagemErro = erros > 0
          ? ` | ❌ ${produtosComErro.length} produtos com erro: ${produtosComErro.slice(0, 5).join(', ')}${produtosComErro.length > 5 ? '...' : ''}`
          : '';

        toast.success("Importação concluída!", {
          description: `✅ ${totalProdutos - produtosComErro.length} produtos com ${sucessos} componentes importados${mensagemErro}`,
          duration: 8000
        });

        // Recarregar dados
        await carregarDados();
      } else {
        toast.error("Nenhuma receita importada", {
          description: `${erros} erros encontrados em: ${produtosComErro.slice(0, 10).join(', ')}${produtosComErro.length > 10 ? '...' : ''}. Verifique o console.`,
          duration: 8000
        });
      }

    } catch (error) {
      console.error('Erro ao importar:', error);
      toast.error("Erro ao importar planilha", {
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
    } finally {
      setIsImporting(false);
      // Limpar o input file para permitir reimportar o mesmo arquivo
      event.target.value = '';
    }
  }, [carregarDados]);

  const handleAddMateriaPrima = () => {
    setFormData(prev => ({
      ...prev,
      materiasPrimas: [...prev.materiasPrimas, { skuMateriaPrima: "", quantidade: "", unidadeMedida: "" }]
    }));
  };

  const handleRemoveMateriaPrima = (index: number) => {
    setFormData(prev => ({
      ...prev,
      materiasPrimas: prev.materiasPrimas.filter((_, i) => i !== index)
    }));
  };

  const handleMateriaPrimaChange = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      materiasPrimas: prev.materiasPrimas.map((mp, i) =>
        i === index ? { ...mp, [field]: value } : mp
      )
    }));
  };

  const handleSubmit = async () => {
    try {
      const validMateriasPrimas = formData.materiasPrimas
        .filter(mp => mp.skuMateriaPrima && mp.quantidade && parseFloat(mp.quantidade) > 0);

      if (validMateriasPrimas.length === 0) {
        toast.error("Adicione pelo menos uma matéria-prima com quantidade válida");
        return;
      }

      const receitaData = {
        sku_produto: formData.skuProduto,
        items: validMateriasPrimas.map(mp => ({
          sku_mp: mp.skuMateriaPrima,
          quantidade_por_produto: parseFloat(mp.quantidade),
          unidade_medida: mp.unidadeMedida,
          valor_unitario: 0
        }))
      };

      const response = await fetch('http://localhost:3001/api/receita-produto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receitaData)
      });

      if (!response.ok) throw new Error('Erro ao salvar receita');

      toast.success("Receita cadastrada com sucesso!");
      setShowAddDialog(false);
      setFormData({
        skuProduto: "",
        materiasPrimas: [{ skuMateriaPrima: "", quantidade: "", unidadeMedida: "" }]
      });
      carregarDados();
    } catch (error) {
      console.error("Erro ao salvar receita:", error);
      toast.error("Erro ao salvar receita");
    }
  };

  const handleOpenEdit = (skuProduto: string) => {
    const receitasDoProduto = getReceitasPorProduto(skuProduto);
    if (!receitasDoProduto || receitasDoProduto.length === 0) {
      toast.error("Nenhuma receita encontrada para este produto");
      return;
    }
    setEditFormData({
      skuProduto,
      materiasPrimas: receitasDoProduto.map(r => ({
        skuMateriaPrima: r["SKU Matéria-Prima"],
        quantidade: String(r["Quantidade por Produto"] ?? ""),
        unidadeMedida: r["Unidade de Medida"] ?? ""
      }))
    });
    setShowEditDialog(true);
  };

  const handleEditAddMateriaPrima = () => {
    setEditFormData(prev => ({
      ...prev,
      materiasPrimas: [...prev.materiasPrimas, { skuMateriaPrima: "", quantidade: "", unidadeMedida: "" }]
    }));
  };

  const handleEditRemoveMateriaPrima = (index: number) => {
    setEditFormData(prev => ({
      ...prev,
      materiasPrimas: prev.materiasPrimas.filter((_, i) => i !== index)
    }));
  };

  const handleEditMateriaPrimaChange = (index: number, field: string, value: string) => {
    setEditFormData(prev => ({
      ...prev,
      materiasPrimas: prev.materiasPrimas.map((mp, i) =>
        i === index ? { ...mp, [field]: value } : mp
      )
    }));
  };

  const handleUpdate = async () => {
    try {
      const validMateriasPrimas = editFormData.materiasPrimas
        .filter(mp => mp.skuMateriaPrima && mp.quantidade && parseFloat(mp.quantidade) > 0);

      if (validMateriasPrimas.length === 0) {
        toast.error("Adicione pelo menos uma matéria-prima com quantidade válida");
        return;
      }

      const receitaData = {
        sku_produto: editFormData.skuProduto,
        items: validMateriasPrimas.map(mp => ({
          sku_mp: mp.skuMateriaPrima,
          quantidade_por_produto: parseFloat(mp.quantidade),
          unidade_medida: mp.unidadeMedida,
          valor_unitario: 0
        }))
      };

      const response = await fetch('http://localhost:3001/api/receita-produto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receitaData)
      });

      if (!response.ok) throw new Error('Erro ao atualizar receita');

      toast.success("Receita atualizada com sucesso!");
      setShowEditDialog(false);
      carregarDados();
    } catch (error) {
      console.error("Erro ao atualizar receita:", error);
      toast.error("Erro ao atualizar receita");
    }
  };

  // Funções para gerenciamento de matérias-primas
  const handleOpenMateriaPrimaDialog = (mp?: MateriaPrima) => {
    if (mp) {
      setEditingMateriaPrima(mp);
      setMateriaPrimaFormData({
        sku: mp["SKU Matéria-Prima"],
        nome: mp["Nome Matéria-Prima"],
        categoria: mp["Categoria MP"] || "",
        unidadeMedida: mp["Unidade de Medida"] || "UN",
        quantidadeAtual: mp["Quantidade Atual"]?.toString() || "0",
        custoUnitario: mp["Custo Unitário"]?.toString() || "0"
      });
    } else {
      setEditingMateriaPrima(null);
      setMateriaPrimaFormData({
        sku: gerarIdMateriaPrima(),
        nome: "",
        categoria: "",
        unidadeMedida: "UN",
        quantidadeAtual: "0",
        custoUnitario: "0"
      });
    }
    setShowMateriaPrimaDialog(true);
  };

  const handleSaveMateriaPrima = async () => {
    if (!materiaPrimaFormData.sku || !materiaPrimaFormData.nome) {
      toast.error("SKU e Nome são obrigatórios");
      return;
    }

    try {
      const mpData = {
        sku_mp: materiaPrimaFormData.sku,
        nome: materiaPrimaFormData.nome,
        categoria: materiaPrimaFormData.categoria || null,
        unidade_medida: materiaPrimaFormData.unidadeMedida,
        quantidade_atual: parseFloat(materiaPrimaFormData.quantidadeAtual) || 0,
        custo_unitario: parseFloat(materiaPrimaFormData.custoUnitario) || 0,
        ativo: true
      };

      const url = editingMateriaPrima
        ? `http://localhost:3001/api/materia-prima/${materiaPrimaFormData.sku}`
        : 'http://localhost:3001/api/materia-prima';

      const method = editingMateriaPrima ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mpData)
      });

      if (!response.ok) throw new Error('Erro ao salvar');

      toast.success(editingMateriaPrima ? "Matéria-prima atualizada!" : "Matéria-prima cadastrada!");

      // Limpar formulário e fechar modal
      setShowMateriaPrimaDialog(false);
      setEditingMateriaPrima(null);
      setMateriaPrimaFormData({
        sku: "",
        nome: "",
        categoria: "",
        unidadeMedida: "UN",
        quantidadeAtual: "0",
        custoUnitario: "0"
      });

      carregarDados();
    } catch (error) {
      console.error("Erro ao salvar matéria-prima:", error);
      toast.error("Erro ao salvar matéria-prima");
    }
  };

  const handleDeleteMateriaPrima = async (sku: string) => {
    if (!confirm("Deseja realmente excluir esta matéria-prima?")) return;

    try {
      const response = await fetch(`http://localhost:3001/api/materia-prima/${sku}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Erro ao excluir');

      toast.success("Matéria-prima excluída!");
      carregarDados();
    } catch (error) {
      console.error("Erro ao excluir matéria-prima:", error);
      toast.error("Erro ao excluir matéria-prima");
    }
  };

  const filteredReceitas = receitas.filter(receita =>
    receita["SKU Produto"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receita["SKU Matéria-Prima"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getMateriaPrimaNome(receita["SKU Matéria-Prima"])?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <p>Carregando dados...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Receita de Produtos
            </h1>
            <p className="text-muted-foreground">
              Gerencie as receitas e consulte matérias-primas por produto
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Botão de Importação */}
            <label htmlFor="import-receitas-excel">
              <Button
                variant="outline"
                size="sm"
                disabled={isImporting}
                asChild
              >
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  {isImporting ? 'Importando...' : 'Importar Excel'}
                </span>
              </Button>
            </label>
            <input
              id="import-receitas-excel"
              type="file"
              accept=".xlsx,.xls"
              onChange={importarReceitasDeExcel}
              style={{ display: 'none' }}
            />

            {/* Botão de Nova Receita */}
            <Dialog
              open={showAddDialog}
              onOpenChange={(open) => {
                setShowAddDialog(open);
                if (!open) {
                  // Limpar formulário ao fechar
                  setFormData({
                    skuProduto: "",
                    materiasPrimas: [{ skuMateriaPrima: "", quantidade: "", unidadeMedida: "" }]
                  });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="btn-gradient">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Receita
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">Cadastrar Receita de Produto</h2>
                    <p className="text-muted-foreground">
                      Adicione múltiplas matérias-primas para um produto
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label>Produto *</Label>
                      <Select onValueChange={(value) => setFormData(prev => ({ ...prev, skuProduto: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {produtos.filter(produto => produto.SKU && produto.SKU.trim() !== "").map((produto) => (
                            <SelectItem key={produto.SKU} value={produto.SKU}>
                              {produto.SKU} - {produto["Nome Produto"] || ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Matérias-Primas *</Label>
                        <Button type="button" variant="outline" size="sm" onClick={handleAddMateriaPrima}>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Matéria-Prima
                        </Button>
                      </div>

                      {formData.materiasPrimas.map((mp, index) => (
                        <Card key={index} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <Label>Matéria-Prima</Label>
                              <Select onValueChange={(value) => handleMateriaPrimaChange(index, "skuMateriaPrima", value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {materiasPrimas.filter(mp => mp["SKU Matéria-Prima"] && mp["SKU Matéria-Prima"].trim() !== "").map((materiaPrima) => (
                                    <SelectItem key={materiaPrima["SKU Matéria-Prima"]} value={materiaPrima["SKU Matéria-Prima"]}>
                                      {materiaPrima["SKU Matéria-Prima"]} - {materiaPrima["Nome Matéria-Prima"] || ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label>Quantidade</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={mp.quantidade}
                                onChange={(e) => handleMateriaPrimaChange(index, "quantidade", e.target.value)}
                                placeholder="Ex: 2"
                              />
                            </div>

                            <div>
                              <Label>Unidade</Label>
                              <Select onValueChange={(value) => handleMateriaPrimaChange(index, "unidadeMedida", value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Unidade" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="UN">Unidade</SelectItem>
                                  <SelectItem value="KG">Quilograma</SelectItem>
                                  <SelectItem value="G">Grama</SelectItem>
                                  <SelectItem value="MT">Metro</SelectItem>
                                  <SelectItem value="CM">Centímetro</SelectItem>
                                  <SelectItem value="LT">Litro</SelectItem>
                                  <SelectItem value="ML">Mililitro</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveMateriaPrima(index)}
                                disabled={formData.materiasPrimas.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSubmit} disabled={!formData.skuProduto}>
                        Salvar Receita
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="cadastro" className="space-y-6">
          <TabsList>
            <TabsTrigger value="cadastro">Cadastro de Receitas</TabsTrigger>
            <TabsTrigger value="consulta">Consulta por Produto</TabsTrigger>
            <TabsTrigger value="materiasprimas">Matérias-Primas</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastro" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Receitas Cadastradas</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Buscar por produto ou matéria-prima..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU Produto</TableHead>
                      <TableHead>Nome Produto</TableHead>
                      <TableHead>SKU Matéria-Prima</TableHead>
                      <TableHead>Nome Matéria-Prima</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceitas.map((receita, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{receita["SKU Produto"]}</TableCell>
                        <TableCell>{getProdutoNome(receita["SKU Produto"])}</TableCell>
                        <TableCell>{receita["SKU Matéria-Prima"]}</TableCell>
                        <TableCell>{getMateriaPrimaNome(receita["SKU Matéria-Prima"])}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {receita["Quantidade por Produto"]} {receita["Unidade de Medida"] || "UN"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => handleOpenEdit(receita["SKU Produto"])}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consulta" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Consulta de Receita por Produto</CardTitle>
                <div>
                  <Label>Selecione um produto para ver sua receita</Label>
                  <Select onValueChange={setSelectedProduct}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.filter(produto => produto.SKU && produto.SKU.trim() !== "").map((produto) => (
                        <SelectItem key={produto.SKU} value={produto.SKU}>
                          {produto.SKU} - {produto["Nome Produto"] || ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              {selectedProduct && (
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">
                        {selectedProduct} - {getProdutoNome(selectedProduct)}
                      </h3>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU Matéria-Prima</TableHead>
                          <TableHead>Nome Matéria-Prima</TableHead>
                          <TableHead>Quantidade por Produto</TableHead>
                          <TableHead>Unidade de Medida</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getReceitasPorProduto(selectedProduct).map((receita, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{receita["SKU Matéria-Prima"]}</TableCell>
                            <TableCell>{getMateriaPrimaNome(receita["SKU Matéria-Prima"])}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {receita["Quantidade por Produto"]}
                              </Badge>
                            </TableCell>
                            <TableCell>{receita["Unidade de Medida"] || "UN"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {getReceitasPorProduto(selectedProduct).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhuma receita cadastrada para este produto</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="materiasprimas" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Matérias-Primas Cadastradas</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Gerencie as matérias-primas utilizadas nas receitas
                    </p>
                  </div>
                  <Button onClick={() => handleOpenMateriaPrimaDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Matéria-Prima
                  </Button>
                </div>
                <div className="mt-4">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Buscar matéria-prima..."
                      value={materiaPrimaSearchTerm}
                      onChange={(e) => setMateriaPrimaSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Foto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materiasPrimas
                      .filter(mp =>
                        mp["Nome Matéria-Prima"]?.toLowerCase().includes(materiaPrimaSearchTerm.toLowerCase()) ||
                        mp["SKU Matéria-Prima"]?.toLowerCase().includes(materiaPrimaSearchTerm.toLowerCase()) ||
                        mp["Categoria MP"]?.toLowerCase().includes(materiaPrimaSearchTerm.toLowerCase())
                      )
                      .map((mp) => (
                        <TableRow key={mp["SKU Matéria-Prima"]}>
                          <TableCell>
                            <Avatar className="w-10 h-10">
                              <AvatarImage
                                src={`${API_BASE_URL}/api/materia-prima-fotos/${mp["SKU Matéria-Prima"]}/thumbnail`}
                                alt={mp["Nome Matéria-Prima"]}
                              />
                              <AvatarFallback className="text-xs bg-muted">
                                {mp["Nome Matéria-Prima"]?.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-mono">{mp["SKU Matéria-Prima"]}</TableCell>
                          <TableCell className="font-medium">{mp["Nome Matéria-Prima"]}</TableCell>
                          <TableCell>{mp["Categoria MP"] || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{mp["Unidade de Medida"] || "UN"}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {mp["Quantidade Atual"].toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            R$ {mp["Custo Unitário"].toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenMateriaPrimaDialog(mp)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteMateriaPrima(mp["SKU Matéria-Prima"])}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                {materiasPrimas.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma matéria-prima cadastrada</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog
          open={showMateriaPrimaDialog}
          onOpenChange={(open) => {
            setShowMateriaPrimaDialog(open);
            if (!open) {
              // Limpar formulário ao fechar
              setEditingMateriaPrima(null);
              setMateriaPrimaFormData({
                sku: "",
                nome: "",
                categoria: "",
                unidadeMedida: "UN",
                quantidadeAtual: "0",
                custoUnitario: "0"
              });
            }
          }}
        >
          <DialogContent>
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">
                  {editingMateriaPrima ? "Editar Matéria-Prima" : "Nova Matéria-Prima"}
                </h2>
                <p className="text-muted-foreground">
                  {editingMateriaPrima ? "Atualize os dados da matéria-prima" : "Cadastre uma nova matéria-prima"}
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>SKU *</Label>
                    <Input
                      value={materiaPrimaFormData.sku}
                      onChange={(e) => setMateriaPrimaFormData(prev => ({ ...prev, sku: e.target.value }))}
                      disabled={!!editingMateriaPrima}
                      placeholder="Ex: MP001"
                    />
                  </div>

                  <div>
                    <Label>Nome *</Label>
                    <Input
                      value={materiaPrimaFormData.nome}
                      onChange={(e) => setMateriaPrimaFormData(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Tecido Algodão"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Categoria</Label>
                    <Input
                      value={materiaPrimaFormData.categoria}
                      onChange={(e) => setMateriaPrimaFormData(prev => ({ ...prev, categoria: e.target.value }))}
                      placeholder="Ex: Tecidos"
                    />
                  </div>

                  <div>
                    <Label>Unidade de Medida *</Label>
                    <Select
                      value={materiaPrimaFormData.unidadeMedida}
                      onValueChange={(value) => setMateriaPrimaFormData(prev => ({ ...prev, unidadeMedida: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UN">Unidade</SelectItem>
                        <SelectItem value="KG">Quilograma</SelectItem>
                        <SelectItem value="G">Grama</SelectItem>
                        <SelectItem value="MT">Metro</SelectItem>
                        <SelectItem value="CM">Centímetro</SelectItem>
                        <SelectItem value="LT">Litro</SelectItem>
                        <SelectItem value="ML">Mililitro</SelectItem>
                        <SelectItem value="M2">Metro Quadrado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quantidade Atual</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={materiaPrimaFormData.quantidadeAtual}
                      onChange={(e) => setMateriaPrimaFormData(prev => ({ ...prev, quantidadeAtual: e.target.value }))}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Quantidade em estoque
                    </p>
                  </div>

                  <div>
                    <Label>Custo Unitário (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={materiaPrimaFormData.custoUnitario}
                      onChange={(e) => setMateriaPrimaFormData(prev => ({ ...prev, custoUnitario: e.target.value }))}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Preço por unidade
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowMateriaPrimaDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveMateriaPrima}>
                  {editingMateriaPrima ? "Salvar Alterações" : "Cadastrar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) {
              // Limpar formulário ao fechar
              setEditFormData({
                skuProduto: "",
                materiasPrimas: [{ skuMateriaPrima: "", quantidade: "", unidadeMedida: "" }]
              });
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Editar Receita do Produto</h2>
                <p className="text-muted-foreground">
                  Atualize as matérias-primas deste produto
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Produto</Label>
                  <Select value={editFormData.skuProduto} disabled>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.filter(produto => produto.SKU && produto.SKU.trim() !== "").map((produto) => (
                        <SelectItem key={produto.SKU} value={produto.SKU}>
                          {produto.SKU} - {produto["Nome Produto"] || ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Matérias-Primas</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleEditAddMateriaPrima}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Matéria-Prima
                    </Button>
                  </div>

                  {editFormData.materiasPrimas.map((mp, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <Label>Matéria-Prima</Label>
                          <Select
                            value={mp.skuMateriaPrima}
                            onValueChange={(value) => handleEditMateriaPrimaChange(index, "skuMateriaPrima", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {materiasPrimas.filter(mp => mp["SKU Matéria-Prima"] && mp["SKU Matéria-Prima"].trim() !== "").map((materiaPrima) => (
                                <SelectItem key={materiaPrima["SKU Matéria-Prima"]} value={materiaPrima["SKU Matéria-Prima"]}>
                                  {materiaPrima["SKU Matéria-Prima"]} - {materiaPrima["Nome Matéria-Prima"] || ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={mp.quantidade}
                            onChange={(e) => handleEditMateriaPrimaChange(index, "quantidade", e.target.value)}
                            placeholder="Ex: 2"
                          />
                        </div>

                        <div>
                          <Label>Unidade</Label>
                          <Select
                            value={mp.unidadeMedida}
                            onValueChange={(value) => handleEditMateriaPrimaChange(index, "unidadeMedida", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Unidade" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="UN">Unidade</SelectItem>
                              <SelectItem value="KG">Quilograma</SelectItem>
                              <SelectItem value="G">Grama</SelectItem>
                              <SelectItem value="MT">Metro</SelectItem>
                              <SelectItem value="CM">Centímetro</SelectItem>
                              <SelectItem value="LT">Litro</SelectItem>
                              <SelectItem value="ML">Mililitro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRemoveMateriaPrima(index)}
                            disabled={editFormData.materiasPrimas.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdate} disabled={!editFormData.skuProduto}>
                    Salvar alterações
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </Layout>
  );
};

export default ReceitaProduto;