import React, { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { supabase, supabaseAnonKey, supabaseUrl } from '../supabase';
import { apiUrl } from '../lib/api';
import { User } from '../types';
import logoW from '@/scr_logo/logo-W.png';

interface LoginProps {
  onLogin: (user: User) => void;
}

/** Evita exibir códigos internos na UI */
function humanizeAuthError(raw: string | undefined): string {
  const m = (raw || '').trim();
  if (
    m === 'LOGIN_TIMEOUT' ||
    m === 'GETSESSION_TIMEOUT' ||
    m === 'SETSESSION_TIMEOUT' ||
    m === 'PROFILE_TIMEOUT' ||
    m === 'SESSION_NOT_READY'
  ) {
    return 'Não foi possível concluir a autenticação a tempo. Aguarde alguns segundos e tente novamente.';
  }
  if (m === 'Invalid login credentials' || /invalid login credentials|invalid_grant/i.test(m)) {
    return 'Email ou senha inválidos. Verifique se a senha está correta.';
  }
  if (/fetch|network|failed to fetch|abort/i.test(m)) {
    return 'Falha de conexão. Verifique sua internet e se o servidor está rodando (npm run dev).';
  }
  return m || 'Não foi possível entrar. Tente novamente.';
}

const TOKEN_REQUEST_MS = 120_000;

function isCredentialMessage(msg: string | undefined) {
  return !!msg && /invalid login credentials|invalid_grant|email not confirmed|email address not confirmed/i.test(msg);
}

/** Erros que não devem abrir o painel de debug (senha/e-mail ou confirmação de e-mail). */
function isLoginCredentialUserFacingError(displayError: string): boolean {
  const d = (displayError || '').toLowerCase();
  return (
    d.includes('email ou senha inválidos') ||
    d.includes('invalid login credentials') ||
    d.includes('invalid_grant') ||
    /email not confirmed|email address not confirmed|e-mail não confirmado/i.test(displayError || '')
  );
}

function isRetryableMessage(msg: string | undefined) {
  return (
    !!msg &&
    (msg === 'LOGIN_TIMEOUT' ||
      msg === 'SESSION_NOT_READY' ||
      msg === 'SETSESSION_TIMEOUT' ||
      /network|fetch|abort|failed to fetch/i.test(msg.toLowerCase()))
  );
}

/** Login por HTTP direto ao GoTrue (evita travamentos do signInWithPassword no @supabase/supabase-js). */
async function fetchPasswordGrant(email: string, password: string): Promise<{
  ok: boolean;
  payload: Record<string, unknown>;
  errorMessage: string;
}> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, payload: {}, errorMessage: 'Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).' };
  }

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), TOKEN_REQUEST_MS);

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });

    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      const msg =
        (typeof payload.msg === 'string' && payload.msg) ||
        (typeof payload.error_description === 'string' && payload.error_description) ||
        (typeof payload.error === 'string' && payload.error) ||
        'Invalid login credentials';
      return { ok: false, payload, errorMessage: String(msg) };
    }

    return { ok: true, payload, errorMessage: '' };
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    if (err?.name === 'AbortError') {
      return { ok: false, payload: {}, errorMessage: 'LOGIN_TIMEOUT' };
    }
    return { ok: false, payload: {}, errorMessage: err?.message || 'NETWORK_ERROR' };
  } finally {
    clearTimeout(tid);
  }
}

async function persistGrantSession(payload: Record<string, unknown>): Promise<{
  user: import('@supabase/supabase-js').User | null;
  error: { message: string } | null;
}> {
  const accessToken = payload.access_token as string | undefined;
  const refreshToken = payload.refresh_token as string | undefined;
  if (!accessToken || !refreshToken) {
    return { user: null, error: { message: 'SESSION_NOT_READY' } };
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    const u = payload.user as import('@supabase/supabase-js').User | undefined;
    if (u?.id) {
      return { user: u, error: null };
    }
    return { user: null, error: { message: error.message || 'SESSION_NOT_READY' } };
  }

  const u = data.session?.user ?? (payload.user as import('@supabase/supabase-js').User | undefined) ?? null;
  return { user: u, error: u ? null : { message: 'SESSION_NOT_READY' } };
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  /** Porta/URLs reais do Express (quando 3000 estiver ocupada, o servidor muda de porta). */
  const [localServerUrls, setLocalServerUrls] = useState<string[] | null>(null);

  useEffect(() => {
    fetch(apiUrl('/__meta'))
      .then((r) => (r.ok ? r.json() : null))
      .then((m: { urls?: string[] } | null) => {
        if (m?.urls?.length) setLocalServerUrls(m.urls);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const uiFailsafeTimeout = setTimeout(() => {
      setLoading(false);
      setError(humanizeAuthError('LOGIN_TIMEOUT'));
    }, 130000);

    let loginEmail = email.toLowerCase().trim();
    if (loginEmail === 'admin') {
      loginEmail = 'renan.santos95neves@gmail.com';
    }

    console.time('loginProcess');

    try {
      console.log('Attempting sign in with:', loginEmail);

      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        /* limpar estado local evita “lock” raro do cliente */
      }

      const signInViaBackend = async (pwd: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TOKEN_REQUEST_MS);
        let response: Response;
        try {
          response = await fetch(apiUrl('/api/auth/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: loginEmail, password: pwd }),
            signal: controller.signal,
          });
        } catch (fetchErr: unknown) {
          clearTimeout(timeoutId);
          const fe = fetchErr as { name?: string; message?: string };
          if (fe?.name === 'AbortError') {
            return { user: null, error: { message: 'LOGIN_TIMEOUT' } };
          }
          return { user: null, error: { message: fe?.message || 'NETWORK_ERROR' } };
        }
        clearTimeout(timeoutId);

        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) {
          const errMsg =
            (typeof payload.error === 'string' && payload.error) || 'Invalid login credentials';
          return { user: null, error: { message: errMsg } };
        }

        return persistGrantSession(payload);
      };

      const tryDirectThenPersist = async (pwd: string) => {
        const grant = await fetchPasswordGrant(loginEmail, pwd);
        if (!grant.ok) {
          return { user: null, error: { message: grant.errorMessage } };
        }
        return persistGrantSession(grant.payload);
      };

      let user: import('@supabase/supabase-js').User | null = null;
      let authErr: { message: string } | null = null;

      let attempt = await tryDirectThenPersist(password);
      user = attempt.user;
      authErr = attempt.error;

      if (authErr && isRetryableMessage(authErr.message) && !isCredentialMessage(authErr.message)) {
        attempt = await tryDirectThenPersist(password);
        user = attempt.user;
        authErr = attempt.error;
      }

      if (authErr && isRetryableMessage(authErr.message) && !isCredentialMessage(authErr.message)) {
        attempt = await signInViaBackend(password);
        user = attempt.user;
        authErr = attempt.error;
      }

      if (authErr && isRetryableMessage(authErr.message) && !isCredentialMessage(authErr.message)) {
        const { data, error: sdkErr } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: password.trim(),
        });
        if (sdkErr) {
          authErr = { message: sdkErr.message };
          user = null;
        } else {
          user = data.user;
          authErr = null;
        }
      }

      if (
        authErr?.message === 'Invalid login credentials' &&
        password !== password.trim()
      ) {
        attempt = await tryDirectThenPersist(password.trim());
        user = attempt.user;
        authErr = attempt.error;
      }

      if (authErr) {
        console.error('Auth Error Details:', authErr);
        throw authErr;
      }

      if (!user) {
        throw new Error('No user returned from auth');
      }

      const fallbackName =
        (user.user_metadata?.name as string | undefined) ||
        (user.email?.split('@')[0] as string | undefined) ||
        'Usuário';
      const fallbackRole =
        loginEmail === 'renan@reetech.com.br'
          ? 'ttickett_admin'
          : ((user.user_metadata?.role as User['role'] | undefined) || 'client');
      const tempUser: User = {
        id: user.id,
        email: user.email || loginEmail,
        name: fallbackName,
        role: fallbackRole,
      };
      onLogin(tempUser);

      const runWithTimeout = async <T,>(pending: PromiseLike<T>, timeoutMs: number) => {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('PROFILE_TIMEOUT')), timeoutMs)
        );
        return await Promise.race([Promise.resolve(pending), timeoutPromise]);
      };

      (async () => {
        try {
          console.log('Fetching user doc for ID:', user.id);
          const { data: userDoc, error: userError } = await runWithTimeout(
            supabase
              .from('users')
              .select('id,name,email,role,organizationId,companyId,avatar,phone,whatsapp,observations,createdAt')
              .eq('id', user.id)
              .maybeSingle(),
            12000
          );

          if (userError) {
            console.error('User doc fetch error:', userError);
            return;
          }

          if (userDoc) {
            const { data: mem } = await supabase
              .from('user_organizations')
              .select('"organizationId"')
              .eq('userId', userDoc.id);
            const organizationIds = (mem || []).map((r: any) => r.organizationId).filter(Boolean);
            onLogin({ ...(userDoc as User), organizationIds });
            return;
          }

          const { data: createdUser, error: createUserError } = await runWithTimeout(
            supabase
              .from('users')
              .insert({
                id: user.id,
                email: user.email,
                name: fallbackName,
                role: fallbackRole,
                createdAt: new Date().toISOString(),
              })
              .select('id,name,email,role,organizationId,companyId,avatar,phone,whatsapp,observations,createdAt')
              .single(),
            12000
          );

          if (!createUserError && createdUser) {
            onLogin({ ...(createdUser as User), organizationIds: [] });
          }
        } catch (bgErr) {
          console.warn('Background profile sync failed:', bgErr);
        }
      })();
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Login catch block:', err);
      setError(humanizeAuthError(e?.message));
    } finally {
      clearTimeout(uiFailsafeTimeout);
      console.timeEnd('loginProcess');
      console.log('Login process finished (finally)');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-discord-darkest flex items-center justify-center p-4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-discord-accent/10 via-transparent to-transparent">
      <div className="w-full max-w-[480px] bg-discord-dark p-8 rounded-lg shadow-2xl border border-discord-border">
        <div className="flex flex-col items-center mb-8">
          <img
            src={logoW}
            alt="TTICKETT"
            className="h-12 sm:h-14 w-auto max-w-[min(100%,300px)] object-contain object-center select-none"
            decoding="async"
          />
          <p className="text-discord-muted text-sm mt-4 font-medium text-center">Bem-vindo de volta! Estamos prontos para ajudar.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-black text-discord-muted uppercase tracking-widest mb-2">Usuário ou Email</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-discord-darkest border-none rounded-md p-3 text-discord-text focus:ring-2 focus:ring-discord-accent transition-all outline-none"
              placeholder="Ex: admin ou seu email"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black text-discord-muted uppercase tracking-widest mb-2">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-discord-darkest border-none rounded-md p-3 text-discord-text focus:ring-2 focus:ring-discord-accent transition-all outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-red-600 dark:text-red-400 text-xs font-bold text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-discord-accent hover:bg-discord-accent/90 disabled:opacity-50 text-white font-bold py-3 rounded-md transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-discord-accent/20 active:scale-[0.98]"
          >
            <LogIn className="w-5 h-5" />
            {loading ? 'Entrando...' : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-discord-border/30 text-center">
          <p className="text-[10px] text-discord-muted font-bold uppercase tracking-widest opacity-50">
            Ambiente de Produção • v1.0.0
          </p>
          {error && !isLoginCredentialUserFacingError(error) && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400 font-medium text-left">
              <p className="font-bold mb-1 uppercase tracking-tighter">Debug Info:</p>
              {localServerUrls?.[0] && (
                <p className="opacity-90 break-all mt-1">
                  App local (use esta URL se a conexão falhar): <span className="text-discord-text">{localServerUrls[0]}</span>
                </p>
              )}
              <p className="opacity-70 break-all mt-1">Supabase: {import.meta.env.VITE_SUPABASE_URL ? String(import.meta.env.VITE_SUPABASE_URL) : "Não configurado"}</p>
              <p className="opacity-70 mt-1">Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? "Configurada (oculta)" : "Não configurada"}</p>
              <p className="opacity-70 mt-1">
                Use <code className="text-discord-muted">npm run dev</code> e a URL que o terminal mostrar (porta pode ser 3001 se 3000 estiver ocupada).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
