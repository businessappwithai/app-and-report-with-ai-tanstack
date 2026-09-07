import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/roles")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/roles" });
  },
  component: () => null,
});
