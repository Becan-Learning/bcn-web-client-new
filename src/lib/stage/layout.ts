/* توزيع مناطق المسرح الثلاث (figure · board · notes). Tailwind بالمتّجه الأول للجوال:
   390 مكدّسة، 768 عمودان، 1120 (xl = 70rem في tokens) كلها جنبًا إلى جنب.
   المنطقة الفارغة لا تُرسم أصلًا، فالباقية تتقاسم العرض. الاتجاه لا يُكتب هنا: لغة المسار تقرّره. */

export const STAGE_LAYOUT = {
  /** Phone: one column, figure on top. From md: figure beside the text column. */
  root: "flex w-full min-w-0 flex-col gap-4 md:flex-row md:items-start",
  figure: "min-w-0 md:flex-1",
  /** Holds board and notes. Stacked until xl, then side by side. */
  text: "flex min-w-0 flex-col gap-4 md:flex-1 xl:flex-[2] xl:flex-row xl:items-start",
  board: "min-w-0 xl:flex-1",
  notes: "min-w-0 xl:flex-1",
} as const;
