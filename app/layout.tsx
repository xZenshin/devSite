import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ChatProvider } from "@/components/chat/chat-provider";
import { ChatWidget } from "@/components/chat/chat-widget";
import { Cursor } from "@/components/cursor";
import { MobileNotice } from "@/components/mobile-notice";
import { SectionLink } from "@/components/section-link";
import type { Contact } from "@/lib/content";
import { getSite } from "@/lib/site";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Alexander Skou-Larsen", template: "%s – Alexander Skou-Larsen" },
  description: "Software developer in Copenhagen. Ask the assistant about his experience and projects.",
};

const NAV = [
  { href: "/projects", label: "projects" },
  { href: "/cv", label: "cv" },
  { href: "/about", label: "about" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { contact } = await getSite();
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <ChatProvider contactEmail={contact.email}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[90] focus:bg-bone focus:px-3 focus:py-2 focus:text-black"
          >
            Skip to content
          </a>

          {/* Fades from black so content scrolls underneath without colliding with the links. */}
          <header className="fixed inset-x-0 top-0 z-40 bg-linear-to-b from-black via-black/85 to-transparent pb-6">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 font-mono text-[13px] whitespace-nowrap sm:px-8">
              <Link href="/" aria-label="Alexander Skou-Larsen, home">
                <span className="sm:hidden">a. skou-larsen</span>
                <span className="hidden sm:inline">alexander skou-larsen</span>
              </Link>
              <nav aria-label="Main">
                {/* Phones drop the ~/ prefixes so the links fit beside the name at 375px. */}
                <ul className="flex gap-3 sm:gap-7">
                  {NAV.map((item) => (
                    <li key={item.href}>
                      <SectionLink href={item.href} className="group">
                        <span aria-hidden="true" className="hidden text-ash sm:inline">
                          ~/
                        </span>
                        <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 ease-out-expo group-hover:bg-[length:100%_1px]">
                          {item.label}
                        </span>
                      </SectionLink>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </header>

          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pb-32 sm:px-8">
            {children}
          </main>

          <Footer contact={contact} />
          <ChatWidget />
          <Cursor />
          <MobileNotice />
        </ChatProvider>
      </body>
    </html>
  );
}

function Footer({ contact }: { contact: Contact }) {
  const links = [
    contact.email && { href: `mailto:${contact.email}`, label: contact.email },
    contact.linkedin && { href: contact.linkedin, label: "linkedin" },
    contact.github && { href: contact.github, label: "github" },
    contact.leaguepedia && { href: contact.leaguepedia, label: "leaguepedia" },
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  return (
    // Opaque and above the home page's fixed lake canvas, which would otherwise show through.
    <footer className="relative z-10 border-t border-line bg-black">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline gap-x-8 gap-y-3 px-5 pt-10 pb-24 font-mono text-[13px] text-ash sm:px-8">
        <h2>
          <span aria-hidden="true">{"// "}</span>contact
        </h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="transition-colors hover:text-bone">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
