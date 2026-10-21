"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { Account } from "@/lib/types/ledger";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"];

export default function AccountsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    asset: true, liability: true, equity: true, revenue: true, expense: true,
  });

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      apiFetch<Account[]>("/api/v1/accounts")
        .then(setAccounts)
        .catch((err) => setError(err.message));
    }
  }, [user]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;
  if (error) return <div className="p-8 text-destructive">{error}</div>;

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    accounts: accounts.filter((a) => a.accountType === type),
  })).filter((g) => g.accounts.length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Chart of Accounts</h1>
          <p className="text-muted-foreground">{accounts.length} accounts</p>
        </div>
        {(user.role === "owner" || user.role === "manager") && (
          <Link href="/ledger/accounts/new">
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Account</Button>
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {grouped.map((group) => (
          <Card key={group.type}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setExpanded({ ...expanded, [group.type]: !expanded[group.type] })}
            >
              <div className="flex items-center gap-2">
                {expanded[group.type] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-base">{group.label}</CardTitle>
                <span className="text-sm text-muted-foreground">({group.accounts.length})</span>
              </div>
            </CardHeader>
            {expanded[group.type] && (
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Code</th>
                      <th className="text-left py-2 px-3 font-medium">Name</th>
                      <th className="text-left py-2 px-3 font-medium">Normal Balance</th>
                      <th className="text-left py-2 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.accounts.map((account) => (
                      <tr key={account.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 font-mono">
                          <Link href={`/ledger/accounts/${account.code}`} className="text-primary hover:underline">
                            {account.code}
                          </Link>
                        </td>
                        <td className="py-2 px-3">{account.name}</td>
                        <td className="py-2 px-3 capitalize text-muted-foreground">{account.normalBalance}</td>
                        <td className="py-2 px-3">
                          {account.isSystem ? (
                            <span className="text-xs text-muted-foreground">System</span>
                          ) : account.isActive ? (
                            <span className="text-xs text-green-600">Active</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Inactive</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
