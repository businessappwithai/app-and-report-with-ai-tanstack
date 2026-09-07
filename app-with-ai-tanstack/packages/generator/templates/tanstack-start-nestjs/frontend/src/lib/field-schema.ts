import { z, type ZodTypeAny } from 'zod';
import type { FieldMetadata } from '@/hooks/use-entities';

const REFERENCE_TYPE = {
  STRING: 10,
  INTEGER: 11,
  AMOUNT: 12,
  ID: 13,
  TEXT: 14,
  DATE: 15,
  DATETIME: 16,
  LIST: 17,
  TABLE: 18,
  TABLE_DIRECT: 19,
  YES_NO: 20,
  URL: 24,
  EMAIL: 30,
  PHONE: 31,
  PASSWORD: 29,
} as const;

function buildFieldValidator(field: FieldMetadata, mode: 'create' | 'edit'): ZodTypeAny {
  const label = field.name;
  let schema: ZodTypeAny;

  switch (field.sys_reference_id) {
    case REFERENCE_TYPE.YES_NO:
      schema = z.boolean().or(z.literal('')).or(z.null());
      break;

    case REFERENCE_TYPE.INTEGER:
      schema = z.coerce.number({ invalid_type_error: `${label} must be a number` })
        .int({ message: `${label} must be a whole number` })
        .or(z.literal(''))
        .or(z.null());
      break;

    case REFERENCE_TYPE.AMOUNT:
      schema = z.coerce.number({ invalid_type_error: `${label} must be a number` })
        .or(z.literal(''))
        .or(z.null());
      break;

    case REFERENCE_TYPE.EMAIL: {
      let s = z.string().email({ message: `${label} must be a valid email` });
      if (field.field_length) s = s.max(field.field_length, { message: `${label} max ${field.field_length} chars` });
      schema = s.or(z.literal(''));
      break;
    }

    case REFERENCE_TYPE.URL: {
      let s = z.string().url({ message: `${label} must be a valid URL` });
      if (field.field_length) s = s.max(field.field_length, { message: `${label} max ${field.field_length} chars` });
      schema = s.or(z.literal(''));
      break;
    }

    case REFERENCE_TYPE.PHONE: {
      let s = z.string().regex(/^[+\d\s\-().]*$/, { message: `${label} must be a valid phone number` });
      if (field.field_length) s = s.max(field.field_length, { message: `${label} max ${field.field_length} chars` });
      schema = s.or(z.literal(''));
      break;
    }

    case REFERENCE_TYPE.DATE:
    case REFERENCE_TYPE.DATETIME:
      schema = z.string().or(z.literal('')).or(z.null());
      break;

    case REFERENCE_TYPE.PASSWORD: {
      let s = z.string().min(6, { message: `${label} must be at least 6 characters` });
      if (field.field_length) s = s.max(field.field_length, { message: `${label} max ${field.field_length} chars` });
      schema = s.or(z.literal(''));
      break;
    }

    default: {
      let s = z.string();
      if (field.field_length) s = s.max(field.field_length, { message: `${label} max ${field.field_length} chars` });
      schema = s.or(z.literal('')).or(z.null()).or(z.number());
      break;
    }
  }

  if (field.is_mandatory && !(field.is_read_only && mode === 'edit')) {
    schema = schema.refine(
      (val) => val !== undefined && val !== null && val !== '',
      { message: `${label} is required` }
    );
  } else {
    schema = schema.optional();
  }

  return schema;
}

export function buildFormSchema(
  fields: FieldMetadata[],
  mode: 'create' | 'edit' = 'create'
): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};

  for (const field of fields) {
    if (!field.is_displayed) continue;
    shape[field.column_name] = buildFieldValidator(field, mode);
  }

  return z.object(shape).passthrough();
}

export function validateFormData(
  fields: FieldMetadata[],
  data: Record<string, unknown>,
  mode: 'create' | 'edit' = 'create'
): { success: boolean; errors: Record<string, string> } {
  const schema = buildFormSchema(fields, mode);
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, errors: {} };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path[0];
    if (path && typeof path === 'string') {
      errors[path] = issue.message;
    }
  }
  return { success: false, errors };
}

export function getFieldTypeLabel(sysReferenceId: number): string {
  switch (sysReferenceId) {
    case REFERENCE_TYPE.STRING: return 'Text';
    case REFERENCE_TYPE.INTEGER: return 'Integer';
    case REFERENCE_TYPE.AMOUNT: return 'Amount';
    case REFERENCE_TYPE.ID: return 'ID';
    case REFERENCE_TYPE.TEXT: return 'Long Text';
    case REFERENCE_TYPE.DATE: return 'Date';
    case REFERENCE_TYPE.DATETIME: return 'Date/Time';
    case REFERENCE_TYPE.LIST: return 'List';
    case REFERENCE_TYPE.TABLE: return 'Lookup';
    case REFERENCE_TYPE.TABLE_DIRECT: return 'Direct Lookup';
    case REFERENCE_TYPE.YES_NO: return 'Yes/No';
    case REFERENCE_TYPE.URL: return 'URL';
    case REFERENCE_TYPE.EMAIL: return 'Email';
    case REFERENCE_TYPE.PHONE: return 'Phone';
    case REFERENCE_TYPE.PASSWORD: return 'Password';
    default: return sysReferenceId >= 1000 ? 'Dropdown' : 'Text';
  }
}

export function getFieldTypeColor(sysReferenceId: number): string {
  switch (sysReferenceId) {
    case REFERENCE_TYPE.STRING: return 'bg-blue-100 text-blue-700';
    case REFERENCE_TYPE.INTEGER: return 'bg-violet-100 text-violet-700';
    case REFERENCE_TYPE.AMOUNT: return 'bg-emerald-100 text-emerald-700';
    case REFERENCE_TYPE.TEXT: return 'bg-sky-100 text-sky-700';
    case REFERENCE_TYPE.DATE: return 'bg-amber-100 text-amber-700';
    case REFERENCE_TYPE.DATETIME: return 'bg-orange-100 text-orange-700';
    case REFERENCE_TYPE.YES_NO: return 'bg-teal-100 text-teal-700';
    case REFERENCE_TYPE.URL: return 'bg-indigo-100 text-indigo-700';
    case REFERENCE_TYPE.EMAIL: return 'bg-pink-100 text-pink-700';
    case REFERENCE_TYPE.PHONE: return 'bg-cyan-100 text-cyan-700';
    case REFERENCE_TYPE.PASSWORD: return 'bg-red-100 text-red-700';
    case REFERENCE_TYPE.TABLE:
    case REFERENCE_TYPE.TABLE_DIRECT: return 'bg-purple-100 text-purple-700';
    default: return sysReferenceId >= 1000 ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-gray-100 text-gray-700';
  }
}
