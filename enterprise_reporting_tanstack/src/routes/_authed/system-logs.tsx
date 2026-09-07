import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/system-logs")({
  beforeLoad: () => {
    throw redirect({ to: "/logs" });
  },
  component: () => null,
});
