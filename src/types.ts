import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type TicketStatus = 'Aberto' | 'Pendente' | 'Em atendimento' | 'Resolvido' | 'Fechado' | 'Cancelado';

export type TicketUrgency = 'Baixa' | 'Média' | 'Alta' | 'Crítica';

export type Platform = string;

export interface Company {
  id: string;
  name: string;
  observations?: string;
  /** Endereço que recebe e-mails para tickets (escopo empresa). */
  supportEmail?: string;
  /** Organização padrão para tickets abertos por e-mail. */
  defaultOrganizationId?: string;
  /** Nome exibido no remetente das respostas (ex.: "Suporte ACME"). */
  emailFromName?: string;
  createdAt?: Date;
}

export interface Organization {
  id: string;
  name: string;
  companyId?: string;
  platforms: string[];
  categories: string[];
  address?: string;
  phone?: string;
  contactPerson?: string;
  email?: string;
  observations?: string;
}

export interface PlatformType {
  id: string;
  name: string;
  url: string;
  env: string;
}

export interface CategoryType {
  id: string;
  name: string;
  desc: string;
}

export interface AccessLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  ip: string;
  timestamp: Date;
}

export interface Message {
  id: string;
  author: string;
  authorRole: 'client' | 'agent' | 'admin' | 'ttickett_admin';
  content: string;
  timestamp: Date;
  isInternal?: boolean;
  /** Origem da mensagem quando integração e-mail. */
  source?: 'app' | 'email';
  emailMessageId?: string;
  attachment?: {
    name: string;
    url: string;
    type: 'image' | 'file';
  };
}

export interface Ticket {
  id: string;
  number: string;
  requester: string;
  requesterEmail: string;
  requesterUid?: string;
  organizationId?: string;
  companyId?: string;
  /** app (painel) | email */
  source?: string;
  emailRootMessageId?: string;
  emailLastMessageId?: string;
  platform: Platform;
  category?: string;
  subject: string;
  description: string;
  status: TicketStatus;
  urgency: TicketUrgency;
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;
  estimatedDeadline?: Date;
  messages: Message[];
  attachment?: {
    name: string;
    url: string;
    type: 'image' | 'file';
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'client' | 'agent' | 'admin' | 'ttickett_admin';
  avatar?: string;
  companyId?: string;
  /** Legado (single-org). Manter até remover do banco. */
  organizationId?: string;
  /** Novo escopo multi-org (se vazio/undefined, acesso global conforme papel). */
  organizationIds?: string[];
  phone?: string;
  whatsapp?: string;
  observations?: string;
  createdAt?: Date;
}
