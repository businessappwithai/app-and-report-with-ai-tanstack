"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-tremor-background group-[.toaster]:text-tremor-content-emphasis group-[.toaster]:border-tremor-border group-[.toaster]:rounded-tremor-default group-[.toaster]:shadow-tremor-dropdown",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-tremor-background-subtle group-[.toast]:text-tremor-content",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
