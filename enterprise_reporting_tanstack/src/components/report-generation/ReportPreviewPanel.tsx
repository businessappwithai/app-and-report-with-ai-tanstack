import {
  ChevronDown,
  ChevronUp,
  Code2,
  Table2,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportIntent } from "@/lib/report-generation/types";

interface Props {
  rows: Record<string, unknown>[];
  columns: string[];
  sql: string;
  intent?: ReportIntent;
}

export function ReportPreviewPanel({ rows, columns, sql, intent }: Props) {
  const [sqlExpanded, setSqlExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* Intent Summary */}
      {intent && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Report Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-tremor-content">Chart Type</span>
              <p className="font-medium capitalize">{intent.chartType}</p>
            </div>
            <div>
              <span className="text-tremor-content">Metrics</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(intent.metrics ?? []).map((m) => (
                  <Badge key={m} variant="outline" className="text-xs font-mono">{m}</Badge>
                ))}
              </div>
            </div>
            <div>
              <span className="text-tremor-content">Dimensions</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(intent.dimensions ?? []).map((d) => (
                  <Badge key={d} variant="outline" className="text-xs font-mono">{d}</Badge>
                ))}
              </div>
            </div>
            <div>
              <span className="text-tremor-content">Formats</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(intent.outputFormats ?? []).map((f) => (
                  <Badge key={f} variant="secondary" className="text-xs uppercase">{f}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SQL Display */}
      <Card>
        <CardHeader className="pb-2">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setSqlExpanded((e) => !e)}
          >
            <CardTitle className="text-base flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              Generated SQL
            </CardTitle>
            {sqlExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CardHeader>
        {sqlExpanded && (
          <CardContent>
            <pre className="bg-muted rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-48">
              {sql}
            </pre>
          </CardContent>
        )}
      </Card>

      {/* Data Preview Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Table2 className="h-4 w-4" />
            Data Preview
            <Badge variant="outline" className="ml-2 text-xs">
              {rows.length} sample rows
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col} className="whitespace-nowrap font-mono text-xs">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                      No data returned
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, i) => (
                    <TableRow key={i}>
                      {columns.map((col) => (
                        <TableCell key={col} className="text-sm whitespace-nowrap">
                          {row[col] != null ? String(row[col]) : "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            This is a preview of the first {rows.length} rows. The full report will include all matching data.
            Confirm in the chat to generate Excel, PDF, and CSV artifacts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
