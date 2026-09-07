# JWT Federation Implementation Guide

## Overview

JWT Federation enables secure cross-application navigation for enterprise systems where reporting, ERP, CRM, and other applications operate on different domains. This guide implements **Option 2: JWT Federation** as the recommended architecture for your platform.

## Architecture Decision Matrix

| Scenario | Solution | Use Case |
|----------|----------|----------|
| **Same Domain** (reports.internal, erp.internal) | Shared Session Cookie | ✅ Recommended - Simpler, Faster, More Secure |
| **Different Domains** (reports.com, erp.com) | JWT Federation | Required - Cross-domain navigation |
| **Hybrid** | Both + Domain Mapping | Enterprise multi-tenant |

## Why JWT Federation?

**Benefits:**
- ✅ **Stateless**: No session server synchronization needed
- ✅ **Secure**: Short-lived tokens (60 seconds), cryptographic validation
- ✅ **Scalable**: Works across independent infrastructure
- ✅ **Auditable**: Token payload logs user intent and navigation context
- ✅ **Portable**: Tokens contain all necessary information

**Trade-offs:**
- ⚠️ Requires token generation overhead (~10ms per request)
- ⚠️ Token revocation requires blocklist (optional)
- ⚠️ Slightly more complex than shared cookies

---

## Implementation: Step-by-Step

### Step 1: Define Navigation Metadata Schema

Create standardized navigation metadata stored with each report, chart, and dashboard.

**File**: `src/types/navigation.ts`

```typescript
export interface NavigationMetadata {
  // Target semantic object (SAP-style navigation)
  semanticObject: string; // "SalesOrder", "Customer", "Invoice"
  
  // Target application identifier
  targetApplication: string; // "ERP", "CRM", "Workflow"
  
  // URL template with parameter placeholders
  urlTemplate: string; // "/orders/{id}", "/customers/{id}/details"
  
  // Browser window behavior
  targetWindow: "erp-drilldown-window" | "crm-details-window" | "_blank" | "_self";
  
  // Navigation mode
  navigationMode: "REUSE_TAB" | "NEW_TAB" | "MODAL";
  
  // Authentication mode
  authenticationMode: "BETTER_AUTH_SHARED_SESSION" | "JWT_FEDERATION";
  
  // Optional: Additional parameters passed to target app
  additionalParams?: Record<string, string>;
  
  // Optional: Action to perform in target app
  action?: "display" | "edit" | "create" | "delete";
  
  // Expiration time for token (in seconds)
  tokenExpiration?: number; // default: 60
  
  // Optional: Required permissions to navigate
  requiredPermissions?: string[];
}

export interface FederationToken {
  // User information
  sub: string; // user.id
  email: string; // user.email
  roles: string[]; // user.roles
  
  // Navigation context
  target: string; // semantic object
  action: "view" | "edit" | "create" | "delete";
  id?: string | number; // resource ID
  
  // Security
  exp: number; // expiration timestamp
  iat: number; // issued at
  jti?: string; // JWT ID (for revocation blocklist)
  
  // Audit trail
  sourceApp: string; // "Reporting"
  sourceUser: string; // user email for audit
  navigationReason?: string; // "Cross-filter drill-down"
  
  // Additional context
  [key: string]: any;
}
```

### Step 2: Create Federation Token Service

**File**: `src/server-fns/navigation/federation.ts`

```typescript
import { createServerFn } from "@tanstack/react-start";
import { SignJWT, jwtVerify } from "jose";
import { requireAuth } from "@/lib/auth/middleware";
import type { FederationToken, NavigationMetadata } from "@/types/navigation";

// Environment setup (use strong secret in production)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_FEDERATION_SECRET || "your-secret-key-min-32-chars"
);

/**
 * Generate a short-lived federation token for cross-app navigation
 */
export const createFederationToken = createServerFn({
  method: "POST",
}).handler(async (input: {
  target: string;
  id?: string | number;
  action: "view" | "edit" | "create" | "delete";
  metadata?: NavigationMetadata;
  additionalData?: Record<string, any>;
}): Promise<{ token: string; expiresIn: number }> => {
  const session = await requireAuth();
  
  // Token validity: short-lived (60 seconds by default)
  const expiresIn = input.metadata?.tokenExpiration || 60;
  const now = Math.floor(Date.now() / 1000);
  
  const federationToken: FederationToken = {
    // User claims
    sub: session.user.id,
    email: session.user.email,
    roles: session.user.roles || [],
    
    // Navigation context
    target: input.target,
    action: input.action,
    id: input.id,
    
    // Security
    exp: now + expiresIn,
    iat: now,
    jti: crypto.getRandomValues(new Uint8Array(16)).toString(),
    
    // Audit trail
    sourceApp: "ReportingApp",
    sourceUser: session.user.email,
    navigationReason: input.metadata?.action || "standard-navigation",
    
    // Additional context
    ...input.additionalData,
  };
  
  // Sign the token
  const token = await new SignJWT(federationToken)
    .setProtectedHeader({ alg: "HS256" })
    .sign(JWT_SECRET);
  
  return {
    token,
    expiresIn,
  };
});

/**
 * Verify federation token (used by target app)
 */
export async function verifyFederationToken(token: string): Promise<FederationToken> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as FederationToken;
  } catch (error) {
    throw new Error(`Token verification failed: ${error}`);
  }
}

/**
 * Create navigation URL with federation token
 */
export async function createFederatedUrl(
  navigationMetadata: NavigationMetadata,
  parameters: Record<string, string | number>
): Promise<string> {
  const session = await requireAuth();
  
  // Generate federation token
  const { token } = await createFederationToken.handler({
    target: navigationMetadata.semanticObject,
    action: navigationMetadata.action || "view",
    id: parameters.id,
    metadata: navigationMetadata,
  });
  
  // Build URL from template
  let url = navigationMetadata.urlTemplate;
  Object.entries(parameters).forEach(([key, value]) => {
    url = url.replace(`{${key}}`, String(value));
  });
  
  // Add token as query parameter
  const separator = url.includes("?") ? "&" : "?";
  url += `${separator}federation_token=${encodeURIComponent(token)}`;
  
  // Add optional parameters
  if (navigationMetadata.additionalParams) {
    Object.entries(navigationMetadata.additionalParams).forEach(([key, value]) => {
      url += `&${key}=${encodeURIComponent(value)}`;
    });
  }
  
  return url;
}
```

### Step 3: Reporting App - Navigation Component

**File**: `src/components/drilldown/federated-navigation.tsx`

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { createFederatedUrl } from "@/server-fns/navigation/federation";
import type { NavigationMetadata } from "@/types/navigation";

interface FederatedNavigationProps {
  metadata: NavigationMetadata;
  parameters: Record<string, string | number>;
  children?: React.ReactNode;
  onNavigate?: () => void;
}

export function FederatedNavigation({
  metadata,
  parameters,
  children,
  onNavigate,
}: FederatedNavigationProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrillDown = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Generate federated URL on server
      const url = await createFederatedUrl(metadata, parameters);

      // Navigate with configured target window
      window.open(url, metadata.targetWindow);

      onNavigate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Navigation failed");
      console.error("Federated navigation error:", err);
    } finally {
      setLoading(false);
    }
  }, [metadata, parameters, onNavigate]);

  return (
    <div>
      <button
        onClick={handleDrillDown}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? "Loading..." : `Open in ${metadata.targetApplication}`}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
      {children}
    </div>
  );
}
```

### Step 4: ERP App - Token Validation & Session Creation

**File**: `erp/src/routes/api/federated-login.ts`

```typescript
import { verifyFederationToken } from "@reporting/src/server-fns/navigation/federation";
import { createBetterAuthSession } from "@/lib/auth/better-auth";
import type { FederationToken } from "@reporting/src/types/navigation";

/**
 * ERP App receives federation token and creates session
 */
export async function handleFederatedLogin(token: string) {
  try {
    // 1. Verify token signature and expiration
    const federationToken: FederationToken = await verifyFederationToken(token);

    // 2. Verify user exists in ERP database
    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", federationToken.email)
      .executeTakeFirst();

    if (!user) {
      throw new Error("User not found in ERP system");
    }

    // 3. CRITICAL: Re-verify authorization in target app
    // Never trust reporting app's claims blindly
    const hasPermission = await checkUserPermissions(user.id, {
      resource: federationToken.target,
      action: federationToken.action,
      resourceId: federationToken.id,
    });

    if (!hasPermission) {
      throw new Error(
        `User ${user.email} not authorized to ${federationToken.action} ${federationToken.target} ${federationToken.id}`
      );
    }

    // 4. Create Better Auth session
    const session = await createBetterAuthSession({
      userId: user.id,
      federationToken: federationToken.jti, // Store token ID for audit
      sourceApp: federationToken.sourceApp,
    });

    // 5. Set HTTP-only cookie (if shared domain)
    // Or return session token if cross-domain
    const cookieHeader = generateSecureCookie(session.token, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 3600, // 1 hour
    });

    // 6. Build target URL
    let targetUrl = federationToken.target;
    if (federationToken.id) {
      targetUrl = targetUrl.replace("{id}", String(federationToken.id));
    }

    return {
      status: 302,
      headers: {
        "Set-Cookie": cookieHeader,
        Location: targetUrl,
      },
      body: null,
    };
  } catch (error) {
    // Log security event
    await auditLog({
      event: "FEDERATION_LOGIN_FAILED",
      error: error instanceof Error ? error.message : "Unknown error",
      token_claims: token,
      timestamp: new Date(),
    });

    return {
      status: 401,
      body: { error: "Federation authentication failed" },
    };
  }
}

/**
 * Authorization check in target app
 */
async function checkUserPermissions(
  userId: string,
  context: {
    resource: string;
    action: string;
    resourceId?: string | number;
  }
): Promise<boolean> {
  // Example: Check user's role-based permissions
  const user = await db
    .selectFrom("users")
    .leftJoin("user_roles", "users.id", "user_roles.user_id")
    .leftJoin("roles", "user_roles.role_id", "roles.id")
    .selectAll()
    .where("users.id", "=", userId)
    .execute();

  // Implement your authorization logic
  const canAccess = user.some((row) => {
    const permissions = JSON.parse(row.roles?.permissions || "[]");
    return permissions.some((perm: string) =>
      perm.match(new RegExp(`^${context.resource}:(.*|\\*)$`))
    );
  });

  // Log all access attempts
  await auditLog({
    event: canAccess ? "FEDERATION_AUTHORIZED" : "FEDERATION_DENIED",
    user_id: userId,
    resource: context.resource,
    action: context.action,
    resource_id: context.resourceId,
  });

  return canAccess;
}
```

### Step 5: Report/Chart Metadata Configuration

**File**: `src/lib/db/seeds/navigation-metadata.ts`

```typescript
export const navigationMetadata: Record<string, NavigationMetadata> = {
  // SalesOrder deep-link from reports
  salesOrderDrilldown: {
    semanticObject: "SalesOrder",
    targetApplication: "ERP",
    urlTemplate: "/orders/{id}",
    targetWindow: "erp-drilldown-window",
    navigationMode: "REUSE_TAB",
    authenticationMode: "JWT_FEDERATION",
    action: "display",
    tokenExpiration: 60,
    requiredPermissions: ["query:execute", "report:view"],
    additionalParams: {
      sourceSystem: "ReportingApp",
      context: "sales-analytics",
    },
  },

  // Customer information from dashboards
  customerDrilldown: {
    semanticObject: "Customer",
    targetApplication: "CRM",
    urlTemplate: "/customers/{id}/profile",
    targetWindow: "_blank",
    navigationMode: "NEW_TAB",
    authenticationMode: "JWT_FEDERATION",
    action: "view",
    tokenExpiration: 120,
  },

  // Invoice management
  invoiceDrilldown: {
    semanticObject: "Invoice",
    targetApplication: "ERP",
    urlTemplate: "/invoices/{id}/details",
    targetWindow: "erp-details-window",
    navigationMode: "REUSE_TAB",
    authenticationMode: "JWT_FEDERATION",
    action: "edit",
    tokenExpiration: 60,
    requiredPermissions: ["invoice:write"],
  },
};
```

### Step 6: Semantic Navigation Resolver Service

**File**: `src/lib/navigation/navigation-resolver.ts`

This service provides a centralized, scalable way to handle all cross-app navigation.

```typescript
import type { NavigationMetadata } from "@/types/navigation";

export interface NavigationRequest {
  semanticObject: string;
  action: "display" | "edit" | "create" | "delete";
  parameters: Record<string, string | number>;
  context?: Record<string, any>;
}

export interface ResolvedNavigation {
  url: string;
  targetWindow: string;
  navigationMode: string;
  metadata: NavigationMetadata;
}

/**
 * Universal navigation resolver for enterprise apps
 * Supports: ERP, CRM, Workflow, Reporting, BI, Dashboards
 */
export class NavigationResolverService {
  private registry: Map<string, NavigationMetadata> = new Map();

  constructor() {
    this.initializeRegistry();
  }

  private initializeRegistry() {
    // Register all semantic objects and their routing rules
    const registry = {
      SalesOrder: this.defineSalesOrderNavigation(),
      Customer: this.defineCustomerNavigation(),
      Invoice: this.defineInvoiceNavigation(),
      Product: this.defineProductNavigation(),
      Workflow: this.defineWorkflowNavigation(),
      Task: this.defineTaskNavigation(),
    };

    Object.entries(registry).forEach(([key, metadata]) => {
      this.registry.set(key, metadata);
    });
  }

  /**
   * Main entry point for navigation
   */
  async resolve(request: NavigationRequest): Promise<ResolvedNavigation> {
    const metadata = this.registry.get(request.semanticObject);

    if (!metadata) {
      throw new Error(
        `No navigation rule for ${request.semanticObject}`
      );
    }

    // Merge action if specified
    if (request.action && request.action !== metadata.action) {
      metadata.action = request.action;
    }

    // Generate federated URL
    const url = await createFederatedUrl(metadata, request.parameters);

    return {
      url,
      targetWindow: metadata.targetWindow,
      navigationMode: metadata.navigationMode,
      metadata,
    };
  }

  private defineSalesOrderNavigation(): NavigationMetadata {
    return {
      semanticObject: "SalesOrder",
      targetApplication: "ERP",
      urlTemplate: "/orders/{id}",
      targetWindow: "erp-drilldown-window",
      navigationMode: "REUSE_TAB",
      authenticationMode: "JWT_FEDERATION",
      action: "view",
      tokenExpiration: 60,
    };
  }

  private defineCustomerNavigation(): NavigationMetadata {
    return {
      semanticObject: "Customer",
      targetApplication: "CRM",
      urlTemplate: "/customers/{id}",
      targetWindow: "crm-details-window",
      navigationMode: "REUSE_TAB",
      authenticationMode: "JWT_FEDERATION",
      action: "view",
    };
  }

  private defineInvoiceNavigation(): NavigationMetadata {
    return {
      semanticObject: "Invoice",
      targetApplication: "ERP",
      urlTemplate: "/invoices/{id}",
      targetWindow: "erp-details-window",
      navigationMode: "REUSE_TAB",
      authenticationMode: "JWT_FEDERATION",
      action: "view",
    };
  }

  private defineProductNavigation(): NavigationMetadata {
    return {
      semanticObject: "Product",
      targetApplication: "ERP",
      urlTemplate: "/products/{id}",
      targetWindow: "erp-product-window",
      navigationMode: "REUSE_TAB",
      authenticationMode: "JWT_FEDERATION",
      action: "view",
    };
  }

  private defineWorkflowNavigation(): NavigationMetadata {
    return {
      semanticObject: "Workflow",
      targetApplication: "Workflow",
      urlTemplate: "/workflows/{id}",
      targetWindow: "_blank",
      navigationMode: "NEW_TAB",
      authenticationMode: "JWT_FEDERATION",
      action: "view",
    };
  }

  private defineTaskNavigation(): NavigationMetadata {
    return {
      semanticObject: "Task",
      targetApplication: "Workflow",
      urlTemplate: "/tasks/{id}",
      targetWindow: "_blank",
      navigationMode: "NEW_TAB",
      authenticationMode: "JWT_FEDERATION",
      action: "edit",
    };
  }
}

// Singleton instance
export const navigationResolver = new NavigationResolverService();
```

### Step 7: Usage in Charts/Reports

**File**: `src/components/charts/chart-with-drilldown.tsx`

```typescript
"use client";

import { navigationResolver } from "@/lib/navigation/navigation-resolver";
import { useCallback } from "react";

export function ChartWithDrilldown({ chartData, ...props }) {
  const handleDataPointClick = useCallback(
    async (dataPoint: { salesOrderId: number; customerName: string }) => {
      try {
        // Use semantic navigation resolver
        const navigation = await navigationResolver.resolve({
          semanticObject: "SalesOrder",
          action: "view",
          parameters: {
            id: dataPoint.salesOrderId,
          },
        });

        // Navigate with configured target window
        window.open(navigation.url, navigation.targetWindow);
      } catch (error) {
        console.error("Navigation failed:", error);
      }
    },
    []
  );

  return (
    <ECharts
      {...props}
      onEvents={{
        click: (event: any) => {
          handleDataPointClick(event.data);
        },
      }}
    />
  );
}
```

---

## Security Best Practices

### 1. Token Secret Management

```bash
# Generate secure secret
openssl rand -base64 32

# Store in environment
JWT_FEDERATION_SECRET=your-generated-secret
```

### 2. Token Revocation (Optional)

For enhanced security, maintain a blocklist:

```typescript
// src/lib/auth/token-blocklist.ts
const blocklist = new Set<string>(); // In production, use Redis

export async function revokeToken(jti: string) {
  blocklist.add(jti);
  // In Redis: await redis.sadd("revoked_tokens", jti, "EX", 3600);
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  return blocklist.has(jti);
}

// In verifyFederationToken:
if (await isTokenRevoked(federationToken.jti)) {
  throw new Error("Token has been revoked");
}
```

### 3. Audit Logging

Every navigation event must be logged:

```typescript
interface NavigationAuditLog {
  timestamp: Date;
  sourceUser: string;
  sourceApp: string;
  targetApp: string;
  semanticObject: string;
  action: string;
  resourceId: string | number;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  error?: string;
}

await db
  .insertInto("navigation_audit_logs")
  .values(auditEntry)
  .execute();
```

### 4. Authorization Checks

**CRITICAL**: Always re-verify permissions in the target application.

```typescript
// Never trust incoming claims
const canAccess = await targetApp.authorize({
  userId,
  resource: federationToken.target,
  action: federationToken.action,
  resourceId: federationToken.id,
});

if (!canAccess) {
  throw new AuthorizationError("Access denied");
}
```

---

## Deployment Checklist

- [ ] Generate and store JWT_FEDERATION_SECRET securely
- [ ] Configure token expiration times (recommend 60-120 seconds)
- [ ] Implement audit logging
- [ ] Test cross-app navigation flows
- [ ] Configure CORS for federated endpoints
- [ ] Set up token revocation (if needed)
- [ ] Document semantic objects and routing rules
- [ ] Train teams on navigation resolver API
- [ ] Monitor federation token failures
- [ ] Set up alerts for authorization rejections

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Token verification fails | Secret mismatch | Verify JWT_FEDERATION_SECRET is identical |
| "User not found" | Cross-app sync issue | Sync user databases or use federation token data |
| Authorization denied | Insufficient permissions | Check target app's RBAC rules |
| Token expired | Too short expiration | Increase tokenExpiration in metadata |
| CORS errors | Improper domain config | Add target app domain to CORS allowlist |

---

## Migration Path from Shared Cookies

If you're currently using shared session cookies:

1. **Phase 1**: Deploy JWT Federation alongside existing cookies
2. **Phase 2**: Update UI components to use `navigationResolver`
3. **Phase 3**: Monitor federation logs for issues
4. **Phase 4**: Gradually deprecate shared cookie method
5. **Phase 5**: Remove shared cookie implementation

