import { useTranslations } from "next-intl";
import { splitStep } from "@/lib/stage/derivation";
import { proseScale } from "@/lib/stage/fit";
import type { StageElement } from "@/lib/stage/stage";
import { Fit } from "./fit";
import { Tex } from "./math";
import { RichText } from "./rich-text";

/* عناصر مناطق board وnotes. كلها تتدفّق بالترتيب بلا إحداثيات، وتظهر بحركة CSS
   `animate-board-in` التي تتوقّف مع «تقليل الحركة» من القاعدة العامة في globals.css.
   النص الغني يلتفّ بطبيعته (ويصغر قليلًا إن طال)؛ المعادلة والاشتقاق يقيسان أنفسهما في `Fit`. */

const item = "animate-board-in min-w-0";

type Of<K extends StageElement["kind"]> = Extract<StageElement, { kind: K }>;

function proseStyle(text: string) {
  return { fontSize: `calc(${proseScale(text.length)} * 1em)` };
}

function NoteCard({ element }: { element: Of<"note"> }) {
  const t = useTranslations("Demo.stage.tone");
  const { text, tone } = element.props;
  const toneClass =
    tone === "key"
      ? "border-s-4 border-s-warmth"
      : tone === "warning"
        ? "border-s-4 border-s-ink-3"
        : "";
  return (
    <li
      data-element-id={element.id}
      data-kind="note"
      data-tone={tone}
      className={`${item} rounded-md border border-line bg-panel px-4 py-3 text-lg leading-base text-ink ${toneClass}`}
    >
      {tone ? <p className="text-sm font-semibold text-ink-2">{t(tone)}</p> : null}
      <p className="[overflow-wrap:anywhere]" style={proseStyle(text)}>
        <RichText text={text} />
      </p>
    </li>
  );
}

function TextBlock({ element }: { element: Of<"text"> }) {
  const { text, size } = element.props;
  const title = size === "title";
  return (
    <li data-element-id={element.id} data-kind="text" data-size={size} className={`${item} leading-base text-ink`}>
      <p
        className={`[overflow-wrap:anywhere] ${title ? "text-xl font-bold" : "text-lg"}`}
        style={proseStyle(text)}
      >
        <RichText text={text} />
      </p>
    </li>
  );
}

function TexBlock({ element }: { element: Of<"tex"> }) {
  return (
    <li data-element-id={element.id} data-kind="tex" className={`${item} text-ink`}>
      <Fit className="py-1 text-center text-xl md:text-2xl">
        <Tex tex={element.props.tex} />
      </Fit>
    </li>
  );
}

function DerivationBlock({ element }: { element: Of<"derivation"> }) {
  const { steps } = element.props;
  return (
    <li data-element-id={element.id} data-kind="derivation" className={`${item} text-ink`}>
      <Fit className="py-1 text-lg md:text-xl">
        {/* The grid is a math block, so its columns run left-to-right whatever the page direction.
            Each comment keeps the direction of its own text. */}
        <ol
          dir="ltr"
          data-derivation
          className="grid grid-cols-[minmax(0,1fr)_auto_auto_minmax(0,1fr)] gap-y-2 group-data-[wrap=true]:grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,auto)_minmax(0,1fr)]"
        >
          {steps.map((step, i) => {
            const split = splitStep(step.tex);
            return (
              <li key={i} data-step={i + 1} className="col-span-4 grid grid-cols-subgrid gap-y-1">
                {split.aligned ? (
                  <>
                    <span className="col-start-2 min-w-0 justify-self-end">
                      <Tex tex={split.lhs} />
                    </span>
                    <span className="col-start-3 min-w-0 justify-self-start ps-1">
                      <Tex tex={split.rhs} />
                    </span>
                  </>
                ) : (
                  <span className="col-span-2 col-start-2 min-w-0 justify-self-center">
                    <Tex tex={split.whole} />
                  </span>
                )}
                {step.comment ? (
                  <p dir="auto" className="col-span-4 w-0 min-w-full text-center text-sm leading-base text-ink-2 [overflow-wrap:anywhere]">
                    <RichText text={step.comment} />
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Fit>
    </li>
  );
}

export function StageItem({ element }: { element: StageElement }) {
  switch (element.kind) {
    case "note":
      return <NoteCard element={element} />;
    case "text":
      return <TextBlock element={element} />;
    case "tex":
      return <TexBlock element={element} />;
    case "derivation":
      return <DerivationBlock element={element} />;
  }
}
