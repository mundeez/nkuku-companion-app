"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { BroilerFlock, FlockCalendarDay } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Syringe, Wheat } from "lucide-react";
import { FlockSubNav } from "@/components/flock-subnav";

export default function CalendarPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;

  const [flock, setFlock] = useState<BroilerFlock | null>(null);
  const [days, setDays] = useState<FlockCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && flockId) {
      Promise.all([
        apiFetch<BroilerFlock>(`/api/v1/broiler-flocks/${flockId}`),
        apiFetch<{ days: FlockCalendarDay[] }>(`/api/v1/broiler-flocks/${flockId}/summary`),
      ])
        .then(([f, s]) => {
          setFlock(f);
          setDays(s.days || []);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [user, isLoading, flockId, router]);

  if (isLoading || loading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <FlockSubNav />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Management Calendar</h1>
          <div className="text-muted-foreground">{flock?.name} · Hatch: {flock?.startDate ? new Date(flock.startDate).toLocaleDateString() : "-"}</div>
        </div>
        <Button variant="outline" onClick={() => router.push(`/broiler-flocks/${flockId}/calendar/print`)}>
          <Printer className="h-4 w-4 mr-1" /> Print
        </Button>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
        {days.map((day) => (
          <Card key={day.day} className={`overflow-hidden ${day.vaccines.length > 0 ? "border-green-300" : ""}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold">{day.age}</div>
                <div className="text-xs text-muted-foreground">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              </div>

              <div className="mb-2 flex items-center gap-2 text-sm">
                <Wheat className="h-4 w-4 text-yellow-600" />
                <span className="font-medium">{day.feedPhase}</span>
              </div>

              {day.vaccines.length > 0 && (
                <div className="mb-2 space-y-1">
                  {day.vaccines.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Syringe className="h-4 w-4 text-green-600" />
                      <span className="flex-1 truncate">{v.vaccineName}</span>
                      <Badge variant={v.completed ? "default" : "outline"} className="text-xs">{v.completed ? "Done" : "Due"}</Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-0.5">
                {day.managementTasks.slice(0, 3).map((t, i) => <div key={i}>• {t}</div>)}
              </div>

              {day.healthSupport && (
                <div className="mt-2 text-xs bg-blue-50 text-blue-800 p-1.5 rounded">
                  {day.healthSupport}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
