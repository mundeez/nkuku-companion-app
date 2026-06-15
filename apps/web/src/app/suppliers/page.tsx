"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Supplier, FeedStage } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { Pencil, Trash2, Plus } from "lucide-react";

interface SupplierFormData {
  name: string;
  description: string;
  chickenType: string;
  contact: string;
  isActive: boolean;
  isDefault: boolean;
}

const emptyForm: SupplierFormData = {
  name: "",
  description: "",
  chickenType: "",
  contact: "",
  isActive: true,
  isDefault: false,
};

export default function SuppliersPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormData>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);

  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stagePrice, setStagePrice] = useState<string>("");
  const [priceSaving, setPriceSaving] = useState(false);

  const canCreateEdit = user?.role === "owner" || user?.role === "manager";
  const canDelete = user?.role === "owner";

  function loadSuppliers() {
    apiFetch<Supplier[]>("/api/v1/suppliers")
      .then(setSuppliers)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) loadSuppliers();
  }, [user, isLoading, router]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  function openEdit(supplier: Supplier) {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      description: supplier.description || "",
      chickenType: supplier.chickenType || "",
      contact: supplier.contact || "",
      isActive: supplier.isActive,
      isDefault: supplier.isDefault,
    });
    setEditOpen(true);
  }

  function openDelete(supplier: Supplier) {
    setDeletingSupplier(supplier);
    setDeleteOpen(true);
  }

  async function handleCreate() {
    setFormLoading(true);
    try {
      await apiFetch<Supplier>("/api/v1/suppliers", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSuccess("Supplier created successfully.");
      setCreateOpen(false);
      setForm(emptyForm);
      loadSuppliers();
    } catch (err: any) {
      setError(err.message || "Failed to create supplier.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editingSupplier) return;
    setFormLoading(true);
    try {
      await apiFetch<Supplier>(`/api/v1/suppliers/${editingSupplier.id}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setSuccess("Supplier updated successfully.");
      setEditOpen(false);
      setEditingSupplier(null);
      loadSuppliers();
    } catch (err: any) {
      setError(err.message || "Failed to update supplier.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!deletingSupplier) return;
    setFormLoading(true);
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/suppliers/${deletingSupplier.id}`, {
        method: "DELETE",
      });
      setSuccess("Supplier deleted successfully.");
      setDeleteOpen(false);
      setDeletingSupplier(null);
      loadSuppliers();
    } catch (err: any) {
      setError(err.message || "Failed to delete supplier.");
    } finally {
      setFormLoading(false);
    }
  }

  async function saveStagePrice(stage: FeedStage) {
    const value = parseFloat(stagePrice);
    if (Number.isNaN(value) || value < 0) {
      setError("Invalid price value.");
      setEditingStageId(null);
      return;
    }
    setPriceSaving(true);
    try {
      await apiFetch<FeedStage>(`/api/v1/feed-stages/${stage.id}`, {
        method: "PATCH",
        body: JSON.stringify({ unitPriceZmw: value }),
      });
      setSuccess("Unit price updated.");
      loadSuppliers();
    } catch (err: any) {
      setError(err.message || "Failed to update price.");
    } finally {
      setPriceSaving(false);
      setEditingStageId(null);
    }
  }

  function startEditingPrice(stage: FeedStage) {
    setEditingStageId(stage.id);
    setStagePrice(stage.unitPriceZmw.toString());
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Suppliers</h1>
          <p className="text-muted-foreground">Feed suppliers and their pricing</p>
        </div>
        {canCreateEdit && (
          <Button onClick={() => { setForm(emptyForm); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Supplier
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

      <div className="grid gap-6">
        {suppliers.map((supplier) => (
          <Card key={supplier.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{supplier.name}</CardTitle>
                  {supplier.contact && (
                    <p className="text-sm text-muted-foreground mt-1">Contact: {supplier.contact}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-2">
                    {supplier.isDefault && <Badge variant="default">Default</Badge>}
                    {supplier.chickenType && <Badge variant="secondary">{supplier.chickenType}</Badge>}
                    {!supplier.isActive && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  {canCreateEdit && (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(supplier)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => openDelete(supplier)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {supplier.description && (
                <p className="text-sm text-muted-foreground mt-1">{supplier.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Unit Size</TableHead>
                    <TableHead>Unit Price (ZMW)</TableHead>
                    <TableHead>Intake/Bird (kg)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.feedStages.map((stage) => (
                    <TableRow key={stage.id}>
                      <TableCell className="font-medium">{stage.stageName}</TableCell>
                      <TableCell>
                        <Badge variant={stage.stageType === "chick" ? "secondary" : "outline"}>
                          {stage.stageType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {stage.dayRangeStart != null && stage.dayRangeEnd != null
                          ? `${stage.dayRangeStart}-${stage.dayRangeEnd}`
                          : "-"}
                      </TableCell>
                      <TableCell>{stage.unitSizeKg} kg</TableCell>
                      <TableCell
                        className={canCreateEdit ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => {
                          if (canCreateEdit) startEditingPrice(stage);
                        }}
                      >
                        {editingStageId === stage.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            autoFocus
                            disabled={priceSaving}
                            className="w-28 h-8 text-sm"
                            value={stagePrice}
                            onChange={(e) => setStagePrice(e.target.value)}
                            onBlur={() => saveStagePrice(stage)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveStagePrice(stage);
                              if (e.key === "Escape") setEditingStageId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className={canCreateEdit ? "underline decoration-dotted" : ""}>
                            {Number(stage.unitPriceZmw).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{stage.intakePerBirdKg}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Supplier</DialogTitle>
            <DialogDescription>Add a new feed supplier.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="chickenType">Chicken Type</Label>
              <Input id="chickenType" value={form.chickenType} onChange={(e) => setForm({ ...form, chickenType: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact">Contact</Label>
              <Input id="contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                Default
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={formLoading || !form.name}>
              {formLoading ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>Update supplier details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input id="edit-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-chickenType">Chicken Type</Label>
              <Input id="edit-chickenType" value={form.chickenType} onChange={(e) => setForm({ ...form, chickenType: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-contact">Contact</Label>
              <Input id="edit-contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                Default
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={formLoading || !form.name}>
              {formLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingSupplier?.name}</strong>? This action cannot be undone.
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

