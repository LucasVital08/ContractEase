// Contract types and interfaces

export type ContractStatus = 'draft' | 'review' | 'pending' | 'active' | 'completed' | 'cancelled' | 'failed' | 'archived';

export type ContractType =
  | 'service'
  | 'supply'
  | 'partnership'
  | 'nda'
  | 'license'
  | 'employment'
  | 'rental'
  | 'loan'
  | 'escrow'
  | 'sla'
  | 'sale'
  | 'power_of_attorney'
  | 'declaration'
  | 'receipt';


export interface Party {
  id: string;
  name: string;
  email: string;
  role: 'creator' | 'counterparty' | 'witness';
  signedAt?: string;
  // Assinatura e Evidências
  cpf?: string;
  ipAddress?: string;
  userAgent?: string;
  geolocation?: string;
  signatureType?: 'draw' | 'type' | 'upload' | 'a1' | 'freighter';
  signatureImage?: string;
  lgpdConsent?: boolean;
}

export interface ClauseHistory {
  version: number;
  content: string;
  updatedAt: string;
}

export interface Clause {
  id: string;
  order: number;
  title: string;
  content: string;
  history?: ClauseHistory[];
}

export interface AttachmentVersion {
  id: string;
  url: string;
  uploadedAt: string;
  size: number;
}

export interface AttachmentComment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: string;
  uploadedBy: string; // User/Party ID
  versions?: AttachmentVersion[];
  comments?: AttachmentComment[];
  scanStatus?: 'pending' | 'clean' | 'infected';
  extractedText?: string;
  sharedLink?: string;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  ownerId?: string;
  organizationId?: string;
  createdAt: string;
}

export interface Contract {
  id: string;
  title: string;
  description: string;
  type: ContractType;
  parties: Party[];
  clauses: Clause[];
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  stellarTxHash?: string;
  tags: string[];
  folderId?: string;
  isFavorite?: boolean;
  // Configurações de Assinatura
  signatureOrder?: 'parallel' | 'sequential';
  multisigEnabled?: boolean;
  // Audit & Compliance
  contractHash?: string;
  attachments?: Attachment[];
}

export interface ContractDraft {
  title: string;
  description: string;
  type: ContractType;
  parties: Omit<Party, 'id' | 'signedAt'>[];
  clauses: Omit<Clause, 'id'>[];
  expiresAt: string;
  tags: string[];
  signatureOrder?: 'parallel' | 'sequential';
}
