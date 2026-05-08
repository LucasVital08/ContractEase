/**
 * PDF Generation Service
 * Gera documentos PDF completos a partir de contratos, incluindo:
 * - Cabeçalho com logo/organização
 * - Cláusulas numeradas
 * - Tabela de partes e assinaturas
 * - Informações criptográficas (hash, stellar tx)
 * - Marca d'água "RASCUNHO" em drafts
 * - Rodapé com numeração de páginas
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Contract } from '@/types';

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export interface PDFOptions {
  watermark?: boolean;
  includeSignatures?: boolean;
  includeAuditTrail?: boolean;
  includeCrypto?: boolean;
  orgName?: string;
  orgLogo?: string;
}

const COLORS = {
  primary: [16, 185, 129] as [number, number, number],    // emerald-500
  dark: [10, 10, 10] as [number, number, number],         // neutral-950
  text: [50, 50, 50] as [number, number, number],
  muted: [120, 120, 120] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  light: [245, 245, 245] as [number, number, number],
};

export function generateContractPDF(contract: Contract, options: PDFOptions = {}): jsPDF {
  const {
    watermark = contract.status === 'draft',
    includeSignatures = true,
    includeAuditTrail = true,
    includeCrypto = true,
    orgName = 'ContractEase',
  } = options;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // --- Helpers ---
  const addPage = () => {
    doc.addPage();
    y = margin;
    addFooter(doc.getNumberOfPages());
    if (watermark) addWatermark();
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 30) {
      addPage();
    }
  };

  const addWatermark = () => {
    doc.saveGraphicsState();
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(60);
    doc.setFont('helvetica', 'bold');
    const text = 'RASCUNHO';
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, pageHeight / 2, { angle: 45 });
    doc.restoreGraphicsState();
  };

  const addFooter = (pageNum: number) => {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      `${orgName} · Documento gerado em ${new Date().toLocaleDateString('pt-BR')} · Página ${pageNum}`,
      pageWidth / 2, pageHeight - 10, { align: 'center' }
    );
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
  };

  // --- Header ---
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(orgName, margin, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Contrato Digital · Powered by Stellar Network', margin, 27);

  y = 45;

  // --- Watermark ---
  if (watermark) addWatermark();

  // --- Contract Title ---
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(contract.title, margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text(contract.description || 'Sem descrição', margin, y);
  y += 10;

  // --- Meta info ---
  const STATUS_LABELS: Record<string, string> = {
    draft: 'Rascunho', review: 'Em Revisão', pending: 'Pendente',
    active: 'Ativo', completed: 'Concluído', cancelled: 'Cancelado',
    archived: 'Arquivado',
  };

  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Informação', 'Valor']],
    body: [
      ['ID do Contrato', contract.id],
      ['Status', STATUS_LABELS[contract.status] || contract.status],
      ['Tipo', contract.type],
      ['Criado em', new Date(contract.createdAt).toLocaleDateString('pt-BR')],
      ['Válido até', new Date(contract.expiresAt).toLocaleDateString('pt-BR')],
    ],
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: COLORS.text },
    alternateRowStyles: { fillColor: COLORS.light },
    theme: 'grid',
  });

  y = doc.lastAutoTable.finalY + 12;

  // --- Clauses ---
  checkPageBreak(20);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text('Cláusulas', margin, y);
  y += 8;

  const sortedClauses = [...contract.clauses].sort((a, b) => a.order - b.order);
  for (const clause of sortedClauses) {
    checkPageBreak(30);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text(`${clause.order}. ${clause.title}`, margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);

    const lines = doc.splitTextToSize(clause.content, contentWidth);
    for (const line of lines) {
      checkPageBreak(6);
      doc.text(line, margin, y);
      y += 5;
    }
    y += 4;
  }

  // --- Parties & Signatures ---
  if (includeSignatures) {
    checkPageBreak(30);
    y += 5;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Partes e Assinaturas', margin, y);
    y += 8;

    const partyRows = contract.parties.map(p => [
      p.name,
      p.email,
      p.role === 'creator' ? 'Criador' : p.role === 'counterparty' ? 'Contraparte' : 'Testemunha',
      p.signedAt ? new Date(p.signedAt).toLocaleDateString('pt-BR') : 'Pendente',
      p.signatureType || '-',
    ]);

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Nome', 'E-mail', 'Função', 'Assinatura', 'Tipo']],
      body: partyRows,
      headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: COLORS.text },
      alternateRowStyles: { fillColor: COLORS.light },
      theme: 'grid',
    });

    y = doc.lastAutoTable.finalY + 10;
  }

  // --- Audit Trail ---
  if (includeAuditTrail) {
    const signedParties = contract.parties.filter(p => p.signedAt);
    if (signedParties.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.dark);
      doc.text('Trilha de Auditoria', margin, y);
      y += 8;

      const auditRows = signedParties.map(p => [
        p.name,
        p.cpf ? `***.${p.cpf.replace(/\D/g, '').slice(3, 6)}.***-**` : 'N/A',
        p.ipAddress || 'N/A',
        p.geolocation || 'N/A',
        p.lgpdConsent ? 'Sim' : 'Não',
      ]);

      doc.autoTable({
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Signatário', 'CPF', 'IP', 'Geolocalização', 'LGPD']],
        body: auditRows,
        headStyles: { fillColor: [75, 85, 99], textColor: COLORS.white, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7, textColor: COLORS.text },
        alternateRowStyles: { fillColor: COLORS.light },
        theme: 'grid',
      });

      y = doc.lastAutoTable.finalY + 10;
    }
  }

  // --- Crypto Info ---
  if (includeCrypto && (contract.contractHash || contract.stellarTxHash)) {
    checkPageBreak(30);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text('Informações Criptográficas', margin, y);
    y += 8;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);

    if (contract.contractHash) {
      doc.text('Hash SHA-256:', margin, y);
      y += 4;
      doc.setFont('courier', 'normal');
      const hashLines = doc.splitTextToSize(contract.contractHash, contentWidth);
      for (const line of hashLines) {
        doc.text(line, margin, y);
        y += 4;
      }
      y += 2;
    }

    if (contract.stellarTxHash) {
      doc.setFont('helvetica', 'normal');
      doc.text('Stellar Transaction Hash:', margin, y);
      y += 4;
      doc.setFont('courier', 'normal');
      const txLines = doc.splitTextToSize(contract.stellarTxHash, contentWidth);
      for (const line of txLines) {
        doc.text(line, margin, y);
        y += 4;
      }
      y += 2;
      doc.setFont('helvetica', 'italic');
      doc.text(`Verificar em: https://stellar.expert/explorer/testnet/tx/${contract.stellarTxHash}`, margin, y);
    }
  }

  // --- Legal Footer ---
  checkPageBreak(20);
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLORS.muted);
  doc.text(
    'Este documento digital é válido conforme a Medida Provisória nº 2.200-2/2001 (ICP-Brasil).',
    margin, y
  );
  y += 4;
  doc.text(
    'As evidências digitais foram coletadas em conformidade com a Lei Geral de Proteção de Dados (LGPD).',
    margin, y
  );

  // --- Add page numbers to all pages ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i);
  }

  return doc;
}

/**
 * Download contract as PDF
 */
export function downloadContractPDF(contract: Contract, options?: PDFOptions) {
  const doc = generateContractPDF(contract, options);
  doc.save(`${contract.title.replace(/[^a-zA-Z0-9]/g, '_')}_${contract.id}.pdf`);
}

/**
 * Get PDF as blob URL for preview
 */
export function getContractPDFPreviewUrl(contract: Contract, options?: PDFOptions): string {
  const doc = generateContractPDF(contract, options);
  return doc.output('bloburl').toString();
}
