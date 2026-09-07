/**
 * API client with proper error handling and token management
 */

import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import { APIError, NetworkError, UnauthorizedError } from "./errors";

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export class ApiClient {
  private client: AxiosInstance;
  private tokenRefreshPromise: Promise<string> | null = null;

  constructor(baseURL: string = import.meta.env.VITE_API_URL || "/api") {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors and token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        // Handle network errors
        if (!error.response) {
          throw new NetworkError(
            error.message || "Network request failed - please check your connection"
          );
        }

        // Handle 401 - token expired
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.client(originalRequest);
          } catch (_refreshError) {
            // Token refresh failed - clear tokens and redirect to login
            this.clearTokens();
            if (typeof window !== "undefined") {
              window.location.href = "/login";
            }
            throw new UnauthorizedError("Session expired - please login again");
          }
        }

        // Handle other errors
        const message =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          "An unexpected error occurred";

        throw new APIError(message, error.response?.status || 500, error.response?.data);
      }
    );
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;

    try {
      const tokenData = localStorage.getItem("auth_tokens");
      if (tokenData) {
        const parsed: TokenData = JSON.parse(tokenData);
        // Check if token is expired
        if (parsed.expires_at && Date.now() > parsed.expires_at) {
          this.clearTokens();
          return null;
        }
        return parsed.access_token;
      }
    } catch {
      return null;
    }
    return null;
  }

  private setToken(tokenData: TokenData): void {
    if (typeof window === "undefined") return;

    const data: TokenData = {
      ...tokenData,
      expires_at: tokenData.expires_at || Date.now() + 60 * 60 * 1000, // 1 hour default
    };

    localStorage.setItem("auth_tokens", JSON.stringify(data));
  }

  private clearTokens(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem("auth_tokens");
  }

  private async refreshToken(): Promise<string> {
    // Prevent multiple concurrent refresh attempts
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = (async () => {
      try {
        const tokenData = this.getToken();
        const response = await axios.post("/auth/refresh", {
          refresh_token: tokenData,
        });

        const newTokens = response.data;
        this.setToken(newTokens);
        return newTokens.access_token;
      } finally {
        this.tokenRefreshPromise = null;
      }
    })();

    return this.tokenRefreshPromise;
  }

  /**
   * Make a GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * Make a POST request
   */
  async post<TResponse, TRequest = unknown>(
    url: string,
    data?: TRequest,
    config?: AxiosRequestConfig
  ): Promise<TResponse> {
    const response = await this.client.post<TResponse>(url, data, config);
    return response.data;
  }

  /**
   * Make a PUT request
   */
  async put<TResponse, TRequest = unknown>(
    url: string,
    data?: TRequest,
    config?: AxiosRequestConfig
  ): Promise<TResponse> {
    const response = await this.client.put<TResponse>(url, data, config);
    return response.data;
  }

  /**
   * Make a PATCH request
   */
  async patch<TResponse, TRequest = unknown>(
    url: string,
    data?: TRequest,
    config?: AxiosRequestConfig
  ): Promise<TResponse> {
    const response = await this.client.patch<TResponse>(url, data, config);
    return response.data;
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  /**
   * Upload a file
   */
  async uploadFile<T>(
    url: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<T> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await this.client.post<T>(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    return response.data;
  }

  /**
   * Set authentication tokens
   */
  authenticate(tokenData: TokenData): void {
    this.setToken(tokenData);
  }

  /**
   * Clear authentication tokens
   */
  logout(): void {
    this.clearTokens();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }
}

// Singleton instance
let apiClientInstance: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new ApiClient();
  }
  return apiClientInstance;
}

// Export convenience functions
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => getApiClient().get<T>(url, config),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    getApiClient().post<T>(url, data, config),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    getApiClient().put<T>(url, data, config),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    getApiClient().patch<T>(url, data, config),
  delete: <T>(url: string, config?: AxiosRequestConfig) => getApiClient().delete<T>(url, config),
  uploadFile: <T>(url: string, file: File, onProgress?: (progress: number) => void) =>
    getApiClient().uploadFile<T>(url, file, onProgress),
  authenticate: (tokenData: TokenData) => getApiClient().authenticate(tokenData),
  logout: () => getApiClient().logout(),
  isAuthenticated: () => getApiClient().isAuthenticated(),
};
