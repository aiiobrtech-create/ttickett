import type { User } from '../types';

export type AppRole = User['role'];

export function isStaffRole(role: AppRole): boolean {
  return role === 'agent' || role === 'admin' || role === 'ttickett_admin';
}

/** Administrador de empresa ou TTICKETT (painel operacional ampliado). */
export function isAnyAdministrator(role: AppRole): boolean {
  return role === 'admin' || role === 'ttickett_admin';
}

/** Super administrador: todos os cadastros e tickets. */
export function isTtickettAdministrator(role: AppRole): boolean {
  return role === 'ttickett_admin';
}

/** Agente ou qualquer administrador (mensagens internas / UI). */
export function isStaffLikeRole(role: string | undefined): boolean {
  return role === 'agent' || role === 'admin' || role === 'ttickett_admin';
}
