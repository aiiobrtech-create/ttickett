import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, List, FileSpreadsheet, FileText, Filter, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { supabase, testConnection } from './supabase';
import { exportToExcel, exportTicketsToPDF } from './lib/exportUtils';
import { User, Ticket, TicketStatus, Platform, TicketUrgency } from './types';
import { Login } from './screens/Login';
import { Sidebar } from './components/Sidebar';
import { Topbar, TopbarNotification } from './components/Topbar';
import { TicketCard } from './components/TicketCard';
import { StatusBadge } from './components/StatusBadge';
import { UrgencyBadge } from './components/UrgencyBadge';
import { TicketDetails } from './screens/TicketDetails';
import { NewTicket } from './screens/NewTicket';
import { Settings } from './screens/Settings';
import { Registrations } from './screens/Registrations';
import { Reports } from './screens/Reports';
import { cn } from './lib/utils';
import { apiUrl } from './lib/api';
import { isAnyAdministrator, isTtickettAdministrator, isStaffRole } from './lib/roles';
import { Toaster, toast } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  // Não bloquear renderização inicial: auth inicializa em background.
  const [isAuthReady, setIsAuthReady] = useState(true);
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
  const [readNotificationsMap, setReadNotificationsMap] = useState<Record<string, true>>({});
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    urgency: 'Todos' as TicketUrgency | 'Todos',
    platform: '',
    assignee: '' as '' | '__unassigned__' | string,
    category: '',
    requesterQuery: '',
    dateFrom: '',
    dateTo: '',
  });

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
    const tempUserFromAuth = (authUser: SupabaseAuthUser): User =>
      ({
        id: authUser.id,
        email: authUser.email || '',
        name:
          (authUser.user_metadata?.full_name as string | undefined) ||
          (authUser.user_metadata?.name as string | undefined) ||
          authUser.email?.split('@')[0] ||
          'Usuário',
        role:
          authUser.email === 'renan@reetech.com.br'
            ? 'ttickett_admin'
            : ((authUser.user_metadata?.role as User['role'] | undefined) || 'client'),
        organizationId: '',
        companyId: undefined,
        avatar: authUser.user_metadata?.avatar_url as string | undefined,
      }) as User;

    const fetchFullProfileInBackground = (userId: string) => {
      void (async () => {
        try {
          const query = supabase.from('users').select('*').eq('id', userId).maybeSingle();
          const timedOut = new Promise<{ data: null; error: { message: string } }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 15000)
          );
          const result = await Promise.race([query, timedOut]);
          if (result?.data) {
            const { data: mem } = await supabase
              .from('user_organizations')
              .select('"organizationId"')
              .eq('userId', userId);
            const organizationIds = (mem || []).map((r: any) => r.organizationId).filter(Boolean);
            setUser({ ...(result.data as User), organizationIds });
          }
        } catch (e) {
          console.warn('Perfil (background):', e);
        }
      })();
    };

    const applySessionUser = (authUser: SupabaseAuthUser) => {
      setUser(tempUserFromAuth(authUser));
      fetchFullProfileInBackground(authUser.id);
    };

    const initAuth = async () => {
      console.log('Starting auth initialization...');
      try {
        const raced = await Promise.race([
          supabase.auth.getSession().then((r) => ({ kind: 'ok' as const, r })),
          new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), 25000)),
        ]);

        if (raced.kind === 'timeout') {
          console.warn('Auth: getSession demorou; sessão pode chegar via INITIAL_SESSION.');
        } else {
          const { data, error: sessionError } = raced.r;
          if (sessionError) {
            console.warn('Auth session fetch failed:', sessionError.message);
            setUser(null);
          } else if (data?.session?.user) {
            console.log('Session found for:', data.session.user.email);
            applySessionUser(data.session.user);
          } else {
            console.log('No active session in getSession().');
            setUser(null);
          }
        }
      } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('Auth init error:', err?.message);
        setUser(null);
      } finally {
        console.log('Auth ready.');
        setIsAuthReady(true);
      }
    };

    initAuth();

    const failSafeAuth = setTimeout(() => {
      setIsAuthReady((current) => {
        if (!current) {
          console.warn('Auth fail-safe: liberando UI.');
          return true;
        }
        return current;
      });
    }, 28000);

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthReady(true);
      console.log('Auth state change:', event, session?.user?.email);

      if (event === 'SIGNED_OUT') {
        setUser(null);
        return;
      }

      if (session?.user) {
        applySessionUser(session.user);
      }
    });

    const subscription = authSub.subscription;

    return () => {
      subscription.unsubscribe();
      clearTimeout(failSafeAuth);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', accentColor);
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
    let prevSnapshot: User | null = null;
    setUser((prev) => {
      prevSnapshot = prev;
      return prev ? { ...prev, ...updatedUser } : null;
    });

    if (!prevSnapshot?.id) return;

    const prev = prevSnapshot;

    void (async () => {
      const payload: Record<string, unknown> = {};
      if (updatedUser.name !== undefined) payload.name = updatedUser.name;
      if (updatedUser.email !== undefined) payload.email = updatedUser.email;
      if (updatedUser.avatar !== undefined) {
        payload.avatar = updatedUser.avatar === '' ? null : updatedUser.avatar;
      }
      if (updatedUser.phone !== undefined) payload.phone = updatedUser.phone;
      if (updatedUser.whatsapp !== undefined) payload.whatsapp = updatedUser.whatsapp;
      if (updatedUser.observations !== undefined) payload.observations = updatedUser.observations;
      if (updatedUser.organizationId !== undefined) payload.organizationId = updatedUser.organizationId;
      if (updatedUser.companyId !== undefined) payload.companyId = updatedUser.companyId;

      if (Object.keys(payload).length === 0) return;

      const { data, error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', prev.id)
        .select('id,name,email,role,organizationId,companyId,avatar,phone,whatsapp,observations,createdAt')
        .maybeSingle();

      if (error) {
        toast.error('Não foi possível salvar o perfil.', { description: error.message });
        setUser(prev);
        return;
      }

      if (data) {
        setUser(data as User);
      }

      if (updatedUser.avatar !== undefined) {
        const metaAvatar =
          updatedUser.avatar === '' || updatedUser.avatar == null ? null : updatedUser.avatar;
        const { error: authErr } = await supabase.auth.updateUser({
          data: { avatar_url: metaAvatar },
        });
        if (authErr) {
          console.warn('auth.updateUser (avatar):', authErr.message);
        }
      }
    })();
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
    const scopeOrgLegacy = user.organizationId || null;
    const scopeOrgIds = Array.isArray(user.organizationIds) ? user.organizationIds : [];
    const scopeCompany = user.companyId || null;

    const inScope = (t: Ticket) => {
      if (scopeOrgIds.length) return !!t.organizationId && scopeOrgIds.includes(t.organizationId);
      if (scopeOrgLegacy) return t.organizationId === scopeOrgLegacy;
      if (scopeCompany) return t.companyId === scopeCompany;
      return true;
    };

    if (user.role === 'client') {
      if (scopeOrgIds.length) {
        return tickets.filter((t) => !!t.organizationId && scopeOrgIds.includes(t.organizationId));
      }
      if (scopeOrgLegacy) {
        return tickets.filter((t) => t.organizationId === scopeOrgLegacy);
      }
      if (scopeCompany) {
        const em = (user.email || '').toLowerCase();
        return tickets.filter(
          (t) =>
            t.companyId === scopeCompany &&
            (t.requesterUid === user.id ||
              (!!t.requesterEmail && t.requesterEmail.toLowerCase() === em))
        );
      }
      const em = (user.email || '').toLowerCase();
      return tickets.filter(
        (t) =>
          t.requesterUid === user.id ||
          (!!t.requesterEmail && t.requesterEmail.toLowerCase() === em)
      );
    }
    if (user.role === 'agent') {
      return tickets.filter((t) => t.assignee === user.name && inScope(t));
    }
    if (user.role === 'ttickett_admin') {
      return tickets;
    }
    if (user.role === 'admin') {
      return tickets.filter(inScope);
    }
    return tickets;
  }, [tickets, user]);

  useEffect(() => {
    if (!user) return;
    const storageKey = `notifications_read_${user.id}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setReadNotificationsMap(JSON.parse(raw));
      } else {
        setReadNotificationsMap({});
      }
    } catch {
      setReadNotificationsMap({});
    }
  }, [user?.id]);

  const notifications = useMemo<TopbarNotification[]>(() => {
    return [...allowedTickets]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 20)
      .map((ticket) => {
        const id = `${ticket.id}:${ticket.updatedAt.toISOString()}`;
        return {
          id,
          title: `${ticket.number} • ${ticket.status}`,
          description: ticket.subject,
          createdAt: ticket.updatedAt,
          unread: !readNotificationsMap[id],
        };
      });
  }, [allowedTickets, readNotificationsMap]);

  const persistReadNotifications = (next: Record<string, true>) => {
    setReadNotificationsMap(next);
    if (user) {
      localStorage.setItem(`notifications_read_${user.id}`, JSON.stringify(next));
    }
  };

  const handleNotificationClick = (notification: TopbarNotification) => {
    const ticketId = notification.id.split(':')[0];
    persistReadNotifications({ ...readNotificationsMap, [notification.id]: true });
    setActiveTab('dashboard');
    setSelectedTicketId(ticketId);
  };

  const handleMarkAllNotificationsRead = () => {
    const next = { ...readNotificationsMap };
    notifications.forEach((notification) => {
      next[notification.id] = true;
    });
    persistReadNotifications(next);
  };

  const canUseAdvancedFilter =
    user?.role === 'agent' || (user != null && isAnyAdministrator(user.role));

  const advancedFilterOptions = useMemo(() => {
    const platforms = new Set<string>();
    const assignees = new Set<string>();
    const categories = new Set<string>();
    for (const t of allowedTickets) {
      if (t.platform) platforms.add(t.platform);
      if (t.assignee) assignees.add(t.assignee);
      if (t.category) categories.add(t.category);
    }
    return {
      platforms: [...platforms].sort((a, b) => a.localeCompare(b)),
      assignees: [...assignees].sort((a, b) => a.localeCompare(b)),
      categories: [...categories].sort((a, b) => a.localeCompare(b)),
    };
  }, [allowedTickets]);

  const activeAdvancedFilterCount = useMemo(() => {
    let n = 0;
    if (advancedFilters.urgency !== 'Todos') n++;
    if (advancedFilters.platform) n++;
    if (advancedFilters.assignee) n++;
    if (advancedFilters.category) n++;
    if (advancedFilters.requesterQuery.trim()) n++;
    if (advancedFilters.dateFrom) n++;
    if (advancedFilters.dateTo) n++;
    return n;
  }, [advancedFilters]);

  const filteredTickets = useMemo(() => {
    let result = allowedTickets;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.number.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'Todos') {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (canUseAdvancedFilter) {
      if (advancedFilters.urgency !== 'Todos') {
        result = result.filter((t) => t.urgency === advancedFilters.urgency);
      }
      if (advancedFilters.platform) {
        result = result.filter((t) => t.platform === advancedFilters.platform);
      }
      if (advancedFilters.assignee === '__unassigned__') {
        result = result.filter((t) => !t.assignee || t.assignee.trim() === '');
      } else if (advancedFilters.assignee) {
        result = result.filter((t) => t.assignee === advancedFilters.assignee);
      }
      if (advancedFilters.category) {
        result = result.filter((t) => t.category === advancedFilters.category);
      }
      const rq = advancedFilters.requesterQuery.trim().toLowerCase();
      if (rq) {
        result = result.filter(
          (t) =>
            t.requester.toLowerCase().includes(rq) ||
            t.requesterEmail.toLowerCase().includes(rq)
        );
      }
      if (advancedFilters.dateFrom) {
        const from = new Date(advancedFilters.dateFrom + 'T00:00:00');
        if (!Number.isNaN(from.getTime())) {
          result = result.filter((t) => t.createdAt >= from);
        }
      }
      if (advancedFilters.dateTo) {
        const to = new Date(advancedFilters.dateTo + 'T23:59:59.999');
        if (!Number.isNaN(to.getTime())) {
          result = result.filter((t) => t.createdAt <= to);
        }
      }
    }

    return result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [
    allowedTickets,
    searchQuery,
    statusFilter,
    canUseAdvancedFilter,
    advancedFilters,
  ]);

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
        const query = supabase.from('tickets').select('*');
        const timedOut = new Promise<{ data: null; error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 30000)
        );
        const { data, error } = (await Promise.race([query, timedOut])) as {
          data: Ticket[] | null;
          error: { message: string } | null;
        };
        if (error?.message === 'timeout') {
          console.warn('Tickets: consulta demorou demais.');
          toast.warning('Tickets não carregaram a tempo', { description: 'Recarregue a página ou verifique a rede.' });
          setTickets([]);
          return;
        }
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
    attachment?: { name: string; url: string; type: 'image' | 'file' };
    organizationId?: string | null;
  }) => {
    if (!user) return;

    let ticketNumber: string;
    const { data: rpcNum, error: rpcError } = await supabase.rpc('next_ticket_number');
    if (!rpcError && typeof rpcNum === 'string' && rpcNum.length > 0) {
      ticketNumber = rpcNum;
    } else {
      if (rpcError) console.warn('next_ticket_number RPC:', rpcError.message);
      ticketNumber = `TK-${Date.now()}`;
    }
    
    const orgId = data.organizationId ?? user.organizationId ?? null;
    let companyId: string | null = user.companyId ?? null;
    if (orgId) {
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('companyId')
        .eq('id', orgId)
        .maybeSingle();
      if (orgRow?.companyId) companyId = orgRow.companyId as string;
    }

    const newTicket = {
      number: ticketNumber,
      requester: user.name,
      requesterEmail: user.email,
      requesterUid: user.id,
      organizationId: orgId,
      companyId: companyId || null,
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
      const { data: insertedTicket, error } = await supabase
        .from('tickets')
        .insert(newTicket)
        .select('*')
        .single();
      if (error) throw error;
      if (insertedTicket) {
        setTickets(prev => [
          {
            ...insertedTicket,
            createdAt: new Date(insertedTicket.createdAt),
            updatedAt: new Date(insertedTicket.updatedAt),
            estimatedDeadline: insertedTicket.estimatedDeadline ? new Date(insertedTicket.estimatedDeadline) : undefined,
            messages: (insertedTicket.messages || []).map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp)
            }))
          } as Ticket,
          ...prev
        ]);
      }
      setActiveTab('dashboard');
    } catch (error) {
      console.error("Error creating ticket:", error);
      const msg = (error as any)?.message || (error as any)?.details || 'Falha desconhecida';
      toast.error("Erro ao criar ticket", { description: msg });
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    try {
      const updatedAt = new Date();
      const { error, data } = await supabase
        .from('tickets')
        .update({
          status,
          updatedAt: updatedAt.toISOString()
        })
        .eq('id', ticketId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error('Sem permissão para alterar status deste ticket.');
      }
      setTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, status, updatedAt } : t))
      );
    } catch (error) {
      console.error("Error updating status:", error);
      const msg = (error as any)?.message || (error as any)?.details || 'Falha desconhecida';
      toast.error("Erro ao atualizar status", { description: msg });
    }
  };

  const handleUpdateTicketAssignee = async (ticketId: string, assignee: string) => {
    try {
      const updatedAt = new Date();
      const { error, data } = await supabase
        .from('tickets')
        .update({
          assignee,
          updatedAt: updatedAt.toISOString()
        })
        .eq('id', ticketId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error('Sem permissão para alterar responsável deste ticket.');
      }
      setTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, assignee, updatedAt } : t))
      );
    } catch (error) {
      console.error("Error updating assignee:", error);
      const msg = (error as any)?.message || (error as any)?.details || 'Falha desconhecida';
      toast.error("Erro ao atualizar responsável", { description: msg });
    }
  };

  const handleUpdateEstimatedDeadline = async (ticketId: string, date: Date | undefined) => {
    try {
      const updatedAt = new Date();
      const { error, data } = await supabase
        .from('tickets')
        .update({
          estimatedDeadline: date ? date.toISOString() : null,
          updatedAt: updatedAt.toISOString()
        })
        .eq('id', ticketId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error('Sem permissão para alterar prazo deste ticket.');
      }
      setTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, estimatedDeadline: date, updatedAt } : t))
      );
    } catch (error) {
      console.error("Error updating deadline:", error);
      const msg = (error as any)?.message || (error as any)?.details || 'Falha desconhecida';
      toast.error("Erro ao atualizar prazo", { description: msg });
    }
  };

  // Escopo (empresa/organização) não é editável no detalhe do ticket.

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
      const updatedAt = new Date();
      const nextMessages = [...(ticket.messages || []), newMessage];
      const { error, data } = await supabase
        .from('tickets')
        .update({
          messages: nextMessages,
          updatedAt: updatedAt.toISOString()
        })
        .eq('id', ticketId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error('Sem permissão para enviar mensagem neste ticket.');
      }
      setTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, messages: nextMessages as any, updatedAt } : t))
      );

      if (!isInternal && isStaffRole(user.role) && ticket.requesterEmail?.trim()) {
        void (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;
            const r = await fetch(apiUrl('/api/email/send-ticket-reply'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ ticketId, content }),
            });
            if (!r.ok) {
              const j = await r.json().catch(() => ({}));
              toast.warning('Mensagem salva, mas o e-mail ao solicitante falhou.', {
                description: typeof (j as any)?.error === 'string' ? (j as any).error : `HTTP ${r.status}`,
              });
            }
          } catch (e) {
            console.warn('[email] send-ticket-reply', e);
            toast.warning('Mensagem salva; não foi possível enviar e-mail ao solicitante.');
          }
        })();
      }
    } catch (error) {
      console.error("Error adding message:", error);
      const msg = (error as any)?.message || (error as any)?.details || 'Falha desconhecida';
      toast.error("Erro ao enviar mensagem", { description: msg });
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!user || (!isAnyAdministrator(user.role) && user.role !== 'agent')) return;

    try {
      const { data, error } = await supabase.from('tickets').delete().eq('id', ticketId).select('id');
      if (error) throw error;
      if (!data?.length) {
        toast.error('Não foi possível excluir o ticket.', {
          description: 'Sem permissão ou o ticket não existe.',
        });
        return;
      }
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
      setSelectedTicketId(null);
      toast.success('Ticket excluído.');
    } catch (error) {
      console.error('Error deleting ticket:', error);
      const msg = (error as any)?.message || (error as any)?.details || 'Falha desconhecida';
      toast.error('Erro ao excluir ticket', { description: msg });
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
    <div className="flex h-screen min-h-0 max-h-[100dvh] w-full min-w-0 bg-discord-darkest overflow-hidden">
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

      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
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
                onDeleteTicket={async () => handleDeleteTicket(selectedTicket.id)}
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
                notifications={notifications}
                onNotificationClick={handleNotificationClick}
                onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
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
                notifications={notifications}
                onNotificationClick={handleNotificationClick}
                onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
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
          ) : activeTab === 'reports' && isAnyAdministrator(user.role) ? (
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
                notifications={notifications}
                onNotificationClick={handleNotificationClick}
                onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
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
                title={
                  isTtickettAdministrator(user.role)
                    ? 'Painel TTICKETT'
                    : user.role === 'admin'
                      ? 'Painel Administrativo'
                      : user.role === 'agent'
                        ? 'Central de Atendimento'
                        : 'Meus Chamados'
                }
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onMenuClick={() => setIsMobileMenuOpen(true)}
                notifications={notifications}
                onNotificationClick={handleNotificationClick}
                onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              />
              
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 pb-20 md:pb-32">
                <div className="max-w-6xl mx-auto w-full min-w-0">
                  <div className="mb-8">
                    <div className="mb-6">
                      <h2 className="text-xl md:text-2xl font-black text-discord-text tracking-tight uppercase">
                        {isTtickettAdministrator(user.role)
                          ? 'Todos os tickets (TTICKETT)'
                          : user.role === 'admin'
                            ? 'Tickets da sua empresa'
                            : user.role === 'agent'
                              ? 'Visão Geral dos Tickets'
                              : 'Acompanhe seus Tickets'}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-discord-accent animate-pulse" />
                        <p className="text-discord-muted text-xs md:text-sm font-bold uppercase tracking-widest">
                          {filteredTickets.length} tickets encontrados no total.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-discord-dark/30 p-3 sm:p-4 rounded-xl border border-discord-border/50 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 min-w-0">
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

                    {canUseAdvancedFilter && (
                      <div className="mt-4 rounded-xl border border-discord-border/60 bg-discord-darker/50 overflow-hidden min-w-0">
                        <button
                          type="button"
                          onClick={() => setAdvancedFilterOpen((o) => !o)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-discord-hover/40 transition-colors"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <Filter className="w-4 h-4 text-discord-accent shrink-0" />
                            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-discord-text truncate">
                              Filtro avançado
                            </span>
                            {activeAdvancedFilterCount > 0 && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-discord-accent/20 text-discord-accent border border-discord-accent/30 shrink-0">
                                {activeAdvancedFilterCount}{' '}
                                {activeAdvancedFilterCount === 1 ? 'critério' : 'critérios'}
                              </span>
                            )}
                          </span>
                          <ChevronDown
                            className={cn(
                              'w-4 h-4 text-discord-muted shrink-0 transition-transform',
                              advancedFilterOpen && 'rotate-180'
                            )}
                          />
                        </button>
                        {advancedFilterOpen && (
                          <div className="px-4 pb-4 pt-0 border-t border-discord-border/40 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                              <div className="space-y-2">
                                <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">
                                  Urgência
                                </label>
                                <select
                                  value={advancedFilters.urgency}
                                  onChange={(e) =>
                                    setAdvancedFilters((f) => ({
                                      ...f,
                                      urgency: e.target.value as TicketUrgency | 'Todos',
                                    }))
                                  }
                                  className="w-full bg-discord-darkest border border-discord-border rounded-md p-2.5 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent"
                                >
                                  <option value="Todos">Todas</option>
                                  {(['Baixa', 'Média', 'Alta', 'Crítica'] as TicketUrgency[]).map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">
                                  Plataforma
                                </label>
                                <select
                                  value={advancedFilters.platform}
                                  onChange={(e) =>
                                    setAdvancedFilters((f) => ({ ...f, platform: e.target.value }))
                                  }
                                  className="w-full bg-discord-darkest border border-discord-border rounded-md p-2.5 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent"
                                >
                                  <option value="">Todas</option>
                                  {advancedFilterOptions.platforms.map((p) => (
                                    <option key={p} value={p}>
                                      {p}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">
                                  Responsável
                                </label>
                                <select
                                  value={advancedFilters.assignee}
                                  onChange={(e) =>
                                    setAdvancedFilters((f) => ({
                                      ...f,
                                      assignee: e.target.value as typeof f.assignee,
                                    }))
                                  }
                                  className="w-full bg-discord-darkest border border-discord-border rounded-md p-2.5 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent"
                                >
                                  <option value="">Todos</option>
                                  <option value="__unassigned__">Sem responsável</option>
                                  {advancedFilterOptions.assignees.map((a) => (
                                    <option key={a} value={a}>
                                      {a}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">
                                  Categoria
                                </label>
                                <select
                                  value={advancedFilters.category}
                                  onChange={(e) =>
                                    setAdvancedFilters((f) => ({ ...f, category: e.target.value }))
                                  }
                                  className="w-full bg-discord-darkest border border-discord-border rounded-md p-2.5 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent"
                                >
                                  <option value="">Todas</option>
                                  {advancedFilterOptions.categories.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                                <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">
                                  Solicitante (nome ou e-mail)
                                </label>
                                <input
                                  type="text"
                                  value={advancedFilters.requesterQuery}
                                  onChange={(e) =>
                                    setAdvancedFilters((f) => ({ ...f, requesterQuery: e.target.value }))
                                  }
                                  placeholder="Contém..."
                                  className="w-full bg-discord-darkest border border-discord-border rounded-md p-2.5 text-sm text-discord-text placeholder:text-discord-muted outline-none focus:ring-1 focus:ring-discord-accent"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">
                                  Aberto desde
                                </label>
                                <input
                                  type="date"
                                  value={advancedFilters.dateFrom}
                                  onChange={(e) =>
                                    setAdvancedFilters((f) => ({ ...f, dateFrom: e.target.value }))
                                  }
                                  className="w-full bg-discord-darkest border border-discord-border rounded-md p-2.5 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">
                                  Aberto até
                                </label>
                                <input
                                  type="date"
                                  value={advancedFilters.dateTo}
                                  onChange={(e) =>
                                    setAdvancedFilters((f) => ({ ...f, dateTo: e.target.value }))
                                  }
                                  className="w-full bg-discord-darkest border border-discord-border rounded-md p-2.5 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent"
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setAdvancedFilters({
                                    urgency: 'Todos',
                                    platform: '',
                                    assignee: '',
                                    category: '',
                                    requesterQuery: '',
                                    dateFrom: '',
                                    dateTo: '',
                                  })
                                }
                                className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md border border-discord-border text-discord-muted hover:text-discord-text hover:bg-discord-hover transition-colors"
                              >
                                Limpar filtros
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
