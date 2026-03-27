import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Bell, Menu } from 'lucide-react';
import { cn } from '../lib/utils';

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

  const unreadCount = useMemo(() => notifications.filter((n) => n.unread).length, [notifications]);

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

  const searchField = (
    <div className="relative w-full min-w-0">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-discord-muted" />
      <input
        type="search"
        placeholder="Buscar por número ou assunto..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        enterKeyHint="search"
        className="w-full min-w-0 bg-discord-darkest border-none rounded-md py-2 pl-10 pr-3 text-sm text-discord-text placeholder:text-discord-muted focus:ring-1 focus:ring-discord-accent transition-all"
      />
    </div>
  );

  return (
    <header className="shrink-0 bg-discord-dark border-b border-discord-border z-30">
      <div
        className={cn(
          'w-full min-w-0 max-w-[100vw] px-3 sm:px-4 md:px-6 py-3 md:py-2 md:min-h-16',
          'grid gap-x-2 gap-y-3 md:gap-x-4 md:items-center',
          'grid-cols-[auto_minmax(0,1fr)_auto]',
          'md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto]'
        )}
      >
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="col-start-1 row-start-1 md:hidden p-2 -ml-1 text-discord-muted hover:text-discord-text transition-colors rounded-md hover:bg-discord-hover/80 self-center justify-self-start"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <h2
          className={cn(
            'row-start-1 md:col-start-1 md:row-start-1',
            onMenuClick ? 'col-start-2' : 'col-start-1',
            'min-w-0 truncate text-sm sm:text-base md:text-lg font-bold text-discord-text self-center'
          )}
        >
          {title}
        </h2>

        <div
          className="col-start-3 row-start-1 md:col-start-3 md:row-start-1 relative justify-self-end self-center"
          ref={notificationRef}
        >
          <button
            type="button"
            onClick={() => setIsNotificationOpen((prev) => !prev)}
            className="p-2 text-discord-muted hover:text-discord-text transition-colors relative shrink-0 rounded-md hover:bg-discord-hover/80"
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
            <div className="absolute right-0 mt-2 w-80 max-w-[min(100vw-2rem,20rem)] sm:max-w-[min(100vw-3rem,24rem)] bg-discord-darker border border-discord-border rounded-lg shadow-2xl z-50">
              <div className="p-3 border-b border-discord-border flex items-center justify-between gap-2 min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-discord-text truncate">
                  Notificações
                </p>
                <button
                  type="button"
                  onClick={() => onMarkAllNotificationsRead?.()}
                  className="text-[10px] font-bold uppercase tracking-wider text-discord-muted hover:text-discord-text transition-colors shrink-0"
                >
                  Marcar lidas
                </button>
              </div>

              <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-4 text-xs text-discord-muted text-center">
                    Nenhuma notificação no momento.
                  </p>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => {
                        onNotificationClick?.(notification);
                        setIsNotificationOpen(false);
                      }}
                      className={cn(
                        'w-full text-left p-3 border-b border-discord-border/40 last:border-b-0 hover:bg-discord-hover transition-colors',
                        notification.unread && 'bg-discord-dark/50'
                      )}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span
                          className={cn(
                            'mt-1.5 w-2 h-2 rounded-full shrink-0',
                            notification.unread ? 'bg-discord-accent' : 'bg-transparent'
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-discord-text truncate">{notification.title}</p>
                          <p className="text-[11px] text-discord-muted mt-1 line-clamp-2 break-words">
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

        <div
          className={cn(
            'col-span-3 row-start-2 min-w-0',
            'md:col-span-1 md:col-start-2 md:row-start-1 md:row-span-1'
          )}
        >
          {searchField}
        </div>
      </div>
    </header>
  );
};
