import { splitLatinRuns } from "./bidi";
import { splitRichText } from "./ops/text";

/* نص غني (note/text/تعليق خطوة) → مقاطع جاهزة للعرض. نقيّ، بلا React.
   `$…$` رياضيات KaTeX مضمّنة؛ والمقاطع اللاتينية خارجها (رموز، أرقام، معادلات)
   تُعزل لتُعرض من اليسار إلى اليمين. كل الأرقام غربية 0–9 مهما أرسل المعلّم. */

export type InlineRun =
  | { type: "text"; text: string }
  | { type: "ltr"; text: string }
  | { type: "math"; tex: string };

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits become 0-9. */
export function westernDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));
}

export function inlineRuns(source: string): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const segment of splitRichText(westernDigits(source))) {
    if (segment.type === "math") {
      runs.push({ type: "math", tex: segment.tex });
      continue;
    }
    for (const run of splitLatinRuns(segment.text)) {
      runs.push({ type: run.ltr ? "ltr" : "text", text: run.text });
    }
  }
  return runs;
}
