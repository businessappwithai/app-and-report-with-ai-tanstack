import { useQuery } from "@tanstack/react-query";
import { apiClient, type PaginatedResponse } from "@/lib/api-client";

interface SysTab {
  sys_tab_id: string;
  sys_window_id: string;
  sys_table_id: string;
  name: string;
  description?: string;
  tab_level: number;
  seq_no: number;
  is_active: boolean;
  [key: string]: unknown;
}

interface SysWindow {
  sys_window_id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

interface WindowAndTabsResult {
  window: SysWindow | null;
  tabs: SysTab[];
  isLoading: boolean;
}

export function useWindowAndTabs(tableName: string): WindowAndTabsResult {
  const { data: windowsData, isLoading: windowsLoading } = useQuery({
    queryKey: ["window-tabs", tableName],
    queryFn: async () => {
      const tables = await apiClient.get<PaginatedResponse<any>>("/sys/tables", {
        search: tableName,
        limit: 1,
      });
      const table = tables?.data?.[0];
      if (!table?.sys_table_id) return { window: null, tabs: [] };

      const [windowsRes, tabsRes] = await Promise.all([
        apiClient.get<PaginatedResponse<SysWindow>>("/sys/windows", { limit: 100 }),
        apiClient.get<PaginatedResponse<SysTab>>("/sys/tabs", { limit: 200 }),
      ]);

      const allTabs = tabsRes?.data || [];
      const tableTabs = allTabs.filter((t) => t.sys_table_id === table.sys_table_id);
      const windowId = tableTabs[0]?.sys_window_id;
      const win = windowsRes?.data?.find((w) => w.sys_window_id === windowId) || null;
      const windowTabs = windowId ? allTabs.filter((t) => t.sys_window_id === windowId) : tableTabs;

      return { window: win, tabs: windowTabs };
    },
    staleTime: 30 * 60 * 1000,
    enabled: !!tableName,
  });

  return {
    window: windowsData?.window || null,
    tabs: windowsData?.tabs || [],
    isLoading: windowsLoading,
  };
}

export function groupFieldsByTab(fields: any[], tabs: SysTab[]): Map<string, any[]> {
  const groups = new Map<string, any[]>();
  for (const tab of tabs) {
    groups.set(tab.sys_tab_id, []);
  }
  for (const field of fields) {
    const tabId = field.sys_tab_id;
    if (groups.has(tabId)) {
      groups.get(tabId)!.push(field);
    }
  }
  return groups;
}

export function sortTabsBySequence(tabs: SysTab[]): SysTab[] {
  return [...tabs].sort((a, b) => (a.seq_no || 0) - (b.seq_no || 0));
}

export function getTabById(tabs: SysTab[], tabId: string): SysTab | undefined {
  return tabs.find((t) => t.sys_tab_id === tabId);
}
