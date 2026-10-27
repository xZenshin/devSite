import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import { ChatProvider } from "@/components/chat/chat-provider";
import { ChatWidget } from "@/components/chat/chat-widget";
import { getSite } from "@/lib/site";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Alexander Skou-Larsen", template: "%s – Alexander Skou-Larsen" },
  description: "Software developer in Copenhagen. Ask the assistant about his experience and projects.",
};

const NAV = [
  { href: "/#projects", label: "Projects" },
  { href: "/cv", label: "CV" },
  { href: "/about", label: "About" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { contact } = await getSite();
  return (
    <html lang="en" className={`${schibsted.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <ChatProvider contactEmail={contact.email}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
          >
            Skip to content
          </a>
          <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
            <Link href="/" className="font-semibold">
              Alexander Skou-Larsen
            </Link>
            <nav aria-label="Main">
              <ul className="flex gap-5 text-ink-muted">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="hover:text-ink">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </header>
          <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-5 pt-8 pb-32 sm:px-8">
            {children}
          </main>
          <Footer />
          <ChatWidget />
        </ChatProvider>
      </body>
    </html>
  );
}

async function Footer() {
  const { contact } = await getSite();
  const links = [
    contact.email && { href: `mailto:${contact.email}`, label: contact.email },
    contact.github && { href: contact.github, label: "GitHub" },
    contact.linkedin && { href: contact.linkedin, label: "LinkedIn" },
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  return (
    <footer className="mx-auto w-full max-w-3xl border-t border-mist px-5 py-8 pb-24 text-ink-muted sm:px-8">
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href} className="hover:text-ink">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
