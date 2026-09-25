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
    <div className={`mx-auto w-full ${widthClass} px-1 pb-8 pt-2 sm:px-4 sm:pb-14`}>
      <header className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.12em] text-slate-500">{eyebrow}</p>
            <h1 className="mt-1.5 text-[22px] font-extrabold leading-snug text-slate-900 sm:text-3xl">
              {title}
            </h1>
            <div className="mt-2 max-w-3xl text-sm leading-[1.8] text-slate-700 sm:text-[15px] sm:leading-7">
              {description}
            </div>
          </div>
          {updated && (
            <p className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">
              {updated}
            </p>
          )}
        </div>
      </header>

      <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">{children}</div>
    </div>
  );
}

export function InfoSection({ title, children, tone = "default" }: InfoSectionProps) {
  const toneClass = {
    default: "border-slate-200 bg-white",
    soft: "border-slate-200 bg-slate-50",
    notice: "border-brand-100 bg-brand-50/70",
    warning: "border-amber-200 bg-amber-50/80",
  }[tone];

  return (
    <section className={`rounded-xl border p-4 sm:p-6 ${toneClass}`}>
      <h2 className="flex items-center gap-2 text-[17px] font-extrabold leading-snug text-slate-900 sm:text-xl">
        <span className="h-4 w-1 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-[1.8] text-slate-700 sm:text-[15px] sm:leading-7">{children}</div>
    </section>
  );
}

export function InfoDefinitionList({ items }: { items: InfoDefinitionItem[] }) {
  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {items.map((item) => (
        <div key={item.label} className="grid gap-1 p-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4 sm:p-4">
          <dt className="text-sm font-bold text-slate-900">{item.label}</dt>
          <dd className="text-sm leading-[1.8] text-slate-700 sm:text-[15px] sm:leading-7">{item.value}</dd>
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
    notice: "border-brand-200 bg-brand-50 text-brand-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-rose-200 bg-rose-50 text-rose-950",
  }[tone];

  return <div className={`rounded-xl border-l-[3px] p-3.5 text-sm leading-[1.8] sm:p-4 sm:leading-7 ${toneClass}`}>{children}</div>;
}

export function InfoCardLink({ href, title, description }: InfoCardLinkProps) {
  return (
    <Link
      prefetch={false}
      href={href}
      className="group block rounded-xl border border-slate-200 bg-white p-4 transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <h3 className="text-[15px] font-bold text-slate-900 group-hover:text-brand-700 sm:text-base">{title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{description}</p>
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
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="border-b border-slate-200 pb-2 text-[17px] font-extrabold leading-snug text-slate-900 sm:text-lg">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-[1.8] text-slate-700 sm:text-[15px] sm:leading-7">{children}</div>
    </section>
  );
}
