import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  smartContractOpportunityService,
  type AcceptProposalInput,
  type CreateSmartContractOpportunityInput,
  type OpportunityFeedFilters,
  type SendProposalInput,
} from '@/services/smartContractOpportunityService';

export function useOpportunityFeed(filters: OpportunityFeedFilters = {}) {
  return useQuery({
    queryKey: ['opportunity-feed', filters],
    queryFn: () => smartContractOpportunityService.list(filters),
    staleTime: 30_000,
  });
}

export function useCreateOpportunity() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSmartContractOpportunityInput) => smartContractOpportunityService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunity-feed'] });
    },
  });
}

export function useAcceptOpportunity() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (opportunityId: string) => smartContractOpportunityService.accept(opportunityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunity-feed'] });
    },
  });
}

export function useOpportunityProposals(opportunityId: string | null | undefined) {
  return useQuery({
    queryKey: ['opportunity-proposals', opportunityId ?? null],
    queryFn: () => smartContractOpportunityService.listProposals(opportunityId as string),
    enabled: Boolean(opportunityId),
    staleTime: 10_000,
  });
}

export function useSendProposal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: SendProposalInput) => smartContractOpportunityService.sendProposal(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['opportunity-proposals', variables.opportunityId] });
    },
  });
}

export function useAcceptProposal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: AcceptProposalInput) => smartContractOpportunityService.acceptProposal(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['opportunity-proposals', variables.opportunityId] });
      qc.invalidateQueries({ queryKey: ['opportunity-feed'] });
    },
  });
}

export function useWithdrawProposal(opportunityId?: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (proposalId: string) => smartContractOpportunityService.withdrawProposal(proposalId),
    onSuccess: () => {
      if (opportunityId) {
        qc.invalidateQueries({ queryKey: ['opportunity-proposals', opportunityId] });
      } else {
        qc.invalidateQueries({ queryKey: ['opportunity-proposals'] });
      }
    },
  });
}