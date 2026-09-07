/**
 * Authentication and Authorization Types
 * Better Auth integration for APPWITHAI
 */

import type { Session, User } from "better-auth/types";

/**
 * Better Auth User (extends base User type)
 */
export interface AuthUser extends User {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Better Auth Session
 */
export interface AuthSession extends Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user: AuthUser;
}

/**
 * User roles in the system
 */
export type UserRole =
  | "admin" // Full system access
  | "doctor" // Clinical access, can view/edit patient records
  | "nurse" // Clinical access, limited edit capabilities
  | "receptionist" // Front desk, patient registration, appointments
  | "billing" // Financial access, invoices and payments
  | "readonly"; // Read-only access

/**
 * Entity operations for RBAC
 */
export type EntityOperation = "CREATE" | "READ" | "UPDATE" | "DELETE";

/**
 * Permission check result
 */
export interface PermissionCheck {
  granted: boolean;
  reason?: string;
}

/**
 * User context attached to requests
 */
export interface UserContext {
  user: AuthUser;
  roles: UserRole[];
  permissions: string[];
  sessionId: string;
}

/**
 * Authentication options
 */
export interface AuthOptions {
  /**
   * Secret key for signing tokens
   */
  secret: string;

  /**
   * Base URL of the application
   */
  baseURL: string;

  /**
   * Database connection
   */
  database: unknown;

  /**
   * Enable social login providers
   */
  socialProviders?: ("google" | "microsoft" | "github")[];

  /**
   * Session duration in seconds
   * @default 604800 (7 days)
   */
  sessionMaxAge?: number;

  /**
   * Enable 2FA for specific roles
   */
  twoFactorRoles?: UserRole[];
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data
 */
export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

/**
 * Auth service interface
 */
export interface IAuthService {
  /**
   * Authenticate user with email and password
   */
  login(credentials: LoginCredentials): Promise<AuthSession>;

  /**
   * Register new user
   */
  register(data: RegisterData): Promise<AuthSession>;

  /**
   * Register new user with pending approval
   */
  registerPending(data: RegisterData): Promise<{ userId: string; email: string }>;

  /**
   * Logout user (invalidate session)
   */
  logout(sessionToken: string): Promise<void>;

  /**
   * Get session by token
   */
  getSession(sessionToken: string): Promise<AuthSession | null>;

  /**
   * Verify if user has required role(s)
   */
  hasRole(userId: string, roles: UserRole | UserRole[]): Promise<boolean>;

  /**
   * Verify if user has permission for entity operation
   */
  hasPermission(
    userId: string,
    entityName: string,
    operation: EntityOperation
  ): Promise<PermissionCheck>;

  /**
   * Assign role to user
   */
  assignRole(userId: string, role: UserRole): Promise<void>;

  /**
   * Remove role from user
   */
  removeRole(userId: string, role: UserRole): Promise<void>;
}
