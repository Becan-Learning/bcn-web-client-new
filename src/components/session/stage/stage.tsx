"use client";

import { AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { leavingId } from "@/lib/stage/animation";
import { elementsIn, type StageState } from "@/lib/stage/stage";
import { StageItem } from "./elements";
import { FigureRegion } from "./figure-region";
import { StageSceneProvider, type StageSceneInfo } from "./motion-context";
import { StageLayout } from "./stage-layout";

/* المسرح (Stage): يعرض ما رسمه المعلّم في ثلاث مناطق: figure وboard وnotes.
   الاتجاه يتبع لغة المسار ولا يُكتب على أي حاوية. المنطقة التي لا عناصر فيها لا تُرسم.

   مشهد واحد حاضر في كل لحظة. حين يُزاح مشهد جانبًا أو يُستعاد يتبدّل عمق المشاهد المزاحة،
   فيُعاد بناء الشجرة (`key`) بلا حركات خروج؛ وعناصر المشهد المستعاد تُرسم في حالتها كما كانت،
   فلا تُعيد حركة دخولها. */

function Region({
  name,
  label,
  elements,
  leaving,
}: {
  name: "board" | "notes";
  label: string;
  elements: ReturnType<typeof elementsIn>;
  leaving: string | null;
}) {
  return (
    <>
      <h2 className="mb-3 text-sm font-semibold text-ink-2">{label}</h2>
      <ul data-region={name} className="flex flex-col gap-3">
        <AnimatePresence custom={leaving}>
          {elements.map((element) => (
            <StageItem key={element.id} element={element} />
          ))}
        </AnimatePresence>
      </ul>
    </>
  );
}

function StageScene({ state, restored }: { state: StageState; restored: ReadonlySet<string> }) {
  const t = useTranslations("Demo.stage");
  const figure = elementsIn(state, "figure");
  const board = elementsIn(state, "board");
  const notes = elementsIn(state, "notes");
  const info: StageSceneInfo = {
    cue: state.cue,
    highlighted: new Set(state.highlighted),
    leaving: leavingId(state.cue),
    restored,
  };

  return (
    <StageSceneProvider value={info}>
      <StageLayout
        figure={figure.length > 0 ? <FigureRegion elements={figure} /> : null}
        board={
          board.length > 0 ? <Region name="board" label={t("board")} elements={board} leaving={info.leaving} /> : null
        }
        notes={
          notes.length > 0 ? <Region name="notes" label={t("notes")} elements={notes} leaving={info.leaving} /> : null
        }
      />
    </StageSceneProvider>
  );
}

export function Stage({ state }: { state: StageState }) {
  const t = useTranslations("Demo.stage");
  const depth = state.aside.length;
  // When a Scene is put aside or restored, the elements now shown (a restored Scene's, or none)
  // are drawn as they are, without their entrance. Derived during render, not in an effect.
  const [shown, setShown] = useState<{ depth: number; restored: ReadonlySet<string> }>({
    depth,
    restored: new Set(),
  });
  let restored = shown.restored;
  if (shown.depth !== depth) {
    restored = new Set(state.elements.map((element) => element.id));
    setShown({ depth, restored });
  }

  return (
    <section aria-label={t("label")} data-stage className="w-full">
      {state.elements.length === 0 ? (
        <p data-stage-empty className="rounded-md bg-panel px-4 py-3 text-ink-2">
          {t("empty")}
        </p>
      ) : null}
      {state.elements.length === 0 ? null : <StageScene key={depth} state={state} restored={restored} />}
    </section>
  );
}
