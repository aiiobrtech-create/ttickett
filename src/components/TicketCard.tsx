import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronRight, Calendar, Monitor, Tag } from 'lucide-react';
import { Ticket } from '../types';
import { StatusBadge } from './StatusBadge';
import { UrgencyBadge } from './UrgencyBadge';

interface TicketCardProps {
  ticket: Ticket;
  onClick: () => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-discord-darker hover:bg-discord-hover border border-discord-border rounded-xl p-4 cursor-pointer transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-discord-muted bg-discord-darkest px-2 py-1 rounded border border-discord-border tracking-tighter">
            {ticket.number}
          </span>
          <StatusBadge status={ticket.status} />
          <UrgencyBadge urgency={ticket.urgency} />
        </div>
        <ChevronRight className="w-4 h-4 text-discord-muted group-hover:text-discord-accent transition-colors" />
      </div>

      <h3 className="text-discord-text font-bold text-base mb-1 line-clamp-1">{ticket.subject}</h3>
      <p className="text-discord-muted text-sm line-clamp-2 mb-4 leading-relaxed">
        {ticket.description}
      </p>

      <div className="flex flex-wrap items-center gap-y-2 gap-x-4 pt-4 border-t border-discord-border">
        <div className="flex items-center gap-1.5 text-[11px] text-discord-muted font-semibold uppercase tracking-wider">
          <Monitor className="w-3.5 h-3.5" />
          {ticket.platform}
        </div>
        {ticket.category && (
          <div className="flex items-center gap-1.5 text-[11px] text-discord-muted font-semibold uppercase tracking-wider">
            <Tag className="w-3.5 h-3.5" />
            {ticket.category}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-discord-muted font-semibold uppercase tracking-wider">
          <Calendar className="w-3.5 h-3.5" />
          {format(ticket.updatedAt, "dd 'de' MMM", { locale: ptBR })}
        </div>
        {ticket.assignee && (
          <div className="flex items-center gap-1.5 text-[11px] text-discord-accent font-bold uppercase tracking-wider ml-auto">
            <div className="w-1.5 h-1.5 rounded-full bg-discord-accent animate-pulse" />
            {ticket.assignee}
          </div>
        )}
      </div>
    </div>
  );
};
