// Builds an OpenAPI 3.0 document from the EML model at runtime.

import { ENUMS, MODEL } from "./model.js";

const TYPE_MAP = {
  string: { type: "string" },
  text: { type: "string" },
  integer: { type: "integer" },
  decimal: { type: "number" },
  boolean: { type: "boolean" },
  date: { type: "string", format: "date" },
  datetime: { type: "string", format: "date-time" },
  json: { type: "object" },
};

export function buildOpenApi() {
  const paths = {};
  const schemas = {};

  for (const entity of MODEL.entities ?? []) {
    const props = {};
    const required = [];
    for (const a of entity.attributes) {
      const base = TYPE_MAP[a.type] ?? { type: "string" };
      props[a.name] =
        a.enumRef && ENUMS[a.enumRef] ? { ...base, enum: ENUMS[a.enumRef] } : { ...base };
      if (a.required && !a.isPrimaryKey) required.push(a.name);
    }
    schemas[entity.name] = { type: "object", properties: props, required };

    const ref = { $ref: `#/components/schemas/${entity.name}` };
    const col = entity.collection;
    paths[`/api/${col}`] = {
      get: { summary: `List ${entity.name}`, responses: { 200: { description: "OK" } } },
      post: {
        summary: `Create ${entity.name}`,
        requestBody: { content: { "application/json": { schema: ref } } },
        responses: { 201: { description: "Created" }, 400: { description: "Validation error" } },
      },
    };
    paths[`/api/${col}/{id}`] = {
      get: {
        summary: `Get ${entity.name}`,
        responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
      },
      put: {
        summary: `Update ${entity.name}`,
        requestBody: { content: { "application/json": { schema: ref } } },
        responses: { 200: { description: "OK" }, 409: { description: "Illegal transition" } },
      },
      delete: { summary: `Delete ${entity.name}`, responses: { 204: { description: "Deleted" } } },
    };
  }

  return {
    openapi: "3.0.3",
    info: { title: MODEL.meta?.name ?? "EML App", version: MODEL.meta?.version ?? "1.0.0" },
    paths,
    components: { schemas },
  };
}
