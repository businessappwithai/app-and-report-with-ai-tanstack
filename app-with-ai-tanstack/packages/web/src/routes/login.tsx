import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Tab = "login" | "register";
type RegistrationStatus = "idle" | "pending";

function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s: any) => s.setUser);

  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>("idle");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          navigate({ to: "/projects" });
        }
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === "PENDING_APPROVAL") {
          setError(
            "Your account is pending admin approval. Please wait for an administrator to review your registration."
          );
        } else if (data.error === "ACCOUNT_REJECTED") {
          setError("Your account has been rejected. Please contact an administrator.");
        } else {
          setError(data.error ?? "Login failed");
        }
        return;
      }

      setUser(data.user);
      window.location.href = "/projects";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }

      if (data.pending) {
        setRegistrationStatus("pending");
        setEmail("");
        setPassword("");
        setName("");
        return;
      }

      setUser(data.user);
      window.location.href = "/projects";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (registrationStatus === "pending") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white dark:from-gray-950 dark:to-gray-900 p-4">
        <div className="w-full max-w-md mx-auto flex items-center justify-center min-h-screen">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 w-full">
            <div className="flex justify-center mb-6">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-4 text-gray-900 dark:text-white">
              Registration Successful!
            </h2>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <p className="text-blue-900 dark:text-blue-200 text-center">
                Your account is pending admin approval. An administrator will review your
                registration and grant you access shortly. You'll be able to log in once approved.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRegistrationStatus("idle");
                setTab("login");
                setError("");
              }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white dark:from-gray-950 dark:to-gray-900 p-4">
      <div className="w-full max-w-md mx-auto flex items-center justify-center min-h-screen">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 w-full">
          <div className="flex justify-center mb-6">
            <svg
              aria-hidden="true"
              className="w-12 h-12 text-orange-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 17.5h7M17.5 14v7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
            APPWITHAI
          </h1>

          <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                setTab("login");
                setError("");
              }}
              className={`pb-3 px-4 font-semibold transition ${
                tab === "login"
                  ? "text-orange-500 border-b-2 border-orange-500"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              <LogIn className="inline mr-2 w-5 h-5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("register");
                setError("");
              }}
              className={`pb-3 px-4 font-semibold transition ${
                tab === "register"
                  ? "text-orange-500 border-b-2 border-orange-500"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-6 flex gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={tab === "login" ? handleLogin : handleRegister} className="space-y-4">
            {tab === "register" && (
              <div>
                <label
                  htmlFor="login-full-name"
                  className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white"
                >
                  Full Name
                </label>
                <input
                  id="login-full-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  disabled={isLoading}
                />
              </div>
            )}

            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                disabled={isLoading}
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-semibold mb-2 text-gray-900 dark:text-white"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                disabled={isLoading}
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {isLoading
                ? tab === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : tab === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
