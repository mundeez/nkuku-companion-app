import { redirect } from "next/navigation";

// Deprecated: moved to the double-entry ledger (P-5).
export default function Page() {
  redirect("/ledger/scheduled-reports");
}
