import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type TicketStatus = 'Aberto' | 'Pendente' | 'Em atendimento' | 'Resolvido' | 'Fechado' | 'Cancelado';

export type TicketUrgency = 'Baixa' | 'Média' | 'Alta' | 'Crítica';

export type Platform = string;

export interface Organization {
  id: string;
  name: string;
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
  authorRole: 'client' | 'agent' | 'admin';
  content: string;
  timestamp: Date;
  isInternal?: boolean;
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
  organizationId?: string;
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
  role: 'client' | 'agent' | 'admin';
  avatar?: string;
  organizationId?: string;
  phone?: string;
  whatsapp?: string;
  observations?: string;
  createdAt?: Date;
}
