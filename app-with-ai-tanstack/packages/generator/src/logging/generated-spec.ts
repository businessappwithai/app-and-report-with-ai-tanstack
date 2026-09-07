/**
 * The log spec a generated application ships with.
 *
 * Derived from the canonical `packages/core/src/logging/log-spec.json` at
 * generation time rather than kept as a second copy under `templates/`. A
 * template would be a duplicate, and duplicates of a specification drift in the
 * direction nobody notices: the generator would go on compiling against one
 * catalogue while every application it wrote used another.
 *
 * Imported by relative path because the exports map for `@appwithai/core`
 * points at built JavaScript, and reaching the JSON through it would pull the
 * Pino-backed runtime into a module the browser bundle compiles. The same
 * pattern already carries `appwithai-language.json` into `browser/full-stack.ts`.
 *
 * What is filtered out: channels whose `surfaces` do not include `generated`.
 * A generated application has no code-generation pipeline and makes no model
 * calls, so shipping it `pipeline.*` and `ai.*` would hand its operator a
 * catalogue of events that can never appear.
 */

import canonical from "../../../core/src/logging/log-spec.json" with { type: "json" };

interface SpecChannel {
  name: string;
  description: string;
  level: string;
  surfaces: string[];
}

interface SpecEvent {
  id: string;
  channel: string;
  level: string;
  message: string;
  fields: string[];
}

interface Spec {
  specVersion: string;
  description: string;
  levels: Record<string, number>;
  environments: Record<string, { level: string; pretty: boolean }>;
  transport: Record<string, unknown>;
  redact: { censor: string; paths: string[] };
  channels: SpecChannel[];
  events: SpecEvent[];
}

const SURFACE = "generated";

/**
 * The spec as a generated application's `log-spec.json`, ready to write.
 *
 * Returned as text rather than an object so the caller writes it verbatim;
 * re-serialising it somewhere else is how the file's formatting would end up
 * depending on which code path wrote it.
 */
export function generatedLogSpec(): string {
  const spec = canonical as unknown as Spec;

  const channels = spec.channels.filter((channel) => channel.surfaces.includes(SURFACE));
  const kept = new Set(channels.map((channel) => channel.name));

  const shipped = {
    specVersion: spec.specVersion,
    description:
      "The log specification for this application. Levels, channels, messages and " +
      "redaction are declared here; the code names an event id and this file decides " +
      "the rest. Generated from the APPWITHAI canonical specification — edit it to " +
      "change what this application logs.",
    levels: spec.levels,
    environments: spec.environments,
    transport: spec.transport,
    redact: spec.redact,
    channels: channels.map(({ surfaces: _surfaces, ...channel }) => channel),
    events: spec.events.filter((event) => kept.has(event.channel)),
  };

  return `${JSON.stringify(shipped, null, 2)}\n`;
}

/** The channels a generated application logs on, for tests and for the manual. */
export function generatedChannels(): string[] {
  return (canonical as unknown as Spec).channels
    .filter((channel) => channel.surfaces.includes(SURFACE))
    .map((channel) => channel.name);
}

/** The event ids a generated application may emit. */
export function generatedEventIds(): string[] {
  const kept = new Set(generatedChannels());
  return (canonical as unknown as Spec).events
    .filter((event) => kept.has(event.channel))
    .map((event) => event.id);
}
