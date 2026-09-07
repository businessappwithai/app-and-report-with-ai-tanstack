import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
  beforeLoad: async () => {
    throw redirect({ to: "/projects" });
  },
});

function HomePage() {
  return null;
}
