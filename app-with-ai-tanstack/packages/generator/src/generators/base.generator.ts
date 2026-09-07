import { promises as fs } from "node:fs";
import path from "node:path";
import type { Entity, Relationship } from "@appwithai/core/types";
import { TemplateLoader } from "../templates/loader";

export abstract class BaseGenerator {
  protected templateLoader: TemplateLoader;

  protected readonly templateDir: string;

  constructor(templateDir: string) {
    this.templateDir = templateDir;
    this.templateLoader = new TemplateLoader(templateDir);
  }

  abstract generate(
    entities: Entity[],
    relationships: Relationship[],
    outputDir: string
  ): Promise<void>;

  protected async renderTemplate(
    templatePath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Handlebars context is dynamic
    context: any
  ): Promise<string> {
    const template = await this.templateLoader.load(templatePath);
    return template(context);
  }

  /**
   * Read a component that needs no substitution.
   *
   * A file only has to be a Handlebars template if a model changes it. Most of
   * the front end does not: it renders whatever the Application Dictionary
   * describes, so it is the same code for a CRM and for a drug-discovery lab,
   * and the identity it does need comes from `src/lib/app-meta.ts` — the one
   * generated module — rather than from twenty substitutions.
   *
   * Keeping them as real `.tsx` is what lets an editor, a linter and the
   * generated application's own `tsc` read them — a `.hbs` file is text to all
   * three. (The root tsconfig still excludes `templates/`, since a component
   * written against the generated app's dependencies cannot compile against
   * this repo's; what checks them is building the application, which CI does.)
   *
   * It also makes regeneration deterministic. Most of these files were
   * templates only because they carried a `Generated: <timestamp>` header,
   * which meant every regeneration rewrote every file and no diff between two
   * runs meant anything.
   */
  protected async component(componentPath: string): Promise<string> {
    return fs.readFile(path.join(this.templateDir, componentPath), "utf-8");
  }
}
