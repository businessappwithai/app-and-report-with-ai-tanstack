import { z } from "zod";

export const entityAttributeSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "integer", "decimal", "boolean", "date", "datetime", "text", "json"]),
  required: z.boolean(),
  unique: z.boolean().optional(),
  default: z.any().optional(),
  maxLength: z.number().optional(),
  minLength: z.number().optional(),
  pattern: z.string().optional(),
});

export const entitySchema = z.object({
  name: z.string(),
  tableName: z.string(),
  description: z.string().optional(),
  attributes: z.array(entityAttributeSchema),
  primaryKey: z.string(),
  timestamps: z.boolean(),
});

export const relationshipSchema = z.object({
  name: z.string(),
  sourceEntity: z.string(),
  targetEntity: z.string(),
  cardinality: z.enum(["oneToOne", "oneToMany", "manyToOne", "manyToMany"]),
  foreignKey: z.string().optional(),
  inverseForeignKey: z.string().optional(),
  onDelete: z.enum(["CASCADE", "SET NULL", "RESTRICT"]).optional(),
  onUpdate: z.enum(["CASCADE", "SET NULL", "RESTRICT"]).optional(),
});
