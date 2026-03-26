import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, List, FileSpreadsheet, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase, testConnection } from './supabase';
import { exportToExcel, exportTicketsToPDF } from './lib/exportUtils';
import { User, Ticket, TicketStatus, Platform, TicketUrgency } from './types';
import { Login } from './screens/Login';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { TicketCard } from './components/TicketCard';
import { StatusBadge } from './components/StatusBadge';
import { UrgencyBadge } from './components/UrgencyBadge';
import { TicketDetails } from './screens/TicketDetails';
import { NewTicket } from './screens/NewTicket';
import { Settings } from './screens/Settings';
import { Registrations } from './screens/Registrations';
import { Reports } from './screens/Reports';
import { cn } from './lib/utils';
import { Toaster, toast } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'Todos'>('Todos');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [registrationsState, setRegistrationsState] = useState<{
    activeType?: string;
    editingItem?: any;
    viewMode?: 'grid' | 'form' | 'list';
    navigationId?: number;
  }>({});
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('accentColor') || '#5865F2');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'online' | 'offline' | 'invalid_key'>('checking');

  // Global error handlers for better debugging
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("Global JS Error caught:", event.error);
      toast.error(`Erro no Sistema: ${event.message}`, {
        description: "Verifique o console (F12) para mais detalhes.",
        duration: 10000
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled Promise Rejection caught:", event.reason);
      const reason = event.reason;
      let message = "Erro desconhecido";
      if (typeof reason === 'string') {
        message = reason;
      } else if (reason && typeof reason === 'object') {
        message = reason.message || reason.error_description || reason.error || JSON.stringify(reason);
      }
      
      toast.error(`Erro de Conexão/Promessa: ${message}`, {
        description: "Isso pode ser um problema com o Supabase ou rede.",
        duration: 10000
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Supabase Health Check
  useEffect(() => {
    const checkSupabase = async () => {
      try {
        console.log("Checking Supabase health...");
        // testConnection now returns 'online', 'offline', or 'invalid_key'
        const status = await testConnection();
        setSupabaseStatus(status as any);
        
        if (status === 'offline') {
          console.error("Supabase health check failed: offline");
        } else if (status === 'invalid_key') {
          console.error("Supabase health check failed: invalid_key (401)");
        } else {
          console.log("Supabase is online.");
        }
      } catch (err: any) {
        console.error("Supabase health check exception:", err.message);
        setSupabaseStatus('offline');
      }
    };

    checkSupabase();
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      console.log("Starting auth initialization...");
      try {
        // 1. Get Session com timeout para evitar tela de loading presa
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('SESSION_TIMEOUT')), 3000)
        );
        const { data, error: sessionError } = await Promise.race([
          sessionPromise,
          timeoutPromise,
        ]) as Awaited<ReturnType<typeof supabase.auth.getSession>>;
        const session = data?.session;
        
        if (sessionError) {
          console.warn("Auth session fetch failed:", sessionError.message);
          setUser(null);
        } else if (session?.user) {
          console.log("Session found for:", session.user.email);
          
          // 2. We have a basic user, let's set a temporary state to allow the app to load
          // We'll fetch the full profile in the background
          const tempUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuário',
            role: 'client', // Default role until we fetch the doc
            organizationId: '',
            avatar: session.user.user_metadata?.avatar_url
          } as User;
          
          setUser(tempUser);

          // 3. Fetch full profile in background
          const fetchProfile = async () => {
            try {
              const { data: userDoc, error: docError } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (docError) {
                console.warn("Background profile fetch error:", docError.message);
              } else if (userDoc) {
                console.log("Full user profile loaded:", userDoc.email);
                setUser(userDoc as User);
              }
            } catch (e: any) {
              console.warn("Background profile fetch failed:", e.message);
            }
          };
          fetchProfile();
        } else {
          console.log("No active session found.");
          setUser(null);
        }
      } catch (error: any) {
        if (error?.message === 'SESSION_TIMEOUT') {
          console.warn("Auth session fetch timed out. Continuing without blocking UI.");
        } else {
          console.error("Auth init error:", error.message);
        }
        setUser(null);
      } finally {
        console.log("Auth ready.");
        setIsAuthReady(true);
      }
    };

    initAuth();

    // Safety timeout: ensure app loads even if auth init hangs indefinitely
    const timeout = setTimeout(() => {
      setIsAuthReady(current => {
        if (!current) {
          console.warn("Auth initialization safety timeout reached.");
          toast.warning("A inicialização está demorando...", {
            description: "O sistema tentará carregar assim mesmo. Verifique sua conexão se os dados não aparecerem."
          });
          return true;
        }
        return current;
      });
    }, 5000);

    const authResponse = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event, session?.user?.email);
      try {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const { data: userDoc, error } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (error) {
              console.error("Error fetching user doc on auth change:", error);
            } else if (userDoc) {
              setUser(userDoc as User);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      } catch (err) {
        console.error("Exception in onAuthStateChange callback:", err);
      } finally {
        setIsAuthReady(true);
      }
    });

    const subscription = authResponse?.data?.subscription;

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--discord-accent', accentColor);
    localStorage.setItem('accentColor', accentColor);
  }, [accentColor]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const handleLogin = (loggedInUser: User) => {
    console.log('App: handleLogin called with:', loggedInUser.email);
    setUser(loggedInUser);
    setActiveTab('dashboard');
  };

  const handleUpdateUser = (updatedUser: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updatedUser } : null);
  };

  const handleUpdateAccentColor = (color: string) => {
    setAccentColor(color);
  };

  const handleUpdateTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSelectedTicketId(null);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const allowedTickets = useMemo(() => {
    if (!user) return [];
    if (user.role === 'client') {
      if (user.organizationId) {
        return tickets.filter(t => t.organizationId === user.organizationId && t.requesterEmail === user.email);
      } else {
        return tickets.filter(t => t.requesterEmail === user.email);
      }
    }
    if (user.role === 'agent') {
      return tickets.filter(t => t.assignee === user.name);
    }
    return tickets;
  }, [tickets, user]);

  const filteredTickets = useMemo(() => {
    let result = allowedTickets;

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.number.toLowerCase().includes(q) || 
        t.subject.toLowerCase().includes(q)
      );
    }

    // Filter by status
    if (statusFilter !== 'Todos') {
      result = result.filter(t => t.status === statusFilter);
    }

    return result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [allowedTickets, searchQuery, statusFilter]);

  const selectedTicket = useMemo(() => 
    allowedTickets.find(t => t.id === selectedTicketId), 
  [allowedTickets, selectedTicketId]);

  useEffect(() => {
    if (!user) {
      setTickets([]);
      return;
    }

    const fetchTickets = async () => {
      try {
        const { data, error } = await supabase.from('tickets').select('*');
        if (error) {
          console.error("Error fetching tickets:", error);
          toast.error("Erro ao carregar tickets", { description: error.message });
          return;
        }
        setTickets((data || []).map(t => ({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
          estimatedDeadline: t.estimatedDeadline ? new Date(t.estimatedDeadline) : undefined,
          messages: (t.messages || []).map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        })));
      } catch (err: any) {
        console.error("Exception in fetchTickets:", err);
        toast.error("Erro de conexão ao buscar tickets");
      }
    };

    fetchTickets();
  }, [user]);

  const handleCreateTicket = async (data: { 
    subject: string; 
    description: string; 
    platform: Platform;
    category: string;
    urgency: TicketUrgency;
    estimatedDeadline?: Date;
    attachment?: { name: string; url: string; type: 'image' | 'file' }
  }) => {
    if (!user) return;
    
    const newTicket = {
      number: `TK-${1000 + tickets.length + 1}`,
      requester: user.name,
      requesterEmail: user.email,
      requesterUid: user.id,
      organizationId: user.organizationId || null,
      platform: data.platform,
      category: data.category,
      subject: data.subject,
      description: data.description,
      status: 'Aberto',
      urgency: data.urgency,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      attachment: data.attachment || null
    };

    try {
      const { error } = await supabase.from('tickets').insert(newTicket);
      if (error) throw error;
      setActiveTab('dashboard');
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast.error("Erro ao criar ticket");
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    try {
      const { error } = await supabase.from('tickets').update({
        status,
        updatedAt: new Date().toISOString()
      }).eq('id', ticketId);
      if (error) throw error;
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleUpdateTicketAssignee = async (ticketId: string, assignee: string) => {
    try {
      const { error } = await supabase.from('tickets').update({
        assignee,
        updatedAt: new Date().toISOString()
      }).eq('id', ticketId);
      if (error) throw error;
    } catch (error) {
      console.error("Error updating assignee:", error);
      toast.error("Erro ao atualizar responsável");
    }
  };

  const handleUpdateEstimatedDeadline = async (ticketId: string, date: Date | undefined) => {
    try {
      const { error } = await supabase.from('tickets').update({
        estimatedDeadline: date ? date.toISOString() : null,
        updatedAt: new Date().toISOString()
      }).eq('id', ticketId);
      if (error) throw error;
    } catch (error) {
      console.error("Error updating deadline:", error);
      toast.error("Erro ao atualizar prazo");
    }
  };

  const handleAddMessage = async (
    ticketId: string, 
    content: string, 
    isInternal: boolean = false, 
    attachment?: { name: string; url: string; type: 'image' | 'file' }
  ) => {
    if (!user) return;

    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const newMessage = {
      id: `m${Date.now()}`,
      author: user.name,
      authorRole: user.role,
      authorUid: user.id,
      content,
      timestamp: new Date().toISOString(),
      isInternal,
      attachment: attachment || null
    };

    try {
      const { error } = await supabase.from('tickets').update({
        messages: [...(ticket.messages || []), newMessage],
        updatedAt: new Date().toISOString()
      }).eq('id', ticketId);
      if (error) throw error;
    } catch (error) {
      console.error("Error adding message:", error);
      toast.error("Erro ao enviar mensagem");
    }
  };

  console.log("App Render State:", { isAuthReady, user: !!user, supabaseStatus });

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-discord-darkest flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-discord-accent/20 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-discord-accent border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-discord-text font-black uppercase tracking-widest text-sm">Carregando Sistema</p>
          <div className="flex flex-col items-center gap-1">
            <p className="text-discord-muted text-[10px] uppercase tracking-wider">
              {supabaseStatus === 'checking' ? 'Verificando conexão com Supabase...' : 
               supabaseStatus === 'offline' ? 'Supabase Offline ou Lento' : 
               supabaseStatus === 'invalid_key' ? 'Chave de API Inválida (401)' :
               'Inicializando autenticação...'}
            </p>
            {supabaseStatus === 'offline' && (
              <p className="text-red-400 text-[9px] max-w-xs">
                O projeto Supabase pode estar pausado ou inacessível.
              </p>
            )}
            {supabaseStatus === 'invalid_key' && (
              <div className="text-red-400 text-[9px] max-w-xs space-y-1">
                <p>A VITE_SUPABASE_ANON_KEY está incorreta ou expirada.</p>
                <p>Verifique as variáveis de ambiente no menu de configurações.</p>
              </div>
            )}
          </div>
        </div>
        
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-discord-darker hover:bg-discord-hover text-discord-muted hover:text-discord-text text-[10px] font-black uppercase tracking-widest rounded border border-discord-border transition-all"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const statuses: (TicketStatus | 'Todos')[] = ['Todos', 'Pendente', 'Aberto', 'Em atendimento', 'Resolvido', 'Fechado', 'Cancelado'];

  return (
    <div className="flex h-screen bg-discord-darkest overflow-hidden">
      <Toaster position="top-right" richColors theme={theme === 'dark' ? 'dark' : 'light'} />
      <Sidebar 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedTicketId(null);
          if (tab === 'registrations') {
            setRegistrationsState({});
          }
        }} 
        onLogout={handleLogout}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <AnimatePresence mode="wait">
          {selectedTicket ? (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0"
            >
              <TicketDetails 
                ticket={selectedTicket}
                currentUser={user}
                onBack={() => setSelectedTicketId(null)}
                onUpdateStatus={(status) => handleUpdateTicketStatus(selectedTicket.id, status)}
                onUpdateAssignee={(assignee) => handleUpdateTicketAssignee(selectedTicket.id, assignee)}
                onUpdateEstimatedDeadline={(date) => handleUpdateEstimatedDeadline(selectedTicket.id, date)}
                onAddMessage={(content, isInternal, attachment) => handleAddMessage(selectedTicket.id, content, isInternal, attachment)}
                onNavigateToRegistration={(type, item, mode) => {
                  setRegistrationsState({ 
                    activeType: type, 
                    editingItem: item, 
                    viewMode: mode as any,
                    navigationId: Date.now()
                  });
                  setSelectedTicketId(null);
                  setActiveTab('registrations');
                }}
              />
            </motion.div>
          ) : activeTab === 'new-ticket' ? (
            <motion.div
              key="new"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col flex-1 min-h-0"
            >
              <NewTicket 
                currentUser={user}
                onCancel={() => setActiveTab('dashboard')}
                onSubmit={handleCreateTicket}
              />
            </motion.div>
          ) : activeTab === 'settings' ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0"
            >
              <Topbar 
                title="Configurações do Sistema" 
                searchQuery="" 
                setSearchQuery={() => {}} 
                onMenuClick={() => setIsMobileMenuOpen(true)}
              />
              <Settings 
                currentUser={user} 
                onUpdateUser={handleUpdateUser}
                accentColor={accentColor}
                onUpdateAccentColor={handleUpdateAccentColor}
                theme={theme}
                onUpdateTheme={handleUpdateTheme}
              />
            </motion.div>
          ) : activeTab === 'registrations' ? (
            <motion.div
              key="registrations"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0"
            >
              <Topbar 
                title="Cadastros" 
                searchQuery="" 
                setSearchQuery={() => {}} 
                onMenuClick={() => setIsMobileMenuOpen(true)}
              />
              <Registrations 
                key={`registrations-${registrationsState.navigationId || 0}`}
                initialActiveType={registrationsState.activeType}
                initialEditingItem={registrationsState.editingItem}
                initialViewMode={registrationsState.viewMode}
                currentUser={user}
                onBackToDashboard={() => setActiveTab('dashboard')}
              />
            </motion.div>
          ) : activeTab === 'reports' && user.role === 'admin' ? (
            <motion.div
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col flex-1 min-h-0"
            >
              <Topbar 
                title="Central de Relatórios" 
                searchQuery="" 
                setSearchQuery={() => {}} 
                onMenuClick={() => setIsMobileMenuOpen(true)}
              />
              <Reports />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col flex-1 min-h-0"
            >
              <Topbar 
                title={user.role === 'admin' ? "Painel Administrativo" : (user.role === 'agent' ? "Central de Atendimento" : "Meus Chamados")} 
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onMenuClick={() => setIsMobileMenuOpen(true)}
              />
              
              <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-32">
                <div className="max-w-6xl mx-auto">
                  <div className="mb-8">
                    <div className="mb-6">
                      <h2 className="text-xl md:text-2xl font-black text-discord-text tracking-tight uppercase">
                        {user.role === 'admin' ? 'Controle Total de Tickets' : (user.role === 'agent' ? 'Visão Geral dos Tickets' : 'Acompanhe seus Tickets')}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-discord-accent animate-pulse" />
                        <p className="text-discord-muted text-xs md:text-sm font-bold uppercase tracking-widest">
                          {filteredTickets.length} tickets encontrados no total.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-discord-dark/30 p-4 rounded-xl border border-discord-border/50">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1 bg-discord-darker rounded-lg p-1 border border-discord-border shrink-0">
                          <button
                            onClick={() => exportToExcel(filteredTickets.map(t => ({
                              Número: t.number,
                              Assunto: t.subject,
                              Solicitante: t.requester,
                              Email: t.requesterEmail,
                              Status: t.status,
                              Urgência: t.urgency,
                              Aberto: format(t.createdAt, 'dd/MM/yyyy HH:mm'),
                              Responsável: t.assignee || '-'
                            })), 'Relatorio_Tickets')}
                            className="flex items-center gap-2 px-2 py-1.5 rounded text-discord-muted hover:text-discord-text hover:bg-discord-hover transition-all group"
                            title="Exportar Excel"
                          >
                            <FileSpreadsheet className="w-4 h-4 group-hover:text-emerald-400 transition-colors" />
                            <span className="text-[10px] font-black uppercase tracking-tighter">Excel</span>
                          </button>
                          <div className="w-px h-4 bg-discord-border mx-0.5" />
                          <button
                            onClick={() => exportTicketsToPDF(filteredTickets, 'Relatório de Tickets')}
                            className="flex items-center gap-2 px-2 py-1.5 rounded text-discord-muted hover:text-discord-text hover:bg-discord-hover transition-all group"
                            title="Exportar PDF"
                          >
                            <FileText className="w-4 h-4 group-hover:text-red-400 transition-colors" />
                            <span className="text-[10px] font-black uppercase tracking-tighter">PDF</span>
                          </button>
                        </div>

                        <div className="flex items-center bg-discord-darker rounded-lg p-1 border border-discord-border shrink-0">
                          <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                              "p-1.5 rounded transition-all",
                              viewMode === 'grid' ? "bg-discord-active text-discord-text shadow-sm" : "text-discord-muted hover:text-discord-text"
                            )}
                            title="Visualização em Grade"
                          >
                            <LayoutGrid className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                              "p-1.5 rounded transition-all",
                              viewMode === 'list' ? "bg-discord-active text-discord-text shadow-sm" : "text-discord-muted hover:text-discord-text"
                            )}
                            title="Visualização em Lista"
                          >
                            <List className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
                        {statuses.map(status => (
                          <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                              statusFilter === status 
                                ? "bg-discord-accent text-white shadow-lg shadow-discord-accent/20" 
                                : "bg-discord-darker text-discord-muted hover:text-discord-text hover:bg-discord-hover"
                            )}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {filteredTickets.length > 0 ? (
                    statusFilter === 'Todos' ? (
                      <div className="space-y-8">
                        {/* Tickets Pendentes */}
                        <section>
                          <h3 className="text-sm font-bold text-discord-text mb-4 uppercase tracking-widest">Tickets Pendentes</h3>
                          {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {filteredTickets.filter(t => t.status === 'Pendente').map(ticket => (
                                <TicketCard key={ticket.id} ticket={ticket} onClick={() => setSelectedTicketId(ticket.id)} />
                              ))}
                            </div>
                          ) : (
                            <div className="bg-discord-dark rounded-xl border border-discord-border overflow-hidden shadow-xl">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                  <thead>
                                    <tr className="bg-discord-darkest/50">
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Ticket</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Assunto</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Urgência</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Status</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Plataforma</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Solicitante</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Atualizado</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border text-right">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-discord-border">
                                    {filteredTickets.filter(t => t.status === 'Pendente').map(ticket => (
                                      <tr key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)} className="hover:bg-discord-hover transition-colors group cursor-pointer">
                                        <td className="p-4"><span className="text-[10px] font-black text-discord-muted bg-discord-darkest px-2 py-1 rounded border border-discord-border tracking-tighter">{ticket.number}</span></td>
                                        <td className="p-4"><p className="text-discord-text font-bold text-sm truncate max-w-[200px]">{ticket.subject}</p></td>
                                        <td className="p-4"><div className="flex"><UrgencyBadge urgency={ticket.urgency} className="text-[9px] px-2 py-0.5" /></div></td>
                                        <td className="p-4"><div className="flex"><StatusBadge status={ticket.status} className="text-[9px] px-2 py-0.5" /></div></td>
                                        <td className="p-4"><span className="text-discord-muted text-xs font-semibold">{ticket.platform}</span></td>
                                        <td className="p-4"><div className="flex flex-col"><span className="text-discord-text text-xs font-bold">{ticket.requester}</span><span className="text-[10px] text-discord-muted">{ticket.requesterEmail}</span></div></td>
                                        <td className="p-4"><span className="text-discord-muted text-xs">{format(ticket.updatedAt, "dd/MM/yyyy", { locale: ptBR })}</span></td>
                                        <td className="p-4 text-right"><button className="text-discord-accent hover:underline text-[10px] font-black uppercase tracking-widest">Ver Detalhes</button></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </section>

                        {/* Tickets em Aberto */}
                        <section>
                          <h3 className="text-sm font-bold text-discord-text mb-4 uppercase tracking-widest">Tickets em Aberto</h3>
                          {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {filteredTickets.filter(t => t.status === 'Aberto').map(ticket => (
                                <TicketCard key={ticket.id} ticket={ticket} onClick={() => setSelectedTicketId(ticket.id)} />
                              ))}
                            </div>
                          ) : (
                            <div className="bg-discord-dark rounded-xl border border-discord-border overflow-hidden shadow-xl">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                  <thead>
                                    <tr className="bg-discord-darkest/50">
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Ticket</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Assunto</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Urgência</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Status</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Plataforma</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Solicitante</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Atualizado</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border text-right">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-discord-border">
                                    {filteredTickets.filter(t => t.status === 'Aberto').map(ticket => (
                                      <tr key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)} className="hover:bg-discord-hover transition-colors group cursor-pointer">
                                        <td className="p-4"><span className="text-[10px] font-black text-discord-muted bg-discord-darkest px-2 py-1 rounded border border-discord-border tracking-tighter">{ticket.number}</span></td>
                                        <td className="p-4"><p className="text-discord-text font-bold text-sm truncate max-w-[200px]">{ticket.subject}</p></td>
                                        <td className="p-4"><div className="flex"><UrgencyBadge urgency={ticket.urgency} className="text-[9px] px-2 py-0.5" /></div></td>
                                        <td className="p-4"><div className="flex"><StatusBadge status={ticket.status} className="text-[9px] px-2 py-0.5" /></div></td>
                                        <td className="p-4"><span className="text-discord-muted text-xs font-semibold">{ticket.platform}</span></td>
                                        <td className="p-4"><div className="flex flex-col"><span className="text-discord-text text-xs font-bold">{ticket.requester}</span><span className="text-[10px] text-discord-muted">{ticket.requesterEmail}</span></div></td>
                                        <td className="p-4"><span className="text-discord-muted text-xs">{format(ticket.updatedAt, "dd/MM/yyyy", { locale: ptBR })}</span></td>
                                        <td className="p-4 text-right"><button className="text-discord-accent hover:underline text-[10px] font-black uppercase tracking-widest">Ver Detalhes</button></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </section>

                        {/* Backlog */}
                        <section>
                          <h3 className="text-sm font-bold text-discord-text mb-4 uppercase tracking-widest">Backlog</h3>
                          {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {filteredTickets.filter(t => t.status !== 'Aberto' && t.status !== 'Pendente').map(ticket => (
                                <TicketCard key={ticket.id} ticket={ticket} onClick={() => setSelectedTicketId(ticket.id)} />
                              ))}
                            </div>
                          ) : (
                            <div className="bg-discord-dark rounded-xl border border-discord-border overflow-hidden shadow-xl">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                  <thead>
                                    <tr className="bg-discord-darkest/50">
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Ticket</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Assunto</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Urgência</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Status</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Plataforma</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Solicitante</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Atualizado</th>
                                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border text-right">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-discord-border">
                                    {filteredTickets.filter(t => t.status !== 'Aberto' && t.status !== 'Pendente').map(ticket => (
                                      <tr key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)} className="hover:bg-discord-hover transition-colors group cursor-pointer">
                                        <td className="p-4"><span className="text-[10px] font-black text-discord-muted bg-discord-darkest px-2 py-1 rounded border border-discord-border tracking-tighter">{ticket.number}</span></td>
                                        <td className="p-4"><p className="text-discord-text font-bold text-sm truncate max-w-[200px]">{ticket.subject}</p></td>
                                        <td className="p-4"><div className="flex"><UrgencyBadge urgency={ticket.urgency} className="text-[9px] px-2 py-0.5" /></div></td>
                                        <td className="p-4"><div className="flex"><StatusBadge status={ticket.status} className="text-[9px] px-2 py-0.5" /></div></td>
                                        <td className="p-4"><span className="text-discord-muted text-xs font-semibold">{ticket.platform}</span></td>
                                        <td className="p-4"><div className="flex flex-col"><span className="text-discord-text text-xs font-bold">{ticket.requester}</span><span className="text-[10px] text-discord-muted">{ticket.requesterEmail}</span></div></td>
                                        <td className="p-4"><span className="text-discord-muted text-xs">{format(ticket.updatedAt, "dd/MM/yyyy", { locale: ptBR })}</span></td>
                                        <td className="p-4 text-right"><button className="text-discord-accent hover:underline text-[10px] font-black uppercase tracking-widest">Ver Detalhes</button></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </section>
                      </div>
                    ) : (
                      viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredTickets.map(ticket => (
                            <TicketCard 
                              key={ticket.id} 
                              ticket={ticket} 
                              onClick={() => setSelectedTicketId(ticket.id)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="bg-discord-dark rounded-xl border border-discord-border overflow-hidden shadow-xl">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                              <thead>
                                <tr className="bg-discord-darkest/50">
                                  <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Ticket</th>
                                  <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Assunto</th>
                                  <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Urgência</th>
                                  <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Status</th>
                                  <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Plataforma</th>
                                  <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Solicitante</th>
                                  <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Atualizado</th>
                                  <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border text-right">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-discord-border">
                                {filteredTickets.map(ticket => (
                                  <tr 
                                    key={ticket.id} 
                                    onClick={() => setSelectedTicketId(ticket.id)}
                                    className="hover:bg-discord-hover transition-colors group cursor-pointer"
                                  >
                                    <td className="p-4">
                                      <span className="text-[10px] font-black text-discord-muted bg-discord-darkest px-2 py-1 rounded border border-discord-border tracking-tighter">
                                        {ticket.number}
                                      </span>
                                    </td>
                                    <td className="p-4">
                                      <p className="text-discord-text font-bold text-sm truncate max-w-[200px]">{ticket.subject}</p>
                                    </td>
                                    <td className="p-4">
                                      <div className="flex">
                                        <UrgencyBadge urgency={ticket.urgency} className="text-[9px] px-2 py-0.5" />
                                      </div>
                                    </td>
                                    <td className="p-4">
                                      <div className="flex">
                                        <StatusBadge status={ticket.status} className="text-[9px] px-2 py-0.5" />
                                      </div>
                                    </td>
                                    <td className="p-4">
                                      <span className="text-discord-muted text-xs font-semibold">{ticket.platform}</span>
                                    </td>
                                    <td className="p-4">
                                      <div className="flex flex-col">
                                        <span className="text-discord-text text-xs font-bold">{ticket.requester}</span>
                                        <span className="text-[10px] text-discord-muted">{ticket.requesterEmail}</span>
                                      </div>
                                    </td>
                                    <td className="p-4">
                                      <span className="text-discord-muted text-xs">
                                        {format(ticket.updatedAt, "dd/MM/yyyy", { locale: ptBR })}
                                      </span>
                                    </td>
                                    <td className="p-4 text-right">
                                      <button className="text-discord-accent hover:underline text-[10px] font-black uppercase tracking-widest">
                                        Ver Detalhes
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-20 h-20 bg-discord-darker rounded-full flex items-center justify-center mb-4 border border-discord-border">
                        <HelpCircle className="w-10 h-10 text-discord-muted" />
                      </div>
                      <h3 className="text-discord-text font-bold text-lg">Nenhum ticket encontrado</h3>
                      <p className="text-discord-muted text-sm mt-1 max-w-xs">
                        Tente ajustar seus filtros ou busca para encontrar o que procura.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function HelpCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}
