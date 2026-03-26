import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { supabase } from '../supabase';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let loginEmail = email.toLowerCase().trim();
    if (loginEmail === 'admin') {
      loginEmail = 'renan.santos95neves@gmail.com';
    }

    const loginTimeout = setTimeout(() => {
      setLoading(currentLoading => {
        if (currentLoading) {
          console.warn('Login process timed out after 90s');
          setError('O login está demorando mais que o esperado. Verifique sua conexão e tente novamente.');
          return false;
        }
        return currentLoading;
      });
    }, 90000);

    console.time('loginProcess');
    try {
      console.log('Attempting sign in with:', loginEmail);
      
      const signIn = (pwd: string) =>
        supabase.auth.signInWithPassword({
          email: loginEmail,
          password: pwd,
        });

      let { data: authData, error: authError } = await signIn(password);

      console.log('Auth response received. Error:', authError?.message || 'None');
      console.timeLog('loginProcess', 'Auth response received');

      let finalAuthData = authData;
      let finalAuthError = authError;

      // Retry automático para casos comuns de espaço acidental no início/fim da senha.
      if (
        finalAuthError?.message === 'Invalid login credentials' &&
        password !== password.trim()
      ) {
        const retryResult = await signIn(password.trim());
        finalAuthData = retryResult.data;
        finalAuthError = retryResult.error;
      }

      // Retry para falha de rede transitória.
      if (
        finalAuthError?.message?.toLowerCase()?.includes('fetch') ||
        finalAuthError?.message?.toLowerCase()?.includes('network')
      ) {
        const retryResult = await signIn(password.trim());
        finalAuthData = retryResult.data;
        finalAuthError = retryResult.error;
      }

      if (finalAuthError) {
        console.error('Auth Error Details:', authError);
        throw finalAuthError;
      }

      if (!finalAuthData.user) {
        throw new Error('No user returned from auth');
      }

      console.log('Fetching user doc for ID:', finalAuthData.user.id);
      const { data: userDoc, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', finalAuthData.user.id)
        .maybeSingle();
      
      console.log('User doc response received. Error:', userError?.message || 'None');
      console.timeLog('loginProcess', 'User doc response received');
      
      if (userError) {
        console.error('User doc fetch error:', userError);
        throw new Error('Erro ao buscar perfil do usuário: ' + userError.message);
      }

      let finalUserDoc = userDoc;
      if (!finalUserDoc) {
        console.warn('User doc not found in public.users for ID:', finalAuthData.user.id, 'Creating a default profile...');
        const fallbackName =
          (finalAuthData.user.user_metadata?.name as string | undefined) ||
          (finalAuthData.user.email?.split('@')[0] as string | undefined) ||
          'Usuário';

        const { data: createdUser, error: createUserError } = await supabase
          .from('users')
          .insert({
            id: finalAuthData.user.id,
            email: finalAuthData.user.email,
            name: fallbackName,
            role: 'client',
            createdAt: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (createUserError) {
          throw new Error('Usuário autenticado, mas não foi possível criar perfil: ' + createUserError.message);
        }

        finalUserDoc = createdUser;
      }

      console.log('Login successful, calling onLogin');
      onLogin(finalUserDoc as User);
    } catch (err: any) {
      console.error('Login catch block:', err);
      if (err.message === 'Invalid login credentials') {
        setError('Email ou senha inválidos. Verifique se a senha está correta.');
      } else {
        setError(err.message || 'Credenciais inválidas ou erro ao conectar.');
      }
    } finally {
      console.timeEnd('loginProcess');
      console.log('Login process finished (finally)');
      clearTimeout(loginTimeout);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-discord-darkest flex items-center justify-center p-4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-discord-accent/10 via-transparent to-transparent">
      <div className="w-full max-w-[480px] bg-discord-dark p-8 rounded-lg shadow-2xl border border-discord-border">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-black text-discord-text tracking-tight">TTICKETT</h1>
          <p className="text-discord-muted text-sm mt-2 font-medium">Bem-vindo de volta! Estamos prontos para ajudar.</p>
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
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400 font-medium text-left">
              <p className="font-bold mb-1 uppercase tracking-tighter">Debug Info:</p>
              <p className="opacity-70 break-all">URL: {import.meta.env.VITE_SUPABASE_URL ? String(import.meta.env.VITE_SUPABASE_URL) : "Não configurado"}</p>
              <p className="opacity-70 mt-1">Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? "Configurada (oculta)" : "Não configurada"}</p>
              <p className="opacity-70 mt-1">Se o erro for 401 "Access to schema is forbidden", verifique se as chaves no Supabase Dashboard não foram alteradas ou se o projeto não foi resetado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
