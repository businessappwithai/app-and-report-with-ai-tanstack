/**
 * The filesystem the real generators run on in a browser.
 *
 * Worth testing on its own rather than only through a generation, because when
 * it is wrong the symptom is four hundred files that look right and one that is
 * missing — and the failure surfaces as an ENOENT deep inside a template
 * loader, pointing at a path that never existed on any disk.
 *
 * The template-suffix resolution is the part most worth pinning. `resolveTemplateDir`
 * tries six candidate locations for the templates and picks the first that
 * exists; none of those questions means anything in a tab, so a miss falls back
 * to matching on everything after `templates/`. That is a shim behaviour, and a
 * shim behaviour nobody wrote down is one somebody removes.
 */

import { beforeEach, describe, expect, it } from "vitest";
import * as memfs from "../memory-fs";

beforeEach(() => memfs.reset());

describe("the in-memory filesystem", () => {
  it("reads back what was written", async () => {
    await memfs.writeFile("/app/backend/src/main.ts", "console.log(1);");
    expect(await memfs.readFile("/app/backend/src/main.ts")).toBe("console.log(1);");
  });

  it("throws an ENOENT that call sites can recognise", async () => {
    await expect(memfs.readFile("/nope")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("creates parent directories implicitly, as writing a file does", async () => {
    await memfs.writeFile("/app/a/b/c.txt", "x");
    expect(await memfs.readdir("/app/a")).toEqual(["b"]);
    expect(memfs.existsSync("/app/a/b")).toBe(true);
  });

  it("hands back only what was written under the output root", async () => {
    memfs.seed({ "common/x.hbs": "template" }, "/templates");
    await memfs.writeFile("/app/one.ts", "1");
    await memfs.writeFile("/app/nested/two.ts", "2");

    expect(memfs.snapshot("/app")).toEqual({ "one.ts": "1", "nested/two.ts": "2" });
  });

  it("forgets everything on reset, so two generations cannot see each other", async () => {
    await memfs.writeFile("/app/one.ts", "1");
    memfs.reset();
    expect(memfs.snapshot("/app")).toEqual({});
  });

  describe("finding templates however the path was spelled", () => {
    beforeEach(() => {
      memfs.seed(
        {
          "tanstack-start-nestjs/backend/src/main.ts.hbs": "main",
          "tanstack-start-nestjs/frontend/src/routes/admin/users.tsx": "users",
          "tanstack-start-nestjs/frontend/src/routes/admin/roles.tsx": "roles",
          "common/seeds/business-data.ts.hbs": "seed",
        },
        "/templates"
      );
    });

    it("reads one through any of the resolver's candidate roots", async () => {
      for (const root of [
        "/templates",
        "/home/someone/repo/packages/generator/templates",
        "/srv/app/templates",
      ]) {
        expect(await memfs.readFile(`${root}/tanstack-start-nestjs/backend/src/main.ts.hbs`)).toBe(
          "main"
        );
      }
    });

    it("reports a directory of them as existing", () => {
      expect(memfs.existsSync("/anywhere/templates/tanstack-start-nestjs/backend")).toBe(true);
      expect(memfs.existsSync("/anywhere/templates/does-not-exist")).toBe(false);
    });

    it("lists one, which is how whole directories get copied", async () => {
      const entries = await memfs.readdir(
        "/x/templates/tanstack-start-nestjs/frontend/src/routes/admin"
      );
      expect(entries).toEqual(["roles.tsx", "users.tsx"]);
    });

    it("tells a template file from a directory of them", async () => {
      const file = await memfs.stat("/x/templates/common/seeds/business-data.ts.hbs");
      expect(file.isFile()).toBe(true);
      const directory = await memfs.stat("/x/templates/common/seeds");
      expect(directory.isDirectory()).toBe(true);
    });

    it("does not mistake a generated file for a template", async () => {
      await memfs.writeFile("/app/main.ts", "generated");
      expect(await memfs.readFile("/app/main.ts")).toBe("generated");
      await expect(memfs.readFile("/app/main.ts.hbs")).rejects.toMatchObject({ code: "ENOENT" });
    });
  });
});
