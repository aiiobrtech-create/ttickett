import React from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Ticket as TicketIcon, 
  LogOut, 
  Users,
  Settings,
  Database,
  BarChart3,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User } from '../types';
import { isAnyAdministrator, isTtickettAdministrator } from '../lib/roles';
import { AvatarDisplay } from './AvatarDisplay';

interface SidebarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, activeTab, setActiveTab, onLogout, isOpen, onClose }) => {
  const isAgent = user.role === 'agent';
  const isElevatedAdmin = isAnyAdministrator(user.role);
  const canManage = isAgent || isElevatedAdmin;

  const menuItems = [
    {
      id: 'dashboard',
      label: isTtickettAdministrator(user.role)
        ? 'Todos os Tickets'
        : user.role === 'admin'
          ? 'Tickets da Empresa'
          : isAgent
            ? 'Central de Atendimento'
            : 'Meus Tickets',
      icon: TicketIcon,
    },
    { id: 'new-ticket', label: 'Novo Ticket', icon: PlusCircle, hidden: isAgent },
    { id: 'registrations', label: 'Cadastros', icon: Database, hidden: !isElevatedAdmin },
    { id: 'reports', label: 'Relatórios', icon: BarChart3, hidden: !isElevatedAdmin },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[min(16rem,85vw)] md:w-64 shrink-0 bg-discord-sidebar flex flex-col h-full min-h-0 max-h-[100dvh] border-r border-discord-border transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 border-b border-discord-border flex items-center justify-between">
          <h1 className="font-extrabold text-lg tracking-tight text-discord-text">TTICKETT</h1>
          <button onClick={onClose} className="md:hidden text-discord-muted hover:text-discord-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.filter(item => !item.hidden).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                onClose();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group",
                activeTab === item.id 
                  ? "bg-discord-active text-discord-text" 
                  : "text-discord-muted hover:bg-discord-hover hover:text-discord-text"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-colors shrink-0",
                activeTab === item.id ? "text-discord-text" : "text-discord-muted group-hover:text-discord-text"
              )} />
              <span className="font-semibold text-sm truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 bg-discord-hover/50 mt-auto border-t border-discord-border">
          <div className="flex items-center gap-3 p-2 rounded-md bg-discord-active/30 mb-3">
            <AvatarDisplay user={user} className="w-8 h-8" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-discord-text truncate">{user.name}</p>
              <p className="text-[10px] text-discord-muted truncate uppercase tracking-wider">
                {user.role === 'ttickett_admin'
                  ? 'Admin. TTICKETT'
                  : user.role === 'admin'
                    ? 'Administrador'
                    : user.role === 'agent'
                      ? 'Atendente'
                      : 'Cliente'}
              </p>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="font-bold text-xs uppercase tracking-widest">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
};
