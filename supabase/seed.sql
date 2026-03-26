-- Seed data for Platforms
INSERT INTO platforms (id, name, url, env) VALUES
('1', 'Portal do Cliente', 'https://cliente.ttickett.com', 'Produção'),
('2', 'Sistema Interno', 'https://interno.ttickett.com', 'Homologação'),
('3', 'Plataforma Financeira', 'https://financeiro.ttickett.com', 'Produção'),
('4', 'Dashboard Web', 'https://dash.ttickett.com', 'Produção'),
('5', 'API Gateway', 'https://api.ttickett.com', 'Desenvolvimento')
ON CONFLICT (id) DO NOTHING;

-- Seed data for Categories
INSERT INTO categories (id, name, "desc") VALUES
('1', 'Bug Crítico', 'Problemas que impedem o uso do sistema.'),
('2', 'Dúvida Técnica', 'Perguntas sobre funcionamento de APIs.'),
('3', 'Sugestão', 'Melhorias sugeridas pelos usuários.'),
('4', 'Acesso', 'Problemas relacionados a login e permissões.')
ON CONFLICT (id) DO NOTHING;

-- Seed data for Organizations
INSERT INTO organizations (id, name, platforms, categories, address, phone, contactPerson, email) VALUES
('org1'::uuid, 'Empresa Alpha', '["1", "3"]'::jsonb, '["1", "2"]'::jsonb, 'Av. Paulista, 1000', '(11) 99999-9999', 'João Silva', 'contato@alpha.com'),
('org2'::uuid, 'Empresa Beta', '["2", "4", "5"]'::jsonb, '["3", "4"]'::jsonb, 'Rua das Flores, 500', '(21) 88888-8888', 'Maria Souza', 'contato@beta.com')
ON CONFLICT (id) DO NOTHING;
