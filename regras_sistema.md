🧠 REGRAS DE NEGÓCIO — ERP FÁBRICA (Versão para Claude Sonnet 4.5)
🔸 1. Contexto Geral

O sistema NÃO é multi-tenant.

Existe apenas um ambiente e um estoque consolidado.

Existem setores/linhas de produção (tratados como "clientes internos") com controle financeiro independente, mas todos compartilham o mesmo estoque.

O estoque é dividido em três tipos:
- **Matéria-Prima (MP)**: insumos que entram na produção
- **Em Processo (WIP)**: produtos sendo fabricados
- **Produtos Acabados (PA)**: prontos para venda/expedição

As Ordens de Produção (OP) são o equivalente a "vendas" do sistema anterior - elas consomem matéria-prima e geram produtos acabados.

Produção terceirizada (outsourcing) é um tipo especial de OP que não consome estoque interno (similar ao fulfillment externo).

🔹 2. Tipos de Ordem de Produção (OP)
Tipo de OP	Baixa Estoque MP	Adiciona Estoque PA	Observação
OP Normal (interna)	✅ Sim	✅ Sim	Consome MP do estoque e adiciona PA ao estoque
OP Terceirizada (outsourcing)	❌ Não	✅ Sim	Produção externa, só adiciona PA quando receber
OP Cancelada	❌ Não	❌ Não	Se já iniciada, deve estornar MP consumida
🔹 3. Fluxo de Ordem de Produção

Cada OP tem um ciclo de vida:

1. **Criação da OP**
   - Define: produto a fabricar, quantidade, prioridade, setor responsável
   - Status inicial: `aguardando`
   - Calcula necessidade de matéria-prima baseado na receita do produto

2. **Verificação de Estoque**
   - Sistema verifica se há MP suficiente
   - Se sim → status `pronto_para_iniciar`
   - Se não → status `aguardando_mp` (bloqueia início)

3. **Início da Produção**
   - Operador clica "Iniciar OP"
   - Status → `em_producao`
   - **BAIXA AUTOMÁTICA de matéria-prima** do estoque
   - Registra timestamp de início

4. **Apontamento de Produção**
   - Operador registra quantas peças foram produzidas
   - Sistema **ADICIONA produtos acabados ao estoque**
   - Se houver refugo → registra quantidade e motivo
   - Atualiza progresso da OP

5. **Conclusão da OP**
   - Quando quantidade produzida >= quantidade planejada
   - Status → `concluida`
   - Registra timestamp de conclusão
   - Calcula KPIs (eficiência, tempo, refugo)

6. **Cancelamento de OP**
   - Pode ser cancelada em qualquer status
   - Se já iniciada → **ESTORNA matéria-prima** consumida de volta ao estoque
   - Status → `cancelada`

🔹 4. Estoque

Estoque é único e compartilhado entre todos os setores.

Pode ficar negativo (sem bloqueio).

Cada produto tem:
sku, nome, categoria, tipo_produto, tipo_estoque, quantidade_atual, preco_unitario, ativo.

**Tipos de Estoque:**
- `materia_prima`: insumos para produção
- `em_processo`: produtos sendo fabricados (WIP)
- `acabado`: produtos finalizados

Baixa de estoque:

Ocorre quando OP é iniciada (consome MP).

Produção terceirizada NÃO reduz estoque interno.

Produtos com receita (BOM) têm seus componentes baixados automaticamente.

Valor considerado:

Sempre o custo do produto/MP no estoque.

Produtos com Receita (BOM - Bill of Materials):

Campo `receita_produto` contém lista de componentes: [{sku_mp, quantidade_por_produto}]

Ao iniciar OP, sistema calcula total de MP necessária.

Baixa automática de cada componente da receita.

Valor do produto acabado = soma dos custos das MPs + mão de obra (se configurado).

**Movimentações de Estoque:**

Todas registradas em `estoque_movimentos`:
- `entrada_mp`: entrada de matéria-prima (compra)
- `consumo_mp`: consumo na produção (OP)
- `producao`: produto acabado gerado
- `ajuste`: ajuste manual de inventário
- `refugo`: perda/descarte de material
- `transferencia`: entre setores

🔹 5. Financeiro e Custos

Cada OP gera custo para o setor responsável.

O valor do custo é calculado pela soma:
- Custo das matérias-primas consumidas (baseado no estoque)
- Custo de mão de obra (se configurado por produto)
- Custos indiretos (overhead, se aplicável)

OPs terceirizadas e canceladas não afetam o custo interno.

Lançamentos Financeiros:

São registrados quando há consumo real de MP.

Não são gerados automaticamente na criação da OP, apenas no início.

Chave de idempotência:
md5(data_consumo | setor_id | sku_mp | quantidade | op_id)

Evita duplicidade automática.

Custos de Produção:

Calculados automaticamente ao iniciar OP.

Baseados no custo atual das MPs no estoque.

Podem ser ajustados manualmente se necessário.

🔹 6. Receitas de Produto (BOM - Bill of Materials)

A tabela `receita_produto` define quais matérias-primas são necessárias para cada produto.

Cada registro contém:
- `sku_produto`: produto final
- `sku_mp`: matéria-prima necessária
- `quantidade_por_produto`: quanto de MP é usado por unidade do produto

Ao criar uma OP, o sistema:

Busca a receita do produto na tabela `receita_produto`.

Calcula total de MP necessária = quantidade_planejada × quantidade_por_produto.

Verifica disponibilidade em estoque.

Quando OP é iniciada:

Sistema baixa automaticamente todas as MPs da receita.

Registra cada consumo em `estoque_movimentos`.

Atualiza `quantidade_atual` de cada MP.

Produtos sem receita cadastrada:

Não podem ter OPs criadas (validação obrigatória).

Sistema alerta usuário para cadastrar receita primeiro.

🔹 7. Auditoria e Idempotência

Toda OP criada é registrada de forma imutável.

Cada movimentação de estoque tem:

Data/hora de processamento

Origem (OP, ajuste, entrada, etc)

Responsável (usuário que executou)

Hash de idempotência.

Reiniciar uma OP:

Não duplica consumo de MP.

Usa mesmos registros de `consumo_mp_op`.

Todas ações são registradas em activity_logs:

user_email, action, entity_type, entity_id, details, ip_address, user_agent, created_at

Exemplos de ações auditadas:
- `op_created`: OP criada
- `op_started`: OP iniciada (consumiu MP)
- `op_paused`: OP pausada
- `op_resumed`: OP retomada
- `op_completed`: OP concluída
- `op_cancelled`: OP cancelada
- `apontamento_created`: Produção registrada
- `refugo_registered`: Refugo registrado

🔹 8. Hierarquia de Processamento (ordem correta)

1. Criar Ordem de Produção (OP).

2. Validar receita do produto (BOM deve existir).

3. Calcular necessidade de matéria-prima.

4. Verificar disponibilidade em estoque:
   - Se OK → status `pronto_para_iniciar`
   - Se NOK → status `aguardando_mp`

5. Iniciar OP (ação manual do operador):
   - Baixar matéria-prima do estoque
   - Registrar consumo em `estoque_movimentos`
   - Status → `em_producao`

6. Apontar produção (pode ser múltiplas vezes):
   - Adicionar produtos acabados ao estoque
   - Registrar refugo (se houver)
   - Atualizar progresso da OP

7. Concluir OP:
   - Validar se quantidade produzida >= planejada
   - Status → `concluida`
   - Calcular KPIs (eficiência, tempo, refugo)

8. Gerar logs e relatórios.

🔹 9. Regra de Ouro (⚠️ para IA e dev)

NUNCA contabilizar OP terceirizada como baixa de estoque interno.
NUNCA iniciar OP sem validar disponibilidade de matéria-prima.
Sempre usar custo das MPs no estoque como base de cálculo de custo de produção.

Se a OP for cancelada após iniciada, DEVE estornar a matéria-prima consumida de volta ao estoque.

Ao apontar produção, SEMPRE adicionar produto acabado ao estoque (exceto em refugo total).

Refugos devem ser registrados separadamente e NÃO entram no estoque de produtos acabados.


E também sempre que vc criar algo que use alguma funcionalidade do banco de dados como tabelas principalmente, consulta lá pra você ver como está o nome pra não colocar nomes errados nem campos errados colocar exatamente igual tá no BD. Resumo sempre roda o script backend/check-ml-tables-quick.js. Pra você ver as tables.

Mais uma coisa caso vc tenha alguma dúvida não faça nada, pergunte antes, mas isso somente se vc realmente tiver alguma dúvida, se não pode seguir.


Sempre que você for fazer alguma coisa no código ou criar algo, você nunca deve mexer em outras coisas apenas no que foi pedido, pra evitar de quebrar o código, muitas vezes vc faz algo e outra para de funcionar, as vezes com nome de tabelas essas coisas, então vamos evitar.


Nova regra, sempre olha o arquivo tabela-sql.md. Lá vc vai ter uma noção de todo SQL do banco.


Se possível não ficar criando scripts, você já pode rodar direto eles, tá enchendo o projeto de arquivo à toa, a não ser que seja algo que vá ficar lá pra ser rodado direto!