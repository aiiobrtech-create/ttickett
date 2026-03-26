import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ticket, User, Organization, AccessLog, PlatformType, CategoryType } from '../types';

export const exportPlatformsToPDF = (platforms: PlatformType[], title: string) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);

  const tableData = platforms.map(p => [
    p.name,
    p.url,
    p.env
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Nome', 'URL', 'Ambiente']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [88, 101, 242] },
  });

  doc.save(`Relatorio_Plataformas_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
};

export const exportCategoriesToPDF = (categories: CategoryType[], title: string) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);

  const tableData = categories.map(c => [
    c.name,
    c.desc
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Nome', 'Descrição']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [88, 101, 242] },
  });

  doc.save(`Relatorio_Categorias_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
};

export const exportAccessLogsToPDF = (logs: AccessLog[], title: string) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);

  const tableData = logs.map(l => [
    l.userName,
    l.userEmail,
    l.action,
    l.ip,
    format(l.timestamp, 'dd/MM/yyyy HH:mm')
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Usuário', 'E-mail', 'Ação', 'IP', 'Data/Hora']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [88, 101, 242] },
  });

  doc.save(`Relatorio_Acessos_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
};

// Extend jsPDF with autotable (optional if using functional approach, but kept for type safety if needed elsewhere)
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');
  XLSX.writeFile(workbook, `${fileName}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
};

export const exportTicketsToPDF = (tickets: Ticket[], title: string) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);

  const tableData = tickets.map(t => [
    t.number,
    t.subject,
    t.requester,
    t.status,
    t.urgency,
    format(t.createdAt, 'dd/MM/yyyy'),
    t.assignee || '-'
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Número', 'Assunto', 'Solicitante', 'Status', 'Urgência', 'Aberto em', 'Responsável']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [88, 101, 242] },
  });

  doc.save(`Relatorio_Tickets_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
};

export const exportUsersToPDF = (users: User[], title: string) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);

  const tableData = users.map(u => [
    u.name,
    u.email,
    u.role === 'admin' ? 'Administrador' : u.role === 'agent' ? 'Atendente' : 'Cliente',
    u.phone || '-',
    u.whatsapp || '-'
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Nome', 'E-mail', 'Cargo', 'Telefone', 'WhatsApp']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [88, 101, 242] },
  });

  doc.save(`Relatorio_Usuarios_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
};

export const exportOrganizationsToPDF = (orgs: Organization[], title: string) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);

  const tableData = orgs.map(o => [
    o.name,
    o.contactPerson || '-',
    o.email || '-',
    o.phone || '-',
    o.platforms.length.toString()
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Nome', 'Contato', 'E-mail', 'Telefone', 'Plataformas']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [88, 101, 242] },
  });

  doc.save(`Relatorio_Organizacoes_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
};

export const printTicketPDF = (ticket: Ticket) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFillColor(88, 101, 242);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('TTICKETT', 14, 25);
  doc.setFontSize(12);
  doc.text(`Ticket: ${ticket.number}`, 160, 25);

  // Ticket Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text(ticket.subject, 14, 55);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Solicitante: ${ticket.requester} (${ticket.requesterEmail})`, 14, 65);
  doc.text(`Status: ${ticket.status} | Urgência: ${ticket.urgency}`, 14, 72);
  doc.text(`Aberto em: ${format(ticket.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 79);

  // Description
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('Descrição:', 14, 100);
  doc.setFontSize(10);
  const splitDescription = doc.splitTextToSize(ticket.description, 180);
  doc.text(splitDescription, 14, 110);

  // Messages
  let yPos = 110 + (splitDescription.length * 5) + 20;
  doc.setFontSize(12);
  doc.text('Histórico de Mensagens:', 14, yPos);
  yPos += 10;

  ticket.messages.filter(m => !m.isInternal).forEach(msg => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(9);
    doc.setTextColor(88, 101, 242);
    doc.text(`${msg.author} (${format(msg.timestamp, "dd/MM/yyyy HH:mm")})`, 14, yPos);
    yPos += 5;
    doc.setTextColor(0, 0, 0);
    const splitMsg = doc.splitTextToSize(msg.content, 170);
    doc.text(splitMsg, 20, yPos);
    yPos += (splitMsg.length * 5) + 5;
  });

  doc.save(`Ticket_${ticket.number}.pdf`);
};
