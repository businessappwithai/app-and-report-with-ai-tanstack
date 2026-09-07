"use client";

import { Loader2, X } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (data: {
    name: string;
    description: string;
    stackType: "tanstackjs-nestjs";
  }) => Promise<void>;
  isLoading?: boolean;
}

export function NewProjectModal({ isOpen, onClose, onCreateProject }: NewProjectModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    stackType: "tanstackjs-nestjs" as const,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onCreateProject(formData);
      setFormData({ name: "", description: "", stackType: "tanstackjs-nestjs" });
      onClose();
    } catch (error) {
      console.error("Failed to create project:", error);
      alert(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Project</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Project Name */}
          <div>
            <label
              htmlFor="project-name"
              className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2 block"
            >
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              id="project-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Hospital Management System"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2 block"
            >
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your project in detail. What does it do? What are the main features and entities?"
              rows={6}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Stack Type */}
          <div>
            <span className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2 block">
              Stack Type <span className="text-red-500">*</span>
            </span>
            <div className="flex items-center p-4 border-2 border-primary bg-primary/5 rounded-xl">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white">
                  Full Stack: TanStack Start + NestJS
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Modern web framework with React, TypeScript, and PostgreSQL
                </p>
              </div>
              <div className="w-5 h-5 rounded-full border-2 border-primary bg-primary flex items-center justify-center">
                <svg
                  aria-hidden="true"
                  className="w-3 h-3 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 py-3 rounded-xl text-sm font-bold text-gray-900 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.name || !formData.description}
              className="flex-1 bg-primary hover:bg-primary/90 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
