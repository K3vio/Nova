"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const links = [
  { href: "/", label: "Goals", match: (path: string) => path === "/" || path.startsWith("/goals") },
  { href: "/chat", label: "Chat", match: (path: string) => path.startsWith("/chat") },
];

export function NavLinks() {
  // On routes with dynamic params the pathname isn't known while prerendering,
  // so the shell shows the links without highlighting the active one.
  return (
    <Suspense fallback={<Links pathname={null} />}>
      <ActiveNavLinks />
    </Suspense>
  );
}

function ActiveNavLinks() {
  return <Links pathname={usePathname()} />;
}

function Links({ pathname }: { pathname: string | null }) {
  return links.map((link) => {
    const active = pathname !== null && link.match(pathname);
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={`text-sm transition-colors ${
          active
            ? "font-medium text-zinc-900 dark:text-zinc-100"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
      >
        {link.label}
      </Link>
    );
  });
}
