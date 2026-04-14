import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const response = await fetch("/api/me", {
        credentials: 'include' // Send session cookie with request
      });
      if (response.status === 401) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Auth request failed with status ${response.status}`);
      }
      return response.json();
    },
    retry: (failureCount, error: any) => {
      // Retry up to 3 times for actual transport failures only.
      if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
        return failureCount < 3;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}

