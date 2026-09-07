# JWT Federation Implementation Guide - Complete Edition

## Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Core Concepts](#core-concepts)
3. [Implementation Details](#implementation-details)
4. [Security Patterns](#security-patterns)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting & Monitoring](#troubleshooting--monitoring)

---

## Overview & Architecture

JWT Federation enables **secure cross-application navigation** for enterprise systems where multiple independent applications (Reporting, ERP, CRM, etc.) operate on different domains and need to share user context without maintaining shared session state.

### Problem Statement

In a typical enterprise setup:
- **Reporting System** (localhost:4050) handles data visualization and analysis
- **ERP System** (erp.internal:3000) manages orders, inventory, customers
- **CRM System** (crm.internal:3001) handles customer relationships and sales
- Users need to **drill down** from a report chart into ERP order details
- Each system has its own authentication and authorization

**Challenge**: How do you securely pass user identity and context across domains without:
- Leaking credentials
- Creating session server bottlenecks
- Violating CORS policies
- Losing audit trails

**Solution**: JWT Federation with short-lived tokens and semantic navigation metadata.

### Architecture Decision

| Scenario | Solution | Pros | Cons |
|----------|----------|------|------|
| **Same Domain** (reports.internal, erp.internal) | Shared Session Cookie | ✅ Simple, Fast, Secure | ❌ Requires wildcard DNS |
| **Different Domains** (reports.com, erp.com) | **JWT Federation** | ✅ Stateless, Auditable, Portable | ⚠️ Token overhead, Revocation complexity |
| **Hybrid** | Both + Domain Mapping | ✅ Best of both | ❌ Operationally complex |

**Recommendation**: Use **JWT Federation** for maximum security and enterprise scalability.

---

## Core Concepts

### 1. Semantic Navigation Objects (SAP Pattern)

A **semantic object** is a business entity type independent of the application holding it:

```
Semantic Object: "SalesOrder"
├── Display: /orders/{id} in ERP
├── Edit: /orders/{id}/edit in ERP
└── Create: /orders/new in ERP

Semantic Object: "Customer"
├── Display: /customers/{id} in CRM
├── Edit: /customers/{id}/edit in CRM
└── Interact: /customers/{id}/interactions in CRM
```

This decouples the **concept** (SalesOrder) from the **implementation** (ERP app's `/orders` route).

### 2. Federation Token (JWT)

A **federation token** is a cryptographically signed token containing:
- **User identity** (email, roles, permissions)
- **Navigation target** (semantic object, action)
- **Resource context** (ID to display or edit)
- **Expiration** (60 seconds - very short-lived)
- **Audit context** (source app, reason, timestamp)

Example token payload (decoded):
```json
{
  "sub": "user-id-123",
  "email": "alice@company.com",
  "roles": ["analyst", "viewer"],
  "target": "SalesOrder",
  "action": "view",
  "id": "SO-12345",
  "sourceApp": "Reporting",
  "navigationReason": "drill-down-from-chart",
  "iat": 1715737660,
  "exp": 1715737720,
  "jti": "token-id-for-revocation"
}
```

### 3. Token Validation (Target App)

When the ERP app receives the federation token in URL: `/orders/SO-12345?fed_token=eyJhbGc...`

It:
1. **Extracts** the token from query string
2. **Verifies signature** using the Reporting app's public key
3. **Checks expiration** (reject if > 60 seconds old)
4. **Validates audience** (ensure token is for ERP app)
5. **Checks permissions** (ensure user can view SalesOrder)
6. **Establishes session** (create local auth cookie)
7. **Logs audit trail** (record cross-app navigation)

---

## Implementation Details

### Step 1: Metadata Storage (Reporting App)

Store navigation metadata with each report, chart, and dashboard.

**File**: `src/types/navigation.ts`

```typescript
export interface SemanticNavigation {
  semanticObject: "SalesOrder" | "Customer" | "Invoice" | "Shipment";
  targetApplication: "ERP" | "CRM" | "Fulfillment" | "Finance";
  
  // URL template in target app: /orders/{id}, /customers/{id}/edit
  urlTemplate: string;
  
  // Browser behavior: open new tab, reuse current, modal popup
  targetWindow: "NEW_TAB" | "REUSE_TAB" | "MODAL" | "SELF";
  
  // Permissions required: user must have these to navigate
  requiredPermissions: string[];
  
  // Token TTL: how long the federation token lives (seconds)
  tokenTtl: number; // typically 60-120 seconds
  
  // Additional parameters to include in token
  additionalContext?: Record<string, any>;
}

export interface FederationTokenPayload {
  // Standard JWT claims
  sub: string;           // user ID
  email: string;         // user email
  roles: string[];       // user roles
  iat: number;          // issued at (Unix timestamp)
  exp: number;          // expiration (Unix timestamp)
  jti?: string;         // JWT ID (for revocation)
  
  // Navigation context
  target: string;       // semantic object
  action: "view" | "edit" | "create" | "delete";
  resourceId?: string | number;
  
  // Audit trail
  sourceApp: string;    // "Reporting"
  sourceUser: string;   // user email
  navigationReason?: string;
  navigationTimestamp: number;
  
  // Target app
  audience?: string;    // "ERP" | "CRM"
}
```

### Step 2: Token Generation (Reporting App)

**File**: `src/server-fns/navigation/federation.ts`

```typescript
import { createServerFn } from "@tanstack/react-start";
import { jwtSign } from "@/lib/auth/jwt";
import { requireAuth } from "@/lib/auth/middleware";

interface GenerateFederationTokenInput {
  semanticObject: string;
  action: "view" | "edit" | "create" | "delete";
  resourceId?: string | number;
  targetApplication: "ERP" | "CRM" | "Fulfillment";
  navigationReason?: string;
}

export const generateFederationToken = createServerFn({
  method: "POST",
}).handler(async (input: GenerateFederationTokenInput) => {
  // 1. Ensure user is authenticated
  const session = await requireAuth();
  
  // 2. Check user has permission to navigate to target
  const { hasPermission } = await import("@/lib/permissions");
  const canNavigate = await hasPermission(
    session.user.id,
    `navigate:${input.semanticObject}`
  );
  
  if (!canNavigate) {
    throw new Error(
      `User does not have permission to navigate to ${input.semanticObject}`
    );
  }
  
  // 3. Generate short-lived federation token (60 seconds)
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 60; // seconds
  
  const payload: FederationTokenPayload = {
    // Standard JWT
    sub: session.user.id,
    email: session.user.email,
    roles: session.user.roles || [],
    iat: now,
    exp: now + expiresIn,
    jti: crypto.randomUUID(), // for revocation blocklist
    
    // Navigation context
    target: input.semanticObject,
    action: input.action,
    resourceId: input.resourceId,
    
    // Audit trail
    sourceApp: "Reporting",
    sourceUser: session.user.email,
    navigationReason: input.navigationReason || "user-initiated",
    navigationTimestamp: now,
    
    // Target application
    audience: input.targetApplication,
  };
  
  // 4. Sign the token with the reporting app's private key
  const token = await jwtSign(payload, {
    expiresIn: `${expiresIn}s`,
    algorithm: "RS256",
  });
  
  // 5. Optionally log to audit trail
  await logNavigationEvent({
    userId: session.user.id,
    sourceApp: "Reporting",
    targetApp: input.targetApplication,
    semanticObject: input.semanticObject,
    action: input.action,
    resourceId: input.resourceId,
    timestamp: new Date(),
    status: "token-issued",
  });
  
  return {
    token,
    expiresIn,
    targetUrl: buildNavigationUrl(
      input.targetApplication,
      input.semanticObject,
      input.resourceId,
      token
    ),
  };
});

// Helper: Build the navigation URL for the target app
function buildNavigationUrl(
  targetApp: string,
  semanticObject: string,
  resourceId: string | number | undefined,
  federationToken: string
): string {
  const appDomains: Record<string, string> = {
    ERP: process.env.ERP_APP_URL || "http://erp.internal:3000",
    CRM: process.env.CRM_APP_URL || "http://crm.internal:3001",
    Fulfillment: process.env.FULFILLMENT_APP_URL || "http://fulfillment.internal:3002",
  };
  
  const baseUrl = appDomains[targetApp];
  
  // Map semantic objects to target app routes
  const routeMap: Record<string, string> = {
    SalesOrder: "/orders",
    Customer: "/customers",
    Invoice: "/invoices",
    Shipment: "/shipments",
  };
  
  const basePath = routeMap[semanticObject];
  const fullPath = resourceId ? `${basePath}/${resourceId}` : basePath;
  
  return `${baseUrl}${fullPath}?fed_token=${encodeURIComponent(federationToken)}`;
}
```

### Step 3: Token Validation (Target App - ERP)

The target app (ERP) validates the federation token and establishes a local session.

**File**: `src/middleware/federation.ts` (in ERP app)

```typescript
import { jwtVerify } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/cookies";

// Middleware that runs on protected routes
export async function validateFederationToken(request: Request) {
  const url = new URL(request.url);
  const federationToken = url.searchParams.get("fed_token");
  
  if (!federationToken) {
    return null; // No federation token - use normal auth flow
  }
  
  try {
    // 1. Verify token signature using Reporting app's public key
    const publicKey = await getReportingAppPublicKey();
    const payload = await jwtVerify(federationToken, publicKey, {
      algorithms: ["RS256"],
    });
    
    // 2. Check token hasn't expired
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Federation token has expired");
    }
    
    // 3. Verify token is for this app
    if (payload.audience !== "ERP") {
      throw new Error("Federation token is not for this application");
    }
    
    // 4. Verify user has permission to access this resource
    const hasPermission = await checkUserPermission(
      payload.sub,
      payload.action,
      payload.target
    );
    
    if (!hasPermission) {
      throw new Error("User does not have permission to access this resource");
    }
    
    // 5. Log the navigation event to audit trail
    await logNavigationEvent({
      userId: payload.sub,
      sourceApp: payload.sourceApp,
      targetApp: "ERP",
      semanticObject: payload.target,
      action: payload.action,
      resourceId: payload.resourceId,
      timestamp: new Date(),
      status: "token-accepted",
      navigationReason: payload.navigationReason,
    });
    
    // 6. Create local authentication session in ERP
    // This might be a JWT cookie or a server session
    const localSessionToken = await createLocalSession({
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles,
      federatedFrom: "Reporting",
      federationJti: payload.jti,
    });
    
    // 7. Set session cookie and redirect to clean URL
    return {
      sessionToken: localSessionToken,
      user: {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles,
      },
      redirectTo: url.pathname, // Remove fed_token from URL
    };
  } catch (error) {
    console.error("Federation token validation failed:", error);
    
    // Log failed validation
    await logNavigationEvent({
      userId: url.searchParams.get("user_hint") || "unknown",
      sourceApp: "Reporting",
      targetApp: "ERP",
      semanticObject: "unknown",
      status: "token-rejected",
      errorReason: error instanceof Error ? error.message : "unknown",
    });
    
    return null;
  }
}

// Get the reporting app's public key (cached, refreshed periodically)
async function getReportingAppPublicKey(): Promise<string> {
  // Cached for 1 hour
  const cached = await cache.get("reporting-public-key");
  if (cached) return cached;
  
  const response = await fetch(
    `${process.env.REPORTING_APP_URL}/.well-known/public-key`
  );
  const { publicKey } = await response.json();
  
  await cache.set("reporting-public-key", publicKey, 3600); // 1 hour TTL
  
  return publicKey;
}

// Semantic validation: user must have permission to perform action on resource
async function checkUserPermission(
  userId: string,
  action: "view" | "edit" | "create" | "delete",
  semanticObject: string
): Promise<boolean> {
  const permissionMap: Record<string, string> = {
    "view:SalesOrder": "sales_order:view",
    "edit:SalesOrder": "sales_order:edit",
    "view:Customer": "customer:view",
    "edit:Customer": "customer:edit",
  };
  
  const requiredPermission = permissionMap[`${action}:${semanticObject}`];
  if (!requiredPermission) return false; // Unknown resource
  
  // Check user's roles have this permission
  const user = await getUserWithPermissions(userId);
  return user.permissions.includes(requiredPermission);
}

// Create a local session in the ERP app
async function createLocalSession(context: {
  userId: string;
  email: string;
  roles: string[];
  federatedFrom: string;
  federationJti: string;
}): Promise<string> {
  // Create a new JWT session token for this app
  const sessionToken = await jwtSign(
    {
      sub: context.userId,
      email: context.email,
      roles: context.roles,
      iss: "ERP", // issued by ERP app
      federatedFrom: context.federatedFrom,
      federationJti: context.federationJti, // track where this session came from
    },
    {
      expiresIn: "8h",
      algorithm: "RS256",
    }
  );
  
  // Store session in Redis or database for revocation support
  await sessionStore.set(sessionToken, {
    userId: context.userId,
    createdAt: new Date(),
    federatedFrom: context.federatedFrom,
  });
  
  return sessionToken;
}
```

### Step 4: Integration in Navigation Components

**File**: `src/components/reporting/drill-down.tsx` (in Reporting app)

```typescript
import { generateFederationToken } from "@/server-fns/navigation/federation";
import { Button } from "@/components/ui/button";

interface DrillDownButtonProps {
  semanticObject: "SalesOrder" | "Customer" | "Invoice";
  resourceId: string | number;
  label: string;
  targetApp: "ERP" | "CRM";
  navigationReason?: string;
}

export function DrillDownButton({
  semanticObject,
  resourceId,
  label,
  targetApp,
  navigationReason,
}: DrillDownButtonProps) {
  const handleDrillDown = async () => {
    try {
      const result = await generateFederationToken({
        semanticObject,
        action: "view",
        resourceId,
        targetApplication: targetApp,
        navigationReason,
      });
      
      // Open target app with federation token
      if (result.targetUrl) {
        window.open(result.targetUrl, "_blank");
      }
    } catch (error) {
      console.error("Failed to generate federation token:", error);
      // Show error toast to user
    }
  };
  
  return (
    <Button onClick={handleDrillDown} variant="outline" size="sm">
      {label} →
    </Button>
  );
}
```

### Step 5: Secure Token Exchange

For extra security, use a **secure token exchange endpoint** instead of passing tokens in URLs.

**In Reporting App**:

```typescript
export const initiateFederatedNavigation = createServerFn({
  method: "POST",
}).handler(async (input: {
  semanticObject: string;
  resourceId: string;
  targetApp: string;
}) => {
  const session = await requireAuth();
  
  // Generate token
  const token = await jwtSign({...}, { expiresIn: "60s" });
  
  // Store token temporarily in cache (code expires in 5 minutes)
  const exchangeCode = crypto.randomUUID();
  await cache.set(`federation-code:${exchangeCode}`, {
    token,
    expiresAt: Date.now() + 5 * 60 * 1000,
  }, 5 * 60); // 5 minute TTL
  
  return {
    exchangeCode,
    targetUrl: `${TARGET_APP_URL}/auth/federation-exchange?code=${exchangeCode}`,
  };
});
```

**In Target App (ERP)**:

```typescript
// GET /auth/federation-exchange?code=<exchange_code>
export async function federationExchange(code: string) {
  // Fetch the actual token from Reporting app's cache
  const response = await fetch(
    `${REPORTING_APP_URL}/api/federation/exchange-token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }
  );
  
  if (!response.ok) throw new Error("Exchange failed");
  
  const { token } = await response.json();
  
  // Validate and create local session
  const payload = await jwtVerify(token, publicKey);
  // ... rest of validation
}
```

---

## Security Patterns

### 1. Token Rotation

Never reuse the same token. Generate a new one for each navigation event.

```typescript
// ✅ CORRECT: Fresh token each time
const token = await generateFederationToken({...});
navigateTo(buildUrl(token));

// ❌ WRONG: Reusing the same token
const token = await generateFederationToken({...}); // Generate once
useEffect(() => {
  // Token will expire on subsequent uses
  navigateTo(buildUrl(token));
}, [token]);
```

### 2. Token Revocation (Optional but Recommended)

Maintain a revocation blocklist for compromised tokens.

```typescript
// Blocklist interface
interface TokenRevocationEntry {
  jti: string; // JWT ID
  revokedAt: Date;
  reason: "user-logout" | "admin-action" | "security-incident";
  expiresAt: Date; // When to remove from blocklist
}

// Check before validating token
async function isTokenRevoked(jti: string): Promise<boolean> {
  const entry = await revocationList.get(jti);
  return !!entry;
}

// When revoking (e.g., on logout across all apps)
async function revokeToken(jti: string) {
  const tokenTtl = 120; // seconds
  await revocationList.set(jti, {
    revokedAt: new Date(),
    expiresAt: new Date(Date.now() + tokenTtl * 1000),
  });
}
```

### 3. Certificate Pinning (Production)

In production, pin the expected certificates to prevent MITM attacks:

```typescript
// In target app's federation validation
const httpClient = new HttpClient({
  certificatePinning: {
    "reporting.company.com": [
      "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    ],
  },
});

const publicKey = await httpClient.fetch(
  "https://reporting.company.com/.well-known/public-key"
);
```

### 4. Audit Logging (Critical)

Every navigation event must be logged for compliance:

```typescript
interface NavigationAuditLog {
  id: string;
  timestamp: Date;
  sourceApp: string;
  targetApp: string;
  userId: string;
  userEmail: string;
  semanticObject: string;
  resourceId?: string;
  action: "view" | "edit" | "create" | "delete";
  navigationReason: string;
  status: "initiated" | "token-issued" | "token-accepted" | "token-rejected";
  ipAddress: string;
  userAgent: string;
  errorReason?: string;
}

async function logNavigationEvent(log: NavigationAuditLog) {
  // Write to database
  await db.insert("navigation_audit_log").values(log);
  
  // Also write to immutable audit system (e.g., Splunk, DataDog)
  await auditSystem.log({
    event: "federation-navigation",
    ...log,
  });
}
```

---

## Production Deployment

### Configuration

Create environment-specific configurations:

```bash
# .env.production
# Reporting App
FEDERATION_PRIVATE_KEY=<base64-encoded-RSA-private-key>
FEDERATION_TOKEN_TTL=60
FEDERATION_TOKEN_ALGORITHM=RS256

# Target Apps
ERP_APP_URL=https://erp.company.com
CRM_APP_URL=https://crm.company.com
FULFILLMENT_APP_URL=https://fulfillment.company.com

# Public keys for validating tokens from other apps
ERP_PUBLIC_KEY=<base64-encoded-public-key>
CRM_PUBLIC_KEY=<base64-encoded-public-key>

# Revocation blocklist (Redis)
REDIS_URL=redis://revocation-store:6379

# Audit logging
AUDIT_LOG_DESTINATION=splunk
SPLUNK_HEC_URL=https://splunk.company.com
```

### Key Generation

```bash
# Generate RS256 key pair for Reporting app
openssl genrsa -out private-key.pem 4096
openssl rsa -in private-key.pem -pubout -out public-key.pem

# Encode for environment variables
cat private-key.pem | base64 > private-key.b64
cat public-key.pem | base64 > public-key.b64

# Share public-key.pem with target apps
# Host at: https://reporting.company.com/.well-known/public-key
```

### Testing Checklist

```bash
# 1. Test token generation
curl -X POST http://localhost:4050/api/federation/generate-token \
  -H "Authorization: Bearer $(jwt-sign ...)" \
  -d '{"semanticObject":"SalesOrder","resourceId":"SO-123"}'

# 2. Test token validation
curl -X GET "http://erp.local/orders/SO-123?fed_token=eyJhbGc..." \
  -H "Cookie: session=..."

# 3. Test audit logging
sqlite3 ./data/sakila.db "SELECT * FROM navigation_audit_log ORDER BY timestamp DESC LIMIT 5;"

# 4. Test revocation
curl -X POST http://localhost:4050/api/federation/revoke-token \
  -H "Authorization: Bearer $(jwt-sign ...)" \
  -d '{"jti":"<token-id>"}'

# 5. Performance test
ab -n 1000 -c 10 \
  "http://localhost:4050/api/federation/generate-token"

# Expected: ~50-100ms p99 per token
```

---

## Troubleshooting & Monitoring

### Common Issues

#### 1. "Token has expired"

**Cause**: Network latency between apps > token TTL

**Solution**: Increase token TTL or reduce network latency

```typescript
// Increase TTL to 90 seconds
const payload = { ..., exp: now + 90 };
```

#### 2. "Invalid signature"

**Cause**: Target app is using wrong public key or token was tampered with

**Solution**: Verify public key is correct and up-to-date

```typescript
// Manually verify the public key
const publicKeyFromServer = await fetch(
  "https://reporting.company.com/.well-known/public-key"
);
// Compare with hardcoded key in config
```

#### 3. "Audience mismatch"

**Cause**: Federation token is for wrong app

**Solution**: Ensure `audience` claim matches target app

```typescript
// In token payload
const payload = { ..., audience: "ERP" }; // Must match target

// In validation
if (payload.audience !== "ERP") throw new Error("Audience mismatch");
```

### Monitoring & Alerts

```typescript
// Key metrics to monitor
const metrics = {
  // Token generation rate
  "federation.token.generated": { unit: "count", interval: "1m" },
  
  // Token validation success rate
  "federation.token.valid": { unit: "count", interval: "1m" },
  
  // Token validation failures
  "federation.token.invalid": { unit: "count", interval: "1m" },
  
  // Token generation latency
  "federation.token.generation.duration": { unit: "ms", percentiles: [p50, p95, p99] },
  
  // Cross-app navigation events
  "federation.navigation.initiated": { unit: "count", interval: "1m" },
  
  // Failed navigations
  "federation.navigation.failed": { unit: "count", interval: "1m" },
};

// Set up alerts
alerts: [
  {
    name: "High Token Validation Failure Rate",
    condition: "federation.token.invalid > 10 per minute",
    severity: "critical",
    action: "page on-call engineer",
  },
  {
    name: "Token Generation Latency High",
    condition: "federation.token.generation.duration.p99 > 500ms",
    severity: "warning",
    action: "log to Slack",
  },
];
```

### Health Check Endpoint

```typescript
// GET /.well-known/federation-health
export async function federationHealth() {
  const checks = {
    privateKeyLoaded: !!process.env.FEDERATION_PRIVATE_KEY,
    redisConnected: await checkRedisConnection(),
    auditLogConnected: await checkAuditLogConnection(),
    publicKeyServing: await fetch("/.well-known/public-key").then(r => r.ok),
  };
  
  const healthy = Object.values(checks).every(v => v === true);
  
  return {
    status: healthy ? "healthy" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
  };
}
```

---

## Summary

JWT Federation provides a **production-grade, secure, auditable** mechanism for cross-application navigation in enterprise systems. Key benefits:

✅ **Stateless**: No session server synchronization  
✅ **Secure**: 60-second tokens, cryptographic validation, audit logging  
✅ **Scalable**: Works across independent infrastructure  
✅ **Auditable**: Every navigation is logged for compliance  
✅ **Portable**: Tokens contain all necessary information  

Implement incrementally:
1. Start with same-domain shared cookies (simplest)
2. Graduate to JWT Federation for cross-domain (when needed)
3. Add revocation, certificate pinning, and advanced monitoring (production hardening)

---

## References

- [RFC 7519 - JWT](https://tools.ietf.org/html/rfc7519)
- [RFC 7518 - JWA](https://tools.ietf.org/html/rfc7518)
- [SAP Semantic Navigation Pattern](https://help.sap.com/docs/ui5/developing_uis_with_sapui5/semantic-object)
- [OWASP JWT Security](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
