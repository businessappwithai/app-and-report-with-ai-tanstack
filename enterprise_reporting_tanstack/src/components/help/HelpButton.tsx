"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { HelpDialog } from "./HelpDialog";

export function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 relative"
        onClick={() => setOpen(true)}
        title="Help (press ? for keyboard shortcut)"
      >
        <HelpCircle className="h-5 w-5" />
      </Button>
      <HelpDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
