import { Navbar } from "@/components/navbar";
import { UpgradePromptProvider } from "@/components/billing/upgrade-prompt-provider";
import { QueryProvider } from "@/lib/api/query-provider";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UpgradePromptProvider>
      <QueryProvider>
        <Navbar />
        <main className="min-h-screen bg-muted/30">{children}</main>
        <SyncStatusIndicator />
      </QueryProvider>
    </UpgradePromptProvider>
  );
}
