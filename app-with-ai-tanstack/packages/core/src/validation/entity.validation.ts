import type { z } from "zod";
import { EntitySchema } from "../types/entity.types";

export function validateEntity(data: unknown): z.infer<typeof EntitySchema> {
  return EntitySchema.parse(data);
}

export function isValidEntity(data: unknown): boolean {
  try {
    EntitySchema.parse(data);
    return true;
  } catch {
    return false;
  }
}
