import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ColumnDefinition, FormatterType } from "@/types/database";

interface SortableColumnRowProps {
  column: ColumnDefinition;
  availableFields: string[];
  onUpdate: (id: string, updates: Partial<ColumnDefinition>) => void;
  onDelete: (id: string) => void;
}

export function SortableColumnRow({
  column,
  availableFields,
  onUpdate,
  onDelete,
}: SortableColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <button {...attributes} {...listeners} className="cursor-grab">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <Input
          value={column.header}
          onChange={(e) => onUpdate(column.id, { header: e.target.value })}
          className="h-8 rounded-none w-64"
        />
      </TableCell>
      <TableCell>
        <Select value={column.field} onValueChange={(field) => onUpdate(column.id, { field })}>
          <SelectTrigger className="h-8 w-40 rounded-none">
            <SelectValue placeholder="Select field" />
          </SelectTrigger>
          <SelectContent>
            {availableFields.map((field) => (
              <SelectItem key={field} value={field}>
                {field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={column.width || ""}
          onChange={(e) =>
            onUpdate(column.id, { width: e.target.value ? Number(e.target.value) : undefined })
          }
          className="h-8 w-20 rounded-none"
          placeholder="Auto"
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={column.visible}
          onCheckedChange={(visible) => onUpdate(column.id, { visible })}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={column.sortable}
          onCheckedChange={(sortable) => onUpdate(column.id, { sortable })}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={column.filterable}
          onCheckedChange={(filterable) => onUpdate(column.id, { filterable })}
        />
      </TableCell>
      <TableCell>
        <Select
          value={column.formatter?.type || "text"}
          onValueChange={(type) =>
            onUpdate(column.id, { formatter: { type: type as FormatterType, options: {} } })
          }
        >
          <SelectTrigger className="h-8 w-24 rounded-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="currency">Currency</SelectItem>
            <SelectItem value="percentage">Percent</SelectItem>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="datetime">DateTime</SelectItem>
            <SelectItem value="boolean">Boolean</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(column.id)}
          className="h-8 w-8 text-destructive"
        >
          <Trash className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
