import Link from "next/link";
import { useId, type ReactNode } from "react";
import { fr } from "@/lib/i18n/fr";
import { inputClass } from "./fields";

export const linkButtonClass =
  "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";
export const primaryLink = `${linkButtonClass} bg-brand-600 text-white hover:bg-brand-700`;
export const secondaryLink = `${linkButtonClass} border border-slate-300 bg-white text-slate-900 hover:bg-slate-100`;

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Formulaire de filtres : envoi en GET, l'état de la liste reste dans l'URL (partageable). */
export function FilterForm({
  children,
  action,
}: {
  children: ReactNode;
  action: string;
}) {
  return (
    <form
      method="get"
      action={action}
      className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      {children}
      <button
        type="submit"
        className={`${linkButtonClass} bg-slate-800 text-white hover:bg-slate-900`}
      >
        {fr.common.filter}
      </button>
      <Link href={action} className={secondaryLink}>
        {fr.common.reset}
      </Link>
    </form>
  );
}

export function FilterField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

export function FilterInput(props: {
  id: string;
  label: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <FilterField id={props.id} label={props.label}>
      <input
        id={props.id}
        name={props.id}
        type={props.type ?? "search"}
        defaultValue={props.defaultValue}
        className={inputClass}
      />
    </FilterField>
  );
}

export function FilterSelect({
  id,
  label,
  value,
  options,
}: {
  id: string;
  label: string;
  value?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <FilterField id={id} label={label}>
      <select
        id={id}
        name={id}
        defaultValue={value ?? ""}
        className={inputClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FilterField>
  );
}

export function DataTable({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export const th = "bg-slate-100 px-3 py-2 font-semibold text-slate-700";
export const td = "border-t border-slate-200 px-3 py-2 align-top";

export function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className={`${td} text-slate-600`}>
        {fr.common.noResults}
      </td>
    </tr>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "neutral" | "alert" | "ok" | "warn";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-800",
    alert: "bg-red-100 text-red-900",
    ok: "bg-green-100 text-green-900",
    warn: "bg-amber-100 text-amber-900",
  } as const;
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <progress
        className="h-2 w-40"
        value={value}
        max={100}
        aria-label={label}
      />
      <span className="text-xs text-slate-700">{value} %</span>
    </div>
  );
}

export function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-lg border border-slate-200 p-4"
    >
      <h2 id={titleId} className="mb-3 text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
