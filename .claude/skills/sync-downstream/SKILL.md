---
name: sync-downstream
description: Carry a new commit of businessappwithai/app-with-ai-tanstack into the two repositories that read it — this orchestrator and businessappwithai.github.io. Use when the generator has been updated and the pin, the canonical language definition, the four protocol documents, the vendored bundles or the published models need to catch up. Triggers: "update the other repos", "sync the downstream repos", "app-with-ai-tanstack has changed", "move the pin".
---

# Syncing the two downstream repositories

`app-with-ai-tanstack` is upstream of both this repository and
`businessappwithai.github.io`. Nothing propagates on its own: every copy is
either pinned, vendored or hand-carried, and the version string is `1.2.0` in
all three language definitions whatever they actually contain. This is the
order that works.

Paths below are written from a checkout root that holds all four repositories
side by side. `$A` is `app-with-ai-tanstack`, `$O` this repository, `$W` the
website.

---

## 0. Find out what actually changed

Do this first. Most upstream commits change nothing either repository carries,
and the work is then only the pin.

```bash
OLD=$(python3 -c "import json;print([d for d in json.load(open('$O/deps.json'))['dependencies'] if d['name']=='app-with-ai-tanstack'][0]['ref'])")
cd $A && git log --oneline $OLD..HEAD | cat
git diff --stat $OLD..HEAD -- language/ website/ html/ examples/ docs/eml-sessions/
```

Only those five directories can reach a downstream repository. A change
anywhere else under `packages/` matters only through the **built bundles**,
which are committed upstream and listed in §3.

**Then check what is already carried rather than assuming.** Earlier sessions
carry work forward, so grep for a marker of each upstream change in each copy
before editing anything:

```bash
for m in <marker> <marker>; do
  for f in $A/website/llmtext/llms-full.txt \
           $O/common/website/llmtext/llms-full.txt \
           $W/llms-full.txt; do
    printf "%-60s " "$f"; grep -qF -- "$m" "$f" && echo yes || echo NO
  done
done
```

---

## 1. Move the pin — `$O/deps.json`

`ref` is the only place any ref lives; every workflow reads it in a `resolve`
job. Replace the `app-with-ai-tanstack` `ref` with the commit you are moving
to, leave `branch` alone, then prove it resolves:

```bash
cd $O && ./deps.sh --install && ./deps.sh --status
```

`--install` installs `app-with-ai-tanstack` only; the line reading
`no install needed (see deps.json)` for the reporting platform is correct.

If the commit is ahead of upstream's `main` (a branch that has not merged yet),
say so in the commit message — a later `./deps.sh --update` resolves `branch`
and would move the pin backwards.

---

## 2. The canonical language definition — `$O/common/language/appwithai-language.json`

**This copy is canonical when the three disagree.** Compare normalized, or the
diff is hundreds of lines of `—`-versus-`—` and compact-versus-expanded
arrays:

```bash
python3 -c "
import json
for s,d in [('$A/language/appwithai-language.json','/tmp/up.json'),
            ('$O/common/language/appwithai-language.json','/tmp/orc.json')]:
    json.dump(json.load(open(s)),open(d,'w'),indent=2,ensure_ascii=False,sort_keys=True)
"
diff /tmp/up.json /tmp/orc.json
```

**Edit it as text, never by re-serialising.** `json.dumps` expands every
compact array and re-escapes every em dash, which buries a ten-line change in
three hundred lines of churn. Replace exact string literals with
`assert s.count(old) == 1` around each one.

Keep this repository's own deltas: `generatorContract.targets`,
`repositoryLayout`, its `common/`-relative paths, its `language.description`,
and any diagnostic-range note that is richer here than upstream.

---

## 3. The built bundles — copy, never rebuild

These are committed upstream. Their bytes depend on the bun version **and the
platform**, so rebuilding them anywhere but where upstream's CI builds commits
bytes that CI will reject.

| To | From |
|---|---|
| `$O/common/html/checker.js` | `$A/html/checker.js` |
| `$O/common/html/fixer.js` | `$A/html/fixer.js` |
| `$O/common/website/viewers/eml-model.js` | `$A/website/viewers/eml-model.js` |
| `$W/guide/checker.js` | `$A/html/checker.js` |
| `$W/guide/fixer.js` | `$A/html/fixer.js` |
| `$W/assets/js/appwithai-wasm.js` | `$A/html/assets/appwithai-wasm.js` |
| `$W/assets/js/appwithai-fullstack.js` | `$A/html/assets/appwithai-fullstack.js` |
| `$W/viewers/eml-model.js` | `$A/website/viewers/eml-model.js` |
| `$W/guide/wasm-app/sw.js` | `$A/html/wasm-app/sw.js` |
| `$W/llmdetailed.txt` | `$A/website/llmtext/llmdetailed.txt` |

**`$W/assets/vendor/stack-templates.json` is the trap.** It is gitignored
upstream, so it is not in the checkout and a `cp` silently skips it — while
`appwithai-fullstack.js` beside it now wants templates the old payload does
not carry. Build it:

```bash
cd $O/app-with-ai-tanstack && bun run build:stack-templates
cp html/assets/stack-templates.json $W/assets/vendor/stack-templates.json
```

The symptom of forgetting is `website-e2e.mjs` dying with `ENOENT` on a
`.hbs` path, or a `carries(...)` assertion reporting the payload "predates the
feature".

**Files with local deltas — check before copying.** `$W/assets/js/run-in-browser.js`
and `run-real-stack.js` carry site-only changes (the `awTrack` lines, the
vendored PGlite shim, `overlay: false`, the extra `BUILT_IN` entries,
`?theme=dark`, the `guide/` import paths). `$W/viewers/index.html` is authored
here, not vendored. If upstream changed either `run-*.js`, re-apply every delta
the website's CLAUDE.md tabulates; if it did not, leave them alone.

---

## 4. The protocol documents

Four per repository, and **two of each four are build outputs**.

- `$O/common/website/llmtext/` — its own bases; hand-carry upstream prose.
- `$W/llmdetailed.txt` — vendored (§3). `$W/llms-full.txt` — **authored here**,
  a language-only rewrite with its own section numbering. Never overwrite it;
  carry the change by hand and expect the anchor text to differ.

Then re-derive both enhancement editions in each repository:

```bash
cd $W
node scripts/build-llmtext-enhancement.mjs          # the site's own pair
O=$O/common/website/llmtext
node scripts/build-llmtext-enhancement.mjs --base $O/llms-full.txt   --protocol batch       --out $O/llmtextenhancement.txt
node scripts/build-llmtext-enhancement.mjs --base $O/llmdetailed.txt --protocol interactive --out $O/llmdetailedenhancement.txt
```

A hand edit to an enhancement edition is lost the next time anyone runs the
deriver, silently, because the output is checked in and reads like a document.

**Re-vendoring `llmdetailed.txt` can break `check-spec.mjs` without either
being wrong.** That check pins the *verbatim wording* of the host-spelling
counter-examples so it can hold them out of its own scan; upstream rewords
them. When it reports stray hosts on lines that are plainly teaching lines,
widen `TEACHING` in `$W/scripts/check-spec.mjs` rather than editing the
vendored document — then prove the check still bites by appending a real bare
host to a document and watching it fail.

---

## 5. The models

- `$O/common/examples/hospital-management-system.mmd` twins
  `$A/examples/hospital-management-system.mmd`. `diff` them; they are meant to
  match.
- `$O/common/{language/examples,html/models}/` must stay byte-identical to each
  other — `check:models` asserts it. **Edit both.**
- `$W/guide/models/crm.eml.mmd` and `drug-discovery.eml.mmd` must stay
  byte-identical to `$A/html/models/`; `dance-studio` twins
  `$A/language/examples/`.
- The site's big `hospital-management-system.eml.mmd` has **diverged from
  upstream on purpose** — it carries the EML287 snake_case repair that
  `$A/docs/eml-sessions/` does not. Do not "re-vendor" it back.

---

## 6. Rebuild what the website derives from the validators

Any change to `$W/guide/checker.js` or `fixer.js` stales three more artifacts:

```bash
cd $W
node scripts/build-validator-source-page.mjs     # guide/source/
node scripts/build-standalone-checker.mjs        # guide/check-model-standalone.mjs
```

---

## 7. Run the checks

Orchestrator — everything but the pack, which needs a PostgreSQL:

```bash
cd $O/common && bun install
bun run check:models && bun run type-check && bun run lint \
  && bun run check:stacks && bun run check:clis && bun run check:pack
cd $O && git status --porcelain     # CI fails on a dirty tree
```

`type-check` reporting TS2307 on `jdm.ts` and `reporting-pack.ts` means the
dependency checkouts are not placed — that is step 1, not a broken repository.

Website — this is `tests.yml`, in order, Node only:

```bash
cd $W
node scripts/check-spec.mjs
node scripts/build-llmtext-enhancement.mjs --check
node scripts/build-validator-source-page.mjs --check
node scripts/check-validator-source-pages.mjs
node scripts/build-standalone-checker.mjs --check
for m in guide/models/*.mmd; do node guide/check-model.mjs "$m" --quiet; done
for m in guide/models/*.mmd; do node guide/audit-model.mjs "$m" --quiet; done   # each must be 22/22
node scripts/website-e2e.mjs
```

---

## 8. Commit and push

Both repositories develop on the branch this session was given. Say in each
commit message what moved upstream and what was carried — and, where a check
was changed rather than a document, why the check was the thing that was wrong.
