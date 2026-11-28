/* VENDORED COPY. Do not edit here.
   Source: Becan-Learning/bcn-lk-agent-new, scene-engine/src/scene-state.ts
   Commit: 9d987e8910b58366feacdd1e61b87fa21edc206b
   CONTRACT_VERSION: 4 (docs/contract.md in the agent repo)
   Re-vendor by copying op.ts, scene-state.ts and ops/*.ts as they are, dropping the ".js" suffix on
   their relative imports, together with scene-engine/fixtures/*.jsonl, and update this header. */
/**
 * What an Op does to a Scene, as a pure fold: the one definition both the Scene Engine (to know
 * what the student sees, for the Scene digest, and to check what the model asks for) and the web
 * client's Stage (to show it) apply.
 *
 * The state is immutable: `applyOp` returns a new state and never changes the one it is given.
 * Vendored into the web client next to `op.ts`. Keep it free of imports other than `op.ts`,
 * `ops/*.ts` and zod's types, and use only what exists in both zod 3.25 and zod 4.
 */
import type { AddOp, Animation, Op } from "./op";
import type { Point } from "./ops/figure";

/** The most Scenes that can be put aside at once. */
export const MAX_ASIDE = 8;

/** An element on the Scene: the `add` Op that made it, with `props` as they are now (after moves). */
export type SceneElement = AddOp;

/** What belongs to one Scene. */
export interface Scene {
  readonly elements: readonly SceneElement[];
  /** Ids of the elements marked with `highlight`. */
  readonly highlighted: readonly string[];
}

/** What the Stage plays on the element a cue names. `fadeOut` and `transform` are the removal of the target. */
export type CueAnimation = Animation | "fadeOut" | "transform";

/**
 * The latest `animate`, `remove` or `transform` Op: what the Stage should play. The element
 * changes (or goes) in the state; the cue tells the Stage how to show it.
 */
export interface Cue {
  /** The id of the Op, so the same animation twice is two cues. */
  readonly op: string;
  readonly target: string;
  readonly animation: CueAnimation;
}

/** The current Scene (`elements`, `highlighted`) and the Scenes put aside, most recent last. */
export interface SceneState extends Scene {
  readonly aside: readonly Scene[];
  readonly cue: Cue | null;
}

export const EMPTY_SCENE_STATE: SceneState = { elements: [], highlighted: [], aside: [], cue: null };

/** Elements an `animate`, `remove`, `move` or `transform` can name: on the current Scene. */
export function findElement(state: Scene, id: string): SceneElement | undefined {
  return state.elements.find((element) => element.id === id);
}

/** The most recently added axes of the current Scene. */
export function lastAxes(state: Scene): Extract<SceneElement, { kind: "axes" }> | undefined {
  for (let i = state.elements.length - 1; i >= 0; i--) {
    const element = state.elements[i]!;
    if (element.kind === "axes") return element;
  }
  return undefined;
}

export function axesOf(state: Scene, id: string): Extract<SceneElement, { kind: "axes" }> | undefined {
  const element = findElement(state, id);
  return element?.kind === "axes" ? element : undefined;
}

/** The figure kinds that sit at a place in math coordinates and can be moved. */
const MOVABLE = new Set(["plot", "dot", "line", "arrow", "shape"]);

/** The point `move({to})` brings to its target, or null for kinds that have no single place. */
export function referencePoint(element: SceneElement): Point | null {
  switch (element.kind) {
    case "dot":
      return element.props.at;
    case "line":
    case "arrow":
      return element.props.from;
    case "shape":
      return element.props.shape === "rect" ? element.props.from : element.props.center;
    default:
      return null;
  }
}

const tidy = (v: number): number => Number(v.toFixed(6));
const shift = (p: Point, by: Point): Point => [tidy(p[0] + by[0]), tidy(p[1] + by[1])];

/** The element moved by `by` in math coordinates. Kinds that cannot move are returned as they are. */
export function translate(element: SceneElement, by: Point): SceneElement {
  switch (element.kind) {
    case "dot":
      return { ...element, props: { ...element.props, at: shift(element.props.at, by) } };
    case "line":
    case "arrow":
      return {
        ...element,
        props: { ...element.props, from: shift(element.props.from, by), to: shift(element.props.to, by) },
      };
    case "plot":
      return {
        ...element,
        props: { ...element.props, segments: element.props.segments.map((seg) => seg.map((p) => shift(p, by))) },
      };
    case "shape":
      return {
        ...element,
        props:
          element.props.shape === "rect"
            ? { ...element.props, from: shift(element.props.from, by), to: shift(element.props.to, by) }
            : { ...element.props, center: shift(element.props.center, by) },
      };
    default:
      return element;
  }
}

function idTaken(state: SceneState, id: string): boolean {
  return (
    state.elements.some((e) => e.id === id) || state.aside.some((scene) => scene.elements.some((e) => e.id === id))
  );
}

function checkAdd(state: SceneState, op: AddOp): string | null {
  if (idTaken(state, op.id)) return `id "${op.id}" is already on the Stage`;
  if ("axes" in op.props && typeof op.props.axes === "string" && !axesOf(state, op.props.axes))
    return `unknown axes "${op.props.axes}": add axes before the elements that use them`;
  return null;
}

/**
 * Why `op` cannot be applied to `state`, or null when it can. Schema checks are separate: this is
 * about references (an id that exists, axes that exist) and limits. An Op that fails is skipped.
 */
export function checkOp(state: SceneState, op: Op): string | null {
  switch (op.op) {
    case "add":
      return checkAdd(state, op);
    case "clear":
      return null;
    case "animate": {
      const target = findElement(state, op.target);
      return target ? null : `unknown element "${op.target}" (it must be on the current Scene)`;
    }
    case "remove": {
      const target = findElement(state, op.target);
      return target ? null : `unknown element "${op.target}" (it must be on the current Scene)`;
    }
    case "move": {
      const target = findElement(state, op.target);
      if (!target) return `unknown element "${op.target}" (it must be on the current Scene)`;
      return MOVABLE.has(target.kind) ? null : `a ${target.kind} cannot be moved: only figure elements have a place`;
    }
    case "transform": {
      const target = findElement(state, op.target);
      if (!target) return `unknown element "${op.target}" (it must be on the current Scene)`;
      if (target.kind === "axes") return "axes cannot be transformed: the elements on them would lose their place";
      if (op.to.region !== target.region) return `a ${target.region} element cannot become a ${op.to.region} element`;
      if (op.to.id === op.target) return "transform needs a new id for the element it becomes";
      return checkAdd({ ...state, elements: state.elements.filter((e) => e.id !== op.target) }, op.to);
    }
    case "scene":
      if (op.action === "new") return state.aside.length < MAX_ASIDE ? null : `at most ${MAX_ASIDE} Scenes can be put aside`;
      return state.aside.length > 0 ? null : "no Scene is put aside";
  }
}

/** Apply `op`. It must pass `checkOp`; an Op that does not leaves the state as it was. */
export function applyOp(state: SceneState, op: Op): SceneState {
  if (checkOp(state, op) !== null) return state;
  switch (op.op) {
    case "add":
      return { ...state, elements: [...state.elements, op] };
    case "clear": {
      const keep = new Set(op.keep ?? []);
      const elements = state.elements.filter((e) => e.layer !== op.layer || keep.has(e.id));
      if (elements.length === state.elements.length) return state;
      const left = new Set(elements.map((e) => e.id));
      return { ...state, elements, highlighted: state.highlighted.filter((id) => left.has(id)) };
    }
    case "animate": {
      const cue: Cue = { op: op.id, target: op.target, animation: op.animation };
      if (op.animation !== "highlight") return { ...state, cue };
      const others = state.highlighted.filter((id) => id !== op.target);
      return { ...state, highlighted: op.off ? others : [...others, op.target], cue };
    }
    case "remove":
      return {
        ...state,
        elements: state.elements.filter((e) => e.id !== op.target),
        highlighted: state.highlighted.filter((id) => id !== op.target),
        cue: { op: op.id, target: op.target, animation: "fadeOut" },
      };
    case "move":
      return {
        ...state,
        elements: state.elements.map((e) => (e.id === op.target ? translate(e, op.by) : e)),
      };
    case "transform":
      return {
        ...state,
        elements: state.elements.map((e) => (e.id === op.target ? op.to : e)),
        highlighted: state.highlighted.filter((id) => id !== op.target),
        cue: { op: op.id, target: op.target, animation: "transform" },
      };
    case "scene":
      if (op.action === "new")
        return {
          elements: [],
          highlighted: [],
          aside: [...state.aside, { elements: state.elements, highlighted: state.highlighted }],
          cue: null,
        };
      return {
        elements: state.aside[state.aside.length - 1]!.elements,
        highlighted: state.aside[state.aside.length - 1]!.highlighted,
        aside: state.aside.slice(0, -1),
        cue: null,
      };
  }
}
