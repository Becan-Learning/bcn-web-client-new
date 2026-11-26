import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { firstParam, isDemoAvailable, parseServerUrl } from "./availability";
import { DemoSession } from "./demo-session";

/* تجربة المعلّم الجديد: تقرأ `url` و`token` من الرابط وتنضم إلى الغرفة.
   لا تنادي الخادم الخلفي ولا تُصدر رموزًا (ADR 0004): الرمز يصدر من أمر
   المطوّر في مستودع الوكيل. خارج المسارات التي يحرسها `proxy.ts`. */

export async function generateMetadata(props: PageProps<"/[locale]/demo">): Promise<Metadata> {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Demo" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function DemoPage(props: PageProps<"/[locale]/demo">) {
  if (!isDemoAvailable(process.env.NODE_ENV, process.env.NEXT_PUBLIC_DEMO)) notFound();
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const search = await props.searchParams;
  const url = parseServerUrl(firstParam(search.url));
  const token = firstParam(search.token);

  return <DemoSession url={url} token={token} />;
}
