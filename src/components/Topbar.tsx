import React from 'react';
import { Search, Filter, Bell, Menu } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface TopbarProps {
  title: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onMenuClick?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ title, searchQuery, setSearchQuery, onMenuClick }) => {
  return (
    <header className="h-16 bg-discord-dark border-b border-discord-border flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3 md:gap-4">
        {onMenuClick && (
          <button 
            onClick={onMenuClick}
            className="md:hidden p-2 -ml-2 text-discord-muted hover:text-discord-text transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-discord-text font-bold text-base md:text-lg truncate">{title}</h2>
      </div>

      <div className="flex items-center gap-4 flex-1 max-w-md ml-4 md:ml-8">
        <div className="relative w-full hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-discord-muted" />
          <input
            type="text"
            placeholder="Buscar por número ou assunto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-discord-darkest border-none rounded-md py-1.5 pl-10 pr-4 text-sm text-discord-text placeholder:text-discord-muted focus:ring-1 focus:ring-discord-accent transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-3 ml-2 md:ml-4">
        <button 
          className="sm:hidden p-2 text-discord-muted hover:text-discord-text transition-colors"
        >
          <Search className="w-5 h-5" />
        </button>
        <button 
          onClick={() => toast.info('Filtros avançados em desenvolvimento')}
          className="p-2 text-discord-muted hover:text-discord-text transition-colors hidden sm:block"
        >
          <Filter className="w-5 h-5" />
        </button>
        <button 
          onClick={() => toast.info('Notificações em desenvolvimento')}
          className="p-2 text-discord-muted hover:text-discord-text transition-colors relative"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-discord-dark"></span>
        </button>
      </div>
    </header>
  );
};
