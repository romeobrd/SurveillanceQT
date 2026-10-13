import type { ReactNode } from "react";

/** Mise en page des pages publiques ouvertes depuis un e-mail. */
export default function EmailLinkPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}
