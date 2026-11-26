/* VENDORED COPY. Do not edit here.
   Source: Becan-Learning/bcn-lk-agent-new, scene-engine/src/op.ts
   Commit: 3ffa0498872d66369b59483fc740374bf1973880
   CONTRACT_VERSION: 1 (docs/contract.md in the agent repo)
   Re-vendor by copying the file as is, together with scene-engine/fixtures/*.jsonl,
   and update this header. */
/**
 * The Op schema: the source of truth for what travels on the `scene` text stream.
 *
 * Contract version 1 (see docs/contract.md). Only one element kind exists so far: `note`.
 * The web client vendors a copy of this file; keep it free of imports other than zod, and use
 * only the zod API that exists in both zod 3.25 and zod 4.
 */
import { z } from "zod";

export const CONTRACT_VERSION = 1;

/** Named regions of the Stage. Version 1 draws in `notes` only. */
export const REGIONS = ["notes"] as const;
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

export const NotePropsSchema = z
  .object({
    /** Short Arabic text. Latin runs inside it are shown left-to-right by the renderer. */
    text: z.string().min(1).max(400),
  })
  .strict();
export type NoteProps = z.infer<typeof NotePropsSchema>;

/** Add one element to the Scene. */
export const AddNoteOpSchema = z
  .object({
    op: z.literal("add"),
    id: ElementIdSchema,
    kind: z.literal("note"),
    region: z.literal("notes"),
    /** `scene` for the explanation; later tickets add answer layers such as `answer:sp_42`. */
    layer: z.string().min(1).max(64),
    props: NotePropsSchema,
    /** One line saying what the element means; used by the Scene digest. */
    meaning: z.string().min(1).max(200),
    anchor: AnchorSchema,
  })
  .strict();

/** Every Op. A single member for now; later tickets turn this into a union. */
export const OpSchema = AddNoteOpSchema;
export type Op = z.infer<typeof OpSchema>;

/** Parse one line of the `scene` text stream. Throws on invalid JSON or an invalid Op. */
export function parseOpLine(line: string): Op {
  return OpSchema.parse(JSON.parse(line));
}
