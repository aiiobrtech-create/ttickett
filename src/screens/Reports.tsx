import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Ticket as TicketIcon, 
  Users, 
  Building2, 
  ShieldCheck, 
  Monitor, 
  Tag,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  exportToExcel, 
  exportTicketsToPDF, 
  exportUsersToPDF, 
  exportOrganizationsToPDF, 
  exportAccessLogsToPDF,
  exportPlatformsToPDF,
  exportCategoriesToPDF
} from '../lib/exportUtils';
import { supabase } from '../supabase';
import { Ticket, User, Organization, PlatformType, CategoryType, AccessLog } from '../types';

export const Reports: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [platforms, setPlatforms] = useState<PlatformType[]>([]);
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: tickets } = await supabase.from('tickets').select('*');
        setTickets((tickets || []).map(t => ({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
          estimatedDeadline: t.estimatedDeadline ? new Date(t.estimatedDeadline) : undefined,
        })));

        const { data: users } = await supabase.from('users').select('*');
        setUsers(users || []);

        const { data: orgs } = await supabase.from('organizations').select('*');
        setOrganizations(orgs || []);

        const { data: platforms } = await supabase.from('platforms').select('*');
        setPlatforms(platforms || []);

        const { data: categories } = await supabase.from('categories').select('*');
        setCategories(categories || []);

        setAccessLogs([]);
      } catch (error) {
        console.error("Error fetching report data:", error);
        toast.error("Erro ao carregar dados para relatórios");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);
  const reportSections = [
    {
      title: 'Tickets',
      icon: TicketIcon,
      color: 'text-discord-accent',
      bgColor: 'bg-discord-accent/10',
      description: 'Relatórios detalhados de todos os chamados abertos no sistema.',
      actions: [
        {
          label: 'Exportar Excel',
          icon: FileSpreadsheet,
          onClick: () => {
            const data = tickets.map(t => ({
              Número: t.number,
              Assunto: t.subject,
              Solicitante: t.requester,
              Status: t.status,
              Urgência: t.urgency,
              Aberto: format(t.createdAt, 'dd/MM/yyyy HH:mm'),
              Responsável: t.assignee || '-'
            }));
            exportToExcel(data, 'Relatorio_Tickets');
            toast.success('Excel de tickets gerado!');
          }
        },
        {
          label: 'Exportar PDF',
          icon: FileText,
          onClick: () => exportTicketsToPDF(tickets, 'Relatório Geral de Tickets')
        }
      ]
    },
    {
      title: 'Usuários',
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      description: 'Listagem de todos os usuários cadastrados e seus respectivos cargos.',
      actions: [
        {
          label: 'Exportar Excel',
          icon: FileSpreadsheet,
          onClick: () => {
            const data = users.map(u => ({
              Nome: u.name,
              Email: u.email,
              Cargo: u.role,
              Telefone: u.phone || '-',
              WhatsApp: u.whatsapp || '-'
            }));
            exportToExcel(data, 'Relatorio_Usuarios');
            toast.success('Excel de usuários gerado!');
          }
        },
        {
          label: 'Exportar PDF',
          icon: FileText,
          onClick: () => exportUsersToPDF(users, 'Relatório de Usuários')
        }
      ]
    },
    {
      title: 'Organizações',
      icon: Building2,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10',
      description: 'Dados das empresas e clientes corporativos registrados.',
      actions: [
        {
          label: 'Exportar Excel',
          icon: FileSpreadsheet,
          onClick: () => {
            const data = organizations.map(o => ({
              Nome: o.name,
              Contato: o.contactPerson || '-',
              Email: o.email || '-',
              Telefone: o.phone || '-',
              Plataformas: o.platforms ? o.platforms.length : 0
            }));
            exportToExcel(data, 'Relatorio_Organizacoes');
            toast.success('Excel de organizações gerado!');
          }
        },
        {
          label: 'Exportar PDF',
          icon: FileText,
          onClick: () => exportOrganizationsToPDF(organizations, 'Relatório de Organizações')
        }
      ]
    },
    {
      title: 'Logs de Acesso',
      icon: ShieldCheck,
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      description: 'Histórico completo de acessos e ações realizadas pelos usuários.',
      actions: [
        {
          label: 'Exportar Excel',
          icon: FileSpreadsheet,
          onClick: () => {
            const data = accessLogs.map(l => ({
              Usuário: l.userName,
              Email: l.userEmail,
              Ação: l.action,
              IP: l.ip,
              Timestamp: format(l.timestamp, 'dd/MM/yyyy HH:mm')
            }));
            exportToExcel(data, 'Relatorio_Acessos');
            toast.success('Excel de logs gerado!');
          }
        },
        {
          label: 'Exportar PDF',
          icon: FileText,
          onClick: () => exportAccessLogsToPDF(accessLogs, 'Relatório de Logs de Acesso')
        }
      ]
    },
    {
      title: 'Plataformas',
      icon: Monitor,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      description: 'Relatório de sistemas e ambientes cadastrados.',
      actions: [
        {
          label: 'Exportar Excel',
          icon: FileSpreadsheet,
          onClick: () => {
            const data = platforms.map(p => ({
              Nome: p.name,
              URL: p.url,
              Ambiente: p.env
            }));
            exportToExcel(data, 'Relatorio_Plataformas');
            toast.success('Excel de plataformas gerado!');
          }
        },
        {
          label: 'Exportar PDF',
          icon: FileText,
          onClick: () => exportPlatformsToPDF(platforms, 'Relatório de Plataformas')
        }
      ]
    },
    {
      title: 'Categorias',
      icon: Tag,
      color: 'text-pink-400',
      bgColor: 'bg-pink-400/10',
      description: 'Listagem de categorias e tipos de chamados.',
      actions: [
        {
          label: 'Exportar Excel',
          icon: FileSpreadsheet,
          onClick: () => {
            const data = categories.map(c => ({
              Nome: c.name,
              Descrição: c.desc
            }));
            exportToExcel(data, 'Relatorio_Categorias');
            toast.success('Excel de categorias gerado!');
          }
        },
        {
          label: 'Exportar PDF',
          icon: FileText,
          onClick: () => exportCategoriesToPDF(categories, 'Relatório de Categorias')
        }
      ]
    }
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-discord-darkest p-4 md:p-8 pb-24 md:pb-32">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-discord-text">Central de Relatórios</h2>
          <p className="text-discord-muted mt-1">Gere e exporte dados gerenciais de todas as rotinas do sistema.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportSections.map((section, idx) => (
            <div 
              key={idx}
              className="bg-discord-dark rounded-xl border border-discord-border p-6 flex flex-col h-full hover:border-discord-accent/30 transition-all group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 ${section.bgColor} ${section.color} rounded-xl flex items-center justify-center shrink-0`}>
                  <section.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-discord-text">{section.title}</h3>
              </div>
              
              <p className="text-discord-muted text-sm mb-8 flex-1">
                {section.description}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {section.actions.map((action, aIdx) => (
                  <button
                    key={aIdx}
                    onClick={action.onClick}
                    className="flex items-center justify-center gap-2 py-2.5 bg-discord-darkest hover:bg-discord-hover text-discord-text text-[10px] font-bold uppercase tracking-widest rounded border border-discord-border transition-all"
                  >
                    <action.icon className="w-3.5 h-3.5" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-8 bg-discord-accent/5 rounded-2xl border border-discord-accent/20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-bold text-discord-text">Exportação Completa</h3>
            <p className="text-discord-muted mt-1">Deseja um backup completo de todos os dados de cadastro?</p>
          </div>
          <button 
            onClick={() => {
              const allData = [
                ...organizations.map(o => ({ Tipo: 'Organização', Nome: o.name, Contato: o.contactPerson || '-', Email: o.email || '-' })),
                ...users.map(u => ({ Tipo: 'Usuário', Nome: u.name, Email: u.email, Cargo: u.role })),
                ...platforms.map(p => ({ Tipo: 'Plataforma', Nome: p.name, URL: p.url, Ambiente: p.env })),
                ...categories.map(c => ({ Tipo: 'Categoria', Nome: c.name, Descrição: c.desc }))
              ];
              exportToExcel(allData, 'Backup_Geral_Sistema');
              toast.success('Backup geral exportado com sucesso!');
            }}
            className="px-8 py-3 bg-discord-accent text-white font-bold uppercase tracking-widest rounded-lg hover:bg-discord-accent/90 transition-all flex items-center gap-3 shadow-lg shadow-discord-accent/20"
          >
            <Download className="w-5 h-5" />
            Exportar Tudo (Excel)
          </button>
        </div>
      </div>
    </div>
  );
};
