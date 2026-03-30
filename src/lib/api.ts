/**
 * URL base das rotas Express (`/api/*`). Vazio = mesmo host do front (npm run dev / deploy unificado).
 * Defina `VITE_API_BASE` se o front estático for servido de outro domínio que o backend.
 */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE as string | undefined;
  if (!raw || !String(raw).trim()) return '';
  return String(raw).trim().replace(/\/$/, '');
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBase()}${p}`;
}
