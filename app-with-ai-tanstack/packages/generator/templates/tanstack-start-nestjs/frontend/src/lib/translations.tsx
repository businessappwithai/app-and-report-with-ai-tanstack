import React, { createContext, type ReactNode, useContext } from "react";

const translations = {
  en: {
    "common.dashboard": "Dashboard",
    "common.logout": "Logout",
    "common.login": "Login",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.create": "Create",
    "common.search": "Search",
    "common.loading": "Loading...",
    "common.error": "An error occurred",
    "common.success": "Operation successful",
    "common.actions": "Actions",
    "common.unexpectedError": "An unexpected error occurred",
    "table.deleteFailed": "Delete failed",
    "tabs.recordCreated": "Record created successfully",
    "tabs.recordUpdated": "Record updated successfully",
    "tabs.recordDeleted": "Record deleted successfully",
    "tabs.createFailed": "Failed to create",
    "tabs.updateFailed": "Failed to update",
    "tabs.deleteFailed": "Failed to delete",
    "tabs.loading": "Loading",
    "tabs.loadFailed": "Failed to load",
    "form.createSuccess": "{entity} created successfully",
    "form.updateSuccess": "{entity} updated successfully",
    "form.createFailed": "Failed to create {entity}",
    "form.updateFailed": "Failed to update {entity}",
    "form.deleteFailed": "Delete failed",
  },
};

interface TranslationContextType {
  t: (key: string) => string;
  locale: string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

interface TranslationProviderProps {
  children: ReactNode;
  locale?: string;
}

export function TranslationProvider({ children, locale = "en" }: TranslationProviderProps) {
  const t = (key: string): string => {
    const dict = translations[locale as keyof typeof translations] || translations.en;
    return (dict as Record<string, string>)[key] || key;
  };

  return (
    <TranslationContext.Provider value={{ t, locale }}>{children}</TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useTranslation must be used within TranslationProvider");
  }
  return context;
}

export function translate(key: string, locale = "en"): string {
  const dict = translations[locale as keyof typeof translations] || translations.en;
  return (dict as Record<string, string>)[key] || key;
}

export const useTranslations = useTranslation;
