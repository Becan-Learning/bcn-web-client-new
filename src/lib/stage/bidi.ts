/* نص عربي فيه مقاطع لاتينية (رموز، معادلات، أرقام): كل مقطع منها يُعزل
   فيُعرض من اليسار إلى اليمين. الأرقام غربية 0–9 دائمًا، فهي من المقطع اللاتيني. */

export type TextRun = { text: string; ltr: boolean };

const LATIN_RUN = /[([{]*[A-Za-z0-9][A-Za-z0-9²³⁴+\-−×÷=<>.,:;^_/*()[\]{}'| ]*/g;

export function splitLatinRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let cursor = 0;
  const push = (value: string, ltr: boolean) => {
    if (value) runs.push({ text: value, ltr });
  };
  for (const match of text.matchAll(LATIN_RUN)) {
    // Trailing spaces and sentence punctuation belong to the surrounding text, not the run.
    const run = match[0].replace(/[\s.,:;'|]+$/, "");
    push(text.slice(cursor, match.index), false);
    push(run, true);
    cursor = match.index + run.length;
  }
  push(text.slice(cursor), false);
  return runs;
}
