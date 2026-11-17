import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageView } from "@/components/page-view";
import { getPage, getSite, projectPages } from "@/lib/site";

type Params = PageProps<"/projects/[slug]">["params"];

export async function generateStaticParams() {
  return projectPages(await getSite()).map((page) => ({ slug: page.url.split("/").at(-1)! }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const page = await getPage(`/projects/${(await params).slug}`);
  return page ? { title: page.title, description: page.summary } : {};
}

/**
 * Reading `params` waits on the URL, so it happens inside <Suspense>: navigation
 * shows the placeholder at once instead of blocking until the page is ready.
 */
export default function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  return (
    <Suspense fallback={<ProjectPlaceholder />}>
      <Project params={params} />
    </Suspense>
  );
}

async function Project({ params }: { params: Params }) {
  const { slug } = await params;
  const page = await getPage(`/projects/${slug}`);
  if (!page) notFound();

  const label = (
    <>
      <Link href="/projects" className="text-bone underline decoration-dim underline-offset-4 hover:decoration-bone">
        projects
      </Link>
      /{slug}
    </>
  );
  return <PageView page={page} label={label} />;
}

/** Same outline as the page header, so the content doesn't jump when it arrives. */
function ProjectPlaceholder() {
  return (
    <div aria-busy="true" aria-label="Loading project" className="border-b border-line pt-32 pb-12 sm:pt-40">
      <div className="h-4 w-40 animate-pulse bg-line" />
      <div className="mt-5 h-[clamp(2.5rem,8vw,6.75rem)] w-3/4 animate-pulse bg-line" />
      <div className="mt-8 h-5 w-1/2 animate-pulse bg-line" />
    </div>
  );
}
