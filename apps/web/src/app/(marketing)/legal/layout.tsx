export const metadata = { title: "Legal — Nkuku Companion" };

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 prose prose-slate dark:prose-invert">
      {children}
      <p className="mt-12 text-sm text-muted-foreground">
        Questions? Contact us at{" "}
        <a className="underline" href="mailto:nkuku@zeendeefood.solutions">nkuku@zeendeefood.solutions</a>.
        Last updated: October 2026.
      </p>
    </main>
  );
}
