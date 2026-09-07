import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/saved-queries")({
  beforeLoad: () => {
    throw redirect({ to: "/queries" });
  },
  component: () => null,
});
