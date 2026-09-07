import { Check, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { DatabaseClientType } from "@/types/database";
import { SqliteFileUpload } from "./sqlite-file-upload";

export const DATABASE_TYPES: { value: DatabaseClientType; label: string }[] = [
  { value: "pg", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "mssql", label: "SQL Server" },
  { value: "sqlite3", label: "SQLite" },
  { value: "oracledb", label: "Oracle" },
];

export interface ConnectionFormState {
  name: string;
  description: string;
  clientType: DatabaseClientType;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  fileName: string;
  connectionString?: string;
  useConnectionString?: boolean;
}

interface ConnectionTestResult {
  success: boolean;
  message: string;
}

interface ConnectionFormFieldsProps {
  state: ConnectionFormState;
  onChange: (patch: Partial<ConnectionFormState>) => void;
  disableType?: boolean;
  passwordPlaceholder?: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  connectionTestResult: ConnectionTestResult | null;
  idPrefix?: string;
}

export function ConnectionFormFields({
  state,
  onChange,
  disableType = false,
  passwordPlaceholder = "********",
  fileInputRef,
  uploading,
  onFileSelect,
  onDragOver,
  onDrop,
  connectionTestResult,
  idPrefix = "",
}: ConnectionFormFieldsProps) {
  const set = (patch: Partial<ConnectionFormState>) => onChange(patch);

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}ds-name`}>Name</Label>
          <Input
            id={`${idPrefix}ds-name`}
            value={state.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Production Database"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}ds-type`}>Database Type</Label>
          <Select
            value={state.clientType}
            onValueChange={(v) => set({ clientType: v as DatabaseClientType })}
            disabled={disableType}
          >
            <SelectTrigger id={`${idPrefix}ds-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATABASE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}ds-description`}>Description</Label>
        <Input
          id={`${idPrefix}ds-description`}
          value={state.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Optional description"
        />
      </div>

      {state.clientType === "sqlite3" ? (
        <div className="space-y-2">
          <Label>Database File</Label>
          <SqliteFileUpload
            fileName={state.fileName}
            uploading={uploading}
            compact={disableType}
            fileInputRef={fileInputRef}
            onFileSelect={onFileSelect}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        </div>
      ) : (
        <>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Button
                type="button"
                variant={state.useConnectionString ? "default" : "outline"}
                className="w-full"
                onClick={() =>
                  set({
                    useConnectionString: true,
                    host: "",
                    port: "",
                    database: "",
                    user: "",
                    password: "",
                  })
                }
              >
                Connection String
              </Button>
            </div>
            <div className="flex-1">
              <Button
                type="button"
                variant={!state.useConnectionString ? "default" : "outline"}
                className="w-full"
                onClick={() => set({ useConnectionString: false, connectionString: "" })}
              >
                Individual Fields
              </Button>
            </div>
          </div>

          {state.useConnectionString ? (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}ds-connection-string`}>Connection String</Label>
              <Input
                id={`${idPrefix}ds-connection-string`}
                value={state.connectionString || ""}
                onChange={(e) => set({ connectionString: e.target.value })}
                placeholder={
                  state.clientType === "pg"
                    ? "postgresql://user:password@host:5432/database?ssl=require"
                    : state.clientType === "mysql"
                      ? "mysql://user:password@host:3306/database"
                      : "server connection string"
                }
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {state.clientType === "pg" &&
                  "Example: postgresql://user:pass@localhost:5432/mydb?ssl=require"}
                {state.clientType === "mysql" && "Example: mysql://user:pass@localhost:3306/mydb"}
                {state.clientType === "mssql" && "Example: mssql://user:pass@localhost:1433/mydb"}
                {state.clientType === "oracledb" &&
                  "Example: oracle://user:pass@localhost:1521/mydb"}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor={`${idPrefix}ds-host`}>Host</Label>
                  <Input
                    id={`${idPrefix}ds-host`}
                    value={state.host}
                    onChange={(e) => set({ host: e.target.value })}
                    placeholder="localhost"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}ds-port`}>Port</Label>
                  <Input
                    id={`${idPrefix}ds-port`}
                    value={state.port}
                    onChange={(e) => set({ port: e.target.value })}
                    placeholder={
                      state.clientType === "pg"
                        ? "5432"
                        : state.clientType === "mysql"
                          ? "3306"
                          : ""
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}ds-database`}>Database</Label>
                <Input
                  id={`${idPrefix}ds-database`}
                  value={state.database}
                  onChange={(e) => set({ database: e.target.value })}
                  placeholder="mydb"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}ds-user`}>Username</Label>
                  <Input
                    id={`${idPrefix}ds-user`}
                    value={state.user}
                    onChange={(e) => set({ user: e.target.value })}
                    placeholder="dbuser"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${idPrefix}ds-password`}>Password</Label>
                  <Input
                    id={`${idPrefix}ds-password`}
                    type="password"
                    value={state.password}
                    onChange={(e) => set({ password: e.target.value })}
                    placeholder={passwordPlaceholder}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {connectionTestResult && (
        <div
          className={`p-3 rounded-md flex items-center gap-2 ${
            connectionTestResult.success
              ? "bg-emerald-500 text-white dark:bg-emerald-600"
              : "bg-red-500 text-white dark:bg-red-600"
          }`}
        >
          {connectionTestResult.success ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          <span className="font-medium">
            {connectionTestResult.success ? "Connection Successful" : "Connection Failed"}
          </span>
          {connectionTestResult.message && !connectionTestResult.success && (
            <span className="text-sm opacity-90">: {connectionTestResult.message}</span>
          )}
        </div>
      )}
    </>
  );
}

interface TestConnectionButtonProps {
  state: ConnectionFormState;
  testing: boolean;
}

export function isTestConnectionDisabled({ state, testing }: TestConnectionButtonProps) {
  if (testing) return true;
  if (state.clientType === "sqlite3") return !state.fileName;
  if (state.useConnectionString) return !state.connectionString;
  return !state.host || !state.database || !state.user;
}

export function TestConnectionButton({ testing }: { testing: boolean }) {
  return (
    <>
      {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
      Test Connection
    </>
  );
}
