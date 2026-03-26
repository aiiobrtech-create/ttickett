import { Ticket, User, Organization, PlatformType, CategoryType, AccessLog } from './types';

export const MOCK_ACCESS_LOGS: AccessLog[] = [
  {
    id: '1',
    userId: '3',
    userName: 'Administrador Nexus',
    userEmail: 'admin@ttickett.com',
    action: 'Login no sistema',
    ip: '192.168.1.1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2)
  },
  {
    id: '2',
    userId: '2',
    userName: 'Suporte TTICKETT',
    userEmail: 'suporte@ttickett.com',
    action: 'Visualização de ticket TK-1024',
    ip: '192.168.1.5',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.5)
  },
  {
    id: '3',
    userId: '3',
    userName: 'Administrador Nexus',
    userEmail: 'admin@ttickett.com',
    action: 'Exportação de relatório de tickets',
    ip: '192.168.1.1',
    timestamp: new Date(Date.now() - 1000 * 60 * 30)
  },
  {
    id: '4',
    userId: '1',
    userName: 'Renan Santos',
    userEmail: 'renan@empresa.com',
    action: 'Abertura de novo ticket',
    ip: '177.45.12.89',
    timestamp: new Date(Date.now() - 1000 * 60 * 15)
  }
];

export const MOCK_ORGANIZATIONS: Organization[] = [
  {
    id: 'org1',
    name: 'Empresa Alpha',
    platforms: ['1', '3'],
    categories: ['1', '2'],
    address: 'Av. Paulista, 1000',
    phone: '(11) 99999-9999',
    contactPerson: 'João Silva',
    email: 'contato@alpha.com'
  },
  {
    id: 'org2',
    name: 'Empresa Beta',
    platforms: ['2', '4', '5'],
    categories: ['3', '4'],
    address: 'Rua das Flores, 500',
    phone: '(21) 88888-8888',
    contactPerson: 'Maria Souza',
    email: 'contato@beta.com'
  }
];

export const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'Renan Santos',
    email: 'renan@empresa.com',
    role: 'client',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Renan',
    organizationId: 'org1'
  },
  {
    id: '2',
    name: 'Suporte TTICKETT',
    email: 'suporte@ttickett.com',
    role: 'agent',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Support'
  },
  {
    id: '3',
    name: 'Administrador Nexus',
    email: 'admin@ttickett.com',
    role: 'admin',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'
  },
  {
    id: '4',
    name: 'Ana Silva',
    email: 'ana.silva@ttickett.com',
    role: 'agent',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana'
  },
  {
    id: '5',
    name: 'Carlos Oliveira',
    email: 'carlos.o@ttickett.com',
    role: 'agent',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos'
  },
  {
    id: '6',
    name: 'Mariana Santos',
    email: 'mariana.s@ttickett.com',
    role: 'admin',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mariana'
  },
  {
    id: '7',
    name: 'João Silva',
    email: 'joao@empresa.com',
    role: 'client',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Joao',
    organizationId: 'org1'
  },
  {
    id: '8',
    name: 'Maria Souza',
    email: 'maria@empresa.com',
    role: 'client',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria',
    organizationId: 'org2'
  },
  {
    id: '9',
    name: 'Bruno Costa',
    email: 'bruno@empresa.com',
    role: 'client',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bruno',
    organizationId: 'org2'
  },
  {
    id: '10',
    name: 'Alice Silva',
    email: 'alice@empresa.com',
    role: 'client',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
    organizationId: 'org1'
  }
];

export const MOCK_PLATFORMS: PlatformType[] = [
  { id: '1', name: 'Portal do Cliente', url: 'https://cliente.ttickett.com', env: 'Produção' },
  { id: '2', name: 'Sistema Interno', url: 'https://interno.ttickett.com', env: 'Homologação' },
  { id: '3', name: 'Plataforma Financeira', url: 'https://financeiro.ttickett.com', env: 'Produção' },
  { id: '4', name: 'Dashboard Web', url: 'https://dash.ttickett.com', env: 'Produção' },
  { id: '5', name: 'API Gateway', url: 'https://api.ttickett.com', env: 'Desenvolvimento' },
];

export const MOCK_CATEGORIES: CategoryType[] = [
  { id: '1', name: 'Bug Crítico', desc: 'Problemas que impedem o uso do sistema.' },
  { id: '2', name: 'Dúvida Técnica', desc: 'Perguntas sobre funcionamento de APIs.' },
  { id: '3', name: 'Sugestão', desc: 'Melhorias sugeridas pelos usuários.' },
  { id: '4', name: 'Acesso', desc: 'Problemas relacionados a login e permissões.' },
];

export const MOCK_PERMISSIONS = [
  { id: 1, name: 'Acesso Total', desc: 'Permissão para todas as áreas do sistema.' },
  { id: 2, name: 'Apenas Leitura', desc: 'Pode visualizar mas não pode editar.' },
  { id: 3, name: 'Suporte Nível 1', desc: 'Atendimento básico e triagem.' },
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 't1',
    number: 'TK-1024',
    requester: 'Renan Santos',
    requesterEmail: 'renan@empresa.com',
    organizationId: 'org1',
    platform: 'Plataforma Financeira',
    category: 'Bug Crítico',
    subject: 'Erro ao processar pagamento via PIX',
    description: 'Ao tentar finalizar o pagamento, o sistema retorna um erro 500 inesperado.',
    status: 'Em atendimento',
    urgency: 'Alta',
    assignee: 'Suporte TTICKETT',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    updatedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    messages: [
      {
        id: 'm1',
        author: 'Renan Santos',
        authorRole: 'client',
        content: 'Olá, estou com problemas para realizar pagamentos via PIX na plataforma financeira.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24)
      },
      {
        id: 'm2',
        author: 'Suporte TTICKETT',
        authorRole: 'agent',
        content: 'Olá Renan! Já estamos analisando o log do servidor para identificar a causa do erro 500.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2)
      },
      {
        id: 'm-internal-1',
        author: 'Administrador Nexus',
        authorRole: 'admin',
        content: 'O erro 500 parece estar relacionado ao timeout do banco de dados na query de transações PIX. Já acionei a equipe de infra.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1),
        isInternal: true
      }
    ]
  },
  {
    id: 't2',
    number: 'TK-1025',
    requester: 'Alice Silva',
    requesterEmail: 'alice@empresa.com',
    organizationId: 'org1',
    platform: 'Portal do Cliente',
    category: 'Acesso',
    subject: 'Dificuldade em alterar senha',
    description: 'O link de recuperação de senha não está chegando no meu e-mail.',
    status: 'Aberto',
    urgency: 'Média',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    messages: [
      {
        id: 'm3',
        author: 'Alice Silva',
        authorRole: 'client',
        content: 'Não recebo o e-mail de recuperação.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5)
      }
    ]
  },
  {
    id: 't3',
    number: 'TK-1026',
    requester: 'Bruno Costa',
    requesterEmail: 'bruno@empresa.com',
    organizationId: 'org2',
    platform: 'Dashboard Web',
    category: 'Dúvida Técnica',
    subject: 'Gráficos não carregam no Safari',
    description: 'No Chrome funciona normal, mas no Safari os gráficos ficam em branco.',
    status: 'Resolvido',
    urgency: 'Baixa',
    assignee: 'Suporte TTICKETT',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
    messages: [
      {
        id: 'm4',
        author: 'Bruno Costa',
        authorRole: 'client',
        content: 'Os gráficos não aparecem no Safari.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48)
      },
      {
        id: 'm5',
        author: 'Suporte TTICKETT',
        authorRole: 'agent',
        content: 'Atualizamos a biblioteca de gráficos e agora deve estar funcionando corretamente.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12)
      }
    ]
  }
];
