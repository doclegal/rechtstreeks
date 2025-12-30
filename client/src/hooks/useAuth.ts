import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getAccessToken, setAccessToken, clearAccessToken } from "@/lib/authStore";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role?: string;
}

interface AuthSession {
  user: User | null;
}

interface LoginResponse {
  success: boolean;
  user: User;
  accessToken: string;
}

export function useAuth() {
  const { data, isLoading } = useQuery<AuthSession>({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const token = getAccessToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await fetch("/api/auth/session", { 
        credentials: "include",
        headers,
      });
      if (!res.ok) {
        return { user: null };
      }
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text || res.statusText}`);
      }
      return res.json();
    },
    onSuccess: (data: LoginResponse) => {
      if (data.accessToken) {
        setAccessToken(data.accessToken);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
      const res = await apiRequest("POST", "/api/auth/signup", data);
      return res.json();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/logout", {});
      return res.json();
    },
    onSuccess: () => {
      clearAccessToken();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
    },
  });

  return {
    user: data?.user || null,
    isLoading,
    isAuthenticated: !!data?.user,
    login: loginMutation.mutateAsync,
    signup: signupMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isSigningUp: signupMutation.isPending,
    loginError: loginMutation.error,
    signupError: signupMutation.error,
  };
}
