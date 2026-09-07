/**
 * Admin Workflows Monitoring Page
 *
 * Monitor workflow execution history and status
 *
 * Generated: 2026-06-09T07:37:11.495Z
 */

import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Workflow,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  GitBranch,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_NAME } from "@/lib/app-meta";

export const Route = createFileRoute('/admin/workflows')({
  component: AdminWorkflowsPage,
});

interface WorkflowRun {
  id: string;
  entity_name: string;
  entity_id: string;
  workflow_name?: string;
  operation: string;
  status: 'draft' | 'success' | 'error';
  error_details?: string;
  mutations_applied?: any;
  duration_ms?: number;
  created_at: string;
  completed_at?: string;
}

/** Strip bus_ prefix, snake_case → Title Case */
function formatEntity(name: string): string {
  return name
    .replace(/^bus_/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function AdminWorkflowsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [operationFilter, setOperationFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: workflows, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'workflows', { statusFilter, entityFilter, operationFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (entityFilter) params.append('entityName', entityFilter);
      if (operationFilter) params.append('operation', operationFilter);
      params.append('limit', '100');

      const raw = await apiClient.get<any>(`/api/workflows/runs?${params.toString()}`);
      return (Array.isArray(raw) ? raw : raw?.items ?? raw?.data ?? []) as WorkflowRun[];
    },
    refetchInterval: 5000,
  });

  const filteredWorkflows = (workflows ?? []).filter((wf) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !wf.entity_name.toLowerCase().includes(q) &&
        !wf.entity_id.toLowerCase().includes(q) &&
        !(wf.workflow_name ?? '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const entityNames = Array.from(new Set((workflows ?? []).map((w) => w.entity_name)));
  const operations = Array.from(new Set((workflows ?? []).map((w) => w.operation)));

  const withDuration = (workflows ?? []).filter((w) => w.duration_ms);
  const avgDuration =
    withDuration.length === 0
      ? 0
      : withDuration.reduce((acc, w) => acc + (w.duration_ms ?? 0), 0) / withDuration.length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'error':   return <XCircle className="h-4 w-4 text-red-600" />;
      case 'draft':   return <Clock className="h-4 w-4 text-blue-600" />;
      default:        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'error':   return 'bg-red-50 text-red-700 border-red-200';
      case 'draft':   return 'bg-blue-50 text-blue-700 border-blue-200';
      default:        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getOpBadge = (op: string) => {
    switch (op.toUpperCase()) {
      case 'CREATE': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'UPDATE': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DELETE': return 'bg-rose-50 text-rose-700 border-rose-200';
      default:       return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '—';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const mutationCount = (row: WorkflowRun): number => {
    if (!row.mutations_applied) return 0;
    if (Array.isArray(row.mutations_applied)) return row.mutations_applied.length;
    if (typeof row.mutations_applied === 'object') return Object.keys(row.mutations_applied).length;
    return 0;
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-4 border-black bg-white">
        <div className="max-w-7xl mx-auto px-8 pt-6 pb-0">
          <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm text-gray-500 mb-4">
            <Link to="/dashboard" className="hover:text-gray-700 hover:underline">Dashboard</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to="/admin/workflow-definitions" className="hover:text-gray-700 hover:underline">Workflow Designer</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-900 font-medium">Run History</span>
          </nav>
        </div>
        <div className="max-w-7xl mx-auto px-8 pb-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Workflow className="h-8 w-8 text-black" />
              <div>
                <h1 className="text-5xl font-bold tracking-tight text-black">Workflow Monitor</h1>
                <p className="text-lg text-gray-500 font-light mt-1">
                  Real-time automation run history — refreshing every 5 seconds
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="default"
              onClick={() => refetch()}
              disabled={isLoading}
              className="border-2 border-black hover:bg-black hover:text-white transition-colors rounded-none"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        {/* Stats */}
        <section className="mb-10">
          <div className="grid grid-cols-5 gap-0 border border-black">
            {[
              { label: 'Total Runs', value: workflows?.length ?? 0, color: 'text-black' },
              { label: 'In Progress', value: (workflows ?? []).filter((w) => w.status === 'draft').length, color: 'text-blue-700' },
              { label: 'Succeeded', value: (workflows ?? []).filter((w) => w.status === 'success').length, color: 'text-emerald-700' },
              { label: 'Failed', value: (workflows ?? []).filter((w) => w.status === 'error').length, color: 'text-red-700' },
              { label: 'Avg Duration', value: formatDuration(avgDuration), color: 'text-black' },
            ].map((stat, i) => (
              <div key={stat.label} className={`p-6 bg-gray-50 ${i < 4 ? 'border-r border-black' : ''}`}>
                <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">{stat.label}</p>
                <p className={`text-4xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Filters */}
        <section className="mb-6 flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by entity, workflow name, or record ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-2 border-black rounded-none focus:ring-0 focus:border-black"
            />
          </div>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-4 py-2 border-2 border-black rounded-none focus:ring-0 focus:border-black bg-white text-sm"
          >
            <option value="">All Entities</option>
            {entityNames.map((entity) => (
              <option key={entity} value={entity}>{formatEntity(entity)}</option>
            ))}
          </select>
          <select
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value)}
            className="px-4 py-2 border-2 border-black rounded-none focus:ring-0 focus:border-black bg-white text-sm"
          >
            <option value="">All Operations</option>
            {operations.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border-2 border-black rounded-none focus:ring-0 focus:border-black bg-white text-sm"
          >
            <option value="">All Status</option>
            <option value="draft">In Progress</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
        </section>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-400 border-2 border-black animate-pulse">
            Loading workflow runs…
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="text-center py-16 border-2 border-black">
            <Zap className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">
              {searchQuery || statusFilter || entityFilter || operationFilter
                ? 'No runs match your filters.'
                : 'No runs yet. Automations will appear here after records are created or updated.'}
            </p>
          </div>
        ) : (
          <div className="border-2 border-black">
            {/* Header */}
            <div className="grid grid-cols-12 px-6 py-3 bg-black text-white text-xs uppercase tracking-widest font-semibold">
              <div className="col-span-1" />
              <div className="col-span-2">Entity</div>
              <div className="col-span-3">Workflow</div>
              <div className="col-span-1">Op</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1">Duration</div>
              <div className="col-span-2">Started</div>
            </div>

            {filteredWorkflows.map((wf) => {
              const isExpanded = expandedId === wf.id;
              const mutations = mutationCount(wf);
              return (
                <div key={wf.id} className="border-t border-gray-200">
                  {/* Row */}
                  <div
                    className="grid grid-cols-12 px-6 py-4 hover:bg-gray-50 items-center cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : wf.id)}
                  >
                    <div className="col-span-1">
                      <ChevronDown
                        className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>

                    <div className="col-span-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatEntity(wf.entity_name)}
                      </span>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">
                        {wf.entity_id.slice(0, 8)}…
                      </div>
                    </div>

                    <div className="col-span-3">
                      {wf.workflow_name ? (
                        <div className="flex items-center gap-1.5">
                          <GitBranch className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="text-sm text-gray-800 truncate">{wf.workflow_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">unnamed run</span>
                      )}
                      {mutations > 0 && (
                        <div className="text-xs text-gray-500 mt-0.5 ml-5">
                          {mutations} mutation{mutations !== 1 ? 's' : ''} applied
                        </div>
                      )}
                    </div>

                    <div className="col-span-1">
                      <span className={`inline-flex text-xs px-2 py-0.5 border font-medium ${getOpBadge(wf.operation)}`}>
                        {wf.operation.toUpperCase()}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 border ${getStatusBadge(wf.status)}`}>
                        {getStatusIcon(wf.status)}
                        {wf.status === 'draft' ? 'Running' : wf.status}
                      </span>
                    </div>

                    <div className="col-span-1">
                      <span className="text-sm font-mono font-medium">
                        {formatDuration(wf.duration_ms)}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <div className="text-sm text-gray-700">
                        {new Date(wf.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(wf.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-8 py-5 grid grid-cols-2 gap-6 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-gray-400 mb-2 font-semibold">Run ID</p>
                        <code className="text-xs text-gray-600 font-mono break-all">{wf.id}</code>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-gray-400 mb-2 font-semibold">Record ID</p>
                        <code className="text-xs text-gray-600 font-mono break-all">{wf.entity_id}</code>
                      </div>
                      {wf.completed_at && (
                        <div>
                          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2 font-semibold">Completed</p>
                          <span className="text-gray-700">{new Date(wf.completed_at).toLocaleString()}</span>
                        </div>
                      )}
                      {wf.mutations_applied && mutations > 0 && (
                        <div className="col-span-2">
                          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2 font-semibold">Mutations Applied</p>
                          <pre className="text-xs bg-white border border-gray-200 p-3 rounded overflow-auto max-h-40 text-gray-700">
                            {JSON.stringify(wf.mutations_applied, null, 2)}
                          </pre>
                        </div>
                      )}
                      {wf.error_details && (
                        <div className="col-span-2">
                          <p className="text-xs uppercase tracking-widest text-red-400 mb-2 font-semibold">Error Details</p>
                          <pre className="text-xs bg-red-50 border border-red-200 p-3 rounded overflow-auto max-h-40 text-red-700">
                            {wf.error_details}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t-2 border-black mt-16">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <p className="text-sm text-gray-400">
            {APP_NAME} · Workflow Monitor · Auto-refreshing every 5 seconds
          </p>
        </div>
      </footer>
    </div>
  );
}
