import Link from "next/link";
import type { ReactNode } from "react";

type InfoPageShellProps = {
  eyebrow: string;
  title: string;
  description: ReactNode;
  updated?: string;
  children: ReactNode;
  maxWidth?: "normal" | "wide";
};

type InfoSectionProps = {
  title: string;
  children: ReactNode;
  tone?: "default" | "soft" | "notice" | "warning";
};

type InfoDefinitionItem = {
  label: string;
  value: ReactNode;
};

type InfoCardLinkProps = {
  href: string;
  title: string;
  description: string;
};

export function InfoPageShell({
  eyebrow,
  title,
  description,
  updated,
  children,
  maxWidth = "normal",
}: InfoPageShellProps) {
  const widthClass = maxWidth === "wide" ? "max-w-6xl" : "max-w-5xl";

  return (
    <div className={`mx-auto w-full ${widthClass} px-3 pb-12 pt-4 sm:px-4 sm:pb-16`}>
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.16em] text-slate-400">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
              {title}
            </h1>
            <div className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 sm:text-base">
              {description}
            </div>
          </div>
          {updated && (
            <p className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-500">
              {updated}
            </p>
          )}
        </div>
      </header>

      <div className="mt-5 space-y-5 sm:mt-8 sm:space-y-6">{children}</div>
    </div>
  );
}

export function InfoSection({ title, children, tone = "default" }: InfoSectionProps) {
  const toneClass = {
    default: "border-slate-200 bg-white",
    soft: "border-slate-200 bg-slate-50",
    notice: "border-blue-100 bg-blue-50/70",
    warning: "border-amber-200 bg-amber-50/80",
  }[tone];

  return (
    <section className={`rounded-2xl border p-5 shadow-soft sm:p-6 ${toneClass}`}>
      <h2 className="flex items-center gap-2 text-xl font-black text-slate-950 sm:text-2xl">
        <span className="h-5 w-1 rounded-sm bg-accent" />
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-8 text-slate-600 sm:text-base">{children}</div>
    </section>
  );
}

export function InfoDefinitionList({ items }: { items: InfoDefinitionItem[] }) {
  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {items.map((item) => (
        <div key={item.label} className="grid gap-1 p-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-5">
          <dt className="text-sm font-black text-slate-900">{item.label}</dt>
          <dd className="text-sm leading-7 text-slate-600">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function InfoCallout({
  children,
  tone = "notice",
}: {
  children: ReactNode;
  tone?: "notice" | "warning" | "danger";
}) {
  const toneClass = {
    notice: "border-blue-200 bg-blue-50 text-blue-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-rose-200 bg-rose-50 text-rose-950",
  }[tone];

  return <div className={`rounded-2xl border-l-4 p-4 text-sm leading-8 sm:p-5 ${toneClass}`}>{children}</div>;
}

export function InfoCardLink({ href, title, description }: InfoCardLinkProps) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevated"
    >
      <h3 className="text-base font-black text-slate-950 group-hover:text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    </Link>
  );
}

export function PolicySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
      <h2 className="border-b border-slate-100 pb-3 text-lg font-black text-slate-950 sm:text-xl">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-8 text-slate-600 sm:text-base">{children}</div>
    </section>
  );
}
