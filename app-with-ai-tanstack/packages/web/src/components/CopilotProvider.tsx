"use client";

import { CopilotKit } from "@copilotkit/react-core";
import type { ReactNode } from "react";
import "@copilotkit/react-ui/styles.css";

// Filter out Lit dev mode warnings from CopilotKit BEFORE any code runs
// This must run at module load time, not in useEffect
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = (...args: unknown[]) => {
    const message = args[0];

    // Check if this is a Lit dev mode warning
    const isLitWarning =
      (typeof message === "string" &&
        (message.includes("Lit is in dev mode") || message.includes("lit.dev/msg/dev-mode"))) ||
      (typeof message === "object" &&
        message !== null &&
        "toString" in message &&
        message.toString().includes("Lit is in dev mode"));

    if (isLitWarning) {
      return; // Suppress the warning
    }

    originalWarn.apply(console, args);
  };

  // Also filter from console.error as some Lit warnings come through error
  console.error = (...args: unknown[]) => {
    const message = args[0];

    const isLitWarning =
      (typeof message === "string" &&
        (message.includes("Lit is in dev mode") || message.includes("lit.dev/msg/dev-mode"))) ||
      (typeof message === "object" &&
        message !== null &&
        "toString" in message &&
        message.toString().includes("Lit is in dev mode"));

    if (isLitWarning) {
      return;
    }

    originalError.apply(console, args);
  };
}

interface CopilotProviderProps {
  children: ReactNode;
}

export function CopilotProvider({ children }: CopilotProviderProps) {
  // The inspector is gated on `enableInspector`, NOT `showDevConsole` — the
  // <CopilotKit> wrapper reads them from different props, and `showDevConsole`
  // only silences error toasts and banners. Left unset, `enableInspector`
  // falls back to "is this localhost?", so it mounts a <cpk-web-inspector>
  // floating button that sits above everything at z-index 2147483646 and
  // swallows clicks landing under it.
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" enableInspector={false} showDevConsole={false}>
      {children}
    </CopilotKit>
  );
}
