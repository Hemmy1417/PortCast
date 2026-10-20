"use client";

/**
 * The frame: a hull-navy top bar with the corrugated orange edge of a
 * container under it, a signal strip when the build reads a test deployment,
 * what the wallet is owed, and a hull footer.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ClaimBar } from "./ClaimBar";
import { WalletDock } from "./WalletDock";
import { IS_RECORD, REPO_URL } from "@/lib/config";

const NAV = [
  { href: "/markets", label: "Markets" },
  { href: "/create", label: "Create a market" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/verify", label: "Verify" },
];

export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="8" fill="#0e1b2c" />
      <path d="M33 22 A10 10 0 0 1 43 12" fill="none" stroke="#ffcf33" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M33 22 A18 18 0 0 1 51 4" fill="none" stroke="#ffcf33" strokeWidth="3.2" strokeLinecap="round" opacity="0.55" />
      <circle cx="33" cy="22" r="3.6" fill="#ffcf33" />
      <rect x="11" y="31" width="24" height="11" rx="1.5" fill="#e2531f" />
      <rect x="29" y="31" width="24" height="11" rx="1.5" fill="#f5f6f3" />
      <rect x="17" y="43" width="30" height="11" rx="1.5" fill="#e2531f" />
    </svg>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex min-h-screen flex-col">
      {!IS_RECORD ? (
        <p className="bg-signal px-4 py-2 text-center text-[13px] text-hull">This build reads a test deployment, not the deployment of record.</p>
      ) : null}
      <header className="sticky top-0 z-30 bg-hull text-deck">
        <nav className="mx-auto flex h-16 max-w-[1320px] items-center gap-6 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <Mark />
            <span className="font-[family-name:var(--font-display)] text-[26px] font-extrabold uppercase tracking-[0.02em]">PortCast</span>
          </Link>
          <ul className="hidden flex-1 items-center gap-1 md:flex">
            {NAV.map((n) => {
              const on = path.startsWith(n.href);
              return (
                <li key={n.href}>
                  <Link href={n.href} className={`rounded-tab px-3 py-1.5 text-[15px] no-underline ${on ? "bg-deck text-hull" : "text-deck/85 hover:text-deck"}`}>{n.label}</Link>
                </li>
              );
            })}
          </ul>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <span className="hidden items-center gap-1.5 rounded-tab border border-deck/25 px-2.5 py-1 font-mono text-[11.5px] uppercase tracking-[0.05em] lg:inline-flex">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-signal" /> Studio Next
            </span>
            <WalletDock />
          </div>
        </nav>
        <ul className="flex gap-4 overflow-x-auto px-4 pb-3 md:hidden">
          {NAV.map((n) => (
            <li key={n.href}><Link href={n.href} className={`whitespace-nowrap text-[14px] no-underline ${path.startsWith(n.href) ? "text-signal" : "text-deck/85"}`}>{n.label}</Link></li>
          ))}
        </ul>
        <div className="corrugate h-1.5" aria-hidden />
      </header>
      <ClaimBar />
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-24 pt-8 md:px-6">{children}</main>
      <footer className="bg-hull text-deck">
        <div className="corrugate h-1.5" aria-hidden />
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-end justify-between gap-6 px-4 py-12 md:px-6">
          <p className="h-md max-w-[24ch]">Predict the disruption. The record settles it.</p>
          <div className="flex flex-col gap-1 text-[14px] text-deck/80">
            <Link href="/verify" className="hover:text-deck">Verify this deployment</Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-deck">Source code</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
