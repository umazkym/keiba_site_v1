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
    <div className={`mx-auto w-full ${widthClass} px-2 pb-6 pt-2 sm:px-4 sm:pb-14`}>
      <header className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.16em] text-slate-400">{eyebrow}</p>
            <h1 className="mt-1 text-[14px] font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">
              {title}
            </h1>
            <div className="mt-1.5 max-w-3xl text-[11px] leading-relaxed text-slate-600 sm:text-sm sm:leading-7">
              {description}
            </div>
          </div>
          {updated && (
            <p className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
              {updated}
            </p>
          )}
        </div>
      </header>

      <div className="mt-2 space-y-2 sm:mt-4 sm:space-y-4">{children}</div>
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
    <section className={`rounded-xl border p-2.5 shadow-xs sm:p-5 ${toneClass}`}>
      <h2 className="flex items-center gap-1.5 text-xs font-black text-slate-950 sm:text-xl">
        <span className="h-3 w-1 rounded-full bg-blue-600" />
        {title}
      </h2>
      <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-slate-600 sm:text-sm sm:leading-7">{children}</div>
    </section>
  );
}

export function InfoDefinitionList({ items }: { items: InfoDefinitionItem[] }) {
  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {items.map((item) => (
        <div key={item.label} className="grid gap-0.5 p-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4 sm:p-4">
          <dt className="text-[11.5px] font-black text-slate-900 sm:text-sm">{item.label}</dt>
          <dd className="text-[11px] leading-relaxed text-slate-600 sm:text-sm sm:leading-7">{item.value}</dd>
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

  return <div className={`rounded-xl border-l-2 p-2.5 text-[11px] leading-relaxed sm:p-4 sm:text-sm sm:leading-7 ${toneClass}`}>{children}</div>;
}

export function InfoCardLink({ href, title, description }: InfoCardLinkProps) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs transition-colors hover:border-blue-300 hover:bg-slate-50"
    >
      <h3 className="text-xs font-black text-slate-950 group-hover:text-primary sm:text-base">{title}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{description}</p>
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
    <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs sm:p-5">
      <h2 className="border-b border-slate-100 pb-1.5 text-xs font-black text-slate-950 sm:text-lg">{title}</h2>
      <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-slate-600 sm:text-sm sm:leading-7">{children}</div>
    </section>
  );
}
