"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { BroilerFlock, FlockTask } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Circle, XCircle, RefreshCw, ClipboardList } from "lucide-react";

const categoryColors: Record<string, string> = {
  vaccination: "bg-green-100 text-green-800",
  feed: "bg-yellow-100 text-yellow-800",
  water: "bg-blue-100 text-blue-800",
  environment: "bg-cyan-100 text-cyan-800",
  health: "bg-red-100 text-red-800",
  biosecurity: "bg-purple-100 text-purple-800",
  management: "bg-gray-100 text-gray-800",
};

export default function FlockTasksPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;

  const [flock, setFlock] = useState<BroilerFlock | null>(null);
  const [tasks, setTasks] = useState<FlockTask[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const canCreateEdit = user?.role === "owner" || user?.role === "manager";

  function loadAll() {
    apiFetch<BroilerFlock>(`/api/v1/broiler-flocks/${flockId}`)
      .then(setFlock)
      .catch((err) => setError(err.message));
    apiFetch<FlockTask[]>(`/api/v1/flock-tasks?flockId=${flockId}`)
      .then(setTasks)
      .catch((err) => setError(err.message));
  }

  async function generateTasks() {
    setGenerating(true);
    try {
      await apiFetch(`/api/v1/flock-tasks/generate`, {
        method: "POST",
        body: JSON.stringify({ flockId }),
      });
      loadAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function toggleTask(id: string, isCompleted: boolean) {
    try {
      await apiFetch(`/api/v1/flock-tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isCompleted, isSkipped: false }),
      });
      loadAll();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function skipTask(id: string) {
    try {
      await apiFetch(`/api/v1/flock-tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isSkipped: true, isCompleted: false }),
      });
      loadAll();
    } catch (e: any) {
      alert(e.message);
    }
  }

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (user && flockId) loadAll();
  }, [user, isLoading, flockId, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const pendingTasks = tasks.filter((t) => !t.isCompleted && !t.isSkipped);
  const completedTasks = tasks.filter((t) => t.isCompleted);
  const skippedTasks = tasks.filter((t) => t.isSkipped);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.push(`/broiler-flocks/${flockId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Flock
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Daily Checklist</h1>
          <div className="text-muted-foreground">{flock?.name || "Loading..."} — {pendingTasks.length} pending tasks</div>
        </div>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {canCreateEdit && (
        <div className="mb-6 flex gap-2">
          <Button onClick={generateTasks} disabled={generating}>
            <RefreshCw className={`h-4 w-4 mr-1 ${generating ? "animate-spin" : ""}`} /> Generate Tasks
          </Button>
          <Button variant="outline" onClick={() => router.push(`/broiler-flocks/${flockId}/calendar`)}>
            <ClipboardList className="h-4 w-4 mr-1" /> Calendar View
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {pendingTasks.length === 0 && completedTasks.length === 0 && skippedTasks.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No tasks yet. Click Generate Tasks to create the daily checklist from the vaccination schedule.
            </CardContent>
          </Card>
        )}

        {pendingTasks.map((task) => (
          <Card key={task.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={categoryColors[task.category] || "bg-gray-100"}>{task.category}</Badge>
                    <span className="text-sm text-muted-foreground">Day {task.ageDays} · {new Date(task.taskDate).toLocaleDateString()}</span>
                  </div>
                  <h3 className="font-semibold">{task.title}</h3>
                  {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                </div>
                {canCreateEdit && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => skipTask(task.id)}>
                      <XCircle className="h-4 w-4 mr-1" /> Skip
                    </Button>
                    <Button size="sm" onClick={() => toggleTask(task.id, true)}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Done
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {completedTasks.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mt-8 mb-4">Completed</h2>
            {completedTasks.map((task) => (
              <Card key={task.id} className="opacity-70">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className={categoryColors[task.category] || "bg-gray-100"}>{task.category}</Badge>
                          <span className="text-sm text-muted-foreground">Day {task.ageDays}</span>
                        </div>
                        <h3 className="font-medium line-through">{task.title}</h3>
                      </div>
                    </div>
                    {canCreateEdit && (
                      <Button size="sm" variant="ghost" onClick={() => toggleTask(task.id, false)}>
                        Undo
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {skippedTasks.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mt-8 mb-4">Skipped</h2>
            {skippedTasks.map((task) => (
              <Card key={task.id} className="opacity-60">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-gray-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={categoryColors[task.category] || "bg-gray-100"}>{task.category}</Badge>
                        <span className="text-sm text-muted-foreground">Day {task.ageDays}</span>
                      </div>
                      <h3 className="font-medium line-through">{task.title}</h3>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
