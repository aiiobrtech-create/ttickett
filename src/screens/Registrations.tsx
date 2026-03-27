import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Users, Monitor, Tag, Plus, X, Save, ArrowLeft, Info, Trash2, Edit3, Building2, FileSpreadsheet, FileText, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { MultiSelect } from '../components/MultiSelect';
import { 
  exportToExcel, 
  exportUsersToPDF, 
  exportOrganizationsToPDF, 
  exportAccessLogsToPDF,
  exportPlatformsToPDF,
  exportCategoriesToPDF
} from '../lib/exportUtils';
import { format } from 'date-fns';
import { supabase, supabaseUrl, supabaseAnonKey } from '../supabase';
import { createClient } from '@supabase/supabase-js';

// Create a temporary client for user creation that doesn't persist session
// This prevents the admin from being signed out when creating a new user
const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

import { User } from '../types';

type RegistrationType = 'Organizações' | 'Usuários' | 'Plataformas' | 'Categorias';

type ViewMode = 'grid' | 'form' | 'list';

interface RegistrationsProps {
  initialActiveType?: string;
  initialEditingItem?: any;
  initialViewMode?: ViewMode;
  currentUser?: User;
  onBackToDashboard?: () => void;
}

export const Registrations: React.FC<RegistrationsProps> = ({
  initialActiveType,
  initialEditingItem,
  initialViewMode,
  currentUser,
  onBackToDashboard
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode || 'grid');
  const [activeType, setActiveType] = useState<RegistrationType | null>(initialActiveType as RegistrationType || null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: RegistrationType, id: string } | null>(null);
  
  // Stateful data
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const normalizeUserRole = (value: unknown): 'client' | 'agent' | 'admin' => {
    const role = String(value || '').trim().toLowerCase();
    if (role === 'admin' || role === 'administrador') return 'admin';
    if (role === 'agent' || role === 'atendente') return 'agent';
    return 'client';
  };

  const normalizeOrganization = (org: any) => {
    if (!org) return org;
    // DB column is `contactperson` (lowercase). UI expects `contactPerson`.
    if (org.contactPerson == null && org.contactperson != null) {
      return { ...org, contactPerson: org.contactperson };
    }
    return org;
  };

  /** Recarrega todas as listas (grade, contagens e listagens). */
  const refreshRegistrationLists = useCallback(async () => {
    try {
      const [orgsRes, usersRes, platRes, catRes] = await Promise.all([
        supabase.from('organizations').select('*'),
        supabase.from('users').select('*'),
        supabase.from('platforms').select('*'),
        supabase.from('categories').select('*'),
      ]);

      if (orgsRes.error) console.error('[Registrations] organizations:', orgsRes.error);
      if (usersRes.error) console.error('[Registrations] users:', usersRes.error);
      if (platRes.error) console.error('[Registrations] platforms:', platRes.error);
      if (catRes.error) console.error('[Registrations] categories:', catRes.error);

      if (orgsRes.data) setOrganizations(orgsRes.data.map(normalizeOrganization));
      if (usersRes.data) {
        setUsers(usersRes.data.map((u: any) => ({ ...u, role: normalizeUserRole(u.role) })));
      }
      if (platRes.data) setPlatforms(platRes.data);
      if (catRes.data) setCategories(catRes.data);
    } catch (err: unknown) {
      console.error('[Registrations] refreshRegistrationLists:', err);
    }
  }, []);

  useEffect(() => {
    void refreshRegistrationLists();
  }, [refreshRegistrationLists]);

  // Form state
  const [editingItem, setEditingItem] = useState<any | null>(initialEditingItem || null);
  const [formData, setFormData] = useState<any>(initialEditingItem || {});

  useEffect(() => {
    if (initialActiveType) setActiveType(initialActiveType as RegistrationType);
    if (initialEditingItem) {
      setEditingItem(initialEditingItem);
      setViewMode('form');
    }
    if (initialViewMode) setViewMode(initialViewMode);
  }, [initialActiveType, initialEditingItem, initialViewMode]);

  useEffect(() => {
    if (editingItem) {
      setFormData(editingItem);
    } else {
      setFormData({
        platforms: [],
        categories: [],
        env: 'Produção',
        role: 'client'
      });
    }
  }, [editingItem]);

  const registrationTypes = [
    { id: 'Organizações' as const, icon: Building2, label: 'Organizações', count: organizations.length, desc: 'Gerencie empresas e clientes.' },
    { id: 'Usuários' as const, icon: Users, label: 'Usuários', count: users.length, desc: 'Gerencie clientes e atendentes.' },
    { id: 'Plataformas' as const, icon: Monitor, label: 'Plataformas', count: platforms.length, desc: 'Cadastre novos sistemas e portais.' },
    { id: 'Categorias' as const, icon: Tag, label: 'Categorias', count: categories.length, desc: 'Defina tipos de problemas e assuntos.' },
  ];

  const dataMap: Record<RegistrationType, any[]> = {
    'Organizações': organizations,
    'Usuários': users,
    'Plataformas': platforms,
    'Categorias': categories
  };

  const getSingularName = (type: RegistrationType) => {
    switch (type) {
      case 'Organizações': return 'Organização';
      case 'Usuários': return 'Usuário';
      case 'Plataformas': return 'Plataforma';
      case 'Categorias': return 'Categoria';
      default: return type;
    }
  };

  const getSuccessMessage = (type: RegistrationType, isEdit: boolean) => {
    const isFeminine = type === 'Organizações' || type === 'Plataformas' || type === 'Categorias';
    const singular = getSingularName(type);
    const action = isEdit ? (isFeminine ? 'atualizada' : 'atualizado') : (isFeminine ? 'cadastrada' : 'cadastrado');
    return `${singular} ${action} com sucesso!`;
  };

  const getDeleteMessage = (type: RegistrationType) => {
    const isFeminine = type === 'Organizações' || type === 'Plataformas' || type === 'Categorias';
    const singular = getSingularName(type);
    return `${singular} ${isFeminine ? 'excluída' : 'excluído'} com sucesso!`;
  };

  const getDeleteConfirmMessage = (type: RegistrationType) => {
    const isFeminine = type === 'Organizações' || type === 'Plataformas' || type === 'Categorias';
    const singular = getSingularName(type).toLowerCase();
    return `Tem certeza que deseja excluir ${isFeminine ? 'esta' : 'este'} ${singular}? Esta ação não pode ser desfeita.`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeType) return;

    setIsSaving(true);
    
    try {
      let tableName = '';
      switch (activeType) {
        case 'Organizações': tableName = 'organizations'; break;
        case 'Usuários': tableName = 'users'; break;
        case 'Plataformas': tableName = 'platforms'; break;
        case 'Categorias': tableName = 'categories'; break;
      }

      const buildPayload = () => {
        if (tableName === 'organizations') {
          const {
            name,
            platforms,
            categories,
            address,
            phone,
            email,
            observations,
            contactPerson,
            contactperson,
          } = formData || {};
          const rest = { name, platforms, categories, address, phone, email, observations };
          const dbContactPerson = contactPerson ?? contactperson ?? null;
          // `contactPerson` é só para UI; no banco a coluna é `contactperson`
          return { ...rest, contactperson: dbContactPerson } as any;
        }
        if (tableName === 'users') {
          const { name, email, role, avatar, organizationId, phone, whatsapp, observations } = formData || {};
          return {
            name,
            email,
            role: normalizeUserRole(role),
            avatar,
            organizationId,
            phone,
            whatsapp,
            observations,
          };
        }
        if (tableName === 'platforms') {
          const { id, name, url, env } = formData || {};
          const normalizedId =
            (id && String(id).trim()) ||
            (name
              ? String(name)
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/(^-|-$)/g, '')
              : '') ||
            `platform-${Date.now()}`;
          return { id: normalizedId, name, url, env };
        }
        if (tableName === 'categories') {
          const { id, name, desc } = formData || {};
          const normalizedId =
            (id && String(id).trim()) ||
            (name
              ? String(name)
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/(^-|-$)/g, '')
              : '') ||
            `category-${Date.now()}`;
          return { id: normalizedId, name, desc };
        }
        return formData;
      };

      const payload = buildPayload();
      console.log(`[Registrations] Saving to ${tableName}...`, payload);

      if (editingItem) {
        const { error } = await supabase
          .from(tableName)
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success(getSuccessMessage(activeType, true));
      } else {
        if (activeType === 'Usuários') {
          console.log('[Registrations] Creating Auth user (isolated)...');
          const { data: authData, error: authError } = await authClient.auth.signUp({
            email: formData.email,
            password: 'Ttickett191406*',
            options: {
              data: {
                role: normalizeUserRole((formData || {}).role),
              },
            },
          });
          
          if (authError) {
            console.error('[Registrations] Auth SignUp Error:', authError);
            throw authError;
          }

          console.log('[Registrations] Auth user created:', authData?.user?.id);

          const { error: userError } = await supabase
            .from('users')
            .insert({
              ...(payload || {}),
              id: authData?.user?.id,
              createdAt: new Date().toISOString()
            });
          
          if (userError) {
            console.error('[Registrations] Database User Insert Error:', userError);
            throw userError;
          }
        } else {
          const { error } = await supabase
            .from(tableName)
            .insert({
              ...(payload || {}),
              createdAt: new Date().toISOString()
            });
          if (error) throw error;
        }
        toast.success(getSuccessMessage(activeType, false));
      }

      await refreshRegistrationLists();

      if (currentUser?.role === 'agent') {
        onBackToDashboard?.();
      } else {
        setViewMode('list');
        setEditingItem(null);
        setFormData({});
      }
    } catch (error) {
      console.error("Error saving:", error);
      const msg =
        (error as any)?.message ||
        (error as any)?.error_description ||
        (error as any)?.details ||
        'Erro desconhecido';
      toast.error(`Erro ao salvar: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (type: RegistrationType, id: string) => {
    setDeleteConfirm({ type, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    
    try {
      let tableName = '';
      switch (type) {
        case 'Organizações': tableName = 'organizations'; break;
        case 'Usuários': tableName = 'users'; break;
        case 'Plataformas': tableName = 'platforms'; break;
        case 'Categorias': tableName = 'categories'; break;
      }
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success(getDeleteMessage(type));
      await refreshRegistrationLists();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao excluir");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleEdit = (type: RegistrationType, item: any) => {
    setActiveType(type);
    if (type === 'Organizações') {
      setEditingItem(normalizeOrganization(item));
    } else if (type === 'Usuários') {
      setEditingItem({ ...(item || {}), role: normalizeUserRole(item?.role) });
    } else {
      setEditingItem(item);
    }
    setViewMode('form');
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderContent = () => {
    if (viewMode === 'form' && activeType) {
      return (
        <div className="flex-1 flex flex-col min-h-0 bg-discord-darkest overflow-y-auto p-4 md:p-6 pb-20 md:pb-32">
          <div className="max-w-2xl mx-auto w-full">
            <button 
              onClick={() => {
                if (currentUser?.role === 'agent') {
                  onBackToDashboard?.();
                } else {
                  setViewMode(editingItem ? 'list' : 'grid');
                  setEditingItem(null);
                }
              }}
              className="flex items-center gap-2 text-discord-muted hover:text-discord-text mb-4 md:mb-6 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-widest">
                {currentUser?.role === 'agent' ? 'Voltar para Tickets' : `Voltar para ${editingItem ? 'Listagem' : 'Cadastros'}`}
              </span>
            </button>

            <div className="bg-discord-dark rounded-xl border border-discord-border overflow-hidden shadow-2xl">
              <div className="p-4 md:p-6 border-b border-discord-border flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-discord-darkest rounded-xl flex items-center justify-center text-discord-accent shrink-0">
                  {activeType === 'Organizações' && <Building2 className="w-5 h-5 md:w-6 md:h-6" />}
                  {activeType === 'Usuários' && <Users className="w-5 h-5 md:w-6 md:h-6" />}
                  {activeType === 'Plataformas' && <Monitor className="w-5 h-5 md:w-6 md:h-6" />}
                  {activeType === 'Categorias' && <Tag className="w-5 h-5 md:w-6 md:h-6" />}
                </div>
                <div>
                  <h2 className="text-discord-text font-bold text-lg md:text-xl">
                    {editingItem ? 'Editar' : 'Novo Cadastro'}: {getSingularName(activeType)}
                  </h2>
                  <p className="text-discord-muted text-[10px] md:text-xs">Preencha os campos abaixo para registrar no sistema.</p>
                </div>
              </div>

              <form onSubmit={handleSave} className="p-4 md:p-6 pb-32 space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Nome / Título</label>
                    <input 
                      required
                      type="text" 
                      value={formData.name || ''}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder={`Ex: ${activeType === 'Organizações' ? 'Empresa XYZ' : activeType === 'Usuários' ? 'João Silva' : activeType === 'Plataformas' ? 'Portal do Cliente' : 'Bug Crítico'}`}
                      className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                    />
                  </div>

                  {activeType === 'Organizações' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Plataformas Permitidas</label>
                        <MultiSelect
                          options={platforms.map(p => ({ id: p.id, name: p.name }))}
                          selectedIds={formData.platforms || []}
                          onChange={(selectedIds) => handleInputChange('platforms', selectedIds)}
                          placeholder="Selecione as plataformas..."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Categorias Permitidas</label>
                        <MultiSelect
                          options={categories.map(c => ({ id: c.id, name: c.name }))}
                          selectedIds={formData.categories || []}
                          onChange={(selectedIds) => handleInputChange('categories', selectedIds)}
                          placeholder="Selecione as categorias..."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Endereço</label>
                        <input 
                          type="text" 
                          value={formData.address || ''}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                          placeholder="Ex: Av. Paulista, 1000"
                          className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Telefone</label>
                        <input 
                          type="tel" 
                          value={formData.phone || ''}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          placeholder="Ex: (11) 99999-9999"
                          className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Pessoa de Contato</label>
                        <input 
                          type="text" 
                          value={formData.contactPerson || ''}
                          onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                          placeholder="Ex: João Silva"
                          className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">E-mail de Contato</label>
                        <input 
                          type="email" 
                          value={formData.email || ''}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="Ex: contato@empresa.com"
                          className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Observações</label>
                        <textarea 
                          rows={3}
                          value={formData.observations || ''}
                          onChange={(e) => handleInputChange('observations', e.target.value)}
                          placeholder="Notas adicionais sobre a organização..."
                          className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all resize-none"
                        />
                      </div>
                    </>
                  )}

                  {activeType === 'Usuários' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">E-mail</label>
                        <input 
                          required
                          type="email" 
                          value={formData.email || ''}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="usuario@empresa.com"
                          className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Cargo / Função</label>
                        <select 
                          value={formData.role || 'client'}
                          onChange={(e) => handleInputChange('role', e.target.value)}
                          className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                        >
                          <option value="client">Cliente</option>
                          <option value="agent">Atendente</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Organização</label>
                        <select 
                          value={formData.organizationId || ''}
                          onChange={(e) => handleInputChange('organizationId', e.target.value)}
                          className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                        >
                          <option value="">Nenhuma</option>
                          {organizations.map(org => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Telefone</label>
                        <input 
                          type="tel" 
                          value={formData.phone || ''}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          placeholder="Ex: (11) 99999-9999"
                          className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">WhatsApp</label>
                        <input 
                          type="tel" 
                          value={formData.whatsapp || ''}
                          onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                          placeholder="Ex: (11) 99999-9999"
                          className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Observações</label>
                        <textarea 
                          rows={3}
                          value={formData.observations || ''}
                          onChange={(e) => handleInputChange('observations', e.target.value)}
                          placeholder="Notas adicionais sobre o usuário..."
                          className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all resize-none"
                        />
                      </div>
                    </>
                  )}

                  {activeType === 'Plataformas' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">URL de Acesso</label>
                        <input 
                          required
                          type="url" 
                          value={formData.url || ''}
                          onChange={(e) => handleInputChange('url', e.target.value)}
                          placeholder="https://sistema.exemplo.com"
                          className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Ambiente</label>
                        <div className="flex gap-4">
                          {['Produção', 'Homologação', 'Desenvolvimento'].map(env => (
                            <label key={env} className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="radio" 
                                name="env" 
                                value={env}
                                checked={formData.env === env}
                                onChange={(e) => handleInputChange('env', e.target.value)}
                                className="accent-discord-accent" 
                              />
                              <span className="text-xs text-discord-muted group-hover:text-discord-text">{env}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {activeType === 'Categorias' && (
                    <div className="space-y-2">
                      <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Descrição Detalhada</label>
                      <textarea 
                        rows={4}
                        value={formData.desc || ''}
                        onChange={(e) => handleInputChange('desc', e.target.value)}
                        placeholder="Descreva a finalidade deste registro..."
                        className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all resize-none"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-discord-border flex gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      if (currentUser?.role === 'agent') {
                        onBackToDashboard?.();
                      } else {
                        setViewMode(editingItem ? 'list' : 'grid');
                        setEditingItem(null);
                      }
                    }}
                    className="flex-1 py-3 bg-transparent border border-discord-border text-discord-text text-xs font-bold uppercase tracking-widest rounded hover:bg-discord-hover transition-colors"
                  >
                    {currentUser?.role === 'agent' ? 'Voltar' : 'Cancelar'}
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-3 bg-discord-accent text-white text-xs font-bold uppercase tracking-widest rounded hover:bg-discord-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSaving ? 'Salvando...' : 'Salvar Registro'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      );
    }

    if (viewMode === 'list' && activeType) {
      const data = dataMap[activeType] || [];
      
      return (
        <div className="flex-1 flex flex-col min-h-0 bg-discord-darkest overflow-y-auto p-4 md:p-6 pb-20 md:pb-32">
          <div className="max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <button 
                onClick={() => setViewMode('grid')}
                className="flex items-center gap-2 text-discord-muted hover:text-discord-text transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Voltar para Cadastros</span>
                <span className="text-xs font-bold uppercase tracking-widest sm:hidden">Voltar</span>
              </button>
              <button 
                onClick={() => {
                  setEditingItem(null);
                  setViewMode('form');
                }}
                className="px-3 md:px-4 py-2 bg-discord-accent text-white text-[10px] md:text-xs font-bold uppercase tracking-widest rounded hover:bg-discord-accent/90 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>INCLUIR</span>
              </button>
            </div>

            <div className="bg-discord-dark rounded-xl border border-discord-border overflow-hidden shadow-2xl">
              <div className="p-4 md:p-6 border-b border-discord-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-discord-darkest rounded-lg p-1 border border-discord-border shrink-0">
                    <button
                      onClick={() => {
                        const data = dataMap[activeType];
                        exportToExcel(data, `Relatorio_${activeType}`);
                        toast.success(`Excel de ${activeType} gerado!`);
                      }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-discord-muted hover:text-discord-text hover:bg-discord-hover transition-all group"
                      title="Exportar Excel"
                    >
                      <FileSpreadsheet className="w-4 h-4 group-hover:text-emerald-400 transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-tighter">Excel</span>
                    </button>
                    <div className="w-px h-4 bg-discord-border mx-0.5" />
                    <button
                      onClick={() => {
                        const data = dataMap[activeType];
                        if (activeType === 'Usuários') exportUsersToPDF(data, 'Relatório de Usuários');
                        else if (activeType === 'Organizações') exportOrganizationsToPDF(data, 'Relatório de Organizações');
                        else if (activeType === 'Plataformas') exportPlatformsToPDF(data, 'Relatório de Plataformas');
                        else if (activeType === 'Categorias') exportCategoriesToPDF(data, 'Relatório de Categorias');
                        toast.success(`PDF de ${activeType} gerado!`);
                      }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-discord-muted hover:text-discord-text hover:bg-discord-hover transition-all group"
                      title="Exportar PDF"
                    >
                      <FileText className="w-4 h-4 group-hover:text-red-400 transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-tighter">PDF</span>
                    </button>
                  </div>
                  <div className="hidden md:block">
                    <h2 className="text-discord-text font-bold text-lg md:text-xl">Listagem de {activeType}</h2>
                    <p className="text-discord-muted text-[10px] md:text-xs">Visualize e gerencie todos os registros de {activeType.toLowerCase()}.</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-discord-darkest/50">
                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Nome</th>
                      {activeType === 'Organizações' && (
                        <>
                          <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Plataformas</th>
                          <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Categorias</th>
                        </>
                      )}
                      {activeType === 'Usuários' && (
                        <>
                          <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">E-mail</th>
                          <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Cargo</th>
                          <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Organização</th>
                        </>
                      )}
                      {activeType === 'Plataformas' && (
                        <>
                          <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">URL</th>
                          <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Ambiente</th>
                        </>
                      )}
                      {activeType === 'Categorias' && (
                        <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border">Descrição</th>
                      )}
                      <th className="p-4 text-[10px] text-discord-muted font-black uppercase tracking-widest border-b border-discord-border text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-discord-border">
                    {data.map((item: any) => (
                      <tr key={item.id} className="hover:bg-discord-hover transition-colors group">
                        <td className="p-4 text-sm text-discord-text font-medium">{item.name}</td>
                        {activeType === 'Organizações' && (
                          <>
                            <td className="p-4 text-sm text-discord-muted">{(item.platforms || []).length} permitidas</td>
                            <td className="p-4 text-sm text-discord-muted">{(item.categories || []).length} permitidas</td>
                          </>
                        )}
                        {activeType === 'Usuários' && (
                          <>
                            <td className="p-4 text-sm text-discord-muted">{item.email}</td>
                            <td className="p-4">
                              <span className={cn(
                                "text-[10px] font-black bg-discord-darkest px-2 py-0.5 rounded uppercase tracking-tighter",
                                item.role === 'admin' ? "text-discord-accent" : item.role === 'agent' ? "text-blue-400" : "text-emerald-400"
                              )}>
                                {item.role === 'admin' ? 'Administrador' : item.role === 'agent' ? 'Atendente' : 'Cliente'}
                              </span>
                            </td>
                            <td className="p-4 text-sm text-discord-muted">
                              {organizations.find(org => org.id === item.organizationId)?.name || '-'}
                            </td>
                          </>
                        )}
                        {activeType === 'Plataformas' && (
                          <>
                            <td className="p-4 text-sm text-discord-muted truncate max-w-[200px]">{item.url}</td>
                            <td className="p-4">
                              <span className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter",
                                item.env === 'Produção' ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                              )}>
                                {item.env}
                              </span>
                            </td>
                          </>
                        )}
                        {activeType === 'Categorias' && (
                          <td className="p-4 text-sm text-discord-muted italic truncate max-w-[300px]">{item.desc}</td>
                        )}
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleEdit(activeType, item)}
                            className="text-discord-muted hover:text-discord-text text-xs font-bold uppercase tracking-widest mr-4"
                          >
                            Editar
                          </button>
                          <button 
                            onClick={() => handleDelete(activeType, item.id)}
                            className="text-red-600/50 dark:text-red-400/50 hover:text-red-600 dark:hover:text-red-400 text-xs font-bold uppercase tracking-widest"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {registrationTypes.map((type, idx) => (
              <div 
                key={idx}
                className="bg-discord-dark p-6 rounded-lg border border-discord-border hover:border-discord-accent/50 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-discord-darkest rounded-xl flex items-center justify-center text-discord-muted group-hover:text-discord-accent transition-colors">
                    <type.icon className="w-6 h-6" />
                  </div>
                  <button 
                    onClick={() => {
                      setActiveType(type.id);
                      setViewMode('form');
                    }}
                    className="p-2 bg-discord-accent/10 text-discord-accent rounded-md hover:bg-discord-accent hover:text-white transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex items-baseline gap-2">
                  <h3 className="text-discord-text font-bold text-lg">{type.label}</h3>
                  <span className="text-discord-muted text-xs font-black bg-discord-darkest px-2 py-0.5 rounded">{type.count}</span>
                </div>
                <p className="text-discord-muted text-sm mt-1">{type.desc}</p>
                
                <button 
                  onClick={() => {
                    setActiveType(type.id);
                    setViewMode('list');
                  }}
                  className="mt-6 w-full py-2 bg-discord-darkest hover:bg-discord-hover text-discord-text text-xs font-bold uppercase tracking-widest rounded transition-colors"
                >
                  Ver Todos
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 bg-discord-accent/5 rounded-xl border border-discord-accent/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-discord-text font-bold">Relatórios Gerenciais</h4>
                <p className="text-discord-muted text-xs mt-1">Exporte dados completos do sistema em Excel ou PDF.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const allData = [
                      ...organizations.map(o => ({ Tipo: 'Organização', Nome: o.name, Contato: o.contactPerson || '-', Email: o.email || '-' })),
                      ...users.map(u => ({ Tipo: 'Usuário', Nome: u.name, Email: u.email, Cargo: u.role })),
                      ...platforms.map(p => ({ Tipo: 'Plataforma', Nome: p.name, URL: p.url, Ambiente: p.env })),
                      ...categories.map(c => ({ Tipo: 'Categoria', Nome: c.name, Descrição: c.desc }))
                    ];
                    exportToExcel(allData, 'Relatorio_Geral_Cadastros');
                    toast.success('Excel gerado com sucesso!');
                  }}
                  className="px-4 py-2 bg-discord-darkest text-discord-text text-xs font-bold uppercase tracking-widest rounded hover:bg-discord-hover transition-colors flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel Geral
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <button 
                onClick={() => exportOrganizationsToPDF(organizations, 'Relatório de Organizações')}
                className="p-3 bg-discord-dark rounded-lg border border-discord-border hover:border-discord-accent/50 transition-all text-left flex items-center gap-3"
              >
                <Building2 className="w-4 h-4 text-discord-muted" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-discord-text">PDF Organizações</span>
              </button>
              <button 
                onClick={() => exportUsersToPDF(users, 'Relatório de Usuários')}
                className="p-3 bg-discord-dark rounded-lg border border-discord-border hover:border-discord-accent/50 transition-all text-left flex items-center gap-3"
              >
                <Users className="w-4 h-4 text-discord-muted" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-discord-text">PDF Usuários</span>
              </button>
              <button 
                onClick={() => exportAccessLogsToPDF([], 'Relatório de Logs de Acesso')}
                className="p-3 bg-discord-dark rounded-lg border border-discord-border hover:border-discord-accent/50 transition-all text-left flex items-center gap-3"
              >
                <ShieldCheck className="w-4 h-4 text-discord-muted" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-discord-text">PDF Acessos</span>
              </button>
              <button 
                onClick={() => {
                  const logsExcel = [].map((l: any) => ({
                    Usuário: l.userName,
                    Email: l.userEmail,
                    Ação: l.action,
                    IP: l.ip,
                    Data: format(l.timestamp, 'dd/MM/yyyy HH:mm')
                  }));
                  exportToExcel(logsExcel, 'Relatorio_Acessos');
                  toast.success('Logs de acesso exportados!');
                }}
                className="p-3 bg-discord-dark rounded-lg border border-discord-border hover:border-discord-accent/50 transition-all text-left flex items-center gap-3"
              >
                <FileSpreadsheet className="w-4 h-4 text-discord-muted" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-discord-text">Excel Acessos</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-discord-darkest">
      {renderContent()}

      {/* Delete Confirmation Modal */}
      <AnimatePresence mode="wait">
        {deleteConfirm && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-discord-dark w-full max-w-md rounded-xl border border-discord-border shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-discord-text font-bold text-lg">Confirmar Exclusão</h3>
                    <p className="text-discord-muted text-sm">{getDeleteConfirmMessage(deleteConfirm.type)}</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 py-2 bg-discord-darkest hover:bg-discord-hover text-discord-text text-xs font-bold uppercase tracking-widest rounded border border-discord-border transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest rounded transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
