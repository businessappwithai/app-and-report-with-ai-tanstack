/**
 * Hook Translator Module
 *
 * Parses hook definitions from Mermaid flowcharts and generates TypeScript code
 * using the Visitor pattern for AST traversal and code generation.
 *
 * @module hook-translator
 */

// Parser
export { HookSyntaxParser, hookParser } from "./parser";
// Types
export type {
  BaseHookVisitor,
  GeneratedHook,
  HookDefinitionNode,
  HookType,
  HookVisitor,
  Parameter,
  ParameterNode,
  ParsedHook,
  ParseError,
  ParseResult,
} from "./types";
// Utility functions
export {
  fromHookDefinition,
  generateFlowchartFromHooks,
  generateHookCodeFile,
  generateHookComment,
  parseHookDefinition,
  parseHooksFromFlowchart,
  toHookDefinition,
  validateHookDefinition,
} from "./utils";
// Visitor
export {
  createVisitor,
  HookCodeGenerationVisitor,
  type VisitorOptions,
} from "./visitor";
