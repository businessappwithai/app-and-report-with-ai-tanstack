import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Database, FileText, Info, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BarList } from "@/components/ui/bar-list";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { Legend } from "@/components/ui/legend";
import { ProgressBar, ProgressCircle } from "@/components/ui/progress-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tracker } from "@/components/ui/tracker";
import { Metric, Subtitle, Text, Title } from "@/components/ui/typography";
import { TREMOR_CHART_COLOR_NAMES } from "@/lib/theme/tremor-colors";

export const Route = createFileRoute("/_authed/settings/design-system")({
  component: DesignSystemPage,
});

const tokenSwatches = [
  { name: "brand-faint", className: "bg-tremor-brand-faint" },
  { name: "brand-muted", className: "bg-tremor-brand-muted" },
  { name: "brand-subtle", className: "bg-tremor-brand-subtle" },
  { name: "brand", className: "bg-tremor-brand" },
  { name: "brand-emphasis", className: "bg-tremor-brand-emphasis" },
  { name: "background", className: "bg-tremor-background" },
  { name: "background-subtle", className: "bg-tremor-background-subtle" },
  { name: "background-muted", className: "bg-tremor-background-muted" },
  { name: "border", className: "bg-tremor-border" },
  { name: "content-subtle", className: "bg-tremor-content-subtle" },
  { name: "content", className: "bg-tremor-content" },
  { name: "content-strong", className: "bg-tremor-content-strong" },
];

const chartSwatches = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-gray-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-lime-500",
  "bg-fuchsia-500",
];

const topReports = [
  { name: "Monthly Revenue", value: 1284, icon: FileText },
  { name: "Customer Churn", value: 962, icon: Users },
  { name: "Inventory Levels", value: 741, icon: Database },
  { name: "Support Backlog", value: 430, icon: FileText },
];

const runHistory = Array.from({ length: 30 }, (_, index) => ({
  key: `run-${index}`,
  color:
    index === 11 ? ("red" as const) : index % 9 === 4 ? ("amber" as const) : ("emerald" as const),
  tooltip: index === 11 ? "Failed — timeout" : index % 9 === 4 ? "Degraded" : "Succeeded",
}));

function DesignSystemPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-tremor-content-strong">Design System</h1>
        <Subtitle>
          Tremor tokens and components as they render in this application. Use this page to check a
          component before building with it.
        </Subtitle>
      </div>

      {/* ── Tokens ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Colour tokens</CardTitle>
          <CardDescription>
            Semantic Tremor tokens. Every one flips automatically in dark mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {tokenSwatches.map((token) => (
              <div key={token.name} className="space-y-1.5">
                <div
                  className={`h-12 w-full rounded-tremor-small ring-1 ring-inset ring-tremor-border ${token.className}`}
                />
                <p className="truncate text-tremor-label text-tremor-content">{token.name}</p>
              </div>
            ))}
          </div>

          <Divider>Chart palette</Divider>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
            {chartSwatches.map((swatch, index) => (
              <div key={swatch} className="space-y-1.5">
                <div className={`h-12 w-full rounded-tremor-small ${swatch}`} />
                <p className="truncate text-tremor-label text-tremor-content">
                  {TREMOR_CHART_COLOR_NAMES[index]}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Type scale ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Type scale</CardTitle>
          <CardDescription>Four sizes carry the whole product.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Metric>1,284,930</Metric>
          <Title>Card and section titles</Title>
          <Text>Body copy and supporting descriptions sit at 14px on content grey.</Text>
          <p className="text-tremor-label text-tremor-content">
            Labels, axis ticks and captions sit at 12px.
          </p>
        </CardContent>
      </Card>

      {/* ── KPI cards ───────────────────────────────────────────────────────── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Reports run" value="12,480" delta="+12.3%" deltaType="increase" />
        <KpiCard
          label="Avg. query time"
          value="842 ms"
          delta="-3.1%"
          deltaType="moderateDecrease"
        />
        <KpiCard label="Failed jobs" value="14" delta="+8.0%" deltaType="decrease" />
        <KpiCard
          label="Storage used"
          value="68%"
          description="of 2 TB quota"
          progress={68}
          icon={Database}
        />
      </div>

      {/* ── Buttons and badges ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Buttons and badges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="light">Light</Button>
            <Button variant="destructive">Destructive</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Form controls ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Form controls</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ds-name">Report name</Label>
            <Input id="ds-name" placeholder="Monthly revenue" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ds-source">Data source</Label>
            <Select>
              <SelectTrigger id="ds-source">
                <SelectValue placeholder="Select a data source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres">PostgreSQL — analytics</SelectItem>
                <SelectItem value="mysql">MySQL — sakila</SelectItem>
                <SelectItem value="duckdb">DuckDB — local</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs, table ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Tabs and tables</CardTitle>
          <CardDescription>Line tabs for navigation, solid tabs for view switches.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="line-demo">
            <TabsList>
              <TabsTrigger value="line-demo">Overview</TabsTrigger>
              <TabsTrigger value="solid-demo">Segmented</TabsTrigger>
            </TabsList>
            <TabsContent value="line-demo">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Runs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-tremor-content-strong">
                      Monthly Revenue
                    </TableCell>
                    <TableCell>a.chen</TableCell>
                    <TableCell>
                      <Badge variant="success">Healthy</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">1,284</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-tremor-content-strong">
                      Customer Churn
                    </TableCell>
                    <TableCell>m.patel</TableCell>
                    <TableCell>
                      <Badge variant="warning">Degraded</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">962</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-tremor-content-strong">
                      Inventory Levels
                    </TableCell>
                    <TableCell>j.okafor</TableCell>
                    <TableCell>
                      <Badge variant="error">Failing</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">741</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="solid-demo">
              <Tabs defaultValue="day">
                <TabsList variant="solid">
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
                <TabsContent value="day">
                  <Text>Solid tabs are the Tremor segmented control.</Text>
                </TabsContent>
                <TabsContent value="week">
                  <Text>Use them for switching a view, not for navigation.</Text>
                </TabsContent>
                <TabsContent value="month">
                  <Text>The selected segment lifts onto a white surface.</Text>
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Data visualisation primitives ───────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bar list</CardTitle>
            <CardDescription>Ranked breakdown without an axis.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList data={topReports} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tracker and progress</CardTitle>
            <CardDescription>Last 30 job runs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tracker data={runHistory} />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Text>SLA attainment</Text>
                <span className="text-tremor-default font-medium text-tremor-content-strong">
                  93%
                </span>
              </div>
              <ProgressBar value={93} />
            </div>
            <div className="flex items-center gap-6">
              <ProgressCircle value={68}>68%</ProgressCircle>
              <Legend categories={["Succeeded", "Degraded", "Failed"]} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Callouts ────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Callout title="Schema drift detected" icon={Info} color="blue">
          Three columns were added to <code>public.orders</code> since the last sync.
        </Callout>
        <Callout title="Query cost exceeded" icon={AlertTriangle} color="amber">
          This query scanned 4.2 GB. Consider adding a date filter.
        </Callout>
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>Report published</AlertTitle>
          <AlertDescription>All 12 recipients were notified by email.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Connection failed</AlertTitle>
          <AlertDescription>Could not reach the warehouse — check credentials.</AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
