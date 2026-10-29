import Link from "next/link";
import {
  Egg, TrendingUp, ShieldCheck, CalendarClock, FileText,
  Smartphone, DollarSign, Bell, ChevronRight, CheckCircle2,
} from "lucide-react";

export const metadata = {
  title: "Nkuku Companion — Poultry farm management for Africa",
  description:
    "Track broiler flocks, feed, health, sales and finances — online or offline. Built for African poultry farms, priced in local currency.",
};

const FEATURES = [
  { icon: Egg, title: "Flock management", desc: "Broiler cycles from placement to sale — daily growth, feed, water and mortality tracking against Ross 308 / Cobb 500 targets." },
  { icon: Bell, title: "Smart alerts", desc: "Vaccination reminders, feed transition warnings and health alerts pushed to your phone via ntfy." },
  { icon: DollarSign, title: "Sales & customers", desc: "Record bird sales by customer, track payment status, and see per-flock profitability." },
  { icon: TrendingUp, title: "Double-entry ledger", desc: "GAAP income statement, balance sheet, cash flow and journal — every transaction posted automatically." },
  { icon: Smartphone, title: "Works offline", desc: "The mobile app queues records without signal and syncs when you're back online." },
  { icon: ShieldCheck, title: "Team roles", desc: "Owner, manager, flock minder, sales person and viewer roles keep everyone in their lane." },
];

const STEPS = [
  { n: 1, title: "Create your flock", desc: "Enter chicks, breed and supplier — the app builds the vaccination and feed schedule automatically." },
  { n: 2, title: "Log daily records", desc: "Feed, weight, water and mortality take seconds per day from the app or web." },
  { n: 3, title: "Sell & account", desc: "Record sales, watch profit per flock, and read GAAP statements when the cycle closes." },
];

const FAQS = [
  { q: "Does it work without internet?", a: "Yes — the mobile app works fully offline and syncs when connectivity returns." },
  { q: "How do I pay for a plan?", a: "Zambian mobile money (MTN/Airtel/Zamtel via Lenco) and cards via Flutterwave or DPO Pay — no card needed." },
  { q: "Is my data safe?", a: "Data is encrypted in transit, role-gated inside your organisation, and backed up nightly. You can export or delete it anytime." },
  { q: "Which platforms are supported?", a: "Android APK today (iOS coming), plus the web app on any modern browser." },
];

export default function MarketingPage() {
  return (
    <main className="bg-background">
      {/* 1 — Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 text-center">
        <span className="inline-block rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          Poultry management · Web + Android · Offline-first
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
          Run your poultry farm<br className="hidden sm:block" /> like a business
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Track every chick, kilogram of feed and kwacha — from day-old
          placement to final sale. Built for African broiler farms.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90">
            Start free
          </Link>
          <Link href="/login" className="rounded-lg border px-6 py-3 font-medium hover:bg-accent">
            Log in
          </Link>
        </div>
      </section>

      {/* 2 — Trust strip */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-10 gap-y-3 px-6 py-5 text-sm text-muted-foreground">
          <span>✓ Official Ross 308 &amp; Cobb 500 targets</span>
          <span>✓ Offline-first mobile app</span>
          <span>✓ GAAP double-entry accounting</span>
          <span>✓ Local-currency pricing</span>
        </div>
      </section>

      {/* 3 — Feature grid */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold">Everything after the chick arrives</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          One place for flock records, health schedules, sales and the books.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border p-6">
              <f.icon className="h-8 w-8 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 — How it works */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold">How it works</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-xl bg-background p-6">
                <span className="text-4xl font-bold text-primary/30">{s.n}</span>
                <h3 className="mt-2 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 — Screenshots (live data from the Nkuku Demo Farm account) */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold">See it in action</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            ["Dashboard", "Production overview — flocks, mortality, profit at a glance", "dashboard"],
            ["Flock detail", "Every record for a batch — weights, feed, vaccines, finances", "flock-detail"],
            ["Sales", "Revenue, customers and payment tracking in ZMW", "sales"],
            ["Ledger", "Double-entry books — trial balance to GAAP statements", "ledger"],
            ["Alerts", "Vaccinations, weight checks and anomalies, flagged for you", "alerts"],
            ["Billing", "Plans in local currency — mobile money or card", "billing"],
          ].map(([title, desc, file]) => (
            <figure key={title} className="overflow-hidden rounded-xl border bg-muted/50">
              <div className="aspect-[16/10] overflow-hidden">
                <img src={`/screenshots/${file}.webp`} alt={`Nkuku Companion — ${title}`} className="h-full w-full object-cover object-top" loading="lazy" />
              </div>
              <figcaption className="px-4 py-3">
                <div className="font-semibold">{title}</div>
                <div className="text-sm text-muted-foreground">{desc}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* 6 — Pricing preview */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold">Simple, local-currency pricing</h2>
          <p className="mt-3 text-muted-foreground">
            Start free. Upgrade when your farm grows — pay by mobile money or card.
          </p>
          <Link href="/pricing" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90">
            View pricing <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 7 — Mobile section */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">Built for the field</h2>
            <ul className="mt-6 space-y-3">
              {["Record mortality, feed and sales offline — syncs later",
                "Push alerts for vaccinations and anomalies",
                "Lightweight APK — runs on any Android phone",
                "iOS version on the way"].map((t) => (
                <li key={t} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="justify-self-center overflow-hidden rounded-[2rem] border-4 border-foreground/10 shadow-xl">
            <img src="/screenshots/mobile.webp" alt="Nkuku Companion mobile app — dashboard" className="max-h-[420px] w-auto" loading="lazy" />
          </div>
        </div>
      </section>

      {/* 8 — Security & data */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-3">
          {[
            { icon: ShieldCheck, t: "Your data stays yours", d: "Export or delete your organisation's data anytime. Nightly encrypted backups." },
            { icon: FileText, t: "Real accounting", d: "Immutable double-entry journal — audit-ready income statement, balance sheet and cash flow." },
            { icon: CalendarClock, t: "Transparent billing", d: "Reminder emails before renewal, clear invoices, cancel anytime from Billing." },
          ].map((c) => (
            <div key={c.t} className="rounded-xl bg-background p-6">
              <c.icon className="h-7 w-7 text-primary" />
              <h3 className="mt-3 font-semibold">{c.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 9 — FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold">Questions</h2>
        <div className="mt-10 space-y-4">
          {FAQS.map((f) => (
            <details key={f.q} className="rounded-xl border p-5 open:bg-muted/30">
              <summary className="cursor-pointer font-medium">{f.q}</summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 10 — Final CTA */}
      <section className="border-t bg-primary/5">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold">Start your first flock today</h2>
          <p className="mt-3 text-muted-foreground">
            Free plan, no card required. Upgrades when you're ready.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/signup" className="rounded-lg bg-primary px-8 py-3 font-medium text-primary-foreground hover:opacity-90">
              Create account
            </Link>
            <a href="mailto:nkuku@zeendeefood.solutions" className="rounded-lg border px-8 py-3 font-medium hover:bg-accent">
              Talk to us
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
