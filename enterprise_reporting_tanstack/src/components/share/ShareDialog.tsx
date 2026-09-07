"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Globe, Lock, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string;
  resourceType: "dashboard" | "report" | "chart";
  isPublic: boolean;
  onTogglePublic: (isPublic: boolean) => void;
}

export function ShareDialog({
  open,
  onOpenChange,
  resourceId,
  resourceType,
  isPublic,
  onTogglePublic,
}: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/share/${resourceType}/${resourceId}`
      : "";

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Share link copied to clipboard");
    } catch (_err) {
      toast.error("Failed to copy link");
    }
  };

  const togglePublicMutation = useMutation({
    mutationFn: async (_newPublicState: boolean) => {
      const response = await fetch(`/api/${resourceType}s/${resourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: newState }),
      });

      if (!response.ok) {
        throw new Error("Failed to update visibility");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [resourceType, resourceId] });
      toast.success(
        isPublic
          ? "Dashboard is now private. Only logged in users can view it."
          : "Dashboard is now public. Anyone with the link can view it."
      );
      onTogglePublic(!isPublic);
    },
    onError: () => {
      toast.error("Failed to update visibility");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share {resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}
          </DialogTitle>
          <DialogDescription>
            {isPublic
              ? "This is publicly visible. Anyone with the link can view it."
              : "This is private. Only you can view it."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Public Toggle */}
          <div className="flex items-center justify-between space-x-4">
            <div className="space-y-0.5">
              <Label className="text-base">Make Public</Label>
              <p className="text-tremor-default text-tremor-content">
                {isPublic
                  ? "Anyone with the link can view this without logging in."
                  : "Only you can view this. Users must be logged in."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe className="h-5 w-5 text-emerald-600" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
              <Switch
                checked={isPublic}
                onCheckedChange={(checked) => togglePublicMutation.mutate(checked)}
                disabled={togglePublicMutation.isPending}
              />
            </div>
          </div>

          {/* Share Link */}
          {isPublic && (
            <div className="space-y-2">
              <Label htmlFor="share-url">Public Share Link</Label>
              <div className="flex space-x-2">
                <Input id="share-url" value={shareUrl} readOnly className="flex-1" />
                <Button
                  size="icon"
                  variant={copied ? "default" : "outline"}
                  onClick={copyToClipboard}
                  disabled={togglePublicMutation.isPending}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-tremor-label text-tremor-content">
                Share this link to give others view access.
              </p>
            </div>
          )}

          {!isPublic && (
            <div className="rounded-md border p-4 bg-muted/50">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Private Sharing</p>
                  <p className="text-tremor-label text-tremor-content">
                    Make this {resourceType} public to generate a share link that doesn't require
                    login.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
