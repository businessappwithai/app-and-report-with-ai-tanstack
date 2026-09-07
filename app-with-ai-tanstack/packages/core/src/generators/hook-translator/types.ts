/**
 * AST Node Types for Hook Definitions
 *
 * These types represent the Abstract Syntax Tree generated from parsing
 * hook definitions using the HookSyntax grammar
 */

/**
 * Hook types supported by the system
 */
export type HookType =
  | "beforeCreate"
  | "afterCreate"
  | "beforeUpdate"
  | "afterUpdate"
  | "beforeDelete"
  | "afterDelete"
  | "beforeQuery"
  | "afterQuery"
  | "customValidate"
  | "beforeRead"
  | "afterRead"
  | "beforeList"
  | "afterList";

/**
 * Parameter definition for hooks
 */
export interface ParameterNode {
  $type: "Parameter";
  name: string;
  kind: "field"; // Can be extended to other types in the future
}

/**
 * Hook definition node - the root of the AST
 */
export interface HookDefinitionNode {
  $type: "HookDefinition";
  hookType: HookType;
  hookName: string;
  entity: string;
  parameters?: ParameterNode[];
  raw: string; // Raw input string
}

/**
 * Visitor interface for traversing the AST
 */
export interface HookVisitor<T> {
  visitHookDefinition: (node: HookDefinitionNode) => T;
  visitParameter: (node: ParameterNode) => T;
}

/**
 * Base visitor class with default traversal behavior
 */
export abstract class BaseHookVisitor<T> implements HookVisitor<T> {
  visitHookDefinition(node: HookDefinitionNode): T {
    if (node.parameters) {
      return node.parameters.map((p) => this.visitParameter(p)) as unknown as T;
    }
    return this.defaultResult(node);
  }

  visitParameter(node: ParameterNode): T {
    return this.defaultResult(node);
  }

  protected defaultResult(_node: HookDefinitionNode | ParameterNode): T {
    return undefined as unknown as T;
  }
}

/**
 * Parse result containing AST and any errors
 */
export interface ParseResult {
  ast: HookDefinitionNode | null;
  errors: ParseError[];
}

/**
 * Parse error with location information
 */
export interface ParseError {
  message: string;
  line?: number;
  column?: number;
  offendingSymbol?: string;
}

/**
 * Hook definition as it will be stored/generated
 */
export interface ParsedHook {
  type: HookType;
  name: string;
  entity: string;
  parameters?: Parameter[];
  order: number;
  rawComment: string;
}

/**
 * Parameter for hook execution
 */
export interface Parameter {
  name: string;
  type: string;
}

/**
 * Generated hook code with metadata
 */
export interface GeneratedHook {
  entityName: string;
  hookType: HookType;
  hookName: string;
  code: string;
  imports: string[];
  fileName: string;
}
