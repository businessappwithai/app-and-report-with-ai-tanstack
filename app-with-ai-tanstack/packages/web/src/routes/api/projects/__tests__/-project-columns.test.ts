import { describe, expect, it } from "vitest";
import { EDITABLE_PROJECT_COLUMNS, toProjectColumns, toProjectResponse } from "../$id/index";

describe("toProjectColumns", () => {
  // The handler used to spread the request body into the UPDATE unchanged.
  it("translates camelCase fields to their columns", () => {
    expect(toProjectColumns({ generatedPath: "/out/app" })).toEqual({
      generated_path: "/out/app",
    });
    expect(toProjectColumns({ iconColor: "#fff", stackType: "tanstackjs-nestjs" })).toEqual({
      icon_color: "#fff",
      stack_type: "tanstackjs-nestjs",
    });
  });

  it("passes through fields whose name is already the column", () => {
    expect(toProjectColumns({ name: "Renamed", port: 4000 })).toEqual({
      name: "Renamed",
      port: 4000,
    });
  });

  // An unfiltered spread let a caller name any column, so an edit right was
  // also the ability to take a project over or make it vanish.
  it("drops fields that are not the client's to set", () => {
    expect(
      toProjectColumns({
        name: "Kept",
        owner_user_id: "someone-else",
        ownerId: "someone-else",
        is_deleted: true,
        isDeleted: true,
        id: "other-project",
        created_at: "1999-01-01",
      })
    ).toEqual({ name: "Kept" });
  });

  it("treats undefined as 'not changing', not as null", () => {
    expect(toProjectColumns({ name: "Kept", description: undefined })).toEqual({ name: "Kept" });
    // An explicit null is a real value — clearing a field must still work.
    expect(toProjectColumns({ description: null })).toEqual({ description: null });
  });

  it("returns nothing for a body that is not an object", () => {
    expect(toProjectColumns(null)).toEqual({});
    expect(toProjectColumns("name=x")).toEqual({});
    expect(toProjectColumns(undefined)).toEqual({});
  });

  it("never maps two fields onto the same column", () => {
    const columns = Object.values(EDITABLE_PROJECT_COLUMNS);
    expect(new Set(columns).size).toBe(columns.length);
  });
});

describe("toProjectResponse", () => {
  // The generate step reads generatedPath and deploymentStatus together to
  // decide whether a project has been generated. The response carried the
  // first and dropped the second, so a successful run still showed the stack
  // picker.
  it("returns the fields the generate step needs", () => {
    const project = toProjectResponse({
      id: "proj-1",
      generated_path: "/out/app",
      deployment_status: "completed",
    });
    expect(project.generatedPath).toBe("/out/app");
    expect(project.deploymentStatus).toBe("completed");
  });

  it("round-trips every field a client may write", () => {
    // A field writable through PATCH but absent from the response reads back as
    // undefined, so the UI cannot see its own edit.
    const readable = new Set(Object.keys(toProjectResponse({})));
    for (const field of Object.keys(EDITABLE_PROJECT_COLUMNS)) {
      // Not every writable field is worth returning, but these are the ones the
      // client's Project type declares.
      if (
        [
          "stackVersion",
          "databaseSchema",
          "environmentVariables",
          "buildConfig",
          "isTypescript",
          "isTailwind",
          "baseUrl",
        ].includes(field)
      ) {
        continue;
      }
      expect(readable, `${field} is writable but never read back`).toContain(field);
    }
  });

  it("maps snake_case columns onto camelCase fields", () => {
    const project = toProjectResponse({
      icon_color: "#fff",
      owner_user_id: "u1",
      is_deleted: false,
    });
    expect(project.iconColor).toBe("#fff");
    expect(project.ownerId).toBe("u1");
    expect(project.isDeleted).toBe(false);
  });
});
