"use client";

/**
 * The small parts. One filled button per view, in container orange; the
 * secondary action is a hull-navy outline; anything else is a plain text
 * button. Cards are deck white on chart white with a steel hairline and no
 * shadow; corners stay nearly square.
 */
import Link from "next/link";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "light" };

const LOOK = {
  primary: "rounded-tab bg-box px-5 py-2.5 text-deck hover:bg-box-soft",
  secondary: "rounded-tab border border-hull bg-deck px-4 py-2 text-hull hover:bg-hull hover:text-deck",
  ghost: "px-1 py-1 text-hull underline-offset-4 hover:underline",
  light: "rounded-tab border border-deck/60 px-4 py-2 text-deck hover:bg-deck hover:text-hull",
};

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  return (
    <button type="button" className={`inline-flex items-center justify-center gap-2 text-[15px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${LOOK[variant]} ${className}`} {...rest} />
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" | "light" }) {
  return <Link href={href} className={`inline-flex items-center gap-2 text-[15px] font-bold no-underline ${LOOK[variant]}`}>{children} <span aria-hidden>→</span></Link>;
}

export function TextLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const cls = "text-sea underline decoration-rule underline-offset-4 hover:decoration-sea";
  return external
    ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{children}</a>
    : <Link href={href} className={cls}>{children}</Link>;
}

export function Tag({ children, tone = "rule" }: { children: React.ReactNode; tone?: "rule" | "yes" | "no" | "signal" | "hull" | "sea" }) {
  const look = {
    rule: "border border-rule bg-deck text-hull",
    yes: "bg-yes-tint text-yes",
    no: "bg-no-tint text-no",
    signal: "bg-signal text-hull",
    hull: "bg-hull text-deck",
    sea: "bg-sea text-deck",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-tab px-2 py-0.5 font-mono text-[11.5px] uppercase tracking-[0.05em] ${look}`}>{children}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-card border border-rule bg-deck p-5 md:p-6 ${className}`}>{children}</div>;
}

export function Loading({ what }: { what: string }) {
  return <p className="pulse muted text-[14px]">Reading {what} from the chain.</p>;
}

export function Problem({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Card>
      <p className="h-md">{title}</p>
      {children ? <div className="muted mt-2 max-w-[60ch]">{children}</div> : null}
    </Card>
  );
}

/** The two pools as one bar: yes on the left, no on the right. */
export function PoolBar({ yes, no, className = "" }: { yes: bigint; no: bigint; className?: string }) {
  const total = yes + no;
  const pct = total === 0n ? 50 : Number((yes * 1000n) / total) / 10;
  return (
    <div className={`flex h-2 w-full overflow-hidden rounded-tab bg-rule ${className}`} aria-hidden>
      {total === 0n ? null : (
        <>
          <span className="h-full bg-yes" style={{ width: `${pct}%` }} />
          <span className="h-full bg-no" style={{ width: `${100 - pct}%` }} />
        </>
      )}
    </div>
  );
}
