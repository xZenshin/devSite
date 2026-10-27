import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageView } from "@/components/page-view";
import { getPage } from "@/lib/site";

export const metadata: Metadata = { title: "Quick facts" };

export default async function AboutPage() {
  const page = await getPage("/about");
  if (!page) notFound();
  return <PageView page={page} label="about" />;
}
