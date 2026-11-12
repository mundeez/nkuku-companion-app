import { Navbar } from "@/components/navbar";
import { UpgradePromptProvider } from "@/components/billing/upgrade-prompt-provider";
import { QueryProvider } from "@/lib/api/query-provider";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { TrialBanner } from "@/components/billing/trial-banner";
import { SubscriptionGate } from "@/components/billing/subscription-gate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UpgradePromptProvider>
      <QueryProvider>
        <ImpersonationBanner />
        <AnnouncementBanner />
        <TrialBanner />
        <Navbar />
        <main className="min-h-screen bg-muted/30">
          <SubscriptionGate>{children}</SubscriptionGate>
        </main>
        <SyncStatusIndicator />
      </QueryProvider>
    </UpgradePromptProvider>
  );
}
