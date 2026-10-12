"use client";

import { useRef, type ReactNode } from "react";
import { fr } from "@/lib/i18n/fr";
import ActionForm, { type ActionState } from "./ActionForm";

interface ConfirmDialogProps {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel?: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Champs cachés envoyés à l'action (identifiants). */
  children?: ReactNode;
}

/** Confirmation avant action destructive : dialogue natif (focus piégé, Échap pour fermer). */
export default function ConfirmDialog({
  triggerLabel,
  title,
  description,
  confirmLabel = fr.common.confirm,
  action,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700"
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="confirm-title"
        className="m-auto w-full max-w-md rounded-lg p-6 shadow-xl backdrop:bg-slate-900/50"
      >
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-700">{description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ActionForm
            action={action}
            submitLabel={confirmLabel}
            variant="danger"
            className="flex flex-col gap-3"
          >
            {children}
          </ActionForm>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-600"
          >
            {fr.common.cancel}
          </button>
        </div>
      </dialog>
    </>
  );
}
