// ── Feature key vocabulary ──────────────────────────────
// Mirrors the `features` arrays in apps/api/src/core/billing/plans.ts.
// Keep in sync when that file grows a new key.

export const FEATURE_KEYS: { key: string; label: string; description?: string }[] = [
  { key: "core_tracking", label: "Core tracking", description: "Growth/feed/water/mortality/vaccination records" },
  { key: "disease_db", label: "Disease database" },
  { key: "basic_alerts", label: "Basic alerts" },
  { key: "full_alerts", label: "Full alerts" },
  { key: "financial_dashboard", label: "Financial dashboard" },
  { key: "double_entry_ledger", label: "Double-entry ledger" },
  { key: "document_attachments", label: "Document attachments" },
  { key: "multi_site", label: "Multi-site" },
  { key: "gaap_statements", label: "GAAP statements" },
  { key: "csv_pdf_export", label: "CSV/PDF export" },
  { key: "api_access", label: "API access" },
  { key: "priority_support", label: "Priority support" },
  { key: "white_label", label: "White-label" },
  { key: "dedicated_onboarding", label: "Dedicated onboarding" },
  { key: "sla", label: "SLA" },
  { key: "self_hosted", label: "Self-hosted" },
];

export function featureLabel(key: string): string {
  return FEATURE_KEYS.find((f) => f.key === key)?.label ?? key;
}
