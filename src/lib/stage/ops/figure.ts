/* VENDORED COPY. Do not edit here.
   Source: Becan-Learning/bcn-lk-agent-new, scene-engine/src/ops/figure.ts
   Commit: 667e58154c4789d81b89660380a83408fb63c399
   CONTRACT_VERSION: 3 (docs/contract.md in the agent repo)
   Re-vendor by copying op.ts, scene-state.ts and ops/*.ts as they are, dropping the ".js" suffix on
   their relative imports, together with scene-engine/fixtures/*.jsonl, and update this header. */
/**
 * Element kinds for the `figure` region: `axes`, `plot`, `dot`, `line`, `arrow` and `shape`.
 *
 * Only the kind-specific pieces live here: the props schemas. The shared Op envelope (id, layer,
 * meaning, anchor) is in `op.ts`, which composes these into the `add` Ops.
 *
 * Every element is placed in **math coordinates of the axes it belongs to**. There is no pixel
 * position anywhere in these schemas, and objects are strict, so a stray `left`, `top` or `x` is
 * invalid. Colors are role names the renderer maps to tokens, never raw colors.
 *
 * Vendored into the web client next to `op.ts`. Keep it free of imports other than zod, and use
 * only the zod API that exists in both zod 3.25 and zod 4.
 */
import { z } from "zod";

/** The one region the figure kinds use. */
export const FigureRegionSchema = z.literal("figure");

/** Color roles. The renderer maps each to a token of the identity; the wire never carries a color. */
export const COLOR_ROLES = ["ink", "muted", "accent", "olive"] as const;
export const ColorRoleSchema = z.enum(COLOR_ROLES);
export type ColorRole = z.infer<typeof ColorRoleSchema>;

/** Where a label sits relative to its point: `start` toward smaller x, `end` toward larger x. */
export const LABEL_SIDES = ["above", "below", "start", "end"] as const;
export const LabelSideSchema = z.enum(LABEL_SIDES);
export type LabelSide = z.infer<typeof LabelSideSchema>;

/** A coordinate in the axes' math space. Bounded so a pixel value cannot hide in a huge number. */
const CoordSchema = z.number().min(-1e6).max(1e6);
export const PointSchema = z.tuple([CoordSchema, CoordSchema]);
export type Point = z.infer<typeof PointSchema>;

const RangeSchema = z
  .tuple([CoordSchema, CoordSchema])
  .refine(([min, max]) => min < max, { message: "a range needs min < max" });

/** Text shown in the figure: Arabic with Latin and math runs allowed (shown left-to-right). */
const FigureTextSchema = z.string().min(1).max(80);

/** The axes an element belongs to: an element id (same pattern as `ElementIdSchema` in `op.ts`). */
const axesRef = z.string().regex(/^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/);

export const AxesPropsSchema = z
  .object({
    xRange: RangeSchema,
    yRange: RangeSchema,
    /** Distance between ticks. Chosen from the range when absent. */
    xStep: z.number().positive().max(1e6).optional(),
    yStep: z.number().positive().max(1e6).optional(),
    xLabel: FigureTextSchema.optional(),
    yLabel: FigureTextSchema.optional(),
    grid: z.boolean().optional(),
  })
  .strict();

/** Longest path a plot may carry, in points over all segments. */
export const MAX_PLOT_POINTS = 800;

export const PlotPropsSchema = z
  .object({
    axes: axesRef,
    /** Path data in math coordinates, sampled on the server. A break splits it into segments. */
    segments: z
      .array(z.array(PointSchema).min(2).max(MAX_PLOT_POINTS))
      .min(1)
      .max(32)
      .refine((s) => s.reduce((n, seg) => n + seg.length, 0) <= MAX_PLOT_POINTS, {
        message: `a plot carries at most ${MAX_PLOT_POINTS} points`,
      }),
    color: ColorRoleSchema.optional(),
    dashed: z.boolean().optional(),
  })
  .strict();

export const DotPropsSchema = z
  .object({
    axes: axesRef,
    at: PointSchema,
    /** May contain math text such as `(1, -2)` or `x²`; Latin runs are shown left-to-right. */
    label: FigureTextSchema.optional(),
    side: LabelSideSchema.optional(),
    color: ColorRoleSchema.optional(),
  })
  .strict();

export const LinePropsSchema = z
  .object({
    axes: axesRef,
    from: PointSchema,
    to: PointSchema,
    dashed: z.boolean().optional(),
    color: ColorRoleSchema.optional(),
  })
  .strict();

const shapeBase = { axes: axesRef, color: ColorRoleSchema.optional(), dashed: z.boolean().optional(), filled: z.boolean().optional() };

export const ShapePropsSchema = z.discriminatedUnion("shape", [
  z.object({ ...shapeBase, shape: z.literal("rect"), from: PointSchema, to: PointSchema }).strict(),
  z
    .object({
      ...shapeBase,
      shape: z.literal("circle"),
      center: PointSchema,
      /** In axes units (x units horizontally, y units vertically). */
      radius: z.number().positive().max(1e6),
    })
    .strict(),
]);

export type AxesProps = z.infer<typeof AxesPropsSchema>;
export type PlotProps = z.infer<typeof PlotPropsSchema>;
export type DotProps = z.infer<typeof DotPropsSchema>;
export type LineProps = z.infer<typeof LinePropsSchema>;
export type ShapeProps = z.infer<typeof ShapePropsSchema>;
