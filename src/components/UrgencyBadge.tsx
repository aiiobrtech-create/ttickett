import React from 'react';
import { cn } from '../lib/utils';
import { TicketUrgency } from '../types';

interface UrgencyBadgeProps {
  urgency: TicketUrgency;
  className?: string;
}

export const UrgencyBadge: React.FC<UrgencyBadgeProps> = ({ urgency, className }) => {
  const styles = {
    'Baixa': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'Média': 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    'Alta': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    'Crítica': 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse',
  };

  return (
    <span className={cn(
      "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter border",
      styles[urgency],
      className
    )}>
      {urgency}
    </span>
  );
};
