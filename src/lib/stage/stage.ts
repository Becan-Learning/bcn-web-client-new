import { opSchemaFor, type Region } from "./op";
import {
  EMPTY_SCENE_STATE,
  applyOp as applyToScene,
  checkOp,
  type SceneElement,
  type SceneState,
} from "./scene-state";

/* حالة المسرح (Stage): طيّ نقيّ لسلسلة Ops. لا يعرف الشبكة ولا الرسم.
   الطيّ نفسه (`scene-state.ts`) هو ما يطبّقه محرّك المشاهد في الوكيل: مشهد واحد حاضر،
   ومشاهد مُزاحة جانبًا تعود كما كانت. Op غير صالح، أو يشير إلى عنصر غير موجود،
   يُتخطّى بتحذير في الـconsole ولا يُسقط المسرح. */

/** What is drawn: the elements that `add` Ops put on the current Scene. */
export type StageElement = SceneElement;

/** The current Scene's `elements` and `highlighted`, the Scenes put `aside`, and the latest animation `cue`. */
export type StageState = SceneState;

export const EMPTY_STAGE: StageState = EMPTY_SCENE_STATE;

/** Apply one Op, as it arrived off the wire. Anything that is not a valid Op for this Stage leaves the state as it was:
    an invalid Op, a duplicate id, an Op that names an element that is not on the current Scene. */
export function applyOp(state: StageState, raw: unknown): StageState {
  const parsed = opSchemaFor(raw).safeParse(raw);
  if (!parsed.success) {
    console.warn("stage: skipped an invalid op", parsed.error.issues[0]?.message, raw);
    return state;
  }
  const op = parsed.data;
  const problem = checkOp(state, op);
  if (problem !== null) {
    console.warn("stage: skipped an op that does not fit the Scene", problem, op.id);
    return state;
  }
  return applyToScene(state, op);
}

export function foldOps(ops: readonly unknown[], from: StageState = EMPTY_STAGE): StageState {
  return ops.reduce<StageState>(applyOp, from);
}

export function elementsIn(state: StageState, region: Region, layer?: string): StageElement[] {
  return state.elements.filter(
    (element) => element.region === region && (layer === undefined || element.layer === layer),
  );
}
