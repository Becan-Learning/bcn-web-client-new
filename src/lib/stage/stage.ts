import { opSchemaFor, type Op, type Region } from "./op";

/* حالة المسرح (Stage): طيّ نقيّ لسلسلة Ops. لا يعرف الشبكة ولا الرسم.
   Op غير صالح يُتخطّى بتحذير في الـconsole ولا يُسقط المسرح. */

/** What is drawn: the elements that `add` Ops put on the Stage. A `clear` removes them. */
export type StageElement = Extract<Op, { op: "add" }>;

export type StageState = {
  readonly elements: readonly StageElement[];
};

export const EMPTY_STAGE: StageState = { elements: [] };

/** Apply one Op, as it arrived off the wire. Anything that is not a valid new Op leaves the state as it was.
    `clear` removes every element of its layer; clearing an empty or unknown layer changes nothing. */
export function applyOp(state: StageState, raw: unknown): StageState {
  const parsed = opSchemaFor(raw).safeParse(raw);
  if (!parsed.success) {
    console.warn("stage: skipped an invalid op", parsed.error.issues[0]?.message, raw);
    return state;
  }
  const op = parsed.data;
  if (op.op === "clear") {
    const kept = state.elements.filter((element) => element.layer !== op.layer);
    return kept.length === state.elements.length ? state : { elements: kept };
  }
  if (state.elements.some((element) => element.id === op.id)) {
    console.warn("stage: skipped an op with a duplicate id", op.id);
    return state;
  }
  return { elements: [...state.elements, op] };
}

export function foldOps(ops: readonly unknown[], from: StageState = EMPTY_STAGE): StageState {
  return ops.reduce<StageState>(applyOp, from);
}

export function elementsIn(state: StageState, region: Region, layer?: string): StageElement[] {
  return state.elements.filter(
    (element) => element.region === region && (layer === undefined || element.layer === layer),
  );
}
