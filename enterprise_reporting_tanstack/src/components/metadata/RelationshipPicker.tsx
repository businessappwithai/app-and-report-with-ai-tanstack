/**
 * Relationship Picker Component
 *
 * Handles foreign key relationship selection with two modes:
 * - dropdown: Select from a dropdown list of display values
 * - popup: Searchable dialog with server-side paginated table
 */

"use client";

import { ExternalLink, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { useEntityRecords } from "@/hooks/metadata/use-metadata-queries";
import type { MetadataEntityField, MetadataEntityWithFields } from "@/types/database";

interface RelationshipPickerProps {
  dataSourceId: string;
  entity: MetadataEntityWithFields;
  field: MetadataEntityField;
  value: string | number | null;
  onChange: (value: string | number | null) => void;
}

export function RelationshipPicker({
  dataSourceId,
  entity: _entity,
  field,
  value,
  onChange,
}: RelationshipPickerProps) {
  const uiType = field.relationship_ui_type || "dropdown";
  const referencedEntityName = field.referenced_table_name;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch referenced entity records for dropdown (limited)
  const { data: dropdownData, isLoading: isLoadingDropdown } = useEntityRecords(
    dataSourceId,
    referencedEntityName,
    uiType === "dropdown" ? { page: 1, limit: 100 } : { page: 1, limit: 0 }
  );

  // Fetch referenced entity records for popup (paginated search)
  const { data: popupData, isLoading: isLoadingPopup } = useEntityRecords(
    dataSourceId,
    referencedEntityName,
    uiType === "popup" && popupOpen
      ? {
          page: searchPage,
          limit: 20,
          search: searchTerm || undefined,
        }
      : { page: 1, limit: 0 }
  );

  const records = (uiType === "dropdown" ? dropdownData : popupData)?.data?.records || [];
  const total = (uiType === "dropdown" ? dropdownData : popupData)?.data?.total || 0;
  const pageCount = (uiType === "dropdown" ? dropdownData : popupData)?.data?.pageCount || 0;

  // Get display fields for the referenced entity
  // For now, we'll use the first field or the field that matches the referenced column name
  const getDisplayValue = (record: Record<string, unknown>) => {
    // Try to find a display field
    const displayFields = Object.keys(record).filter((k) => k !== "id");
    if (displayFields.length > 0) {
      const val = record[displayFields[0]];
      return val !== null && val !== undefined ? String(val) : "(null)";
    }
    return String(record.id || "");
  };

  const getPrimaryKeyValue = (record: Record<string, unknown>) => {
    return record.id as string | number;
  };

  if (uiType === "dropdown") {
    return (
      <Select
        value={value?.toString() || ""}
        onValueChange={(val) => onChange(val === "" ? null : val)}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
      >
        <SelectTrigger>
          <SelectValue placeholder={`Select ${field.referenced_table_name}...`} />
        </SelectTrigger>
        <SelectContent>
          {isLoadingDropdown ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">No records found</div>
          ) : (
            records.map((record, idx) => {
              const pkValue = getPrimaryKeyValue(record as Record<string, unknown>);
              const displayValue = getDisplayValue(record as Record<string, unknown>);
              return (
                <SelectItem key={pkValue || idx} value={String(pkValue)}>
                  {displayValue}
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>
    );
  }

  // Popup mode
  return (
    <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start" type="button">
          {value ? `Selected ID: ${value}` : `Select ${field.referenced_table_name}...`}
          <ExternalLink className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select {field.referenced_table_name}</DialogTitle>
          <DialogDescription>
            Search and select a record from the {field.referenced_table_name} table.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSearchPage(1);
              }}
              className="pl-8"
            />
          </div>

          {/* Records Table */}
          <div className="flex-1 overflow-auto rounded-md border">
            {isLoadingPopup ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : records.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-center">
                <p className="text-tremor-content">No records found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {records.length > 0 &&
                      Object.keys(records[0] as Record<string, unknown>)
                        .slice(0, 4) // Show first 4 columns only
                        .map((key) => (
                          <TableHead key={key} className="capitalize">
                            {key}
                          </TableHead>
                        ))}
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record, idx) => {
                    const pkValue = getPrimaryKeyValue(record as Record<string, unknown>);
                    const isSelected = value === pkValue;

                    return (
                      <TableRow key={pkValue || idx}>
                        {Object.entries(record as Record<string, unknown>)
                          .slice(0, 4)
                          .map(([key, val]) => (
                            <TableCell key={key}>
                              {val !== null && val !== undefined
                                ? String(val).substring(0, 50)
                                : "<null>"}
                            </TableCell>
                          ))}
                        <TableCell>
                          <Button
                            size="sm"
                            variant={isSelected ? "default" : "outline"}
                            onClick={() => {
                              onChange(pkValue);
                              setPopupOpen(false);
                            }}
                          >
                            {isSelected ? "Selected" : "Select"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-tremor-default text-tremor-content">
                {total} {total === 1 ? "record" : "records"} found
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
                  disabled={searchPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {searchPage} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchPage((p) => Math.min(pageCount, p + 1))}
                  disabled={searchPage >= pageCount}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
