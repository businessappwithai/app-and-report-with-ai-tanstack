import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { AUTH_REGISTER_LIMIT, enforceRateLimit } = await import("@/lib/rate-limit");

        // Signup abuse protection: 3 registrations per minute per IP.
        const limited = enforceRateLimit(request, "auth:register", AUTH_REGISTER_LIMIT);
        if (limited) return limited;

        const { getDatabase, runMigrations } = await import("@appwithai/core/services");
        const { hashPassword } = await import("@/lib/password");

        try {
          await runMigrations();
          const db = getDatabase();
          const body = await request.json();
          const { email, password, name } = body as {
            email: string;
            password: string;
            name: string;
          };

          if (!email || !password || !name) {
            return new Response(
              JSON.stringify({ error: "Name, email and password are required" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          if (password.length < 8) {
            return new Response(
              JSON.stringify({ error: "Password must be at least 8 characters" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // Check if user already exists
          const existingUser = await db
            .selectFrom("auth_users")
            .selectAll()
            .where("email", "=", email)
            .executeTakeFirst();

          if (existingUser) {
            return new Response(JSON.stringify({ error: "Email already registered" }), {
              status: 409,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Create user
          const userId = crypto.randomUUID();
          const now = new Date().toISOString();
          const passwordHash = await hashPassword(password);

          await db
            .insertInto("auth_users")
            .values({
              id: userId,
              email,
              name,
              passwordHash,
              emailVerified: false,
              status: "pending",
              role: "user",
              createdAt: now,
              updatedAt: now,
            })
            .execute();

          return new Response(
            JSON.stringify({
              pending: true,
              message: "Registration successful! Your account is pending admin approval.",
              userId,
            }),
            {
              status: 202,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("[Register Error]", error);
          const message = error instanceof Error ? error.message : "Registration failed";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
