import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  operator: string;
  value: number;
  upperBound?: number;
  onChange: (op: string, val: number, upper?: number) => void;
}

const OPERATORS: Array<{ value: string; label: string }> = [
  { value: "gt", label: "greater than" },
  { value: "gte", label: "greater than or equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "less than or equal" },
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "between", label: "between" },
];

function buildPreviewText(operator: string, value: number, upperBound?: number): string {
  const fmt = (n: number) => n.toLocaleString();
  switch (operator) {
    case "gt":
      return `Alert when metric is greater than ${fmt(value)}`;
    case "gte":
      return `Alert when metric is greater than or equal to ${fmt(value)}`;
    case "lt":
      return `Alert when metric is less than ${fmt(value)}`;
    case "lte":
      return `Alert when metric is less than or equal to ${fmt(value)}`;
    case "eq":
      return `Alert when metric equals ${fmt(value)}`;
    case "neq":
      return `Alert when metric does not equal ${fmt(value)}`;
    case "between":
      return `Alert when metric is between ${fmt(value)} and ${fmt(upperBound ?? 0)}`;
    default:
      return `Alert when metric ${operator} ${fmt(value)}`;
  }
}

export function ThresholdConfigurator({ operator, value, upperBound, onChange }: Props) {
  const isBetween = operator === "between";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="threshold-operator">Condition</Label>
          <Select value={operator} onValueChange={(op) => onChange(op, value, upperBound)}>
            <SelectTrigger id="threshold-operator">
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 space-y-1.5">
          <Label htmlFor="threshold-value">{isBetween ? "Lower Bound" : "Value"}</Label>
          <Input
            id="threshold-value"
            type="number"
            value={value}
            onChange={(e) => onChange(operator, parseFloat(e.target.value) || 0, upperBound)}
            placeholder="Enter value"
          />
        </div>

        {isBetween && (
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="threshold-upper">Upper Bound</Label>
            <Input
              id="threshold-upper"
              type="number"
              value={upperBound ?? ""}
              onChange={(e) => onChange(operator, value, parseFloat(e.target.value) || undefined)}
              placeholder="Enter upper value"
            />
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
        {buildPreviewText(operator, value, upperBound)}
      </p>
    </div>
  );
}
