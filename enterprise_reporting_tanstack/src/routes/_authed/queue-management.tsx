import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/queue-management")({
  beforeLoad: () => {
    throw redirect({ to: "/bull-board" });
  },
  component: () => null,
});
