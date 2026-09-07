/**
 * i18n Field Label Utilities
 *
 * Generates i18n keys for field labels in the format:
 * <entity>_<tab>_<field>
 *
 * Example: patient_identification_first_name -> "First Name"
 *
 * Auto-generated file
 */

import { translate } from "./translations";

/**
 * Convert a string to snake_case for i18n keys
 */
function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Generate i18n key for a field label
 * @param tableName - Table name (e.g., "bus_patient" -> "patient")
 * @param tabName - Tab name (e.g., "Identification" -> "identification")
 * @param fieldName - Field name (e.g., "First Name" -> "first_name")
 * @returns i18n key (e.g., "patient_identification_first_name")
 */
export function generateFieldI18nKey(
  tableName: string,
  tabName: string,
  fieldName: string
): string {
  // Remove 'bus_' prefix from table name
  const entity = tableName.replace(/^bus_/, "");
  const entityKey = toSnakeCase(entity);
  const tabKey = toSnakeCase(tabName);
  const fieldKey = toSnakeCase(fieldName);

  return `${entityKey}_${tabKey}_${fieldKey}`;
}

/**
 * Get field label from i18n
 * @param tableName - Table name
 * @param tabName - Tab name (optional, for more specific keys)
 * @param fieldName - Field name
 * @param fallback - Fallback label if translation not found
 * @returns Translated field label
 */
export function getFieldLabel(
  tableName: string,
  tabName: string | undefined,
  fieldName: string,
  fallback?: string
): string {
  // Try with tab first (most specific)
  if (tabName) {
    const keyWithTab = `fields.${generateFieldI18nKey(tableName, tabName, fieldName)}`;
    const translatedWithTab = translate(keyWithTab);

    if (translatedWithTab !== keyWithTab) {
      return translatedWithTab;
    }
  }

  // Fallback to entity_field format (less specific)
  const entity = tableName.replace(/^bus_/, "");
  const entityKey = toSnakeCase(entity);
  const fieldKey = toSnakeCase(fieldName);
  const simpleKey = `fields.${entityKey}_${fieldKey}`;

  const translatedSimple = translate(simpleKey);
  if (translatedSimple !== simpleKey) {
    return translatedSimple;
  }

  // Final fallback
  return fallback || fieldName;
}

/**
 * Get entity display name from i18n
 * @param tableName - Table name (e.g., "bus_patient")
 * @returns Translated entity name
 */
export function getEntityLabel(tableName: string): string {
  const entity = tableName.replace(/^bus_/, "");
  const key = `entities.${toSnakeCase(entity)}`;
  const translated = translate(key);

  // If translation not found, return formatted entity name
  if (translated === key) {
    return entity
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  return translated;
}

/**
 * Get tab display name from i18n
 * @param tableName - Table name
 * @param tabName - Tab name
 * @returns Translated tab name
 */
export function getTabLabel(tableName: string, tabName: string): string {
  const entity = tableName.replace(/^bus_/, "");
  const key = `tabs.${toSnakeCase(entity)}.${toSnakeCase(tabName)}`;
  const translated = translate(key);

  // If translation not found, return tab name as-is
  if (translated === key) {
    return tabName;
  }

  return translated;
}
