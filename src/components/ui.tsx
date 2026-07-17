import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
  href?: string;
  children: React.ReactNode;
};

export function Button({ className, href, children, ...props }: ButtonProps) {
  const base = cn(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition duration-200 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0 disabled:pointer-events-none disabled:opacity-50",
    className
  );

  if (href) return <Link href={href} className={base}>{children}</Link>;
  return <button className={base} {...props}>{children}</button>;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-white/70 bg-white p-4 shadow-card", className)}>{children}</div>;
}

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "warn" }) {
  const tones = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700"
  };

  return <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-bold leading-none", tones[tone])}>{children}</span>;
}