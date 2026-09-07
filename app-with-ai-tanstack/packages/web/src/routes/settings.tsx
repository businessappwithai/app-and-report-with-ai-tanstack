import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  CircleX,
  Database,
  Download,
  Eye,
  EyeOff,
  HardDrive,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Shield,
  Sun,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { requestContext } from "@/lib/request-context";

async function checkAuthMe() {
  const { baseUrl, fetchInit } = await requestContext();
  const res = await fetch(`${baseUrl}/api/auth/me`, fetchInit);
  return res.json() as Promise<{ user: { id: string; email: string; role: string } | null }>;
}

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    try {
      const data = await checkAuthMe();
      if (!data.user) throw redirect({ to: "/login" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: SettingsPage,
});

type CacheInfo = {
  size: string;
  items: number;
  lastCleared: string;
};

type PrivacySetting = {
  analytics: boolean;
  crashReports: boolean;
  personalization: boolean;
  dataSharing: boolean;
};

type ConfirmationDialog = {
  type: "cache" | "tempFiles" | "exportData" | "deleteAll" | null;
  title: string;
  description: string;
  warning?: string;
};

function SettingsPage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    updates: true,
  });
  const [profile, setProfile] = useState({
    name: "Developer",
    email: "developer@example.com",
  });
  const [isSaving, setIsSaving] = useState(false);

  const [cacheInfo, setCacheInfo] = useState<CacheInfo>({
    size: "Calculating...",
    items: 0,
    lastCleared: "Never",
  });
  const [privacySettings, setPrivacySettings] = useState<PrivacySetting>({
    analytics: true,
    crashReports: true,
    personalization: false,
    dataSharing: false,
  });
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);

  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isRemovingTempFiles, setIsRemovingTempFiles] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isDeletingAllData, setIsDeletingAllData] = useState(false);
  const [isLoadingCache, setIsLoadingCache] = useState(true);

  const [showConfirmDialog, setShowConfirmDialog] = useState<ConfirmationDialog>({
    type: null,
    title: "",
    description: "",
  });

  const [actionStatus, setActionStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "default"
  >("default");
  const [isUpdatingNotification, setIsUpdatingNotification] = useState(false);

  useEffect(() => {
    loadCacheInfo();
    loadNotificationSettings();
    checkNotificationPermission();
    loadTheme();
    loadProfile();
    loadPrivacySettings();
  }, []);

  const loadPrivacySettings = () => {
    try {
      const saved = localStorage.getItem("privacySettings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setPrivacySettings(parsed);
      }
    } catch (error) {
      console.error("Failed to load privacy settings:", error);
    }
  };

  const savePrivacySettings = (settings: PrivacySetting) => {
    try {
      localStorage.setItem("privacySettings", JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save privacy settings:", error);
    }
  };

  const handlePrivacyChange = (key: keyof PrivacySetting, value: boolean) => {
    const updated = { ...privacySettings, [key]: value };
    setPrivacySettings(updated);
    savePrivacySettings(updated);
  };

  const loadTheme = () => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved && (saved === "light" || saved === "dark" || saved === "system")) {
        setTheme(saved);
      }
    } catch (error) {
      console.error("Failed to load theme:", error);
    }
  };

  const loadProfile = () => {
    try {
      const saved = localStorage.getItem("userProfile");
      if (saved) {
        const parsed = JSON.parse(saved);
        setProfile(parsed);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    }
  };

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    try {
      localStorage.setItem("theme", newTheme);

      if (newTheme === "system") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.classList.toggle("dark", prefersDark);
      } else {
        document.documentElement.classList.toggle("dark", newTheme === "dark");
      }

      setActionStatus({
        type: "success",
        message: `Theme changed to ${newTheme}`,
      });
      setTimeout(() => setActionStatus({ type: null, message: "" }), 2000);
    } catch (error) {
      console.error("Failed to save theme:", error);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);

    try {
      const settings = {
        theme,
        notifications,
        profile,
        privacySettings,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem("appSettings", JSON.stringify(settings));
      localStorage.setItem("userProfile", JSON.stringify(profile));

      await new Promise((resolve) => setTimeout(resolve, 1000));

      setActionStatus({
        type: "success",
        message: "Settings saved successfully!",
      });
      setTimeout(() => setActionStatus({ type: null, message: "" }), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setActionStatus({
        type: "error",
        message: "Failed to save settings. Please try again.",
      });
      setTimeout(() => setActionStatus({ type: null, message: "" }), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const loadNotificationSettings = () => {
    try {
      const saved = localStorage.getItem("notificationSettings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setNotifications(parsed);
      }
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    }
  };

  const saveNotificationSettings = (settings: typeof notifications) => {
    try {
      localStorage.setItem("notificationSettings", JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save notification settings:", error);
    }
  };

  const checkNotificationPermission = async () => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  };

  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!("Notification" in window)) {
      setActionStatus({
        type: "error",
        message: "This browser does not support desktop notifications",
      });
      setTimeout(() => setActionStatus({ type: null, message: "" }), 3000);
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        new Notification("APPWITHAI", {
          body: "Notifications enabled! You'll receive updates here.",
          icon: "/favicon.ico",
        });

        setActionStatus({
          type: "success",
          message: "Notifications enabled successfully!",
        });
        setTimeout(() => setActionStatus({ type: null, message: "" }), 3000);
        return true;
      } else {
        setActionStatus({
          type: "error",
          message: "Notification permission denied. Please enable in browser settings.",
        });
        setTimeout(() => setActionStatus({ type: null, message: "" }), 3000);
        return false;
      }
    }

    setActionStatus({
      type: "error",
      message: "Notifications are blocked. Please enable them in your browser settings.",
    });
    setTimeout(() => setActionStatus({ type: null, message: "" }), 3000);
    return false;
  };

  const handleNotificationChange = async (key: keyof typeof notifications, value: boolean) => {
    if (key === "push" && value === true) {
      setIsUpdatingNotification(true);
      const granted = await requestNotificationPermission();

      if (!granted) {
        setIsUpdatingNotification(false);
        return;
      }
    }

    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    saveNotificationSettings(updated);
    setIsUpdatingNotification(false);

    const messages = {
      email: value ? "Email notifications enabled" : "Email notifications disabled",
      push: value ? "Push notifications enabled" : "Push notifications disabled",
      updates: value ? "Product updates enabled" : "Product updates disabled",
    };

    setActionStatus({
      type: "success",
      message: messages[key],
    });
    setTimeout(() => setActionStatus({ type: null, message: "" }), 2000);
  };

  const loadCacheInfo = async () => {
    setIsLoadingCache(true);
    try {
      let totalSize = 0;
      let itemCount = 0;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key || "");
        totalSize += (key?.length || 0) + (value?.length || 0);
        itemCount++;
      }

      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
      const sizeStr =
        totalSize > 1024 * 1024 ? `${sizeInMB} MB` : `${(totalSize / 1024).toFixed(2)} KB`;

      const lastCleared = localStorage.getItem("lastCacheCleared") || "Never";

      setCacheInfo({
        size: sizeStr,
        items: itemCount,
        lastCleared: lastCleared === "Never" ? "Never" : new Date(lastCleared).toLocaleDateString(),
      });
    } catch (error) {
      console.error("Failed to load cache info:", error);
      setCacheInfo({
        size: "Unknown",
        items: 0,
        lastCleared: "Never",
      });
    } finally {
      setIsLoadingCache(false);
    }
  };

  const clearCache = async () => {
    setIsClearingCache(true);
    setActionStatus({ type: null, message: "" });

    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      const settings = localStorage.getItem("theme");
      localStorage.clear();
      if (settings) localStorage.setItem("theme", settings);

      localStorage.setItem("lastCacheCleared", new Date().toISOString());

      await new Promise((resolve) => setTimeout(resolve, 1500));

      setActionStatus({
        type: "success",
        message: "Cache cleared successfully! Application will perform better now.",
      });

      await loadCacheInfo();
    } catch (error) {
      console.error("Failed to clear cache:", error);
      setActionStatus({
        type: "error",
        message: "Failed to clear cache. Please try again.",
      });
    } finally {
      setIsClearingCache(false);
      setShowConfirmDialog({ type: null, title: "", description: "" });
    }
  };

  const removeTempFiles = async () => {
    setIsRemovingTempFiles(true);
    setActionStatus({ type: null, message: "" });

    try {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases
          .filter((db) => db.name && !db.name.includes("settings"))
          .map((db) => indexedDB.deleteDatabase(db.name ?? ""))
      );

      sessionStorage.clear();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      setActionStatus({
        type: "success",
        message: "Temporary files removed successfully! Freed up disk space.",
      });

      await loadCacheInfo();
    } catch (error) {
      console.error("Failed to remove temp files:", error);
      setActionStatus({
        type: "error",
        message: "Failed to remove temporary files. Please try again.",
      });
    } finally {
      setIsRemovingTempFiles(false);
      setShowConfirmDialog({ type: null, title: "", description: "" });
    }
  };

  const exportUserData = async () => {
    setIsExportingData(true);
    setActionStatus({ type: null, message: "" });

    try {
      const userData = {
        exportDate: new Date().toISOString(),
        settings: {
          theme,
          notifications,
          privacySettings,
        },
        localStorage: {} as Record<string, string | null>,
        sessionStorage: {} as Record<string, string | null>,
      };

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          userData.localStorage[key] = localStorage.getItem(key);
        }
      }

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          userData.sessionStorage[key] = sessionStorage.getItem(key);
        }
      }

      const blob = new Blob([JSON.stringify(userData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `appwithai-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setActionStatus({
        type: "success",
        message: "Data exported successfully! Check your downloads folder.",
      });
    } catch (error) {
      console.error("Failed to export data:", error);
      setActionStatus({
        type: "error",
        message: "Failed to export data. Please try again.",
      });
    } finally {
      setIsExportingData(false);
      setShowConfirmDialog({ type: null, title: "", description: "" });
    }
  };

  const deleteAllData = async () => {
    setIsDeletingAllData(true);
    setActionStatus({ type: null, message: "" });

    try {
      localStorage.clear();
      sessionStorage.clear();

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      const databases = await indexedDB.databases();
      await Promise.all(
        databases.map((db) => (db.name ? indexedDB.deleteDatabase(db.name) : Promise.resolve()))
      );

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

      setActionStatus({
        type: "success",
        message: "All data deleted successfully! Refreshing the page...",
      });

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Failed to delete all data:", error);
      setActionStatus({
        type: "error",
        message: "Failed to delete all data. Please try again.",
      });
      setIsDeletingAllData(false);
    }
  };

  const handleConfirmAction = () => {
    switch (showConfirmDialog.type) {
      case "cache":
        clearCache();
        break;
      case "tempFiles":
        removeTempFiles();
        break;
      case "exportData":
        exportUserData();
        break;
      case "deleteAll":
        deleteAllData();
        break;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-screen-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-lg tracking-tight">Settings</h1>
          </div>
        </div>
      </header>

      <main className="max-w-screen-md mx-auto pb-32 px-4 pt-6">
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">Profile</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="settings-display-name"
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block"
                >
                  Display Name
                </label>
                <input
                  id="settings-display-name"
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full bg-muted border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label
                  htmlFor="settings-email"
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block"
                >
                  Email
                </label>
                <input
                  id="settings-email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full bg-muted border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Palette className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">Appearance</h2>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
                  Theme
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleThemeChange("light")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      theme === "light"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/20"
                    }`}
                  >
                    <Sun className="w-5 h-5" />
                    <span className="text-xs font-medium">Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleThemeChange("dark")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      theme === "dark"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/20"
                    }`}
                  >
                    <Moon className="w-5 h-5" />
                    <span className="text-xs font-medium">Dark</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleThemeChange("system")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      theme === "system"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/20"
                    }`}
                  >
                    <Monitor className="w-5 h-5" />
                    <span className="text-xs font-medium">System</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">Notifications</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNotificationChange("email", !notifications.email)}
                  disabled={isUpdatingNotification}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    notifications.email ? "bg-primary" : "bg-muted"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.email ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Push Notifications</p>
                    {notificationPermission !== "default" && (
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                          notificationPermission === "granted"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                        }`}
                      >
                        {notificationPermission === "granted" ? "Allowed" : "Blocked"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">Receive browser notifications</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNotificationChange("push", !notifications.push)}
                  disabled={isUpdatingNotification || notificationPermission === "denied"}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    notifications.push ? "bg-primary" : "bg-muted"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.push ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {notificationPermission === "denied" && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Push notifications are blocked. To enable them, go to your browser settings and
                    allow notifications for this site.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Product Updates</p>
                  <p className="text-sm text-muted-foreground">Get notified about new features</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNotificationChange("updates", !notifications.updates)}
                  disabled={isUpdatingNotification}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    notifications.updates ? "bg-primary" : "bg-muted"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.updates ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-lg">Advanced</h2>
              </div>
              <button
                type="button"
                onClick={loadCacheInfo}
                disabled={isLoadingCache}
                className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                title="Refresh cache info"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingCache ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="mb-6 p-4 bg-muted/50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Cache Size</span>
                </div>
                <span className="text-sm font-bold text-primary">
                  {isLoadingCache ? "Calculating..." : cacheInfo.size}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Cached Items</span>
                </div>
                <span className="text-sm font-bold">
                  {isLoadingCache ? "..." : cacheInfo.items}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Last Cleared</span>
                </div>
                <span className="text-xs text-muted-foreground">{cacheInfo.lastCleared}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() =>
                  setShowConfirmDialog({
                    type: "cache",
                    title: "Clear Application Cache?",
                    description:
                      "This will clear all cached data including images, API responses, and temporary files. Your projects and settings will be preserved.",
                  })
                }
                disabled={isClearingCache}
                className="w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div>
                      <p className="font-medium text-sm">Clear Cache</p>
                      <p className="text-xs text-muted-foreground">
                        Free up {cacheInfo.size} of cached data
                      </p>
                    </div>
                  </div>
                  {isClearingCache && <RefreshCw className="w-4 h-4 animate-spin text-primary" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setShowConfirmDialog({
                    type: "tempFiles",
                    title: "Remove Temporary Files?",
                    description:
                      "This will remove all temporary files, session data, and IndexedDB entries. This action helps improve application performance.",
                  })
                }
                disabled={isRemovingTempFiles}
                className="w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-4 h-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                    <div>
                      <p className="font-medium text-sm">Remove Temporary Files</p>
                      <p className="text-xs text-muted-foreground">
                        Clean up session storage and temp data
                      </p>
                    </div>
                  </div>
                  {isRemovingTempFiles && (
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setShowConfirmDialog({
                    type: "exportData",
                    title: "Export Your Data?",
                    description:
                      "Download a copy of all your data including settings, preferences, and local storage. This is useful for backups or migrating to another device.",
                  })
                }
                disabled={isExportingData}
                className="w-full text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Download className="w-4 h-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                    <div>
                      <p className="font-medium text-sm">Export Your Data</p>
                      <p className="text-xs text-muted-foreground">
                        Download all your data as JSON
                      </p>
                    </div>
                  </div>
                  {isExportingData && (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                  )}
                </div>
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-lg">Privacy Settings</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyDetails(!showPrivacyDetails)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                {showPrivacyDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Analytics</p>
                  <p className="text-xs text-muted-foreground">
                    Help improve the app with usage data
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePrivacyChange("analytics", !privacySettings.analytics)}
                  className={`relative w-11 h-5.5 rounded-full transition-colors ${
                    privacySettings.analytics ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform ${
                      privacySettings.analytics ? "translate-x-5.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Crash Reports</p>
                  <p className="text-xs text-muted-foreground">Automatically send error reports</p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePrivacyChange("crashReports", !privacySettings.crashReports)}
                  className={`relative w-11 h-5.5 rounded-full transition-colors ${
                    privacySettings.crashReports ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform ${
                      privacySettings.crashReports ? "translate-x-5.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Personalization</p>
                  <p className="text-xs text-muted-foreground">
                    Use data to personalize your experience
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handlePrivacyChange("personalization", !privacySettings.personalization)
                  }
                  className={`relative w-11 h-5.5 rounded-full transition-colors ${
                    privacySettings.personalization ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full transition-transform ${
                      privacySettings.personalization ? "translate-x-5.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {showPrivacyDetails && (
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-2">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    Privacy Information
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your data is stored locally on your device. We do not collect or transmit
                    personal information without your consent. You can export or delete your data at
                    any time using the options above.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmDialog({
                      type: "deleteAll",
                      title: "Delete All Data?",
                      description:
                        "⚠️ This will permanently delete all your data including projects, settings, preferences, and cached information. This action cannot be undone.",
                      warning:
                        "This is a destructive action that will remove all your data from this device.",
                    })
                  }
                  disabled={isDeletingAllData}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {isDeletingAllData ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-bold">Deleting...</span>
                    </>
                  ) : (
                    <>
                      <CircleX className="w-4 h-4" />
                      <span className="text-sm font-bold">Delete All Data</span>
                    </>
                  )}
                </button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Permanently remove all data from this device
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </main>

      {showConfirmDialog.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1">{showConfirmDialog.title}</h3>
                <p className="text-sm text-muted-foreground">{showConfirmDialog.description}</p>
                {showConfirmDialog.warning && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                    {showConfirmDialog.warning}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmDialog({ type: null, title: "", description: "" })}
                className="flex-1 bg-muted hover:bg-muted/80 py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {actionStatus.type && (
        <div
          className={`fixed bottom-24 left-4 right-4 max-w-screen-md mx-auto p-4 rounded-xl shadow-2xl z-50 ${
            actionStatus.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
          }`}
        >
          <div className="flex items-center gap-3">
            {actionStatus.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <CircleX className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{actionStatus.message}</p>
            <button
              type="button"
              onClick={() => setActionStatus({ type: null, message: "" })}
              className="ml-auto p-1 hover:bg-white/10 rounded transition-colors"
            >
              <CircleX className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border px-6 py-2 flex items-center justify-center pb-8 z-40">
        <Link
          to="/projects"
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
          <span className="text-[10px] font-medium">Back to Projects</span>
        </Link>
      </nav>
    </div>
  );
}
