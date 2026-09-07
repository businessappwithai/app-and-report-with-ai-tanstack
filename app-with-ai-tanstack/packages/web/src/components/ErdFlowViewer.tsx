import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import { Loader2 } from "lucide-react";

interface ErdFlowViewerProps {
  erdCode: string;
}

// Parse Mermaid erDiagram syntax to nodes and edges
function parseMermaidToGraph(code: string): {
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: { name: string; attrs: string[] };
  }>;
  edges: Array<{ id: string; source: string; target: string; label: string }>;
} {
  const lines = code.split("\n");

  let currentEntity: { name: string; attrs: string[] } | null = null;
  const entityMap = new Map<string, { attrs: string[] }>();
  const edgeList: Array<{ source: string; target: string; label: string }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "erDiagram" || trimmed.startsWith("%%")) continue;

    // Entity block start
    const entityMatch = trimmed.match(/^(\w+)\s*\{/);
    if (entityMatch?.[1]) {
      currentEntity = { name: entityMatch[1], attrs: [] };
      continue;
    }

    // Entity block end
    if (trimmed === "}" && currentEntity) {
      entityMap.set(currentEntity.name, { attrs: currentEntity.attrs });
      currentEntity = null;
      continue;
    }

    // Attribute inside entity
    if (currentEntity && !trimmed.startsWith("}")) {
      currentEntity.attrs.push(trimmed);
      continue;
    }

    // Relationship line: Entity1 ||--o{ Entity2 : "label"
    const relMatch = trimmed.match(/^(\w+)\s+[|}o]{2}--[|{o]{2}\s+(\w+)\s*(?::\s*"?(.+)"?)?$/);
    if (relMatch) {
      edgeList.push({
        source: relMatch[1] ?? "",
        target: relMatch[2] ?? "",
        label: relMatch[3] ?? "",
      });
    }
  }

  const nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: { name: string; attrs: string[] };
  }> = [];
  const edges: Array<{ id: string; source: string; target: string; label: string }> = [];

  // Create nodes
  let i = 0;
  for (const [name, { attrs }] of entityMap) {
    nodes.push({
      id: name,
      position: { x: i * 250, y: 0 },
      data: { name, attrs },
    });
    i++;
  }

  // Create edges (only for known entities)
  const knownNames = new Set(entityMap.keys());
  for (const { source, target, label } of edgeList) {
    if (knownNames.has(source) && knownNames.has(target)) {
      edges.push({
        id: `${source}-${target}`,
        source,
        target,
        label,
      });
    }
  }

  return { nodes, edges };
}

function EntityCard({ name, attrs }: { name: string; attrs: string[] }) {
  return (
    <div className="bg-background border border-border rounded-lg p-2 min-w-[180px]">
      <div className="font-semibold text-sm border-b border-border pb-1 mb-1 text-purple-400">
        {name}
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        {attrs.slice(0, 8).map((a, idx) => (
          <div key={idx} className="font-mono">
            {a}
          </div>
        ))}
        {attrs.length > 8 && <div className="text-slate-500">+{attrs.length - 8} more</div>}
      </div>
    </div>
  );
}

export function ErdFlowViewer({ erdCode }: ErdFlowViewerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLayouting, setIsLayouting] = useState(false);
  const layoutAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!erdCode?.trim() || erdCode.trim() === "erDiagram") {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Cancel previous layout
    if (layoutAbortRef.current) {
      layoutAbortRef.current.abort();
    }
    const abort = new AbortController();
    layoutAbortRef.current = abort;

    const { nodes: parsedNodes, edges: parsedEdges } = parseMermaidToGraph(erdCode);

    if (parsedNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    setIsLayouting(true);

    (async () => {
      try {
        const ELK = (await import("elkjs/lib/elk.bundled.js")).default;
        const elk = new ELK();

        const graph = {
          id: "root",
          layoutOptions: {
            "elk.algorithm": "layered",
            "elk.direction": "DOWN",
            "elk.spacing.nodeNode": "60",
            "elk.layered.spacing.nodeNodeBetweenLayers": "80",
          },
          children: parsedNodes.map((n) => ({
            id: n.id,
            width: 200,
            height: 120 + Math.min(n.data.attrs.length, 8) * 18,
          })),
          edges: parsedEdges.map((e) => ({
            id: e.id,
            sources: [e.source],
            targets: [e.target],
          })),
        };

        if (abort.signal.aborted) return;

        const layout = await elk.layout(graph);

        if (abort.signal.aborted) return;

        const laidOutNodes: Node[] = parsedNodes.map((n) => {
          const elkNode = layout.children?.find((c) => c.id === n.id);
          return {
            id: n.id,
            type: "default",
            position: { x: elkNode?.x ?? n.position.x, y: elkNode?.y ?? n.position.y },
            data: { label: <EntityCard name={n.data.name} attrs={n.data.attrs} /> },
            style: { width: 200 },
          };
        });

        const reactFlowEdges: Edge[] = parsedEdges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          animated: false,
        }));

        setNodes(laidOutNodes);
        setEdges(reactFlowEdges);
      } catch {
        if (!abort.signal.aborted) {
          // Fallback: use simple positions
          const fallbackNodes: Node[] = parsedNodes.map((n) => ({
            id: n.id,
            type: "default",
            position: n.position,
            data: { label: <EntityCard name={n.data.name} attrs={n.data.attrs} /> },
            style: { width: 200 },
          }));
          const fallbackEdges: Edge[] = parsedEdges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
            animated: false,
          }));
          setNodes(fallbackNodes);
          setEdges(fallbackEdges);
        }
      } finally {
        if (!abort.signal.aborted) {
          setIsLayouting(false);
        }
      }
    })();

    return () => {
      abort.abort();
      setIsLayouting(false);
    };
  }, [erdCode, setNodes, setEdges]);

  if (isLayouting) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Computing layout...</span>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No entities to display</p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      fitViewOptions={{ padding: 0.2 }}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
