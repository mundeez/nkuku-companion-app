import { Navbar } from "@/components/navbar";
import { UpgradePromptProvider } from "@/components/billing/upgrade-prompt-provider";
import { QueryProvider } from "@/lib/api/query-provider";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { ImpersonationBanner } from "@/components/impersonation-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UpgradePromptProvider>
      <QueryProvider>
        <ImpersonationBanner />
        <Navbar />
        <main className="min-h-screen bg-muted/30">{children}</main>
        <SyncStatusIndicator />
      </QueryProvider>
    </UpgradePromptProvider>
  );
}
