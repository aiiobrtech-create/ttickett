import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, User as UserIcon, ShieldCheck, Clock, Monitor, ChevronLeft, X, FileText, Image as ImageIcon, Tag, Building2, Landmark, Printer, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Ticket, User, TicketStatus, Message, Organization, Company } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { UrgencyBadge } from '../components/UrgencyBadge';
import { cn } from '../lib/utils';
import { isAnyAdministrator, isStaffLikeRole } from '../lib/roles';
import { printTicketPDF } from '../lib/exportUtils';
import { supabase, uploadFile } from '../supabase';

interface TicketDetailsProps {
  ticket: Ticket;
  currentUser: User;
  onBack: () => void;
  onUpdateStatus: (status: TicketStatus) => void;
  onAddMessage: (content: string, isInternal: boolean, attachment?: { name: string; url: string; type: 'image' | 'file' }) => void;
  onUpdateAssignee: (assignee: string) => void;
  onUpdateEstimatedDeadline?: (date: Date | undefined) => void;
  onDeleteTicket?: () => Promise<void>;
  onNavigateToRegistration: (type: string, item: any, mode: string) => void;
}

export const TicketDetails: React.FC<TicketDetailsProps> = ({ 
  ticket, 
  currentUser, 
  onBack, 
  onUpdateStatus, 
  onAddMessage,
  onUpdateAssignee,
  onUpdateEstimatedDeadline,
  onDeleteTicket,
  onNavigateToRegistration
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isInternal, setIsInternal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; url: string; type: 'image' | 'file' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: orgs, error: orgsError } = await supabase.from('organizations').select('*');
        if (orgsError) console.error('[TicketDetails] Error fetching organizations:', orgsError);
        setOrganizations(orgs || []);

        const { data: comps, error: compsError } = await supabase.from('companies').select('*');
        if (compsError) console.error('[TicketDetails] Error fetching companies:', compsError);
        setCompanies(comps || []);
        
        const { data: usersData, error: usersError } = await supabase.from('users').select('*');
        if (usersError) console.error('[TicketDetails] Error fetching users:', usersError);
        setUsers(usersData || []);
      } catch (err: any) {
        console.error('[TicketDetails] Critical error in fetchData:', err.message);
      }
    };
    fetchData();
  }, []);

  const organization = organizations.find(org => org.id === ticket.organizationId);
  const company =
    (ticket.companyId && companies.find((c) => c.id === ticket.companyId)) ||
    (organization?.companyId && companies.find((c) => c.id === organization.companyId)) ||
    null;
  const isAgent = currentUser.role === 'agent';
  const canManage = isAgent || isAnyAdministrator(currentUser.role);
  const canEditScope = false;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !selectedFile) return;
    onAddMessage(newMessage, isInternal, selectedFile || undefined);
    setNewMessage('');
    setIsInternal(false);
    setSelectedFile(null);
  };

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

  const statuses: TicketStatus[] = ['Aberto', 'Pendente', 'Em atendimento', 'Resolvido', 'Fechado', 'Cancelado'];

  const handleConfirmDelete = async () => {
    if (!onDeleteTicket) return;
    setIsDeleting(true);
    try {
      await onDeleteTicket();
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-discord-dark">
      {/* Header */}
      <div className="h-auto min-h-16 border-b border-discord-border flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 gap-4 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 text-discord-muted hover:text-discord-text hover:bg-discord-hover rounded-md transition-all shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-discord-muted bg-discord-darkest px-1.5 py-0.5 rounded border border-discord-border tracking-tighter shrink-0">
                {ticket.number}
              </span>
              <h2 className="text-discord-text font-bold text-sm sm:text-base line-clamp-1 sm:line-clamp-none">{ticket.subject}</h2>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto w-full sm:w-auto justify-end sm:justify-start min-w-0">
          <button 
            onClick={() => {
              printTicketPDF(ticket);
              toast.success('PDF do ticket gerado com sucesso!');
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-discord-darkest hover:bg-discord-hover text-discord-text text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded border border-discord-border transition-all group"
            title="Imprimir Ticket em PDF"
          >
            <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:text-discord-accent transition-colors" />
            <span className="hidden sm:inline">Imprimir PDF</span>
          </button>
          {canManage && onDeleteTicket && (
            <>
              {!deleteConfirmOpen ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest rounded border border-red-500/30 transition-all"
                  title="Excluir ticket"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Excluir</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-red-500/40 bg-red-500/5">
                  <span className="text-[10px] text-discord-text font-medium px-1">Excluir {ticket.number}?</span>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setDeleteConfirmOpen(false)}
                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-discord-muted hover:text-discord-text rounded border border-discord-border"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => void handleConfirmDelete()}
                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white bg-red-600 hover:bg-red-500 rounded disabled:opacity-50"
                  >
                    {isDeleting ? 'Excluindo…' : 'Confirmar'}
                  </button>
                </div>
              )}
            </>
          )}
          <UrgencyBadge urgency={ticket.urgency} className="text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1" />
          <StatusBadge status={ticket.status} className="text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Chat Area — min-h-0 para o scroll interno respeitar a altura disponível */}
        <div className="order-2 flex min-h-0 min-w-0 flex-1 flex-col border-t border-discord-border lg:order-1 lg:border-t-0">
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 pb-6 sm:p-6 space-y-6 sm:space-y-8">
            {/* Original Description */}
            <div className="flex gap-4 group">
              <div className="w-10 h-10 rounded-full bg-discord-accent flex items-center justify-center shrink-0">
                <UserIcon className="text-white w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-discord-text font-bold hover:underline cursor-pointer">{ticket.requester}</span>
                  <span className="text-[10px] text-discord-muted font-medium">
                    {format(ticket.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div className="text-discord-text text-sm leading-relaxed bg-discord-darker/50 p-4 rounded-lg border border-discord-border">
                  <p className="font-bold text-discord-accent mb-2 uppercase text-[10px] tracking-widest">Descrição do Problema</p>
                  {ticket.description}
                  
                  {ticket.attachment && (
                    <div className="mt-4 pt-4 border-t border-discord-border/30">
                      {ticket.attachment.type === 'image' ? (
                        <div className="relative max-w-sm rounded-lg overflow-hidden border border-discord-border group/img">
                          <img 
                            src={ticket.attachment.url} 
                            alt={ticket.attachment.name}
                            className="w-full h-auto max-h-[300px] object-contain bg-discord-darkest"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <a 
                              href={ticket.attachment.url} 
                              download={ticket.attachment.name}
                              className="bg-discord-accent text-white px-4 py-2 rounded-md text-xs font-bold hover:bg-discord-accent-hover transition-colors"
                            >
                              Baixar Imagem
                            </a>
                          </div>
                        </div>
                      ) : (
                        <a 
                          href={ticket.attachment.url} 
                          download={ticket.attachment.name}
                          className="flex items-center gap-3 p-3 rounded-lg bg-discord-darkest border border-discord-border hover:border-discord-accent transition-all group/file"
                        >
                          <div className="w-10 h-10 rounded bg-discord-dark flex items-center justify-center">
                            <FileText className="w-6 h-6 text-discord-muted group-hover/file:text-discord-accent transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-discord-text font-bold truncate">{ticket.attachment.name}</p>
                            <p className="text-[10px] text-discord-muted uppercase tracking-wider">Clique para baixar</p>
                          </div>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            {ticket.messages
              .filter(msg => !msg.isInternal || canManage)
              .map((msg) => (
              <div key={msg.id} className={cn(
                "flex gap-3 sm:gap-4 group p-3 sm:p-4 rounded-lg transition-all",
                msg.isInternal ? "bg-amber-500/5 border border-amber-500/20" : ""
              )}>
                <div className={cn(
                  "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0",
                  isStaffLikeRole(msg.authorRole) ? "bg-discord-accent" : "bg-zinc-700"
                )}>
                  {isStaffLikeRole(msg.authorRole) ? <ShieldCheck className="text-white w-4 h-4 sm:w-6 sm:h-6" /> : <UserIcon className="text-white w-4 h-4 sm:w-6 sm:h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2 mb-1">
                    <span className={cn(
                      "font-bold hover:underline cursor-pointer text-sm sm:text-base",
                      isStaffLikeRole(msg.authorRole) ? "text-discord-accent" : "text-discord-text"
                    )}>
                      {msg.author}
                    </span>
                    {isStaffLikeRole(msg.authorRole) && (
                      <span className="bg-discord-accent/20 text-discord-accent text-[8px] sm:text-[9px] font-black px-1 rounded uppercase tracking-tighter">
                        {msg.authorRole === 'ttickett_admin' ? 'TTICKETT' : msg.authorRole === 'admin' ? 'Admin' : 'Atendente'}
                      </span>
                    )}
                    {msg.isInternal && (
                      <span className="bg-amber-500/20 text-amber-500 text-[8px] sm:text-[9px] font-black px-1 rounded uppercase tracking-tighter border border-amber-500/30">
                        Observação Interna
                      </span>
                    )}
                    <span className="text-[9px] sm:text-[10px] text-discord-muted font-medium ml-auto sm:ml-0">
                      {format(msg.timestamp, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className={cn(
                    "text-xs sm:text-sm leading-relaxed",
                    msg.isInternal ? "text-amber-200/80 italic" : "text-discord-text"
                  )}>
                    {msg.content}
                  </div>

                  {msg.attachment && (
                    <div className="mt-3">
                      {msg.attachment.type === 'image' ? (
                        <div className="relative max-w-sm rounded-lg overflow-hidden border border-discord-border group/img">
                          <img 
                            src={msg.attachment.url} 
                            alt={msg.attachment.name}
                            className="w-full h-auto max-h-[300px] object-contain bg-discord-darkest"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <a 
                              href={msg.attachment.url} 
                              download={msg.attachment.name}
                              className="bg-discord-accent text-white px-4 py-2 rounded-md text-xs font-bold hover:bg-discord-accent-hover transition-colors"
                            >
                              Baixar Imagem
                            </a>
                          </div>
                        </div>
                      ) : (
                        <a 
                          href={msg.attachment.url} 
                          download={msg.attachment.name}
                          className="flex items-center gap-3 p-3 rounded-lg bg-discord-darkest border border-discord-border hover:border-discord-accent transition-all group/file"
                        >
                          <div className="w-10 h-10 rounded bg-discord-dark flex items-center justify-center">
                            <FileText className="w-6 h-6 text-discord-muted group-hover/file:text-discord-accent transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-discord-text font-bold truncate">{msg.attachment.name}</p>
                            <p className="text-[10px] text-discord-muted uppercase tracking-wider">Clique para baixar</p>
                          </div>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input Area — shrink-0 permanece abaixo da área de scroll, sem sobrepor */}
          <div className="shrink-0 border-t border-discord-border bg-discord-dark p-3 sm:p-4">
            {selectedFile && (
              <div className="mb-3 p-3 bg-discord-darkest rounded-lg border border-discord-accent/30 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="w-10 h-10 rounded bg-discord-dark flex items-center justify-center shrink-0">
                  {selectedFile.type === 'image' ? (
                    <ImageIcon className="w-5 h-5 text-discord-accent" />
                  ) : (
                    <FileText className="w-5 h-5 text-discord-accent" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-discord-text font-bold truncate">{selectedFile.name}</p>
                  <p className="text-[10px] text-discord-muted uppercase tracking-wider">Pronto para enviar</p>
                </div>
                <button 
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 text-discord-muted hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {canManage && (
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setIsInternal(!isInternal)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                    isInternal 
                      ? "bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-500/20" 
                      : "bg-discord-darker text-discord-muted border-discord-border hover:text-discord-text"
                  )}
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isInternal ? "bg-white animate-pulse" : "bg-discord-muted"
                  )} />
                  Observação Interna
                </button>
                {isInternal && (
                  <span className="text-[10px] text-amber-500 font-bold italic animate-fade-in">
                    * Esta mensagem não será visível para o cliente
                  </span>
                )}
              </div>
            )}
            <form 
              onSubmit={handleSendMessage}
              className={cn(
                "bg-discord-darkest rounded-lg flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 min-w-0 focus-within:ring-1 transition-all",
                isInternal ? "focus-within:ring-amber-500 border border-amber-500/30" : "focus-within:ring-discord-accent"
              )}
            >
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "text-discord-muted hover:text-discord-text transition-colors relative group/clip", 
                  isUploading && "animate-spin"
                )}
                disabled={isUploading}
                title="Anexar arquivo"
              >
                <Paperclip className="w-5 h-5" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-discord-darkest text-[9px] text-discord-text font-bold uppercase tracking-widest rounded border border-discord-border opacity-0 group-hover/clip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  Upload Local
                </div>
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={selectedFile ? "Adicione um comentário ou envie..." : `Responder para ${ticket.requester}...`}
                className="flex-1 min-w-0 basis-[8rem] sm:basis-auto bg-transparent border-none text-discord-text placeholder:text-discord-muted text-sm outline-none"
              />
              <button 
                type="submit"
                disabled={!newMessage.trim() && !selectedFile}
                className="text-discord-accent disabled:text-discord-muted transition-colors shrink-0 ml-auto sm:ml-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="order-1 flex max-h-[42vh] min-h-0 w-full shrink-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain border-t border-discord-border bg-discord-darkest lg:order-2 lg:max-h-none lg:w-72 lg:border-l lg:border-t-0">
          <div className="flex flex-col gap-6 p-4 sm:flex-row sm:gap-8 sm:p-6 lg:flex-col lg:gap-0 lg:space-y-8">
            <div className="flex-1">
              <h3 className="text-xs font-black text-discord-muted uppercase tracking-widest mb-3 sm:mb-4">Informações</h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start gap-3">
                  <Monitor className="w-4 h-4 text-discord-muted mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-discord-muted font-bold uppercase tracking-wider">Urgência</p>
                    <UrgencyBadge urgency={ticket.urgency} className="mt-1" />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Landmark className="w-4 h-4 text-discord-muted mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-discord-muted font-bold uppercase tracking-wider">Empresa</p>
                    <p className="text-sm text-discord-text font-medium truncate">{company?.name || 'Não definida'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-discord-muted mt-0.5 shrink-0" />
                  <div className="min-w-0 w-full">
                    <p className="text-[10px] text-discord-muted font-bold uppercase tracking-wider">Organização</p>
                    <p className="text-sm text-discord-text font-medium truncate">{organization?.name || 'Não definida'}</p>
                    {canManage && organization && (
                      <button 
                        onClick={() => {
                          onNavigateToRegistration('Organizações', organization, 'form');
                        }}
                        className="flex items-center gap-1.5 text-[10px] text-discord-accent font-black uppercase tracking-widest mt-2 hover:bg-discord-accent/10 px-2 py-1 rounded-md border border-discord-accent/30 transition-all"
                      >
                        <Building2 className="w-3 h-3" />
                        Ver Cadastro Completo
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Monitor className="w-4 h-4 text-discord-muted mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-discord-muted font-bold uppercase tracking-wider">Plataforma</p>
                    <p className="text-sm text-discord-text font-medium truncate">{ticket.platform}</p>
                  </div>
                </div>
                {ticket.category && (
                  <div className="flex items-start gap-3">
                    <Tag className="w-4 h-4 text-discord-muted mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-discord-muted font-bold uppercase tracking-wider">Categoria</p>
                      <p className="text-sm text-discord-text font-medium truncate">{ticket.category}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-discord-muted mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-discord-muted font-bold uppercase tracking-wider">Aberto em</p>
                    <p className="text-sm text-discord-text font-medium truncate">{format(ticket.createdAt, "dd 'de' MMMM", { locale: ptBR })}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-discord-accent mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-discord-accent font-bold uppercase tracking-wider">Prazo Estimado</p>
                    <p className="text-sm text-discord-text font-medium truncate">
                      {ticket.estimatedDeadline 
                        ? format(ticket.estimatedDeadline, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : 'A definir'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserIcon className="w-4 h-4 text-discord-muted mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-discord-muted font-bold uppercase tracking-wider">Solicitante</p>
                    <p className="text-sm text-discord-text font-medium truncate">{ticket.requester}</p>
                    <p className="text-[10px] text-discord-muted truncate">{ticket.requesterEmail}</p>
                  </div>
                </div>
                {ticket.assignee && (
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-4 h-4 text-discord-accent mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-discord-accent font-bold uppercase tracking-wider">Responsável</p>
                      <p className="text-sm text-discord-text font-medium truncate">{ticket.assignee}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {canManage && (
              <div className="flex-1 pt-6 sm:pt-0 lg:pt-6 border-t sm:border-t-0 lg:border-t border-discord-border sm:border-l lg:border-l-0 sm:pl-8 lg:pl-0">
                <div>
                  <h3 className="text-xs font-black text-discord-muted uppercase tracking-widest mb-3 sm:mb-4">Gerenciamento</h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="text-[10px] text-discord-muted font-bold uppercase tracking-wider block mb-1.5 sm:mb-2">Alterar Status</label>
                      <select 
                        value={ticket.status}
                        onChange={(e) => onUpdateStatus(e.target.value as TicketStatus)}
                        className="w-full bg-discord-dark border border-discord-border rounded-md p-2 text-xs text-discord-text outline-none focus:ring-1 focus:ring-discord-accent"
                      >
                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-discord-muted font-bold uppercase tracking-wider block mb-1.5 sm:mb-2">Responsável</label>
                      <select 
                        value={ticket.assignee || ''}
                        onChange={(e) => onUpdateAssignee(e.target.value)}
                        className="w-full bg-discord-dark border border-discord-border rounded-md p-2 text-xs text-discord-text outline-none focus:ring-1 focus:ring-discord-accent"
                      >
                        <option value="">Sem responsável</option>
                        {users.filter(u => isStaffLikeRole(u.role)).map(u => (
                          <option key={u.id} value={u.name}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    {onUpdateEstimatedDeadline && (
                      <div>
                        <label className="text-[10px] text-discord-muted font-bold uppercase tracking-wider block mb-1.5 sm:mb-2">Prazo Estimado</label>
                        <input 
                          type="datetime-local"
                          value={ticket.estimatedDeadline ? format(ticket.estimatedDeadline, "yyyy-MM-dd'T'HH:mm") : ''}
                          onChange={(e) => onUpdateEstimatedDeadline(e.target.value ? new Date(e.target.value) : undefined)}
                          className="w-full bg-discord-dark border border-discord-border rounded-md p-2 text-xs text-discord-text outline-none focus:ring-1 focus:ring-discord-accent"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
