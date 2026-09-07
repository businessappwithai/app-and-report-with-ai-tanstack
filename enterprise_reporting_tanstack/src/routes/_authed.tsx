import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { AppShell } from "@/components/layout/app-shell";
import { verifySession } from "@/lib/auth/session";

const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const cookie = getRequestHeader("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
});

export const Route = createFileRoute("/_authed")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
    return { session };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session } = Route.useRouteContext();
  return (
    <AppShell user={session.user}>
      <Outlet />
    </AppShell>
  );
}
