import path from "node:path";
import { cacheLife } from "next/cache";
import { loadContent, type Contact, type PageMeta, type ProjectImage, type Section } from "./content";
import { readImageSize } from "./image-size";

export interface PageSection extends Section {
  /** The heading's anchor; the same one citations link to. */
  anchor: string;
}

/** A project image with its pixel size, so its frame can match its shape. */
export interface SiteImage extends ProjectImage {
  width: number;
  height: number;
}

export interface SitePage extends Omit<PageMeta, "images"> {
  sections: PageSection[];
  images: SiteImage[];
}

export interface Site {
  pages: SitePage[];
  contact: Contact;
}

/**
 * Every page and its sections, built from the same parser the assistant uses,
 * so a citation's anchor always exists on the page. Content only changes on
 * deploy, so it is cached for good.
 */
export async function getSite(): Promise<Site> {
  "use cache";
  cacheLife("max");

  const { pages, sections, contact } = await loadContent();
  return {
    contact,
    pages: await Promise.all(pages.map(async (page) => ({
      ...page,
      images: await Promise.all(page.images.map(withSize)),
      // The project overview (no anchor) is rendered from frontmatter in the page header.
      sections: sections
        .filter((section) => section.file === page.file && section.url.includes("#"))
        .map((section) => ({ ...section, anchor: section.url.split("#")[1] })),
    }))),
  };
}

/** Unknown sizes fall back to 16:10; the frame then crops rather than letterboxes. */
async function withSize(image: ProjectImage): Promise<SiteImage> {
  const size = await readImageSize(path.join(process.cwd(), "public", image.src));
  return { ...image, ...(size ?? { width: 1600, height: 1000 }) };
}

export async function getPage(url: string): Promise<SitePage | undefined> {
  return (await getSite()).pages.find((page) => page.url === url);
}

export function projectPages(site: Site): SitePage[] {
  return site.pages.filter((page) => page.url.startsWith("/projects/"));
}
