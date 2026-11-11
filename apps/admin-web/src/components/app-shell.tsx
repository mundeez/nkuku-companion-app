"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";
import { useReauth } from "./reauth-modal";
import {
  clearImpersonation,
  getImpersonation,
} from "@/lib/api/client";
import { endImpersonation, listTickets } from "@/lib/api/platform";
import { hasPerm } from "@/lib/rbac";
import { ROLE_LABELS } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  Building2,
  LifeBuoy,
  Mail,
  HeartPulse,
  ScrollText,
  UserCog,
  LogOut,
  ShieldCheck,
  Eye,
  XCircle,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
  exact?: boolean;
  /** Show the open-support-ticket count badge on this item. */
  openTicketBadge?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "platform.dashboard.read", exact: true },
  { href: "/tenants", label: "Tenants", icon: Building2, permission: "tenants.read" },
  { href: "/support", label: "Support", icon: LifeBuoy, permission: "support.tickets.read", openTicketBadge: true },
  { href: "/comms", label: "Comms", icon: Mail, permission: "comms.log.read" },
  { href: "/health", label: "Health", icon: HeartPulse, permission: "platform.dashboard.read" },
  { href: "/audit", label: "Audit Log", icon: ScrollText, permission: "audit.read" },
  { href: "/staff", label: "Staff", icon: UserCog, permission: "staff.manage" },
];

/** Open-ticket count for the Support nav item — light poll every 60s. */
function OpenTicketBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      listTickets({ status: "open", pageSize: 1 })
        .then((r) => {
          if (alive) setCount(r.total);
        })
        .catch(() => {
          // Endpoint not live yet / transient — hide the badge, don't nag.
        });
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!count) return null;
  return (
    <Badge variant="destructive" className="ml-auto px-1.5 py-0 text-[10px] leading-4">
      {count > 99 ? "99+" : count}
    </Badge>
  );
}

function ImpersonationChip() {
  const [session, setSession] = useState<any | null>(null);
  const { withReauth } = useReauth();
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const sync = () => setSession(getImpersonation());
    sync();
    window.addEventListener("nkuku:impersonation-changed", sync);
    return () => window.removeEventListener("nkuku:impersonation-changed", sync);
  }, []);

  if (!session) return null;

  const expired = session.expiresAt && new Date(session.expiresAt).getTime() < Date.now();

  async function end() {
    setEnding(true);
    try {
      if (session.sessionId) {
        await withReauth(() => endImpersonation(session.sessionId));
      }
    } catch {
      // Clear locally even if the API call fails.
    } finally {
      clearImpersonation();
      setEnding(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
      <Eye className="h-3.5 w-3.5" />
      <span>
        Impersonating{session.targetEmail ? ` ${session.targetEmail}` : ""}
        {session.orgName ? ` @ ${session.orgName}` : ""}
        {expired ? " (expired)" : ""}
      </span>
      <button
        onClick={end}
        disabled={ending}
        className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 hover:bg-amber-500/30 disabled:opacity-50"
      >
        <XCircle className="h-3 w-3" /> {ending ? "Ending…" : "End"}
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-60 border-r bg-card p-4 space-y-3">
          <Skeleton className="h-8 w-32" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        <div className="flex-1 p-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    // AuthProvider redirects to /login; render nothing meanwhile.
    return null;
  }

  const visibleNav = NAV_ITEMS.filter((item) => hasPerm(user, item.permission));

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r bg-card">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <div className="text-sm font-bold leading-tight">Nkuku Platform</div>
            <div className="text-[11px] text-muted-foreground leading-tight">Staff Console</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleNav.map((item) => {
            const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.openTicketBadge && <OpenTicketBadge />}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3 text-[11px] text-muted-foreground">
          admin.nkuku.zeendeefood.solutions
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="ml-60 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <ImpersonationChip />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium leading-tight">{user.name || user.email}</div>
              <div className="text-[11px] text-muted-foreground leading-tight">{user.email}</div>
            </div>
            <Badge variant="secondary" className="uppercase tracking-wide text-[10px]">
              {ROLE_LABELS[user.role] ?? user.role}
            </Badge>
            <Button variant="ghost" size="sm" onClick={logout} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
