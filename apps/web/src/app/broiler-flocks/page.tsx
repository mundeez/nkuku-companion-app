"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast-provider";
import { apiFetch } from "@/lib/api/client";
import { BroilerFlock, Breed } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Eye, TrendingUp, AlertTriangle } from "lucide-react";

interface FlockFormData {
  name: string;
  breedId: string;
  startDate: string;
  initialCount: number;
  targetWeight?: number;
  targetAge?: number;
  feedTransitionDay?: number;
}

const emptyForm: FlockFormData = {
  name: "",
  breedId: "",
  startDate: new Date().toISOString().split("T")[0],
  initialCount: 500,
  targetWeight: 2.5,
  targetAge: 42,
  feedTransitionDay: 11,
};

export default function BroilerFlocksPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { addToast } = useToast();
  const [flocks, setFlocks] = useState<BroilerFlock[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingFlock, setEditingFlock] = useState<BroilerFlock | null>(null);
  const [deletingFlock, setDeletingFlock] = useState<BroilerFlock | null>(null);
  const [form, setForm] = useState<FlockFormData>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);

  const canCreateEdit = user?.role === "owner" || user?.role === "manager";
  const canDelete = user?.role === "owner";

  function loadData() {
    apiFetch<BroilerFlock[]>("/api/v1/broiler-flocks")
      .then(setFlocks)
      .catch((err) => setError(err.message));
    apiFetch<Breed[]>("/api/v1/breeds")
      .then(setBreeds)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) loadData();
  }, [user, isLoading, router]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  function openEdit(flock: BroilerFlock) {
    setEditingFlock(flock);
    setForm({
      name: flock.name,
      breedId: flock.breedId,
      startDate: new Date(flock.startDate).toISOString().split("T")[0],
      initialCount: flock.initialCount,
      targetWeight: flock.targetWeight || undefined,
      targetAge: flock.targetAge || undefined,
      feedTransitionDay: flock.feedTransitionDay || 11,
    });
    setEditOpen(true);
  }

  function openDelete(flock: BroilerFlock) {
    setDeletingFlock(flock);
    setDeleteOpen(true);
  }

  function getAgeDays(startDate: string): number {
    const today = new Date();
    const start = new Date(startDate);
    return Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  async function handleCreate() {
    setFormLoading(true);
    try {
      await apiFetch<BroilerFlock>("/api/v1/broiler-flocks", {
        method: "POST",
        body: JSON.stringify(form),
      });
      addToast("Flock created successfully.", "success");
      setCreateOpen(false);
      setForm(emptyForm);
      loadData();
    } catch (err: any) {
      addToast(err.message || "Failed to create flock.", "error");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editingFlock) return;
    setFormLoading(true);
    try {
      await apiFetch<BroilerFlock>(`/api/v1/broiler-flocks/${editingFlock.id}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      addToast("Flock updated successfully.", "success");
      setEditOpen(false);
      setEditingFlock(null);
      loadData();
    } catch (err: any) {
      addToast(err.message || "Failed to update flock.", "error");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!deletingFlock) return;
    setFormLoading(true);
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/broiler-flocks/${deletingFlock.id}`, {
        method: "DELETE",
      });
      addToast("Flock deleted successfully.", "success");
      setDeleteOpen(false);
      setDeletingFlock(null);
      loadData();
    } catch (err: any) {
      addToast(err.message || "Failed to delete flock.", "error");
    } finally {
      setFormLoading(false);
    }
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  const primaryBreed = breeds.find((b) => b.isPrimary);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Broiler Flocks</h1>
          <p className="text-muted-foreground">
            Manage your broiler flocks ({flocks.filter((f) => f.status === "active").length} active)
          </p>
        </div>
        {canCreateEdit && (
          <Button onClick={() => { setForm({ ...emptyForm, breedId: primaryBreed?.id || "" }); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Flock
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 rounded-lg bg-green-100 text-green-800 text-sm">
          {success}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {flocks.map((flock) => {
          const ageDays = getAgeDays(flock.startDate);
          const mortality = flock.initialCount > 0
            ? ((flock.initialCount - flock.currentCount) / flock.initialCount * 100).toFixed(1)
            : "0";

          return (
            <Card key={flock.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{flock.name}</CardTitle>
                  {getStatusBadge(flock.status)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {flock.breed?.name} | Day {ageDays}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Birds</span>
                    <span className="font-medium">{flock.currentCount} / {flock.initialCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Mortality</span>
                    <span className={`font-medium ${Number(mortality) > 10 ? "text-red-600" : ""}`}>
                      {mortality}%
                    </span>
                  </div>
                  {flock.targetWeight && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Target Weight</span>
                      <span className="font-medium">{flock.targetWeight} kg @ Day {flock.targetAge}</span>
                    </div>
                  )}
                  {flock.feedTransitionDay && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Feed Transition</span>
                      <span className="font-medium">Day {flock.feedTransitionDay}</span>
                    </div>
                  )}
                  <div className="pt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/broiler-flocks/${flock.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Manage
                    </Button>
                    {canCreateEdit && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(flock)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => openDelete(flock)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {flocks.length === 0 && (
        <div className="text-center py-12">
          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No flocks yet</h3>
          <p className="text-muted-foreground mb-4">Create your first broiler flock to get started.</p>
          {canCreateEdit && (
            <Button onClick={() => { setForm({ ...emptyForm, breedId: primaryBreed?.id || "" }); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              New Flock
            </Button>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Flock</DialogTitle>
            <DialogDescription>Enter flock details. Start date = Day 0.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Flock Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Flock A - June 2026" />
            </div>
            <div>
              <Label>Breed</Label>
              <Select value={form.breedId} onValueChange={(v) => setForm({ ...form, breedId: v })}>
                <SelectTrigger><SelectValue placeholder="Select breed" /></SelectTrigger>
                <SelectContent>
                  {breeds.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} {b.isPrimary && "(Primary)"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date (Day 0)</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <Label>Initial Bird Count</Label>
              <Input type="number" value={form.initialCount} onChange={(e) => setForm({ ...form, initialCount: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Weight (kg)</Label>
                <Input type="number" step="0.1" value={form.targetWeight || ""} onChange={(e) => setForm({ ...form, targetWeight: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Target Age (days)</Label>
                <Input type="number" value={form.targetAge || ""} onChange={(e) => setForm({ ...form, targetAge: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Feed Transition Day (Starter to Grower)</Label>
              <Input type="number" value={form.feedTransitionDay || ""} onChange={(e) => setForm({ ...form, feedTransitionDay: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={formLoading || !form.name || !form.breedId}>
              {formLoading ? "Creating..." : "Create Flock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Flock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Flock Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Weight (kg)</Label>
                <Input type="number" step="0.1" value={form.targetWeight || ""} onChange={(e) => setForm({ ...form, targetWeight: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Target Age (days)</Label>
                <Input type="number" value={form.targetAge || ""} onChange={(e) => setForm({ ...form, targetAge: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Feed Transition Day</Label>
              <Input type="number" value={form.feedTransitionDay || ""} onChange={(e) => setForm({ ...form, feedTransitionDay: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editingFlock?.status || "active"} onValueChange={(v: any) => { if (editingFlock) setEditingFlock({ ...editingFlock, status: v }); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={formLoading}>
              {formLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Flock</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingFlock?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={formLoading}>
              {formLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
