import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
}

/** Opções explícitas reduzem comportamentos estranhos de storage/refresh em alguns navegadores. */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export const testConnection = async () => {
  try {
    console.log('[Supabase Test] Starting connection diagnostics...');
    if (!supabaseUrl || !supabaseAnonKey) {
      return 'invalid_key';
    }
    
    // 1. Test Auth API (best-effort, sem travar a UX)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const authHealth = await fetch(`${supabaseUrl}/auth/v1/health`, {
      signal: controller.signal
    }).catch((err) => {
      console.warn('[Supabase Test] Auth health fetch failed or timed out:', err.message);
      return null;
    });
    
    clearTimeout(timeoutId);
    
    const isAuthAlive = !!(authHealth && authHealth.ok);
    console.log(`[Supabase Test] Auth API Health: ${isAuthAlive ? 'OK' : (authHealth ? 'FAILED (' + authHealth.status + ')' : 'OFFLINE/TIMEOUT')}`);

    if (authHealth && authHealth.status === 401) {
      const body = (await authHealth.text().catch(() => '')).toLowerCase();
      if (body.includes('invalid') && body.includes('api')) {
        return 'invalid_key';
      }
    }

    if (!isAuthAlive && authHealth) {
      // Só considera offline quando houve resposta HTTP explícita não-autorizada.
      if (authHealth.status >= 500) {
        return 'offline';
      }
    }

    // 2. Quick check on Data API using a simple fetch instead of the client
    // to avoid potential client-side hanging logic
    const dataController = new AbortController();
    const dataTimeoutId = setTimeout(() => dataController.abort(), 8000);
    
    const dataHealth = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: { 
        'apikey': supabaseAnonKey
      },
      signal: dataController.signal
    }).catch(() => null);
    
    clearTimeout(dataTimeoutId);
    console.log(`[Supabase Test] Data API Health: ${dataHealth && dataHealth.ok ? 'OK' : (dataHealth ? 'FAILED (' + dataHealth.status + ')' : 'OFFLINE/TIMEOUT')}`);

    if (dataHealth && dataHealth.status === 401) {
      const body = (await dataHealth.text().catch(() => '')).toLowerCase();
      if (body.includes('invalid') && body.includes('api')) {
        return 'invalid_key';
      }
      // 401 sem "invalid key" pode ocorrer por política/autorização e não por chave inválida.
      return 'online';
    }

    if (dataHealth && dataHealth.status === 403) {
      // 403 normalmente indica autorização/RLS, mas conexão e chave estão funcionais.
      return 'online';
    }

    // Timeout/falhas transitórias de health-check não devem bloquear o app.
    return 'online';
  } catch (err: any) {
    console.error('[Supabase Test] Critical connection exception:', err.message);
    return 'online';
  }
};

export const uploadFile = async (file: File, bucket: string = 'tickets') => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file);

  if (error) {
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return {
    name: file.name,
    url: publicUrl,
    type: file.type.startsWith('image/') ? 'image' : 'file'
  } as const;
};
