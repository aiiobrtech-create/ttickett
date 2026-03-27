import React, { useState } from 'react';
import { Settings as SettingsIcon, Bell, Lock, User as UserIcon, Palette, ArrowLeft, Save, Check, Globe, Shield, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '../types';
import { cn } from '../lib/utils';
import { AvatarDisplay } from '../components/AvatarDisplay';
import { AvatarSelector } from '../components/AvatarSelector';

interface SettingsProps {
  currentUser: User;
  onUpdateUser: (user: Partial<User>) => void;
  accentColor: string;
  onUpdateAccentColor: (color: string) => void;
  theme: 'dark' | 'light';
  onUpdateTheme: (theme: 'dark' | 'light') => void;
}

type SectionId = 'account' | 'security' | 'appearance';

export const Settings: React.FC<SettingsProps> = ({ 
  currentUser, 
  onUpdateUser, 
  accentColor, 
  onUpdateAccentColor,
  theme,
  onUpdateTheme
}) => {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);

  // Form States
  const [profile, setProfile] = useState({
    name: currentUser.name,
    email: currentUser.email,
    language: 'Português (Brasil)'
  });

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [appearance, setAppearance] = useState({
    theme: theme,
    accentColor: accentColor
  });

  const sections = [
    { id: 'account' as const, icon: UserIcon, label: 'Minha Conta', desc: 'Gerencie suas informações pessoais e avatar.' },
    { id: 'security' as const, icon: Lock, label: 'Segurança', desc: 'Altere sua senha e gerencie sessões ativas.' },
    { id: 'appearance' as const, icon: Palette, label: 'Aparência', desc: 'Personalize o tema e as cores do sistema.' },
  ];

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    setTimeout(() => {
      onUpdateUser({ name: profile.name, email: profile.email });
      setIsSaving(false);
      toast.success('Perfil atualizado com sucesso!');
      setActiveSection(null);
    }, 1000);
  };

  const handleSaveAppearance = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    setTimeout(() => {
      onUpdateAccentColor(appearance.accentColor);
      onUpdateTheme(appearance.theme as 'dark' | 'light');
      setIsSaving(false);
      toast.success('Aparência atualizada com sucesso!');
      setActiveSection(null);
    }, 1000);
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeSection === 'security') {
      if (security.newPassword && security.newPassword !== security.confirmPassword) {
        toast.error('As senhas não coincidem.');
        return;
      }
      if (security.newPassword && !security.currentPassword) {
        toast.error('Informe a senha atual para alterar.');
        return;
      }
    }

    setIsSaving(true);
    
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Configurações salvas com sucesso!');
      if (activeSection === 'security') {
        setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
      setActiveSection(null);
    }, 1000);
  };

  const handleAvatarSelect = (avatarUrl: string) => {
    onUpdateUser({ avatar: avatarUrl });
    setShowAvatarSelector(false);
    toast.success('Avatar atualizado com sucesso!');
  };

  if (activeSection === 'account') {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-discord-darkest overflow-y-auto p-4 md:p-6 pb-20 md:pb-32">
        {showAvatarSelector && (
          <AvatarSelector 
            currentUser={currentUser} 
            onSelect={handleAvatarSelect} 
            onClose={() => setShowAvatarSelector(false)} 
          />
        )}
        <div className="max-w-2xl mx-auto w-full">
          <button 
            onClick={() => setActiveSection(null)}
            className="flex items-center gap-2 text-discord-muted hover:text-discord-text mb-4 md:mb-6 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-widest">Voltar</span>
          </button>

          <div className="bg-discord-dark rounded-xl border border-discord-border overflow-hidden shadow-2xl">
            <div className="p-4 md:p-6 border-b border-discord-border flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-discord-darkest rounded-xl flex items-center justify-center text-discord-accent shrink-0">
                <UserIcon className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h2 className="text-discord-text font-bold text-lg md:text-xl">Minha Conta</h2>
                <p className="text-discord-muted text-[10px] md:text-xs">Atualize suas informações de perfil.</p>
              </div>
            </div>

            <form onSubmit={handleSaveAccount} className="p-4 md:p-6 space-y-4 md:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-6 md:mb-8">
                <div className="relative group cursor-pointer self-start sm:self-auto" onClick={() => setShowAvatarSelector(true)}>
                  <AvatarDisplay user={currentUser} className="w-20 h-20" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <Palette className="w-6 h-6 text-discord-text" />
                  </div>
                </div>
                <div>
                  <button 
                    type="button" 
                    onClick={() => setShowAvatarSelector(true)}
                    className="px-4 py-2 bg-discord-darkest text-discord-text text-xs font-bold uppercase tracking-widest rounded hover:bg-discord-hover transition-colors"
                  >
                    Alterar Avatar
                  </button>
                  <p className="text-discord-muted text-[10px] mt-2">Recomendado: 512x512px. Máx 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Nome Completo</label>
                  <input 
                    required
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">E-mail</label>
                  <input 
                    type="email"
                    required
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Cargo</label>
                  <input 
                    disabled
                    defaultValue={currentUser.role === 'ttickett_admin' ? 'ADMIN. TTICKETT' : currentUser.role === 'admin' ? 'ADMINISTRADOR (EMPRESA)' : currentUser.role === 'agent' ? 'ATENDENTE' : 'CLIENTE'}
                    className="w-full bg-discord-darkest/50 border border-discord-border rounded-md p-3 text-sm text-discord-muted outline-none cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Idioma</label>
                  <select 
                    value={profile.language}
                    onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                    className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                  >
                    <option>Português (Brasil)</option>
                    <option>English (US)</option>
                    <option>Español</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 border-t border-discord-border flex justify-end">
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-8 py-3 bg-discord-accent text-white text-xs font-bold uppercase tracking-widest rounded hover:bg-discord-accent/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'security') {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-discord-darkest overflow-y-auto p-4 md:p-6 pb-20 md:pb-32">
        <div className="max-w-2xl mx-auto w-full">
          <button 
            onClick={() => setActiveSection(null)}
            className="flex items-center gap-2 text-discord-muted hover:text-discord-text mb-4 md:mb-6 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-widest">Voltar</span>
          </button>

          <div className="bg-discord-dark rounded-xl border border-discord-border overflow-hidden shadow-2xl">
            <div className="p-4 md:p-6 border-b border-discord-border flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-discord-darkest rounded-xl flex items-center justify-center text-discord-accent shrink-0">
                <Lock className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h2 className="text-discord-text font-bold text-lg md:text-xl">Segurança</h2>
                <p className="text-discord-muted text-[10px] md:text-xs">Proteja sua conta e sessões.</p>
              </div>
            </div>

            <form onSubmit={handleSaveGeneral} className="p-4 md:p-6 space-y-4 md:space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Senha Atual</label>
                  <input 
                    type="password"
                    value={security.currentPassword}
                    onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })}
                    className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Nova Senha</label>
                  <input 
                    type="password"
                    value={security.newPassword}
                    onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })}
                    className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Confirmar Nova Senha</label>
                  <input 
                    type="password"
                    value={security.confirmPassword}
                    onChange={(e) => setSecurity({ ...security, confirmPassword: e.target.value })}
                    className="w-full bg-discord-darkest border border-discord-border rounded-md p-3 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-discord-border">
                <h4 className="text-discord-text font-bold text-sm mb-4">Sessões Ativas</h4>
                <div className="bg-discord-darkest p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-discord-muted" />
                    <div>
                      <p className="text-discord-text text-xs font-bold">Chrome no Windows (Atual)</p>
                      <p className="text-discord-muted text-[10px]">São Paulo, Brasil • IP: 189.12.34.56</p>
                    </div>
                  </div>
                  <span className="text-green-600 dark:text-green-400 text-[10px] font-black uppercase tracking-widest">Conectado</span>
                </div>
              </div>

              <div className="pt-6 border-t border-discord-border flex justify-end">
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-8 py-3 bg-discord-accent text-white text-xs font-bold uppercase tracking-widest rounded hover:bg-discord-accent/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? 'Atualizando...' : 'Atualizar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'appearance') {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-discord-darkest overflow-y-auto p-4 md:p-6 pb-20 md:pb-32">
        <div className="max-w-2xl mx-auto w-full">
          <button 
            onClick={() => setActiveSection(null)}
            className="flex items-center gap-2 text-discord-muted hover:text-discord-text mb-4 md:mb-6 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-widest">Voltar</span>
          </button>

          <div className="bg-discord-dark rounded-xl border border-discord-border overflow-hidden shadow-2xl">
            <div className="p-4 md:p-6 border-b border-discord-border flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-discord-darkest rounded-xl flex items-center justify-center text-discord-accent shrink-0">
                <Palette className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h2 className="text-discord-text font-bold text-lg md:text-xl">Aparência</h2>
                <p className="text-discord-muted text-[10px] md:text-xs">Personalize sua experiência visual.</p>
              </div>
            </div>

            <div className="p-4 md:p-6 space-y-6 md:space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Tema do Sistema</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setAppearance({ ...appearance, theme: 'dark' })}
                    className={cn(
                      "bg-discord-darkest border-2 p-4 rounded-lg flex flex-col items-center gap-2 transition-all",
                      appearance.theme === 'dark' ? "border-discord-accent" : "border-transparent"
                    )}
                  >
                    <Moon className={cn("w-6 h-6", appearance.theme === 'dark' ? "text-discord-accent" : "text-discord-muted")} />
                    <span className={cn("text-xs font-bold", appearance.theme === 'dark' ? "text-discord-text" : "text-discord-muted")}>Escuro (Padrão)</span>
                  </button>
                  <button 
                    onClick={() => setAppearance({ ...appearance, theme: 'light' })} 
                    className={cn(
                      "bg-discord-darkest border-2 p-4 rounded-lg flex flex-col items-center gap-2 transition-all",
                      appearance.theme === 'light' ? "border-discord-accent" : "border-transparent"
                    )}
                  >
                    <Sun className={cn("w-6 h-6", appearance.theme === 'light' ? "text-discord-accent" : "text-discord-muted")} />
                    <span className={cn("text-xs font-bold", appearance.theme === 'light' ? "text-discord-text" : "text-discord-muted")}>Claro</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] text-discord-muted font-black uppercase tracking-widest">Cor de Destaque</label>
                <div className="flex gap-4">
                  {['#5865F2', '#F23F42', '#23A559', '#F0B132', '#EB459E'].map(color => (
                    <button 
                      key={color}
                      onClick={() => setAppearance({ ...appearance, accentColor: color })}
                      style={{ backgroundColor: color }}
                      className={cn(
                        "w-10 h-10 rounded-full border-4 hover:scale-110 transition-transform",
                        appearance.accentColor === color ? "border-discord-text" : "border-transparent"
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-discord-border flex justify-end">
                <button 
                  onClick={handleSaveAppearance}
                  disabled={isSaving}
                  className="px-8 py-3 bg-discord-accent text-white text-xs font-bold uppercase tracking-widest rounded hover:bg-discord-accent/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? 'Salvando...' : 'Salvar Aparência'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-discord-darkest">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-32">
        <div className="max-w-3xl mx-auto space-y-3 md:space-y-4">
          {sections.map((section, idx) => (
            <button 
              key={idx}
              onClick={() => setActiveSection(section.id)}
              className="w-full bg-discord-dark p-3 md:p-4 rounded-lg border border-discord-border flex items-center gap-3 md:gap-4 hover:bg-discord-hover transition-all text-left group"
            >
              <div className="w-10 h-10 bg-discord-darkest rounded-lg flex items-center justify-center text-discord-muted group-hover:text-discord-text transition-colors shrink-0">
                <section.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-discord-text font-bold text-sm md:text-base truncate">{section.label}</h3>
                <p className="text-discord-muted text-[10px] md:text-xs mt-0.5 truncate">{section.desc}</p>
              </div>
              <div className="text-discord-muted group-hover:text-discord-text shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
