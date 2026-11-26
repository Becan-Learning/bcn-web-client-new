"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";
import { westernDigits } from "@/lib/stage/rich-text";

/* KaTeX في المسرح. المصدر نصٌّ من المعلّم، لا يُنفَّذ كشيفرة: `trust` يرفض الروابط
   والصور و`\htmlClass`، وحدّا `maxSize` و`maxExpand` يمنعان تضخيم التخطيط. إن لم يُحلَّل
   المصدر يُعرض كما هو بدل رسالة خطأ KaTeX الملوّنة. */

export function renderTex(tex: string): string | null {
  // KaTeX renders a command it may not trust (`\href`, `\includegraphics`, ...) as red text
  // instead of throwing, so any such request counts as a failure and the source is shown.
  let untrusted = false;
  try {
    const html = katex.renderToString(westernDigits(tex), {
      displayMode: false,
      throwOnError: true,
      trust: () => {
        untrusted = true;
        return false;
      },
      strict: "ignore",
      output: "htmlAndMathml",
      maxSize: 12,
      maxExpand: 200,
    });
    return untrusted ? null : html;
  } catch {
    return null;
  }
}

/** One formula, always left-to-right and isolated from the Arabic around it. */
export function Tex({ tex }: { tex: string }) {
  const html = useMemo(() => renderTex(tex), [tex]);
  if (html === null) {
    return (
      <code
        dir="ltr"
        data-tex-error
        className="inline-block max-w-full whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere] [unicode-bidi:isolate]"
      >
        {westernDigits(tex)}
      </code>
    );
  }
  return <span dir="ltr" data-math className="[unicode-bidi:isolate]" dangerouslySetInnerHTML={{ __html: html }} />;
}
