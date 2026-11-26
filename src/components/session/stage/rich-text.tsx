import { inlineRuns } from "@/lib/stage/rich-text";
import { Tex } from "./math";

/* نص غني: العربي يتبع اتجاه المسار؛ المقاطع اللاتينية (رموز، أرقام، معادلات) تُعزل في
   span باتجاه ltr؛ و`$…$` تُعرض بـKaTeX. أرقام النص كلها غربية. */

export function RichText({ text }: { text: string }) {
  return (
    <>
      {inlineRuns(text).map((run, i) => {
        if (run.type === "math") return <Tex key={i} tex={run.tex} />;
        if (run.type === "ltr")
          return (
            <span key={i} dir="ltr" className="[unicode-bidi:isolate]">
              {run.text}
            </span>
          );
        return <span key={i}>{run.text}</span>;
      })}
    </>
  );
}
