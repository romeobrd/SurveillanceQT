import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-orange-600";

export function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {help && <p className="text-xs text-slate-600">{help}</p>}
    </div>
  );
}

export function TextInput({
  id,
  label,
  help,
  ...props
}: {
  id: string;
  label: string;
  help?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field id={id} label={label} help={help}>
      <input id={id} name={id} className={inputClass} {...props} />
    </Field>
  );
}

export function SelectField({
  id,
  label,
  options,
  placeholder,
  help,
  ...props
}: {
  id: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  /** Libellé de l'option vide (valeur ""). */
  placeholder?: string;
  help?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field id={id} label={label} help={help}>
      <select id={id} name={id} className={inputClass} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function TextArea({
  id,
  label,
  ...props
}: {
  id: string;
  label: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field id={id} label={label}>
      <textarea id={id} name={id} rows={3} className={inputClass} {...props} />
    </Field>
  );
}
