/* VENDORED COPY. Do not edit here.
   Source: Becan-Learning/bcn-lk-agent-new, scene-engine/src/op.ts
   Commit: 667e58154c4789d81b89660380a83408fb63c399
   CONTRACT_VERSION: 3 (docs/contract.md in the agent repo)
   Re-vendor by copying op.ts, scene-state.ts and ops/*.ts as they are, dropping the ".js" suffix on
   their relative imports, together with scene-engine/fixtures/*.jsonl, and update this header. */
/**
 * The Op schema: the source of truth for what travels on the `scene` text stream.
 *
 * Contract version 3 (see docs/contract.md). Operations: `add` (one element, by kind, with an
 * optional entrance animation), `clear` (empty a layer, optionally keeping ids), `animate`
 * (indicate or highlight something already drawn), `remove` (fade an element out), `move`,
 * `transform` (one element into another) and `scene` (put the current Scene aside and open a new
 * one, or restore the Scene put aside). Element kinds so far: `note`, `text`, `tex`,
 * `derivation` (ops/text.ts) and `axes`, `plot`, `dot`, `line`, `arrow`, `shape` (ops/figure.ts).
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
  PointSchema,
  ShapePropsSchema,
} from "./ops/figure";
import {
  DerivationPropsSchema,
  NotePropsSchema,
  TexPropsSchema,
  TextPropsSchema,
  TextRegionSchema,
} from "./ops/text";

export const CONTRACT_VERSION = 3;

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

/**
 * How an element enters. `create`: strokes draw on, a dot pops in. `write`: text reveals along the
 * reading direction (strokes draw on). `fadeIn`: opacity. Absent: the Stage's default entrance.
 */
export const ENTRANCES = ["create", "write", "fadeIn"] as const;
export const EntranceSchema = z.enum(ENTRANCES);
export type Entrance = z.infer<typeof EntranceSchema>;

/** The envelope every `add` Op shares; each kind brings its own `region` and `props` schemas. */
function addOp<K extends string, R extends z.ZodType, P extends z.ZodType>(kind: K, region: R, props: P) {
  return z
    .object({
      op: z.literal("add"),
      id: ElementIdSchema,
      kind: z.literal(kind),
      region,
      /** `scene` for the explanation; answer layers look like `answer:sp_42`; the model may name others. */
      layer: z.string().min(1).max(64),
      props,
      enter: EntranceSchema.optional(),
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

/** `add`: one element joins the Scene. Each ticket adds its kinds here. */
export const AddOpSchema = z.discriminatedUnion("kind", [
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
export type AddOp = z.infer<typeof AddOpSchema>;

const LayerSchema = z.string().min(1).max(64);

/**
 * `clear`: remove every element of `layer` from the current Scene, whatever its kind or region,
 * except the ids in `keep`. The `id` names this operation (it is not an element), so the engine
 * can confirm or drop it like any other Op.
 */
export const ClearOpSchema = z
  .object({
    op: z.literal("clear"),
    id: ElementIdSchema,
    layer: LayerSchema,
    /** Ids of the layer's elements that stay. Ids that are not in the layer are ignored. */
    keep: z.array(ElementIdSchema).max(64).optional(),
    anchor: AnchorSchema,
  })
  .strict();
export type ClearOp = z.infer<typeof ClearOpSchema>;

/** Animations of something already drawn. `indicate` pulses once; `highlight` marks it until `off`. */
export const ANIMATIONS = ["indicate", "highlight"] as const;
export const AnimationSchema = z.enum(ANIMATIONS);
export type Animation = z.infer<typeof AnimationSchema>;

export const AnimateOpSchema = z
  .object({
    op: z.literal("animate"),
    id: ElementIdSchema,
    target: ElementIdSchema,
    animation: AnimationSchema,
    /** `highlight` only: take the highlight away again. */
    off: z.boolean().optional(),
    anchor: AnchorSchema,
  })
  .strict()
  .refine((op) => op.off === undefined || op.animation === "highlight", {
    message: "off belongs to highlight only",
  });
export type AnimateOp = z.infer<typeof AnimateOpSchema>;

/** `remove`: the target fades out and leaves the Scene. */
export const RemoveOpSchema = z
  .object({ op: z.literal("remove"), id: ElementIdSchema, target: ElementIdSchema, anchor: AnchorSchema })
  .strict();
export type RemoveOp = z.infer<typeof RemoveOpSchema>;

/** `move`: translate a figure element by `by`, in the math coordinates of its axes. */
export const MoveOpSchema = z
  .object({ op: z.literal("move"), id: ElementIdSchema, target: ElementIdSchema, by: PointSchema, anchor: AnchorSchema })
  .strict();
export type MoveOp = z.infer<typeof MoveOpSchema>;

/**
 * `transform`: the target becomes the element `to` (a complete `add` Op, with its own new id), in
 * the same place in the region. The target's id leaves the Scene.
 */
export const TransformOpSchema = z
  .object({
    op: z.literal("transform"),
    id: ElementIdSchema,
    target: ElementIdSchema,
    to: AddOpSchema,
    anchor: AnchorSchema,
  })
  .strict();
export type TransformOp = z.infer<typeof TransformOpSchema>;

/**
 * `scene`: `new` puts the current Scene aside, with everything on it, and opens an empty one.
 * `restore` drops the current Scene and brings back the one put aside last, exactly as it was.
 */
export const SCENE_ACTIONS = ["new", "restore"] as const;
export const SceneOpSchema = z
  .object({ op: z.literal("scene"), id: ElementIdSchema, action: z.enum(SCENE_ACTIONS), anchor: AnchorSchema })
  .strict();
export type SceneOp = z.infer<typeof SceneOpSchema>;

/** Every Op. */
export const OpSchema = z.union([
  AddOpSchema,
  ClearOpSchema,
  AnimateOpSchema,
  RemoveOpSchema,
  MoveOpSchema,
  TransformOpSchema,
  SceneOpSchema,
]);
export type Op = z.infer<typeof OpSchema>;
export type OpName = Op["op"];

/**
 * The schema that explains an Op's mistakes best. A plain union reports only "invalid input", so
 * pick the member by `op` first; an `add` is told apart by `kind` inside its own union.
 */
export function opSchemaFor(value: unknown): z.ZodType<Op> {
  const name = typeof value === "object" && value !== null ? (value as { op?: unknown }).op : undefined;
  switch (name) {
    case "clear":
      return ClearOpSchema;
    case "animate":
      return AnimateOpSchema;
    case "remove":
      return RemoveOpSchema;
    case "move":
      return MoveOpSchema;
    case "transform":
      return TransformOpSchema;
    case "scene":
      return SceneOpSchema;
    default:
      return AddOpSchema;
  }
}

/** Parse one line of the `scene` text stream. Throws on invalid JSON or an invalid Op. */
export function parseOpLine(line: string): Op {
  const value: unknown = JSON.parse(line);
  return opSchemaFor(value).parse(value);
}
