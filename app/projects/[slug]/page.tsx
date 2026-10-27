import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageView } from "@/components/page-view";
import { getPage, getSite, projectPages } from "@/lib/site";

export async function generateStaticParams() {
  return projectPages(await getSite()).map((page) => ({ slug: page.url.split("/").at(-1)! }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const page = await getPage(`/projects/${(await params).slug}`);
  return page ? { title: page.title, description: page.summary } : {};
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const page = await getPage(`/projects/${(await params).slug}`);
  if (!page) notFound();

  return (
    <>
      <p className="mb-6">
        <Link href="/#projects" className="text-ink-muted hover:text-ink">
          All projects
        </Link>
      </p>
      <PageView page={page} />
    </>
  );
}
