/**
 * Authentication Query Hooks
 *
 * TanStack Query hooks for authentication operations.
 *
 * Generated: {{now}}
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiError, apiClient } from "@/lib/api-client";

// ============================================================================
// Types
// ============================================================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    sys_user_id: string;
    email: string;
    name: string;
    roles: Array<{
      sys_role_id: string;
      name: string;
    }>;
  };
}

export interface UserProfile {
  sys_user_id: string;
  name: string;
  email: string;
  description?: string;
  is_active: boolean;
  is_locked: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Query Keys
// ============================================================================

export const authKeys = {
  all: ["auth"] as const,
  profile: () => [...authKeys.all, "profile"] as const,
};

// ============================================================================
// Login Mutation
// ============================================================================

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<AuthResponse, ApiError, LoginCredentials>({
    mutationFn: (credentials) => apiClient.post<AuthResponse>("/auth/login", credentials),
    onSuccess: (data) => {
      // Store token
      localStorage.setItem("auth_token", data.access_token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));

      // Update API client
      apiClient.setAuthToken(data.access_token);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}

// ============================================================================
// Register Mutation
// ============================================================================

export function useRegister() {
  return useMutation<AuthResponse, ApiError, RegisterData>({
    mutationFn: (data) => apiClient.post<AuthResponse>("/auth/register", data),
    onSuccess: (data) => {
      // Store token
      localStorage.setItem("auth_token", data.access_token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));

      // Update API client
      apiClient.setAuthToken(data.access_token);
    },
  });
}

// ============================================================================
// Get Current User Query
// ============================================================================

export function useCurrentUser() {
  return useQuery<UserProfile, ApiError>({
    queryKey: authKeys.profile(),
    queryFn: () => apiClient.get<UserProfile>("/auth/me"),
    retry: false,
  });
}

// ============================================================================
// Logout Mutation
// ============================================================================

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError>({
    mutationFn: () => apiClient.post<void>("/auth/logout"),
    onSuccess: () => {
      // Clear storage
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");

      // Update API client
      apiClient.setAuthToken(null);

      // Clear all queries
      queryClient.clear();
    },
  });
}

// ============================================================================
// Change Password Mutation
// ============================================================================

export function useChangePassword() {
  return useMutation<{ message: string }, ApiError, { old_password: string; new_password: string }>(
    {
      mutationFn: (data) => apiClient.post<{ message: string }>("/auth/change-password", data),
    }
  );
}
