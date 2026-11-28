/* VENDORED COPY. Do not edit here.
   Source: Becan-Learning/bcn-lk-agent-new, scene-engine/src/ops/text.ts
   Commit: 9d987e8910b58366feacdd1e61b87fa21edc206b
   CONTRACT_VERSION: 4 (docs/contract.md in the agent repo)
   Re-vendor by copying op.ts, scene-state.ts and ops/*.ts as they are, dropping the ".js" suffix on
   their relative imports, together with scene-engine/fixtures/*.jsonl, and update this header. */
/**
 * Element kinds for the `board` and `notes` regions: `note`, `text`, `tex` and `derivation`.
 *
 * Only the kind-specific pieces live here: the props schemas, the rich-text syntax and the
 * region each kind may use. The shared Op envelope (id, layer, meaning, anchor) is in `op.ts`,
 * which composes these into the `add` Ops.
 *
 * Vendored into the web client next to `op.ts`. Keep it free of imports other than zod, and use
 * only the zod API that exists in both zod 3.25 and zod 4.
 */
import { z } from "zod";

/** Regions that `text`, `tex` and `derivation` may be added to. */
export const TEXT_REGIONS = ["board", "notes"] as const;
export const TextRegionSchema = z.enum(TEXT_REGIONS);
export type TextRegion = z.infer<typeof TextRegionSchema>;

export const MAX_NOTE_LENGTH = 400;
export const MAX_TEXT_LENGTH = 600;
export const MAX_TEX_LENGTH = 400;
export const MAX_COMMENT_LENGTH = 160;
export const MAX_DERIVATION_STEPS = 12;

// ---- rich text ----------------------------------------------------------------------------
//
// Rich text is a plain string. `$...$` is inline math (KaTeX source); write `\$` for a literal
// dollar sign. Latin runs (symbols, numbers, formulas) outside `$...$` need no markup: the
// renderer isolates them left-to-right inside the Arabic.

export type RichSegment = { type: "text"; text: string } | { type: "math"; tex: string };

interface Scan {
  segments: RichSegment[];
  /** Set when a `$` did not open a closed, non-empty `$...$` pair. */
  problem: string | null;
}

function scan(source: string): Scan {
  const segments: RichSegment[] = [];
  let problem: string | null = null;
  let buffer = "";
  const flush = () => {
    if (buffer !== "") segments.push({ type: "text", text: buffer });
    buffer = "";
  };
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    if (c === "\\" && source[i + 1] === "$") {
      buffer += "$";
      i += 2;
      continue;
    }
    if (c === "$") {
      let j = i + 1;
      let close = -1;
      while (j < source.length) {
        if (source[j] === "\\") j += 2;
        else if (source[j] === "$") {
          close = j;
          break;
        } else j++;
      }
      if (close > i + 1) {
        flush();
        segments.push({ type: "math", tex: source.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
      if (close === i + 1) {
        problem = problem ?? "an empty $$ pair";
        buffer += "$$";
        i += 2;
        continue;
      }
      problem = problem ?? "a $ is never closed";
    }
    buffer += c;
    i++;
  }
  flush();
  return { segments, problem };
}

/** Split rich text into plain and inline-math segments. Never throws: a stray `$` stays literal. */
export function splitRichText(source: string): RichSegment[] {
  return scan(source).segments;
}

/** What is wrong with the rich text's `$` markup, or null when it is fine. */
export function richTextProblem(source: string): string | null {
  return scan(source).problem;
}

const nonBlank = (s: string) => s.trim().length > 0;
const MARKUP_MESSAGE = "unclosed or empty $...$ (write \\$ for a literal dollar sign)";

const richText = (max: number) =>
  z
    .string()
    .max(max)
    .refine(nonBlank, { message: "must not be blank" })
    .refine((s) => richTextProblem(s) === null, { message: MARKUP_MESSAGE });

// ---- props ---------------------------------------------------------------------------------

export const NOTE_TONES = ["key", "warning"] as const;

export const NotePropsSchema = z
  .object({
    /** Short Arabic rich text. Latin and math runs are shown left-to-right by the renderer. */
    text: richText(MAX_NOTE_LENGTH),
    /** Absent for a plain note; `key` marks the point to remember, `warning` a common mistake. */
    tone: z.enum(NOTE_TONES).optional(),
  })
  .strict();
export type NoteProps = z.infer<typeof NotePropsSchema>;

export const TEXT_SIZES = ["title", "body"] as const;

export const TextPropsSchema = z
  .object({
    /** Arabic rich text. */
    text: richText(MAX_TEXT_LENGTH),
    /** `body` when absent. */
    size: z.enum(TEXT_SIZES).optional(),
  })
  .strict();
export type TextProps = z.infer<typeof TextPropsSchema>;

/** KaTeX source, rendered with `trust: false`. Bounded; the browser shows the source if it does not parse. */
export const TexSourceSchema = z
  .string()
  .max(MAX_TEX_LENGTH)
  .refine(nonBlank, { message: "must not be blank" });

export const TexPropsSchema = z.object({ tex: TexSourceSchema }).strict();
export type TexProps = z.infer<typeof TexPropsSchema>;

export const DerivationStepSchema = z
  .object({
    tex: TexSourceSchema,
    /** A short Arabic comment on the step, as rich text. */
    comment: richText(MAX_COMMENT_LENGTH).optional(),
  })
  .strict();
export type DerivationStep = z.infer<typeof DerivationStepSchema>;

export const DerivationPropsSchema = z
  .object({ steps: z.array(DerivationStepSchema).min(1).max(MAX_DERIVATION_STEPS) })
  .strict();
export type DerivationProps = z.infer<typeof DerivationPropsSchema>;
