type LogStatus = "running" | "success" | "error" | "warning";

interface ActionLog {
  id: string;
  projectId: string;
  action: string;
  message: string;
  status: LogStatus;
  entries: Array<{ message: string; status: LogStatus; detail?: string; timestamp: string }>;
  startedAt: string;
  completedAt?: string;
}

const actionLogs = new Map<string, ActionLog>();

export function startActionLog(projectId: string, action: string, message: string): string {
  const id = `${projectId}-${action}-${Date.now()}`;
  actionLogs.set(id, {
    id,
    projectId,
    action,
    message,
    status: "running",
    entries: [],
    startedAt: new Date().toISOString(),
  });
  return id;
}

export function addLogEntry(
  actionId: string,
  message: string,
  status: LogStatus,
  detail?: string
): void {
  const log = actionLogs.get(actionId);
  if (!log) return;
  log.entries.push({ message, status, detail, timestamp: new Date().toISOString() });
}

export function completeActionLog(actionId: string, status: LogStatus, message: string): void {
  const log = actionLogs.get(actionId);
  if (!log) return;
  log.status = status;
  log.message = message;
  log.completedAt = new Date().toISOString();
}

export function getActionLog(actionId: string): ActionLog | undefined {
  return actionLogs.get(actionId);
}
