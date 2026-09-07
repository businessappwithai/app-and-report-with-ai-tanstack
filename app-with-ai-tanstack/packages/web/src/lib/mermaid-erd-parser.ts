// Thin wrapper around @appwithai/generator's MermaidParser
// Exposes ERD parsing as a standalone module for web-layer use

export type { Entity, EntityAttribute, Relationship } from "@appwithai/core/types";
export { MermaidParser } from "@appwithai/generator";
