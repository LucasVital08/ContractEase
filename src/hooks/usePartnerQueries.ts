import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  partnersService,
  type SendConnectionRequestInput,
} from '@/services/partnersService';

export const partnerKeys = {
  all: ['partners'] as const,
  connections: (userId: string | null | undefined) =>
    [...partnerKeys.all, 'connections', userId ?? 'anonymous'] as const,
  search: (query: string) => [...partnerKeys.all, 'search', query] as const,
};

export function usePartnerConnections(userId: string | null | undefined) {
  return useQuery({
    queryKey: partnerKeys.connections(userId),
    queryFn: () => partnersService.listForUser(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
    retry: false,
  });
}

export function useSearchPartners(query: string) {
  const normalizedQuery = query.trim();

  return useQuery({
    queryKey: partnerKeys.search(normalizedQuery),
    queryFn: () => partnersService.searchUsers(normalizedQuery),
    enabled: normalizedQuery.length >= 2,
    staleTime: 30_000,
    retry: false,
  });
}

export function useSendPartnerRequest() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: SendConnectionRequestInput) => partnersService.sendRequest(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partnerKeys.all });
    },
  });
}

export function useAcceptPartnerRequest() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (connectionId: string) => partnersService.acceptRequest(connectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partnerKeys.all });
    },
  });
}

export function useRejectPartnerRequest() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (connectionId: string) => partnersService.rejectRequest(connectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partnerKeys.all });
    },
  });
}

export function useRemovePartner() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (connectionId: string) => partnersService.removePartner(connectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partnerKeys.all });
    },
  });
}
