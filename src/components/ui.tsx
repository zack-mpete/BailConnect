import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
  href?: string;
  children: React.ReactNode;
};

export function Button({ className, href, children, ...props }: ButtonProps) {
  const base = cn("inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 active:translate-y-0", className);
  if (href) return <Link href={href} className={base}>{children}</Link>;
  return <button className={base} {...props}>{children}</button>;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xxl border border-white/70 bg-white p-4 shadow-card", className)}>{children}</div>;
}

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "warn" }) {
  const tones = { default: "bg-slate-100 text-slate-700", success: "bg-emerald-50 text-emerald-700", warn: "bg-amber-50 text-amber-700" };
  return <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}
