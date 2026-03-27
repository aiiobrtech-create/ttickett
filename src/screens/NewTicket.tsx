import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Monitor, FileText, X, Upload, Image as ImageIcon, Trash2, Tag, Building2, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { Platform, User, TicketUrgency, Organization, PlatformType, CategoryType, Company } from '../types';
import { cn } from '../lib/utils';
import { isTtickettAdministrator } from '../lib/roles';
import { supabase, uploadFile } from '../supabase';

interface NewTicketProps {
  currentUser: User;
  onCancel: () => void;
  onSubmit: (data: { 
    subject: string; 
    description: string; 
    platform: Platform;
    category: string;
    urgency: TicketUrgency;
    attachment?: { name: string; url: string; type: 'image' | 'file' };
    organizationId?: string | null;
  }) => void;
}

export const NewTicket: React.FC<NewTicketProps> = ({ currentUser, onCancel, onSubmit }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [platformsData, setPlatformsData] = useState<PlatformType[]>([]);
  const [categoriesData, setCategoriesData] = useState<CategoryType[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: orgs, error: orgsError } = await supabase.from('organizations').select('*');
        if (orgsError) console.error('[NewTicket] Error fetching organizations:', orgsError);

        const { data: comps, error: compsError } = await supabase.from('companies').select('*');
        if (compsError) console.error('[NewTicket] Error fetching companies:', compsError);
        
        const { data: platforms, error: platformsError } = await supabase.from('platforms').select('*');
        if (platformsError) console.error('[NewTicket] Error fetching platforms:', platformsError);
        
        const { data: categories, error: categoriesError } = await supabase.from('categories').select('*');
        if (categoriesError) console.error('[NewTicket] Error fetching categories:', categoriesError);
        
        if (orgs) setOrganizations(orgs);
        if (comps) setCompanies(comps);
        if (platforms) setPlatformsData(platforms);
        if (categories) setCategoriesData(categories);
      } catch (err: any) {
        console.error('[NewTicket] Critical error in fetchData:', err.message);
      }
    };
    fetchData();
  }, []);

  const isSuper = isTtickettAdministrator(currentUser.role);

  const visibleOrgs = useMemo(() => {
    if (isSuper) {
      return organizations.filter((o) => !selectedCompanyId || o.companyId === selectedCompanyId);
    }
    const orgIds = Array.isArray(currentUser.organizationIds) ? currentUser.organizationIds : [];
    if (orgIds.length) {
      return organizations.filter((o) => orgIds.includes(o.id));
    }
    if (currentUser.organizationId) {
      return organizations.filter((o) => o.id === currentUser.organizationId);
    }
    if (currentUser.companyId) {
      return organizations.filter((o) => o.companyId === currentUser.companyId);
    }
    return organizations;
  }, [organizations, currentUser.organizationIds, currentUser.organizationId, currentUser.companyId, isSuper, selectedCompanyId]);

  useEffect(() => {
    if (isSuper) return;
    if (currentUser.organizationId) return;
    const orgIds = Array.isArray(currentUser.organizationIds) ? currentUser.organizationIds : [];
    const needsPick = !!currentUser.companyId || orgIds.length > 1;
    if (!needsPick) return;
    if (visibleOrgs.length === 0) {
      setSelectedOrgId('');
      return;
    }
    setSelectedOrgId((prev) => (prev && visibleOrgs.some((o) => o.id === prev) ? prev : visibleOrgs[0].id));
  }, [visibleOrgs, currentUser.organizationId, currentUser.companyId, currentUser.organizationIds, isSuper]);

  useEffect(() => {
    if (!isSuper) return;
    if (!companies.length) return;
    setSelectedCompanyId((prev) => prev || companies[0].id);
  }, [isSuper, companies]);

  const userOrg = currentUser.organizationId
    ? organizations.find((org) => org.id === currentUser.organizationId)
    : selectedOrgId
      ? organizations.find((org) => org.id === selectedOrgId)
      : null;

  const userCompany = userOrg?.companyId
    ? companies.find((c) => c.id === userOrg.companyId)
    : currentUser.companyId
      ? companies.find((c) => c.id === currentUser.companyId)
      : selectedCompanyId
        ? companies.find((c) => c.id === selectedCompanyId)
        : null;

  const availablePlatforms = userOrg 
    ? platformsData.filter(p => userOrg.platforms.includes(p.id))
    : platformsData;

  const availableCategories = userOrg
    ? categoriesData.filter(c => userOrg.categories.includes(c.id))
    : categoriesData;

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState<Platform>('');
  const [category, setCategory] = useState<string>('');
  const [urgency, setUrgency] = useState<TicketUrgency>('Média');
  const [selectedFile, setSelectedFile] = useState<{ name: string; url: string; type: 'image' | 'file' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set initial values when data is loaded
  useEffect(() => {
    if (availablePlatforms.length > 0 && !platform) {
      setPlatform(availablePlatforms[0].name as Platform);
    }
    if (availableCategories.length > 0 && !category) {
      setCategory(availableCategories[0].name);
    }
  }, [availablePlatforms, availableCategories, platform, category]);

  const platforms: Platform[] = availablePlatforms.map(p => p.name as Platform);
  const categories: string[] = availableCategories.map(c => c.name);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim() || !platform || !category) return;
    if (isSuper && (!selectedCompanyId || !selectedOrgId)) {
      toast.error('Selecione Empresa e Organização para abrir o ticket.');
      return;
    }
    if (!isSuper) {
      const orgIds = Array.isArray(currentUser.organizationIds) ? currentUser.organizationIds : [];
      if (!currentUser.organizationId && (currentUser.companyId || orgIds.length > 1) && !selectedOrgId) {
        toast.error('Selecione a organização para abrir o ticket.');
        return;
      }
    }
    onSubmit({ 
      subject, 
      description, 
      platform, 
      category, 
      urgency, 
      attachment: selectedFile || undefined,
      organizationId: currentUser.organizationId || selectedOrgId || null,
    });
  };

  const urgencyLevels: { label: TicketUrgency; color: string; activeBorder: string; activeBg: string; description: string }[] = [
    { label: 'Baixa', color: 'bg-emerald-500', activeBorder: 'border-emerald-500', activeBg: 'bg-emerald-500/10', description: 'Dúvidas ou melhorias' },
    { label: 'Média', color: 'bg-sky-500', activeBorder: 'border-sky-500', activeBg: 'bg-sky-500/10', description: 'Problemas leves' },
    { label: 'Alta', color: 'bg-orange-500', activeBorder: 'border-orange-500', activeBg: 'bg-orange-500/10', description: 'Erro importante' },
    { label: 'Crítica', color: 'bg-red-500', activeBorder: 'border-red-500', activeBg: 'bg-red-500/10', description: 'Sistema parado' },
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploadedFile = await uploadFile(file);
      setSelectedFile(uploadedFile);
      toast.success('Arquivo anexado com sucesso!');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erro ao fazer upload do arquivo. Verifique se o bucket "tickets" existe no Supabase.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex-1 min-h-0 bg-discord-dark overflow-y-auto overflow-x-hidden">
      <div className="max-w-3xl mx-auto w-full min-w-0 px-4 py-6 sm:p-6 md:p-8 pb-28 md:pb-32">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 sm:mb-8 min-w-0">
          <div className="min-w-0 pr-2">
            <h2 className="text-xl sm:text-2xl font-black text-discord-text tracking-tight">Abrir Novo Ticket</h2>
            <p className="text-discord-muted text-xs sm:text-sm mt-1">Conte-nos o que está acontecendo e nossa equipe ajudará você.</p>
          </div>
          <button 
            onClick={onCancel}
            className="p-2 text-discord-muted hover:text-discord-text hover:bg-discord-hover rounded-full transition-all self-end sm:self-start shrink-0"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-discord-darker p-4 sm:p-6 rounded-xl border border-discord-border space-y-4 sm:space-y-6 min-w-0">
            {/* Empresa/Organização */}
            {isSuper ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-discord-muted uppercase tracking-widest mb-3">Empresa *</label>
                  <div className="relative">
                    <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-discord-muted" />
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedCompanyId(v);
                        setSelectedOrgId('');
                      }}
                      required
                      className="w-full bg-discord-darkest border-none rounded-md p-3 pl-10 text-discord-text focus:ring-2 focus:ring-discord-accent transition-all outline-none"
                    >
                      <option value="">Selecione...</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-discord-muted uppercase tracking-widest mb-3">Organização *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-discord-muted" />
                    <select
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                      required
                      className="w-full bg-discord-darkest border-none rounded-md p-3 pl-10 text-discord-text focus:ring-2 focus:ring-discord-accent transition-all outline-none"
                    >
                      <option value="">Selecione...</option>
                      {visibleOrgs.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-discord-muted uppercase tracking-widest mb-3">Empresa</label>
                  <div className="relative">
                    <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-discord-muted" />
                    <input
                      value={userCompany?.name || '-'}
                      disabled
                      className="w-full bg-discord-darkest/50 border-none rounded-md p-3 pl-10 text-discord-muted outline-none cursor-not-allowed"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-discord-muted uppercase tracking-widest mb-3">Organização</label>
                  {currentUser.organizationId ? (
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-discord-muted" />
                      <input
                        value={userOrg?.name || '-'}
                        disabled
                        className="w-full bg-discord-darkest/50 border-none rounded-md p-3 pl-10 text-discord-muted outline-none cursor-not-allowed"
                      />
                    </div>
                  ) : (currentUser.companyId || (Array.isArray(currentUser.organizationIds) && currentUser.organizationIds.length > 1)) ? (
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-discord-muted" />
                      <select
                        value={selectedOrgId}
                        onChange={(e) => setSelectedOrgId(e.target.value)}
                        required
                        className="w-full bg-discord-darkest border-none rounded-md p-3 pl-10 text-discord-text focus:ring-2 focus:ring-discord-accent transition-all outline-none"
                      >
                        <option value="">Selecione...</option>
                        {visibleOrgs.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-discord-muted" />
                      <input
                        value={userOrg?.name || '-'}
                        disabled
                        className="w-full bg-discord-darkest/50 border-none rounded-md p-3 pl-10 text-discord-muted outline-none cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Legado: quando for cliente escopado por empresa sem org fixa, seleção acima já cobre */}
            {!currentUser.organizationId && currentUser.companyId && false && (
              <div>
                <label className="block text-xs font-black text-discord-muted uppercase tracking-widest mb-3">Organização *</label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  required
                  className="w-full bg-discord-darkest border-none rounded-md p-3 text-discord-text focus:ring-2 focus:ring-discord-accent transition-all outline-none"
                >
                  <option value="">Selecione...</option>
                  {visibleOrgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-black text-discord-muted uppercase tracking-widest mb-3">Assunto do Problema</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Erro ao carregar extrato mensal"
                className="w-full bg-discord-darkest border-none rounded-md p-3 text-discord-text focus:ring-2 focus:ring-discord-accent transition-all outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-black text-discord-muted uppercase tracking-widest mb-3">Plataforma Relacionada</label>
                <div className="relative">
                  <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-discord-muted" />
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as Platform)}
                    className="w-full bg-discord-darkest border-none rounded-md p-3 pl-10 text-discord-text focus:ring-2 focus:ring-discord-accent transition-all outline-none appearance-none cursor-pointer"
                  >
                    {platforms.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-discord-muted uppercase tracking-widest mb-3">Categoria</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-discord-muted" />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-discord-darkest border-none rounded-md p-3 pl-10 text-discord-text focus:ring-2 focus:ring-discord-accent transition-all outline-none appearance-none cursor-pointer"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-discord-muted uppercase tracking-widest mb-3">Anexar Arquivo (Opcional)</label>
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              {!selectedFile ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-discord-darkest border-2 border-dashed border-discord-border rounded-md p-3 flex items-center justify-center gap-2 cursor-pointer hover:border-discord-accent/50 transition-colors group"
                >
                  <Upload className={cn("w-4 h-4", isUploading ? "animate-spin" : "text-discord-muted group-hover:text-discord-accent")} />
                  <span className="text-xs text-discord-muted font-bold uppercase tracking-wider group-hover:text-discord-text">
                    {isUploading ? 'Fazendo upload...' : 'Upload de imagem ou log'}
                  </span>
                </div>
              ) : (
                <div className="w-full bg-discord-darkest border border-discord-accent/30 rounded-md p-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-discord-dark flex items-center justify-center shrink-0">
                    {selectedFile.type === 'image' ? (
                      <ImageIcon className="w-4 h-4 text-discord-accent" />
                    ) : (
                      <FileText className="w-4 h-4 text-discord-accent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-discord-text font-bold truncate">{selectedFile.name}</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="p-1 text-discord-muted hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-black text-discord-muted uppercase tracking-widest mb-3">Nível de Urgência</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {urgencyLevels.map((level) => (
                  <button
                    key={level.label}
                    type="button"
                    onClick={() => setUrgency(level.label)}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-lg border transition-all text-left group/btn",
                      urgency === level.label 
                        ? `${level.activeBorder} ${level.activeBg} ring-1 ring-offset-0 ring-opacity-50` 
                        : "border-discord-border bg-discord-darkest hover:border-discord-muted"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("w-2 h-2 rounded-full", level.color)} />
                      <span className={cn("text-xs font-bold", urgency === level.label ? "text-discord-text" : "text-discord-muted group-hover/btn:text-discord-text")}>
                        {level.label}
                      </span>
                    </div>
                    <p className="text-[9px] text-discord-muted leading-tight">{level.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-discord-muted uppercase tracking-widest mb-3">Descrição Detalhada</label>
              <div className="relative">
                <FileText className="absolute left-3 top-4 w-4 h-4 text-discord-muted" />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o passo a passo do erro ou sua dúvida..."
                  rows={6}
                  className="w-full bg-discord-darkest border-none rounded-md p-3 pl-10 text-discord-text focus:ring-2 focus:ring-discord-accent transition-all outline-none resize-none"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2.5 text-discord-text font-bold text-sm hover:underline"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-discord-accent hover:bg-discord-accent/90 text-white font-bold px-8 py-2.5 rounded-md transition-all duration-200 flex items-center gap-2 shadow-lg shadow-discord-accent/20 active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              Abrir Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
