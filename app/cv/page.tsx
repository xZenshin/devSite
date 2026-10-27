import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageView } from "@/components/page-view";
import { getPage } from "@/lib/site";

export const metadata: Metadata = { title: "CV" };

export default async function CvPage() {
  const page = await getPage("/cv");
  if (!page) notFound();
  return <PageView page={page} />;
}
