import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DatasetManager } from "@/components/datasets/DatasetManager";
import { useDuckDB } from "@/components/duckdb/DuckDBProvider";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/hooks/useDataset";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { DatasetInfo } from "@/types/datasets";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/_authed/datasets/")({
  component: DatasetsPage,
});

interface ServerDataset {
  id: string;
  name: string;
  dataSourceId: string;
  rowCount: number;
  fileSize: number;
  columns: { name: string; type: string; nullable: boolean }[];
  status: string;
}

function DatasetsPage() {
  const wasmEnabled = isFeatureEnabled("wasmEnabled");
  const { status: duckdbStatus } = useDuckDB();
  const { datasets, loadDataset, unloadDataset } = useDataset();
  const [serverDatasets, setServerDatasets] = useState<ServerDataset[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);

  useEffect(() => {
    async function fetchDatasets() {
      try {
        const res = await fetch("/api/datasets?pageSize=100");
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load datasets`);
        const json = await res.json();
        if (json.success) {
          setServerDatasets(json.data.datasets);
        }
      } catch (err) {
        console.error("Failed to fetch datasets:", err);
      } finally {
        setIsLoadingList(false);
      }
    }
    fetchDatasets();
  }, []);

  const merged: DatasetInfo[] = serverDatasets.map((sd) => {
    const local = datasets.find((d) => d.id === sd.id);
    if (local) return local;
    return {
      id: sd.id,
      name: sd.name,
      dataSourceId: sd.dataSourceId,
      tableName: `ds_${sd.id}`,
      rowCount: sd.rowCount,
      fileSize: sd.fileSize,
      memorySize: 0,
      schema: sd.columns,
      cacheStatus: "not-cached" as const,
      isLoading: false,
    };
  });

  const handleLoad = async (id: string) => {
    const sd = serverDatasets.find((d) => d.id === id);
    if (!sd) return;
    await loadDataset({
      id: sd.id,
      name: sd.name,
      dataSourceId: sd.dataSourceId,
      url: `/api/datasets/${sd.id}/parquet`,
    });
  };

  const handleUnload = async (id: string) => {
    await unloadDataset(id);
  };

  if (!wasmEnabled) {
    return (
      <div className="p-6">
        <h1 className="font-semibold text-2xl text-tremor-content-strong">Datasets</h1>
        <p className="mt-2 text-tremor-default text-tremor-content">
          WASM mode is not enabled. Enable VITE_WASM_ENABLED to use client-side datasets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Datasets" description="Manage datasets loaded in DuckDB-Wasm for client-side analytics." />
        <div className="flex items-center gap-2">
          <span className="text-tremor-default text-tremor-content">DuckDB: {duckdbStatus}</span>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh List
          </Button>
        </div>
      </div>

      {isLoadingList ? (
        <div className="text-tremor-default text-tremor-content">Loading datasets…</div>
      ) : (
        <DatasetManager datasets={merged} onLoad={handleLoad} onUnload={handleUnload} />
      )}
    </div>
  );
}
