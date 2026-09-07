/**
 * Admin Rules Management Page
 *
 * Manage business rules with JDM Editor integration
 *
 * Generated: 2026-06-09T07:37:11.494Z
 * Project: simple-crm
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle,
  ChevronLeft,
  Edit,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WindowHelpDialog } from "@/components/admin/window-help-dialog";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/admin/rules/")({
  component: AdminRulesPage,
});

interface Rule {
  id: string;
  entityName: string;
  ruleName: string;
  operation: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function AdminRulesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("");
  const [operationFilter, setOperationFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);

  const queryClient = useQueryClient();

  const {
    data: rules,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin", "rules", { entityFilter, operationFilter, activeFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityFilter) params.append("entityName", entityFilter);
      if (operationFilter) params.append("operation", operationFilter);
      if (activeFilter !== "") params.append("isActive", activeFilter);

      const response = await apiClient.get<Rule[]>(`/rules?${params.toString()}`);
      return response;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await apiClient.delete(`/rules/${ruleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "rules"] });
      toast.success("Rule deactivated successfully");
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to deactivate rule: ${error.message}`);
    },
  });

  const filteredRules =
    rules?.filter((rule) => {
      const matchesSearch =
        searchQuery === "" ||
        rule.ruleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.entityName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    }) || [];

  const entityNames = Array.from(new Set(rules?.map((r) => r.entityName) || []));
  const operations = Array.from(new Set(rules?.map((r) => r.operation) || []));

  const handleDelete = (rule: Rule) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (ruleToDelete) {
      deleteMutation.mutate(ruleToDelete.id);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-4 border-black bg-white">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Link
                to="/admin"
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-black transition-colors mb-4"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back to Admin
              </Link>
              <div className="flex items-center gap-4 mb-4">
                <Scale className="h-8 w-8 text-black" />
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-6xl font-bold tracking-tight text-black">Business Rules</h1>
                    <WindowHelpDialog windowName="Business Rules" entityLabel="Business Rules" />
                  </div>
                  <p className="text-xl text-gray-600 font-light mt-2">
                    Manage validation rules and business logic with JDM Editor
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <Button
                variant="outline"
                size="default"
                onClick={() => refetch()}
                disabled={isLoading}
                className="border-2 border-black hover:bg-black hover:text-white transition-colors rounded-none"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Link to="/admin/rules/new">
                <Button className="bg-black text-white hover:bg-gray-800 rounded-none">
                  <Plus className="h-4 w-4 mr-2" />
                  New Rule
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Stats Cards */}
        <section className="mb-12">
          <div className="grid grid-cols-4 gap-0 border-l border-r border-black">
            <div className="border-t border-b border-black border-r p-6 bg-gray-50">
              <p className="text-sm uppercase tracking-widest text-gray-500 mb-2">Total Rules</p>
              <p className="text-4xl font-bold text-black">{rules?.length || 0}</p>
            </div>
            <div className="border-t border-b border-black border-r p-6 bg-gray-50">
              <p className="text-sm uppercase tracking-widest text-gray-500 mb-2">Active</p>
              <p className="text-4xl font-bold text-emerald-700">
                {rules?.filter((r) => r.isActive).length || 0}
              </p>
            </div>
            <div className="border-t border-b border-black border-r p-6 bg-gray-50">
              <p className="text-sm uppercase tracking-widest text-gray-500 mb-2">Inactive</p>
              <p className="text-4xl font-bold text-gray-400">
                {rules?.filter((r) => !r.isActive).length || 0}
              </p>
            </div>
            <div className="border-t border-b border-black p-6 bg-gray-50">
              <p className="text-sm uppercase tracking-widest text-gray-500 mb-2">Entities</p>
              <p className="text-4xl font-bold text-black">{entityNames.length}</p>
            </div>
          </div>
        </section>

        {/* Search and Filter Bar */}
        <section className="mb-8">
          <div className="mb-6 flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search rules by name or entity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-2 border-black rounded-none focus:ring-0 focus:border-black"
              />
            </div>

            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="px-4 py-2 border-2 border-black rounded-none focus:ring-0 focus:border-black bg-white"
            >
              <option value="">All Entities</option>
              {entityNames.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>

            <select
              value={operationFilter}
              onChange={(e) => setOperationFilter(e.target.value)}
              className="px-4 py-2 border-2 border-black rounded-none focus:ring-0 focus:border-black bg-white"
            >
              <option value="">All Operations</option>
              {operations.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>

            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="px-4 py-2 border-2 border-black rounded-none focus:ring-0 focus:border-black bg-white"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </section>

        {/* Rules List */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-500 border-2 border-black">
            Loading rules...
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-16 text-gray-500 border-2 border-black">
            {searchQuery || entityFilter || operationFilter || activeFilter !== ""
              ? "No rules match your search criteria."
              : "No rules found. Create your first rule to get started."}
          </div>
        ) : (
          <div className="border-2 border-black">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b-2 border-black text-sm uppercase tracking-wider font-semibold">
              <div className="col-span-3">Rule Name</div>
              <div className="col-span-2">Entity</div>
              <div className="col-span-2">Operation</div>
              <div className="col-span-1">Version</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2">Updated</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {filteredRules.map((rule) => (
              <div
                key={rule.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-t border-gray-200 hover:bg-gray-50 items-center"
              >
                <div className="col-span-3">
                  <div className="font-semibold text-black">{rule.ruleName}</div>
                  <div className="text-xs text-gray-500 font-mono">{rule.id.slice(0, 8)}</div>
                </div>

                <div className="col-span-2">
                  <code className="text-sm bg-gray-100 px-2 py-1 font-mono">{rule.entityName}</code>
                </div>

                <div className="col-span-2">
                  <span className="text-sm font-medium">{rule.operation}</span>
                </div>

                <div className="col-span-1">
                  <span className="text-sm font-bold">v{rule.version}</span>
                </div>

                <div className="col-span-1">
                  {rule.isActive ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-emerald-50 text-emerald-700 font-semibold">
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-700 font-semibold">
                      <XCircle className="h-3 w-3" />
                      Inactive
                    </span>
                  )}
                </div>

                <div className="col-span-2">
                  <div className="text-sm text-gray-600">
                    {new Date(rule.updatedAt).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(rule.updatedAt).toLocaleTimeString()}
                  </div>
                </div>

                <div className="col-span-1 flex justify-end gap-2">
                  <Link to="/admin/rules/$id/edit" params={{ id: rule.id }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-black hover:text-white rounded-none"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(rule)}
                    className="h-8 w-8 p-0 hover:bg-red-600 hover:text-white rounded-none"
                    disabled={!rule.isActive}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-2 border-black rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate the rule <strong>{ruleToDelete?.ruleName}</strong>
              ? This will disable the rule but keep its history. You can reactivate it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 rounded-none"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <footer className="border-t-2 border-black mt-16">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <p className="text-sm text-gray-500">Business Rules Management</p>
        </div>
      </footer>
    </div>
  );
}
