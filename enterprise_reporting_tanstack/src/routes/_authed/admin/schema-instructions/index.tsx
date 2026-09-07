import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SchemaInstructionsBrowser } from "@/components/admin/schema-instructions/schema-browser";
import { FieldInstructionEditor } from "@/components/admin/schema-instructions/field-instruction-editor";
import { TableInstructionEditor } from "@/components/admin/schema-instructions/table-instruction-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/_authed/admin/schema-instructions/")({
  component: SchemaInstructionsPage,
});

function SchemaInstructionsPage() {
  const [selectedDataSource, setSelectedDataSource] = useState<string | undefined>();
  const [selectedTable, setSelectedTable] = useState<string | undefined>();
  const [selectedField, setSelectedField] = useState<string | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Schema Instructions Management"
        description="Add field and table level instructions to enhance natural language to SQL translation accuracy"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schema Browser */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Database Schema</CardTitle>
          </CardHeader>
          <CardContent>
            <SchemaInstructionsBrowser
              key={refreshKey}
              onSelectDataSource={setSelectedDataSource}
              onSelectTable={setSelectedTable}
              onSelectField={setSelectedField}
            />
          </CardContent>
        </Card>

        {/* Editor Tabs */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Instructions Editor</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="table" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="table">Table Instructions</TabsTrigger>
                <TabsTrigger value="field">Field Instructions</TabsTrigger>
              </TabsList>

              <TabsContent value="table" className="mt-6">
                <TableInstructionEditor
                  dataSourceId={selectedDataSource}
                  tableName={selectedTable}
                  onSaved={handleRefresh}
                />
              </TabsContent>

              <TabsContent value="field" className="mt-6">
                <FieldInstructionEditor
                  dataSourceId={selectedDataSource}
                  tableName={selectedTable}
                  fieldName={selectedField}
                  onSaved={handleRefresh}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
