/**
 * Modo demonstração.
 *
 * Serve para percorrer o app inteiro sem back-end configurado — útil para
 * revisar a experiência num branch antes de subir, e para gravar demonstrações.
 *
 * Ligado exclusivamente por variável de ambiente em tempo de build
 * (`VITE_DEMO_MODE=1`). Não há como ativar por URL ou localStorage de
 * propósito: um build de produção nunca deve conseguir entrar aqui.
 */

import type { Organization, User } from '@/types';

export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === '1';

export const DEMO_USER: User = {
  id: 'demo-user',
  name: 'Ana Ribeiro',
  email: 'ana@exemplo.com.br',
  handle: 'ana',
  role: 'owner',
  organizationId: 'personal',
  createdAt: new Date().toISOString(),
  credits: 25,
  plan: 'free',
};

export const DEMO_ORG: Organization = {
  id: 'personal',
  name: 'Espaço Pessoal',
  plan: 'free',
  createdAt: new Date().toISOString(),
};
