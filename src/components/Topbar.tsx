import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Filter, Bell, Menu } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export interface TopbarNotification {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  unread: boolean;
}

interface TopbarProps {
  title: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onMenuClick?: () => void;
  notifications?: TopbarNotification[];
  onNotificationClick?: (notification: TopbarNotification) => void;
  onMarkAllNotificationsRead?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  searchQuery,
  setSearchQuery,
  onMenuClick,
  notifications = [],
  onNotificationClick,
  onMarkAllNotificationsRead,
}) => {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!notificationRef.current) return;
      if (!notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    if (isNotificationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationOpen]);

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
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setIsNotificationOpen((prev) => !prev)}
            className="p-2 text-discord-muted hover:text-discord-text transition-colors relative"
            aria-label="Abrir notificações"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[9px] leading-4 text-center rounded-full border border-discord-dark">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotificationOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-discord-darker border border-discord-border rounded-lg shadow-2xl z-50">
              <div className="p-3 border-b border-discord-border flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-discord-text">
                  Notificações
                </p>
                <button
                  onClick={() => onMarkAllNotificationsRead?.()}
                  className="text-[10px] font-bold uppercase tracking-wider text-discord-muted hover:text-discord-text transition-colors"
                >
                  Marcar todas como lidas
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-4 text-xs text-discord-muted text-center">
                    Nenhuma notificação no momento.
                  </p>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => {
                        onNotificationClick?.(notification);
                        setIsNotificationOpen(false);
                      }}
                      className={cn(
                        "w-full text-left p-3 border-b border-discord-border/40 last:border-b-0 hover:bg-discord-hover transition-colors",
                        notification.unread && "bg-discord-dark/50"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-1.5 w-2 h-2 rounded-full shrink-0",
                            notification.unread ? "bg-discord-accent" : "bg-transparent"
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-discord-text truncate">
                            {notification.title}
                          </p>
                          <p className="text-[11px] text-discord-muted mt-1 line-clamp-2">
                            {notification.description}
                          </p>
                          <p className="text-[10px] text-discord-muted/80 mt-1">
                            {notification.createdAt.toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
