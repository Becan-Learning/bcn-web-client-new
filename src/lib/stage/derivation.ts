/* خطوات الاشتقاق (derivation): كل خطوة تُقسم عند أول علاقة (=، <، \le …) خارج الأقواس
   فيصطف الطرفان في أعمدة مشتركة بين الخطوات. `&` صريحة في المصدر تتقدّم على البحث عن علاقة. */

export type StepSplit =
  /** `lhs` goes in the first column, `rhs` (starting with the relation) in the second. */
  | { aligned: true; lhs: string; rhs: string }
  /** No relation found: the whole step is one centered cell. */
  | { aligned: false; whole: string };

const RELATION_COMMANDS = new Set([
  "ne", "neq", "le", "leq", "ge", "geq", "ll", "gg", "approx", "equiv", "sim", "simeq", "cong",
  "propto", "implies", "iff", "Rightarrow", "Leftarrow", "Leftrightarrow", "rightarrow",
  "leftarrow", "leftrightarrow", "Longrightarrow", "longrightarrow",
]);

export function splitStep(tex: string): StepSplit {
  let depth = 0;
  let relation = -1;
  for (let i = 0; i < tex.length; i++) {
    const c = tex[i]!;
    if (c === "\\") {
      const name = /^\\([A-Za-z]+|.)/.exec(tex.slice(i))?.[1] ?? "";
      if (name === "left") depth++;
      else if (name === "right") depth = Math.max(0, depth - 1);
      else if (depth === 0 && relation === -1 && RELATION_COMMANDS.has(name)) relation = i;
      i += name.length; // the backslash is the loop's own step
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      if (c === "&") return { aligned: true, lhs: tex.slice(0, i).trim(), rhs: tex.slice(i + 1).trim() };
      if (relation === -1 && (c === "=" || c === "<" || c === ">")) relation = i;
    }
  }
  if (relation === -1) return { aligned: false, whole: tex.trim() };
  return { aligned: true, lhs: tex.slice(0, relation).trim(), rhs: tex.slice(relation).trim() };
}
