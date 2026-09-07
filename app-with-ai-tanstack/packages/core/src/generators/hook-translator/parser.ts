/**
 * Hook Syntax Parser
 *
 * Parses hook definitions following the HookSyntax grammar:
 * %%hook <hookType> <hookName> on <EntityName>[<parameters>]
 *
 * Example:
 * %%hook beforeCreate hashPassword on User
 * %%hook beforeCreate validateAndHash User[field: password, email]
 */

import type { HookDefinitionNode, HookType, ParameterNode, ParseError, ParseResult } from "./types";

export class HookSyntaxParser {
  private readonly HOOK_DECL = "%%hook";

  // Regex patterns based on the ANTLR4 grammar
  private readonly HOOK_TYPE_PATTERN =
    /^(beforeCreate|afterCreate|beforeUpdate|afterUpdate|beforeDelete|afterDelete|beforeQuery|afterQuery|customValidate)$/;

  private readonly HOOK_DEFINITION_PATTERN = /^%%hook\s+(\w+)\s+(\w+)\s+on\s+(\w+)(?:\[(.*)\])?$/;

  private readonly PARAMETER_PATTERN = /^field:\s*(\w+)$/;

  /**
   * Parse a single hook definition
   */
  parse(input: string): ParseResult {
    const errors: ParseError[] = [];
    const trimmedInput = input.trim();

    // Validate basic structure
    if (!trimmedInput.startsWith(this.HOOK_DECL)) {
      errors.push({
        message: `Hook definition must start with '${this.HOOK_DECL}'`,
        offendingSymbol: trimmedInput.substring(0, 10),
      });
      return { ast: null, errors };
    }

    // Match the pattern
    const match = trimmedInput.match(this.HOOK_DEFINITION_PATTERN);
    if (!match) {
      errors.push({
        message:
          "Invalid hook definition format. Expected: %%hook <type> <name> on <entity>[<params>]",
        offendingSymbol: trimmedInput,
      });
      return { ast: null, errors };
    }

    const [, hookTypeStr, hookName, entity, paramsStr] = match;

    // Validate hook type
    if (!hookTypeStr || !this.HOOK_TYPE_PATTERN.test(hookTypeStr)) {
      errors.push({
        message: `Invalid hook type: '${hookTypeStr || ""}'. Must be one of: beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete, afterDelete, beforeQuery, afterQuery, customValidate`,
        offendingSymbol: hookTypeStr || "",
      });
      return { ast: null, errors };
    }

    const hookType = hookTypeStr as HookType;

    // Validate hook name
    if (!hookName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(hookName)) {
      errors.push({
        message: `Invalid hook name: '${hookName || ""}'. Must start with letter or underscore`,
        offendingSymbol: hookName || "",
      });
      return { ast: null, errors };
    }

    // Validate entity name
    if (!entity || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(entity)) {
      errors.push({
        message: `Invalid entity name: '${entity}'. Must start with letter or underscore`,
        offendingSymbol: entity || "",
      });
      return { ast: null, errors };
    }

    // Parse parameters if present
    const parameters: ParameterNode[] = [];
    if (paramsStr) {
      const paramErrors = this.parseParameters(paramsStr, parameters);
      if (paramErrors.length > 0) {
        errors.push(...paramErrors);
      }
    }

    if (errors.length > 0) {
      return { ast: null, errors };
    }

    // Build AST
    const ast: HookDefinitionNode = {
      $type: "HookDefinition",
      hookType,
      hookName: hookName || "",
      entity: entity || "",
      parameters: parameters.length > 0 ? parameters : undefined,
      raw: trimmedInput,
    };

    return { ast, errors: [] };
  }

  /**
   * Parse parameters from parameter string
   * Format: field: name, field: email
   */
  private parseParameters(paramsStr: string, parameters: ParameterNode[]): ParseError[] {
    const errors: ParseError[] = [];
    const parts = paramsStr.split(",").map((p) => p.trim());

    for (const part of parts) {
      if (!part) continue;

      const match = part.match(this.PARAMETER_PATTERN);
      if (!match) {
        errors.push({
          message: `Invalid parameter format: '${part}'. Expected: field: <name>`,
          offendingSymbol: part,
        });
        continue;
      }

      const [, paramName] = match;

      // Validate parameter name
      if (!paramName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(paramName)) {
        errors.push({
          message: `Invalid parameter name: '${paramName || ""}'. Must start with letter or underscore`,
          offendingSymbol: paramName || "",
        });
        continue;
      }

      parameters.push({
        $type: "Parameter",
        name: paramName,
        kind: "field",
      });
    }

    return errors;
  }

  /**
   * Parse multiple hook definitions from a string
   * (e.g., from a flowchart with multiple hook comments)
   */
  parseMultiple(input: string): { results: ParseResult[] } {
    const lines = input.split("\n");
    const results: ParseResult[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith(this.HOOK_DECL)) {
        results.push(this.parse(trimmedLine));
      }
    }

    return { results };
  }
}

/**
 * Singleton instance of the parser
 */
export const hookParser = new HookSyntaxParser();
