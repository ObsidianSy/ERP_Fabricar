-- Adiciona o campo 'cargo' na tabela usuarios
ALTER TABLE obsidian.usuarios
ADD COLUMN cargo TEXT DEFAULT 'admin';

-- Atualiza o usuário admin já criado para garantir que seja admin
UPDATE obsidian.usuarios
SET cargo = 'admin'
WHERE email = 'deltagarr@gmail.com';

-- Opcional: Definir valor padrão para futuros usuários
ALTER TABLE obsidian.usuarios
ALTER COLUMN cargo SET DEFAULT 'operador';

-- Comentário para documentação
COMMENT ON COLUMN obsidian.usuarios.cargo IS 'Cargo do usuário: admin, operador, supervisor, etc.';
