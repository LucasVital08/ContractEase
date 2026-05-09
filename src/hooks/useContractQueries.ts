import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { ContractDraft, Contract } from '@/types';
import { useNotificationStore, useAuthStore } from '@/stores';

export const contractKeys = {
  all: ['contracts'] as const,
  detail: (id: string) => ['contracts', id] as const,
};

export function useContracts() {
  const org = useAuthStore(s => s.organization);
  return useQuery({
    queryKey: [...contractKeys.all, org?.id],
    queryFn: () => api.contracts.list(org?.id),
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: contractKeys.detail(id),
    queryFn: () => api.contracts.get(id),
    enabled: !!id,
  });
}

export function useCreateContract() {
  const qc = useQueryClient();
  const notify = useNotificationStore.getState().add;

  return useMutation({
    mutationFn: (draft: ContractDraft) => {
      const orgId = useAuthStore.getState().organization?.id;
      return api.contracts.create(draft, orgId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractKeys.all });
      notify({ type: 'success', title: 'Contrato criado com sucesso!' });
    },
    onError: () => {
      notify({ type: 'error', title: 'Erro ao criar contrato' });
    },
  });
}

export function useUpdateContract() {
  const qc = useQueryClient();
  const notify = useNotificationStore.getState().add;

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Contract> }) =>
      api.contracts.update(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: contractKeys.all });
      qc.invalidateQueries({ queryKey: contractKeys.detail(vars.id) });
      notify({ type: 'success', title: 'Contrato atualizado!' });
    },
    onError: () => {
      notify({ type: 'error', title: 'Erro ao atualizar contrato' });
    },
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  const notify = useNotificationStore.getState().add;

  return useMutation({
    mutationFn: (id: string) => api.contracts.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractKeys.all });
      notify({ type: 'info', title: 'Contrato removido' });
    },
    onError: () => {
      notify({ type: 'error', title: 'Erro ao remover contrato' });
    },
  });
}

// ─── Folders & Favorites ─────────────────────────────────────

export function useFolders() {
  const org = useAuthStore(s => s.organization);
  return useQuery({
    queryKey: ['folders', org?.id],
    queryFn: () => api.folders.list(org?.id),
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  const notify = useNotificationStore.getState().add;

  return useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) => {
      const orgId = useAuthStore.getState().organization?.id;
      return api.folders.create(name, color, orgId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      notify({ type: 'success', title: 'Pasta criada!' });
    },
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFav }: { id: string; isFav: boolean }) => api.contracts.toggleFavorite(id, isFav),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractKeys.all });
    },
  });
}

export function useMoveToFolder() {
  const qc = useQueryClient();
  const notify = useNotificationStore.getState().add;

  return useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) => 
      api.contracts.moveToFolder(id, folderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractKeys.all });
      notify({ type: 'success', title: 'Documento movido' });
    },
  });
}
