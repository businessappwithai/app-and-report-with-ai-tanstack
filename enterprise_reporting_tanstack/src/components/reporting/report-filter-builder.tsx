import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than"
  | "between"
  | "is_null"
  | "is_not_null"
  | "in"
  | "not_in"
  | "before"
  | "after"
  | "is_true"
  | "is_false";

type FilterLogic = "AND" | "OR";

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value?: string | number | boolean | (string | number)[];
  value2?: string | number;
}

export interface FilterGroup {
  id: string;
  logic: FilterLogic;
  conditions: FilterCondition[];
  groups?: FilterGroup[];
}

const OPERATORS_BY_TYPE: Record<
  string,
  { value: FilterOperator; label: string; needsValue?: boolean; needsTwoValues?: boolean }[]
> = {
  text: [
    { value: "equals", label: "Equals", needsValue: true },
    { value: "not_equals", label: "Not Equals", needsValue: true },
    { value: "contains", label: "Contains", needsValue: true },
    { value: "not_contains", label: "Does Not Contain", needsValue: true },
    { value: "starts_with", label: "Starts With", needsValue: true },
    { value: "ends_with", label: "Ends With", needsValue: true },
    { value: "is_null", label: "Is Empty" },
    { value: "is_not_null", label: "Is Not Empty" },
    { value: "in", label: "In (comma separated)", needsValue: true },
    { value: "not_in", label: "Not In (comma separated)", needsValue: true },
  ],
  number: [
    { value: "equals", label: "Equals", needsValue: true },
    { value: "not_equals", label: "Not Equals", needsValue: true },
    { value: "greater_than", label: "Greater Than", needsValue: true },
    { value: "less_than", label: "Less Than", needsValue: true },
    { value: "between", label: "Between", needsValue: true, needsTwoValues: true },
    { value: "is_null", label: "Is Null" },
    { value: "is_not_null", label: "Is Not Null" },
  ],
  date: [
    { value: "equals", label: "Equals", needsValue: true },
    { value: "before", label: "Before", needsValue: true },
    { value: "after", label: "After", needsValue: true },
    { value: "between", label: "Between", needsValue: true, needsTwoValues: true },
    { value: "is_null", label: "Is Null" },
    { value: "is_not_null", label: "Is Not Null" },
  ],
  boolean: [
    { value: "is_true", label: "Is True" },
    { value: "is_false", label: "Is False" },
  ],
};

interface ReportFilterBuilderProps {
  filters: FilterGroup;
  availableFields: string[];
  onChange: (filters: FilterGroup) => void;
}

export function ReportFilterBuilder({
  filters,
  availableFields,
  onChange,
}: ReportFilterBuilderProps) {
  const addCondition = (groupId: string) => {
    const newCondition: FilterCondition = {
      id: `condition-${Date.now()}`,
      field: availableFields[0] || "",
      operator: "equals",
      value: "",
    };
    const updateGroup = (group: FilterGroup): FilterGroup => {
      if (group.id === groupId)
        return { ...group, conditions: [...group.conditions, newCondition] };
      if (group.groups) return { ...group, groups: group.groups.map(updateGroup) };
      return group;
    };
    onChange(updateGroup(filters));
  };

  const updateCondition = (
    groupId: string,
    conditionId: string,
    updates: Partial<FilterCondition>
  ) => {
    const updateGroup = (group: FilterGroup): FilterGroup => {
      if (group.id === groupId) {
        return {
          ...group,
          conditions: group.conditions.map((c) =>
            c.id === conditionId ? { ...c, ...updates } : c
          ),
        };
      }
      if (group.groups) return { ...group, groups: group.groups.map(updateGroup) };
      return group;
    };
    onChange(updateGroup(filters));
  };

  const removeCondition = (groupId: string, conditionId: string) => {
    const updateGroup = (group: FilterGroup): FilterGroup => {
      if (group.id === groupId)
        return { ...group, conditions: group.conditions.filter((c) => c.id !== conditionId) };
      if (group.groups) return { ...group, groups: group.groups.map(updateGroup) };
      return group;
    };
    onChange(updateGroup(filters));
  };

  const renderCondition = (groupId: string, condition: FilterCondition) => {
    const operators = OPERATORS_BY_TYPE.text;
    const selectedOperator = operators.find((op) => op.value === condition.operator);
    return (
      <div key={condition.id} className="flex items-center gap-2 p-2 bg-muted rounded-md">
        <Select
          value={condition.field}
          onValueChange={(value) =>
            updateCondition(groupId, condition.id, { field: value, operator: "equals", value: "" })
          }
        >
          <SelectTrigger className="h-8 w-40 rounded-none">
            <SelectValue placeholder="Field" />
          </SelectTrigger>
          <SelectContent>
            {availableFields.map((field) => (
              <SelectItem key={field} value={field}>
                {field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={condition.operator}
          onValueChange={(value) =>
            updateCondition(groupId, condition.id, { operator: value as FilterOperator })
          }
        >
          <SelectTrigger className="h-8 w-36">
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedOperator?.needsValue && !selectedOperator?.needsTwoValues && (
          <Input
            type="text"
            value={(condition.value as string) || ""}
            onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
            className="h-8 flex-1"
            placeholder="Value"
          />
        )}

        {selectedOperator?.needsTwoValues && (
          <div className="flex items-center gap-2 flex-1">
            <Input
              type="text"
              value={(condition.value as string) || ""}
              onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
              className="h-8 flex-1"
              placeholder="From"
            />
            <span className="text-tremor-content">to</span>
            <Input
              type="text"
              value={(condition.value2 as string) || ""}
              onChange={(e) => updateCondition(groupId, condition.id, { value2: e.target.value })}
              className="h-8 flex-1"
              placeholder="To"
            />
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => removeCondition(groupId, condition.id)}
          className="h-8 w-8 text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const renderGroup = (group: FilterGroup, level: number = 0) => (
    <div
      key={group.id}
      className="border rounded-lg p-4 space-y-3"
      style={{ marginLeft: `${level * 20}px` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filter Group</span>
          <Select
            value={group.logic}
            onValueChange={(value) => {
              const updateGroupLogic = (g: FilterGroup): FilterGroup => {
                if (g.id === group.id) return { ...g, logic: value as FilterLogic };
                if (g.groups) return { ...g, groups: g.groups.map(updateGroupLogic) };
                return g;
              };
              onChange(updateGroupLogic(filters));
            }}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">AND</SelectItem>
              <SelectItem value="OR">OR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        {group.conditions.map((condition) => renderCondition(group.id, condition))}
      </div>
      <Button variant="outline" size="sm" onClick={() => addCondition(group.id)} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Condition
      </Button>
    </div>
  );

  return <div className="space-y-4">{renderGroup(filters)}</div>;
}
