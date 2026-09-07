#!/usr/bin/env bun
/**
 * Hold `website/llmtext/llms-full.txt` and `website/llmtext/llmdetailed.txt` to the claims they
 * make about the checker.
 *
 * The two files tell a language model which diagnostics exist, which of them
 * repair themselves, and how to run the engine. Nothing enforced any of that:
 * both are prose, and prose about a compiler goes stale in the one direction
 * nobody notices — a code that was renamed, a repair that stopped being
 * automatic, a section number that moved. A model reading a stale claim does
 * not get an error; it gets a confident wrong answer.
 *
 * The site's `scripts/check-spec.mjs` covers its own published copies. This is
 * the same guarantee where the files are authored.
 *
 *   bun scripts/ci/llmtext-claims.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import definition from "../../language/appwithai-language.json";
import { check } from "../../language/browser/checker.entry";
import { AUTO_FIXABLE_CODES } from "../../language/checker";
import { parseModel } from "../../packages/generator/src/pipeline/parse-model";

/* The checker exports a Set; every assertion below wants a stable ordering. */
const autoFixable = [...AUTO_FIXABLE_CODES].sort();

/* Directive name + status, straight from the definition JSON. Both documents
   name that file as the authority, so it is what their tables are held to. */
const directives = (
  definition.directives.reserved as Array<{ keyword: string; status: string }>
).map((entry) => ({ name: entry.keyword.replace(/^%%/, ""), status: entry.status }));

const ROOT = resolve(import.meta.dir, "../..");
const checkerSource = readFileSync(join(ROOT, "language/checker.ts"), "utf-8");

let failed = 0;
const held = (condition: boolean, label: string): void => {
  if (condition) console.log(`ok   ${label}`);
  else {
    failed++;
    console.log(`FAIL ${label}`);
  }
};

for (const name of ["llms-full.txt", "llmdetailed.txt"]) {
  const doc = readFileSync(join(ROOT, "website", "llmtext", name), "utf-8");
  /* Both files are hard-wrapped, so a claim about a sentence has to be matched
     against a whitespace-collapsed copy or it turns on where a line broke. */
  const prose = doc.replace(/\s+/g, " ");

  /* A diagnostic the engine cannot emit reads exactly like one it can. */
  const cited = [...new Set(doc.match(/EML\d{3}/g) ?? [])].sort();
  const unknown = cited.filter((code) => !checkerSource.includes(code));
  held(
    cited.length > 0 && unknown.length === 0,
    `${name}: every diagnostic it cites exists in the checker (${cited.length} codes${
      unknown.length ? `, missing: ${unknown.join(", ")}` : ""
    })`
  );

  /* The auto-repairs, against AUTO_FIXABLE_CODES rather than a copy of it. */
  /* Matched by presence, not by form: llms-full.txt names them in a sentence
     and llmdetailed.txt in a table, and both are legitimate. What must not
     happen is a code going unmentioned while the engine still repairs it. */
  const claimed = autoFixable.filter((code) => doc.includes(code));
  held(
    claimed.length === autoFixable.length,
    `${name}: tabulates every auto-fixable code (${autoFixable.length}; missing ${
      autoFixable.filter((c) => !claimed.includes(c)).join(", ") || "none"
    })`
  );
  held(
    !/\bseven auto-repairs\b|\bSeven codes are auto-fixable\b/i.test(prose) ||
      autoFixable.length === 7,
    `${name}: counts the auto-repairs correctly (checker says ${autoFixable.length})`
  );

  /* A cross-reference that resolves nowhere sends a reader nowhere. */
  const headings = new Set([...doc.matchAll(/^#{2,4} (\d+(?:\.\d+)*)[. ]/gm)].map((m) => m[1]));
  const dangling = [...new Set([...doc.matchAll(/§(\d+\.\d+)/g)].map((m) => m[1]))].filter(
    (ref) => !headings.has(ref)
  );
  held(
    dangling.length === 0,
    `${name}: every §N.N cross-reference resolves${
      dangling.length ? ` (dangling: ${dangling.join(", ")})` : ""
    }`
  );

  /* Directive status, against `language/appwithai-language.json` — the file both
     documents name as the authority. This is the check that was missing: §11
     rule 2 claimed %%entity was "validated but not compiled" while the same
     document's own §3.2 table said compiled, and a reader who believed rule 2
     would conclude %%entity help: was inert. It is not: it becomes
     sys_table.description and the whole of the generated manual's prose. */
  for (const entry of directives) {
    const row = new RegExp(`^\\| \`%%${entry.name}\` \\|[^\n]*$`, "m").exec(doc);
    held(
      row !== null && new RegExp(`\\b${entry.status}\\b`).test(row[0]),
      `${name}: the status table calls %%${entry.name} ${entry.status}${
        row ? "" : " (no row found)"
      }`
    );
    /* A compiled directive must never be described as inert in prose. */
    if (entry.status === "compiled") {
      held(
        !new RegExp(`%%${entry.name}\`?,? (and )?[^.]{0,60}are validated but not compiled`).test(
          prose
        ),
        `${name}: prose does not call the compiled %%${entry.name} "validated but not compiled"`
      );
    }
  }

  /* The published route has to be offered, or a model without this checkout
     concludes the checker is unreachable — the failure this text exists for. */
  held(
    prose.includes("curl -sO https://appwithai.org/guide/check-model.mjs"),
    `${name}: offers the checkout-free way to run the checker`
  );
  held(
    /reach GitHub says nothing about whether the checker can run/i.test(prose),
    `${name}: states that an unreachable GitHub is not an unreachable checker`
  );
  /* Three observed failures were all one URL failing, generalised into "no
     validation is possible" — including one where the blocked URL was this
     very file. */
  held(
    /needs no specification document at all/i.test(prose),
    `${name}: separates fetching the spec from running the checker`
  );
  /* The fourth failure mode: proposing the mandatory step instead of taking it. */
  held(
    /Perform the validation; do not offer it/i.test(prose),
    `${name}: requires the run rather than offering it`
  );
}

/* ------------------------------------------------------------------------ */
/*  The examples are read the same way by both readers                       */
/* ------------------------------------------------------------------------ */

/**
 * Every fenced `mermaid` example must parse to the same entities the checker
 * sees in it.
 *
 * The two documents are read by two engines. `checkSource` decides whether a
 * model is *accepted*; `parseModel` decides what an accepted model *contains*,
 * and it is the second one that turns into an application. Nothing held them to
 * each other, and they disagreed about the most-copied example in the file.
 *
 * §10.3's seed declared each entity as `Member { string id PK }`. `MermaidParser`
 * opens an entity block on `^<Name>\s*\{$` — the brace has to end the line — so
 * it read **zero** entities. The checker did not report that, because the same
 * seed carries `%%category` and `%%entity … help:` directives it recovers the
 * names from; it reported zero errors and one `EML102` per entity instead, and
 * §10.3 told the reader in as many words to expect exactly those warnings and
 * not to act on them. A model following the protocol produced a document that
 * checked clean and generated nothing.
 *
 * Neither engine alone can catch that. This is the check that can: an example
 * the checker accepts must contain, to `parseModel`, at least the entities the
 * checker counted in it.
 */
/**
 * An entity *declaration* as a reader of the document would recognise one —
 * deliberately looser than the parser's own pattern, which requires the brace to
 * end the line.
 *
 * Matching the parser's pattern here would make this check vacuous in exactly
 * the case it exists for: a one-line `Member { string id PK }` would be found by
 * neither the regexp nor `parseModel`, the two would agree on nothing, and the
 * example would pass. The point is to find what the *document appears to
 * declare* and hold the parser to it.
 */
const ENTITY_BLOCK = /^[ \t]*([A-Z][A-Za-z0-9_]*)[ \t]*\{/gm;

for (const name of ["llms-full.txt", "llmdetailed.txt"]) {
  const doc = readFileSync(join(ROOT, "website", "llmtext", name), "utf-8");

  /* Fenced ```mermaid blocks only. A plain ``` fence is prose about the
     language — including, deliberately, the one-liner §10.3 now quotes as the
     form that does not work. */
  const examples: Array<{ line: number; body: string }> = [];
  const lines = doc.split("\n");
  for (let index = 0; index < lines.length; index++) {
    if (lines[index]?.trim() !== "```mermaid") continue;
    const start = index + 1;
    let end = start;
    while (end < lines.length && lines[end]?.trim() !== "```") end++;
    examples.push({ line: start + 1, body: lines.slice(start, end).join("\n") });
    index = end;
  }

  held(examples.length > 0, `${name}: has fenced mermaid examples to check (${examples.length})`);

  let disagreed = 0;
  for (const example of examples) {
    /* Only examples that are whole documents are comparable: a fragment showing
       one directive has no erDiagram and is not claiming to be a model. */
    if (!/^\s*erDiagram\s*$/m.test(example.body)) continue;

    const declared = new Set<string>();
    for (const match of example.body.matchAll(ENTITY_BLOCK)) {
      if (match[1]) declared.add(match[1]);
    }

    const parsed = new Set(parseModel(example.body).entities.map((entity) => entity.name));
    const missing = [...declared].filter((entity) => !parsed.has(entity));

    /* An example that declares entity blocks the parser cannot see is the
       failure this check exists for. The reverse — the parser finding more than
       the regexp did — is fine: an entity may be introduced by a directive. */
    if (missing.length > 0) {
      disagreed++;
      console.log(
        `FAIL ${name}:${example.line}: the parser does not see ${missing.join(", ")} — ` +
          "an entity block must end its line with `{`"
      );
    }
  }

  held(disagreed === 0, `${name}: every mermaid example parses to the entities it declares`);
}

/**
 * The seed the protocol tells a reader to write must itself survive both
 * readers. Belt and braces over the sweep above, because this one example is
 * the one every session copies.
 */
const seedExample = readFileSync(join(ROOT, "website", "llmtext", "llmdetailed.txt"), "utf-8")
  .split("```mermaid")
  .find((block) => block.includes("Acme Dance Studio"))
  ?.split("```")[0];

if (seedExample) {
  const seed = parseModel(seedExample);
  held(
    seed.entities.length === 4,
    `llmdetailed.txt §10.3: the seed example parses to its four entities (got ${seed.entities.length})`
  );
  held(
    seed.entities.every((entity) => entity.attributes.some((a) => a.name === "id")),
    "llmdetailed.txt §10.3: every seed entity carries the id the example writes"
  );
  const report = check(seedExample);
  held(
    report.counts.errors === 0 && report.counts.warnings === 0,
    `llmdetailed.txt §10.3: the seed checks clean (${report.counts.errors}e ${report.counts.warnings}w ${report.counts.infos}i)`
  );
} else {
  held(false, "llmdetailed.txt §10.3: the seed example is still findable");
}

/* ------------------------------------------------------------------------ */
/*  The viewers                                                              */
/* ------------------------------------------------------------------------ */

/**
 * `llmdetailed.txt` tells the reader to open the viewers, at a URL, and says
 * what they draw. All three of those rot silently: the page can move, a tab can
 * be renamed, and a claim about what is drawn can outlive the code that drew
 * it. A model following a stale instruction sends its user to a 404 in the
 * middle of a walkthrough.
 */
const detailed = readFileSync(join(ROOT, "website", "llmtext", "llmdetailed.txt"), "utf-8");
const detailedProse = detailed.replace(/\s+/g, " ");

held(
  detailed.includes("https://appwithai.org/viewers/"),
  "llmdetailed.txt: names the viewers by their published URL"
);

/* The path it names has to be the directory this repository publishes, and the
   page it names has to be in it. */
for (const file of ["index.html", "eml-model.js", "model-viewer.js", "viewers.css"]) {
  held(
    existsSync(join(ROOT, "website", "viewers", file)),
    `website/viewers/${file} exists — llmdetailed.txt sends readers to it`
  );
}

/* Every tab the prose names by title is a tab the page actually has. Read off
   the markup rather than listed here, so a renamed tab fails this rather than
   quietly disagreeing with the instruction. */
const viewerPage = readFileSync(join(ROOT, "website", "viewers", "index.html"), "utf-8");
const tabs = [...viewerPage.matchAll(/data-tab="[^"]+">([^<]+)</g)].map((match) =>
  (match[1] ?? "").trim()
);
for (const named of ["Workflows", "Business rules", "Access"]) {
  held(
    tabs.includes(named) && detailedProse.includes(`**${named}**`),
    `llmdetailed.txt: the "${named}" tab it names exists on the page`
  );
}

/* The three ways in, and which one needs which browser. Recommending "Watch a
   file" without saying it is Chromium-only is how a reader concludes the page
   is broken. */
held(
  /File System Access API/.test(detailedProse) && /Watch a file/.test(detailedProse),
  "llmdetailed.txt: says which browsers can watch a file"
);
const modelViewer = readFileSync(join(ROOT, "website", "viewers", "model-viewer.js"), "utf-8");
held(
  modelViewer.includes("showOpenFilePicker"),
  "the viewers really gate watching on the File System Access API"
);

/* The claim that makes the viewers worth pointing at: they read the model with
   the generator's own code, so their verdict is the checker's verdict. */
held(
  /same parser, rule compiler, workflow compiler and RBAC derivation the generator/.test(
    detailedProse
  ),
  "llmdetailed.txt: says the viewers read the model with the generator's own code"
);
const viewerEntry = readFileSync(join(ROOT, "packages/generator/src/browser/viewers.ts"), "utf-8");
held(
  viewerEntry.includes("checker.entry") && viewerEntry.includes("../viewers"),
  "the viewer bundle really re-exports the published checker and the pipeline's reading"
);

console.log(failed === 0 ? "\nllmtext claims hold." : `\n${failed} claim(s) contradicted.`);
process.exit(failed === 0 ? 0 : 1);
