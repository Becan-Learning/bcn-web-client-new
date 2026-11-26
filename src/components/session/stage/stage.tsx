import { useTranslations } from "next-intl";
import { elementsIn, type StageState } from "@/lib/stage/stage";
import { StageItem } from "./elements";
import { StageLayout } from "./stage-layout";

/* المسرح (Stage): يعرض ما رسمه المعلّم في ثلاث مناطق: figure (قريبًا) وboard وnotes.
   الاتجاه يتبع لغة المسار ولا يُكتب على أي حاوية. المنطقة التي لا عناصر فيها لا تُرسم. */

function Region({
  name,
  label,
  elements,
}: {
  name: "board" | "notes";
  label: string;
  elements: ReturnType<typeof elementsIn>;
}) {
  return (
    <>
      <h2 className="mb-3 text-sm font-semibold text-ink-2">{label}</h2>
      <ul data-region={name} className="flex flex-col gap-3">
        {elements.map((element) => (
          <StageItem key={element.id} element={element} />
        ))}
      </ul>
    </>
  );
}

export function Stage({ state }: { state: StageState }) {
  const t = useTranslations("Demo.stage");
  const board = elementsIn(state, "board");
  const notes = elementsIn(state, "notes");

  return (
    <section aria-label={t("label")} data-stage className="w-full">
      {state.elements.length === 0 ? (
        <p data-stage-empty className="rounded-md bg-panel px-4 py-3 text-ink-2">
          {t("empty")}
        </p>
      ) : (
        <StageLayout
          board={board.length > 0 ? <Region name="board" label={t("board")} elements={board} /> : null}
          notes={notes.length > 0 ? <Region name="notes" label={t("notes")} elements={notes} /> : null}
        />
      )}
    </section>
  );
}
