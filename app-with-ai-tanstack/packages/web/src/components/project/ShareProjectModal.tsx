import { AlertCircle, Loader2, Shield, Trash2, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

interface Member {
  id: string;
  user_id: string;
  email: string;
  name?: string;
  permission: "read_only" | "read_write";
  created_at: string;
}

interface ShareProjectModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareProjectModal({ projectId, isOpen, onClose }: ShareProjectModalProps) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"read_only" | "read_write">("read_only");
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen, projectId]);

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) {
        throw new Error("Failed to load members");
      }
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error("Error loading members:", err);
      setError("Failed to load members");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    try {
      setError("");
      setSuccess("");
      setIsLoading(true);

      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), permission }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to add member");
        return;
      }

      setSuccess(`${email} added as ${permission === "read_only" ? "read-only" : "read & write"}`);
      setEmail("");
      setPermission("read_only");
      await loadMembers();

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error adding member:", err);
      setError("Failed to add member");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Remove this member?")) return;

    try {
      setError("");
      setIsLoading(true);

      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to remove member");
      }

      await loadMembers();
    } catch (err) {
      console.error("Error removing member:", err);
      setError("Failed to remove member");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePermission = async (userId: string, newPermission: string) => {
    try {
      setError("");
      setIsLoading(true);

      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission: newPermission }),
      });

      if (!res.ok) {
        throw new Error("Failed to update permission");
      }

      await loadMembers();
    } catch (err) {
      console.error("Error updating permission:", err);
      setError("Failed to update permission");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Share Project</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
          </div>
        )}

        <form
          onSubmit={handleAddMember}
          className="space-y-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700"
        >
          <div>
            <label
              htmlFor="shareprojectmodal-email-address"
              className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
            >
              Email Address
            </label>
            <input
              id="shareprojectmodal-email-address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="shareprojectmodal-permission"
              className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
            >
              Permission
            </label>
            <select
              id="shareprojectmodal-permission"
              value={permission}
              onChange={(e) => setPermission(e.target.value as "read_only" | "read_write")}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="read_only">Read Only (view only)</option>
              <option value="read_write">Read & Write (can edit)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Member"
            )}
          </button>
        </form>

        <div>
          <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Members</h3>
          {members.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No members shared yet
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {member.email}
                    </p>
                    {member.name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{member.name}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-3">
                    <select
                      value={member.permission}
                      onChange={(e) => handleChangePermission(member.user_id, e.target.value)}
                      disabled={isLoading}
                      className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="read_only">Read</option>
                      <option value="read_write">Read+Write</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.user_id)}
                      disabled={isLoading}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-900 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
