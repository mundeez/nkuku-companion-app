"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { BroilerFlock } from "@/lib/types";
import { FlockSubNav } from "@/components/flock-subnav";
import { AttachmentPanel } from "@/components/attachments/AttachmentPanel";

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;

  const [flock, setFlock] = useState<BroilerFlock | null>(null);
  const [error, setError] = useState("");

  const canManageDocuments =
    user?.role === "owner" ||
    user?.role === "manager" ||
    user?.role === "flock_minder" ||
    user?.role === "sales_person";
  const canDelete = user?.role === "owner" || user?.role === "manager";

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user && flockId) {
      apiFetch<BroilerFlock>(`/api/v1/broiler-flocks/${flockId}`)
        .then(setFlock)
        .catch((err) => setError(err.message));
    }
  }, [user, isLoading, flockId, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <FlockSubNav />
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Documents</h1>
        <div className="text-muted-foreground">{flock?.name || "Loading..."}</div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <AttachmentPanel
        flockId={flockId}
        title="Flock Documents"
        canManage={canManageDocuments}
        canDelete={canDelete}
      />
    </div>
  );
}
