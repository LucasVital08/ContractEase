import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  smartContractOpportunityService,
  type CreateSmartContractOpportunityInput,
  type OpportunityFeedFilters,
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