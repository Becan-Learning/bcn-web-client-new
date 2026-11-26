/* VENDORED COPY. Do not edit here.
   Source: Becan-Learning/bcn-lk-agent-new, scene-engine/src/op.ts
   Commit: 1cedfa67e89d5a32eb187a2c1c3285b66e642c74
   CONTRACT_VERSION: 2 (docs/contract.md in the agent repo)
   Re-vendor by copying op.ts and ops/*.ts as they are, dropping the ".js" suffix on their relative
   imports, together with scene-engine/fixtures/*.jsonl, and update this header. */
/**
 * The Op schema: the source of truth for what travels on the `scene` text stream.
 *
 * Contract version 2 (see docs/contract.md). Element kinds so far: `note`, `text`, `tex`, `derivation` (ops/text.ts) and `axes`, `plot`, `dot`,
 * `line`, `arrow`, `shape` (ops/figure.ts).
 * The web client vendors a copy of this file; keep it free of imports other than zod, and use
 * only the zod API that exists in both zod 3.25 and zod 4.
 */
import { z } from "zod";
import {
  AxesPropsSchema,
  DotPropsSchema,
  FigureRegionSchema,
  LinePropsSchema,
  PlotPropsSchema,
  ShapePropsSchema,
} from "./ops/figure";
import {
  DerivationPropsSchema,
  NotePropsSchema,
  TexPropsSchema,
  TextPropsSchema,
  TextRegionSchema,
} from "./ops/text";

export const CONTRACT_VERSION = 2;

/** Named regions of the Stage. */
export const REGIONS = ["board", "notes", "figure"] as const;
export const RegionSchema = z.enum(REGIONS);
export type Region = z.infer<typeof RegionSchema>;

const idPattern = /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/;

/** A stable element id, for example `note-1`. */
export const ElementIdSchema = z.string().regex(idPattern);

/** Where in the narration the Op was written: the speech id and the character offset. */
export const AnchorSchema = z
  .object({
    speech: z.string().min(1).max(64),
    char: z.number().int().min(0),
  })
  .strict();
export type Anchor = z.infer<typeof AnchorSchema>;

/** The envelope every `add` Op shares; each kind brings its own `region` and `props` schemas. */
function addOp<K extends string, R extends z.ZodType, P extends z.ZodType>(kind: K, region: R, props: P) {
  return z
    .object({
      op: z.literal("add"),
      id: ElementIdSchema,
      kind: z.literal(kind),
      region,
      /** `scene` for the explanation; later tickets add answer layers such as `answer:sp_42`. */
      layer: z.string().min(1).max(64),
      props,
      /** One line saying what the element means; used by the Scene digest. */
      meaning: z.string().min(1).max(200),
      anchor: AnchorSchema,
    })
    .strict();
}

// Board and notes kinds (ops/text.ts).
export const AddNoteOpSchema = addOp("note", z.literal("notes"), NotePropsSchema);
export const AddTextOpSchema = addOp("text", TextRegionSchema, TextPropsSchema);
export const AddTexOpSchema = addOp("tex", TextRegionSchema, TexPropsSchema);
export const AddDerivationOpSchema = addOp("derivation", TextRegionSchema, DerivationPropsSchema);

// Figure kinds (ops/figure.ts): placed in math coordinates of an axes.
export const AddAxesOpSchema = addOp("axes", FigureRegionSchema, AxesPropsSchema);
export const AddPlotOpSchema = addOp("plot", FigureRegionSchema, PlotPropsSchema);
export const AddDotOpSchema = addOp("dot", FigureRegionSchema, DotPropsSchema);
export const AddLineOpSchema = addOp("line", FigureRegionSchema, LinePropsSchema);
export const AddArrowOpSchema = addOp("arrow", FigureRegionSchema, LinePropsSchema);
export const AddShapeOpSchema = addOp("shape", FigureRegionSchema, ShapePropsSchema);

/** Every Op: add one element to the Scene. Each ticket adds its members here. */
export const OpSchema = z.discriminatedUnion("kind", [
  AddNoteOpSchema,
  AddTextOpSchema,
  AddTexOpSchema,
  AddDerivationOpSchema,
  AddAxesOpSchema,
  AddPlotOpSchema,
  AddDotOpSchema,
  AddLineOpSchema,
  AddArrowOpSchema,
  AddShapeOpSchema,
]);
export type Op = z.infer<typeof OpSchema>;

/** Parse one line of the `scene` text stream. Throws on invalid JSON or an invalid Op. */
export function parseOpLine(line: string): Op {
  return OpSchema.parse(JSON.parse(line));
}
