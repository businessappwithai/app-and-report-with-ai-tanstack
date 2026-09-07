import { useEffect, useState } from "react";

/**
 * Hook for human-in-the-loop approval workflows
 * Provides approve, reject, and modify actions for AI-generated content
 */
export function useHumanInTheLoop({ action }: { action: string }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch pending approval data
    const fetchApprovalData = async () => {
      try {
        const response = await fetch(`/api/approvals/${action}`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error("Failed to fetch approval data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchApprovalData();
  }, [action]);

  const approve = async (data: unknown) => {
    try {
      await fetch(`/api/approvals/${action}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("Failed to approve:", error);
    }
  };

  const reject = async (data: unknown) => {
    try {
      await fetch(`/api/approvals/${action}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("Failed to reject:", error);
    }
  };

  const modify = async (data: unknown) => {
    try {
      await fetch(`/api/approvals/${action}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error("Failed to modify:", error);
    }
  };

  return {
    data,
    loading,
    approve,
    reject,
    modify,
  };
}
