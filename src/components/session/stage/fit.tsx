"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { planFit } from "@/lib/stage/fit";

/* يحتوي عنصرًا لا يلتفّ (معادلة، اشتقاق) في عرض منطقته: يقيس عرضه الطبيعي بخطّ كامل،
   فيصغّره حتى حدّ أدنى (`planFit`) ثم يسمح له بالالتفاف (`data-wrap`، وقواعده في globals.css).
   يضبط `--fit` و`data-wrap` على العنصر مباشرة لا عبر state، فلا إعادة رسم ولا وميض. */

export function Fit({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const target = ref.current;
    if (!target) return;
    const fit = () => {
      target.removeAttribute("data-wrap");
      target.style.setProperty("--fit", "1");
      const plan = planFit(target.scrollWidth, target.clientWidth);
      target.style.setProperty("--fit", String(plan.scale));
      if (plan.wrap) target.setAttribute("data-wrap", "true");
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-fit
      className={`group min-w-0 max-w-full overflow-x-auto overflow-y-hidden ${className}`}
    >
      <div className="[font-size:calc(var(--fit,1)*1em)]">{children}</div>
    </div>
  );
}
