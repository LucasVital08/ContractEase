/**
 * React Query hooks para perfis públicos.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileService } from '@/services/profileService';
import { useAuthStore } from '@/stores';

export function usePublicProfile(handle: string | undefined) {
  const { initialized } = useAuthStore();
  return useQuery({
    queryKey: ['public-profile', handle],
    queryFn: () => (handle ? profileService.getPublicProfile(handle) : null),
    enabled: !!handle && initialized,
    staleTime: 60_000,
  });
}

export function useProfileStats(handle: string | undefined) {
  return useQuery({
    queryKey: ['profile-stats', handle],
    queryFn: () => (handle ? profileService.getStats(handle) : null),
    enabled: !!handle,
    staleTime: 60_000,
  });
}

export function useProfileActivity(handle: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['profile-activity', handle, limit],
    queryFn: () => (handle ? profileService.getActivity(handle, limit) : []),
    enabled: !!handle,
    staleTime: 30_000,
  });
}

export function useProfileFollowers(handle: string | undefined) {
  return useQuery({
    queryKey: ['profile-followers', handle],
    queryFn: () => (handle ? profileService.getFollowers(handle) : []),
    enabled: !!handle,
  });
}

export function useProfileFollowing(handle: string | undefined) {
  return useQuery({
    queryKey: ['profile-following', handle],
    queryFn: () => (handle ? profileService.getFollowing(handle) : []),
    enabled: !!handle,
  });
}

export function useFollowToggle(handle: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (currentlyFollowing: boolean) => {
      if (!handle) throw new Error('handle ausente');
      return currentlyFollowing
        ? profileService.unfollow(handle)
        : profileService.follow(handle);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public-profile', handle] });
      qc.invalidateQueries({ queryKey: ['profile-followers', handle] });
    },
  });
}
