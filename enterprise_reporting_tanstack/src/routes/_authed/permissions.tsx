import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/permissions")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/permissions" });
  },
  component: () => null,
});
