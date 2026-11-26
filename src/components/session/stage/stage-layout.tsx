import type { ReactNode } from "react";
import { STAGE_LAYOUT } from "@/lib/stage/layout";

/* مواضع المناطق الثلاث. كل موضع يستقبل عقدة، والفارغ (null) لا يُرسم، فتتقاسم الباقية العرض.
   المنطقة `figure` تُركَّب في موضعها دون مسّ بقية الملف. */

export function StageLayout({
  figure,
  board,
  notes,
}: {
  figure?: ReactNode;
  board?: ReactNode;
  notes?: ReactNode;
}) {
  return (
    <div data-stage-layout className={STAGE_LAYOUT.root}>
      {figure ? (
        <div data-slot="figure" className={STAGE_LAYOUT.figure}>
          {figure}
        </div>
      ) : null}
      {board || notes ? (
        <div data-slot="text" className={STAGE_LAYOUT.text}>
          {board ? (
            <div data-slot="board" className={STAGE_LAYOUT.board}>
              {board}
            </div>
          ) : null}
          {notes ? (
            <div data-slot="notes" className={STAGE_LAYOUT.notes}>
              {notes}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
