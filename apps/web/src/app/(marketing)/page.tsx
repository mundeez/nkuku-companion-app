"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

const MARKETING_ENABLED = process.env.NEXT_PUBLIC_MARKETING_ENABLED !== "false";

export default function LandingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!MARKETING_ENABLED) {
      router.replace("/login");
    }
  }, [router]);

  if (!MARKETING_ENABLED) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="flex flex-col items-center py-24 text-center sm:py-32">
        <img src="/logo.png" alt="Nkuku" className="mb-8 h-20 w-auto" />
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Run a profitable broiler farm from your phone
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Track flocks, feed, health, and money in one place — offline-first,
          built for Zambian and African poultry farms.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          {user && !isLoading ? (
            <Link
              href="/dashboard"
              className="rounded-md bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-md bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Start free
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-input bg-background px-8 py-3 text-base font-medium transition-colors hover:bg-accent"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </section>
      <section id="features" className="grid gap-8 pb-24 sm:grid-cols-3">
        {[
          ["Flock management", "Birds, growth, feed, water, mortality, vaccination — per flock, per cycle."],
          ["Works offline", "Keep working in the field; everything syncs when you're back online."],
          ["Money in, money out", "Sales, expenses, and full double-entry books in Kwacha."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-lg border p-6">
            <h2 className="mb-2 text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
