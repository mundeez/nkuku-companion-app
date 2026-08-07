"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { socialCompleteSignup } from "@/lib/api/client";

interface SocialSignupFormProps {
  tempToken: string;
  profile: { email?: string; name?: string; provider: string };
  onCancel?: () => void;
}

const COUNTRIES = [
  { code: "ZM", name: "Zambia" },
  { code: "BW", name: "Botswana" },
  { code: "ZW", name: "Zimbabwe" },
  { code: "NA", name: "Namibia" },
  { code: "ZA", name: "South Africa" },
  { code: "MW", name: "Malawi" },
  { code: "MZ", name: "Mozambique" },
  { code: "TZ", name: "Tanzania" },
  { code: "KE", name: "Kenya" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "UG", name: "Uganda" },
];

const CURRENCIES = [
  { code: "ZMW", name: "Zambian Kwacha (ZMW)" },
  { code: "BWP", name: "Botswana Pula (BWP)" },
  { code: "USD", name: "US Dollar (USD)" },
  { code: "ZAR", name: "South African Rand (ZAR)" },
  { code: "ZWL", name: "Zimbabwe Gold (ZiG)" },
];

export function SocialSignupForm({
  tempToken,
  profile,
  onCancel,
}: SocialSignupFormProps) {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [country, setCountry] = useState("ZM");
  const [currency, setCurrency] = useState("ZMW");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError("You must accept the privacy policy and terms to create an account");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await socialCompleteSignup({
        tempToken,
        organizationName: orgName,
        country,
        currency,
        consent: true,
      });
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Complete Your Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Welcome{profile.name ? `, ${profile.name}` : ""}! You&apos;re signed in
          with {profile.provider}.
          {profile.email && ` (${profile.email})`}
          <br />
          Tell us about your farm to get started.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Farm / organization name</label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
            className="mt-1 w-full rounded-md border px-3 py-2"
            placeholder="e.g. Nkuku Poultry Farm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1"
          />
          <span className="text-muted-foreground">
            I accept the privacy policy and terms of service. My data will be
            processed in accordance with the Zambia Data Protection Act (No. 3
            of 2021).
          </span>
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Account"}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-sm text-muted-foreground hover:underline"
          >
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
