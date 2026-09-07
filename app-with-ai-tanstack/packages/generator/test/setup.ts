/**
 * Generator Package Test Setup
 *
 * Provides test utilities, fixtures, and mocks for generator tests
 */

import * as fs from "node:fs/promises";
import os from "node:os";
import * as path from "node:path";
import type { Entity, Relationship } from "@appwithai/core/types";
import { vi } from "vitest";

// Mock fs module for tests that don't need real file operations
export const mockFs = {
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(""),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ isDirectory: () => false }),
  rm: vi.fn().mockResolvedValue(undefined),
};

/**
 * Create a temporary directory for test outputs
 */
export async function createTempDir(prefix: string = "generator-test"): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `${prefix}-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Clean up a temporary directory
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (_error) {
    // Ignore cleanup errors
  }
}

/**
 * Sample entity for testing
 */
export function createTestEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    name: "User",
    tableName: "user",
    description: "User entity for testing",
    attributes: [
      { name: "id", type: "string", required: true, unique: true },
      { name: "email", type: "string", required: true, unique: true, maxLength: 255 },
      { name: "name", type: "string", required: true, maxLength: 100 },
      { name: "age", type: "integer", required: false },
      { name: "isActive", type: "boolean", required: true, default: true },
      { name: "createdAt", type: "datetime", required: true },
    ],
    primaryKey: "id",
    timestamps: true,
    ...overrides,
  };
}

/**
 * Create a complex entity with all attribute types
 */
export function createComplexEntity(): Entity {
  return {
    name: "Product",
    tableName: "product",
    description: "Product entity with all attribute types",
    attributes: [
      { name: "id", type: "string", required: true, unique: true },
      { name: "name", type: "string", required: true, maxLength: 200 },
      { name: "description", type: "text", required: false },
      { name: "price", type: "decimal", required: true },
      { name: "quantity", type: "integer", required: true, default: 0 },
      { name: "isAvailable", type: "boolean", required: true, default: true },
      { name: "releaseDate", type: "date", required: false },
      { name: "lastUpdated", type: "datetime", required: true },
      { name: "metadata", type: "json", required: false },
    ],
    primaryKey: "id",
    timestamps: true,
  };
}

/**
 * Sample relationship for testing
 */
export function createTestRelationship(overrides: Partial<Relationship> = {}): Relationship {
  return {
    name: "user_posts",
    sourceEntity: "User",
    targetEntity: "Post",
    cardinality: "oneToMany",
    foreignKey: "user_id",
    ...overrides,
  };
}

/**
 * Create a set of entities and relationships for full testing
 */
export function createTestEntitySet(): { entities: Entity[]; relationships: Relationship[] } {
  const entities: Entity[] = [
    {
      name: "User",
      tableName: "user",
      description: "Application user",
      attributes: [
        { name: "id", type: "string", required: true, unique: true },
        { name: "email", type: "string", required: true, unique: true },
        { name: "name", type: "string", required: true },
        { name: "role", type: "string", required: true, default: "user" },
      ],
      primaryKey: "id",
      timestamps: true,
    },
    {
      name: "Post",
      tableName: "post",
      description: "Blog post",
      attributes: [
        { name: "id", type: "string", required: true, unique: true },
        { name: "title", type: "string", required: true },
        { name: "content", type: "text", required: true },
        { name: "published", type: "boolean", required: true, default: false },
        { name: "authorId", type: "string", required: true },
      ],
      primaryKey: "id",
      timestamps: true,
    },
    {
      name: "Comment",
      tableName: "comment",
      description: "Post comment",
      attributes: [
        { name: "id", type: "string", required: true, unique: true },
        { name: "content", type: "text", required: true },
        { name: "postId", type: "string", required: true },
        { name: "authorId", type: "string", required: true },
      ],
      primaryKey: "id",
      timestamps: true,
    },
    {
      name: "Category",
      tableName: "category",
      description: "Post category",
      attributes: [
        { name: "id", type: "string", required: true, unique: true },
        { name: "name", type: "string", required: true, unique: true },
        { name: "description", type: "text", required: false },
      ],
      primaryKey: "id",
      timestamps: true,
    },
  ];

  const relationships: Relationship[] = [
    {
      name: "user_posts",
      sourceEntity: "User",
      targetEntity: "Post",
      cardinality: "oneToMany",
      foreignKey: "author_id",
    },
    {
      name: "post_comments",
      sourceEntity: "Post",
      targetEntity: "Comment",
      cardinality: "oneToMany",
      foreignKey: "post_id",
    },
    {
      name: "user_comments",
      sourceEntity: "User",
      targetEntity: "Comment",
      cardinality: "oneToMany",
      foreignKey: "author_id",
    },
    {
      name: "post_categories",
      sourceEntity: "Post",
      targetEntity: "Category",
      cardinality: "manyToMany",
      foreignKey: "post_id",
      inverseForeignKey: "category_id",
    },
  ];

  return { entities, relationships };
}

/**
 * Sample Mermaid ERD content for parsing tests
 */
export const SAMPLE_MERMAID_ERD = `erDiagram
  User {
    string id PK
    string email UK
    string name
    integer age OPTIONAL
    boolean isActive
    datetime createdAt
  }
  Post {
    string id PK
    string title
    text content
    boolean published
    string authorId FK
  }
  Comment {
    string id PK
    text content
    string postId FK
    string authorId FK
  }
  User ||--o{ Post : writes
  Post ||--o{ Comment : has
  User ||--o{ Comment : authors
`;

/**
 * Complex Mermaid ERD with all relationship types
 */
export const COMPLEX_MERMAID_ERD = `erDiagram
  Customer {
    string id PK
    string name
    string email UK
    decimal balance
    boolean isVip
    datetime createdAt
  }
  Order {
    string id PK
    datetime orderDate
    decimal totalAmount
    string status
    string customerId FK
  }
  OrderItem {
    string id PK
    integer quantity
    decimal unitPrice
    string orderId FK
    string productId FK
  }
  Product {
    string id PK
    string name
    text description
    decimal price
    integer stock
    json metadata
  }
  Address {
    string id PK
    string street
    string city
    string country
    string customerId FK
  }
  Customer ||--o{ Order : places
  Order ||--o{ OrderItem : contains
  Product ||--o{ OrderItem : "included in"
  Customer ||--|| Address : "has primary"
`;

/**
 * Verify that a file exists and has content
 */
export async function assertFileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Verify that a directory exists
 */
export async function assertDirExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Read and return file content
 */
export async function readFileContent(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf-8");
}

/**
 * List all files in a directory recursively
 */
export async function listFilesRecursively(
  dir: string,
  fileList: string[] = []
): Promise<string[]> {
  const files = await fs.readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      await listFilesRecursively(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }

  return fileList;
}

/**
 * Verify generated file content contains expected strings
 */
export async function assertFileContains(
  filePath: string,
  expectedStrings: string[]
): Promise<{ success: boolean; missing: string[] }> {
  const content = await fs.readFile(filePath, "utf-8");
  const missing: string[] = [];

  for (const expected of expectedStrings) {
    if (!content.includes(expected)) {
      missing.push(expected);
    }
  }

  return {
    success: missing.length === 0,
    missing,
  };
}

/**
 * Global test timeout
 */
export const TEST_TIMEOUT = 30000;
