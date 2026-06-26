"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { Supplier, FeedStage, SupplierCategoryTemplate, SupplierCategoryTemplateItem } from "@/lib/types";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Pencil, Trash2, Plus, X, AlertTriangle, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SupplierFormData {
  name: string;
  description: string;
  chickenType: string;
  contact: string;
  isActive: boolean;
  isDefault: boolean;
}

interface StageFormData {
  id: string;
  stageName: string;
  stageType: "feed" | "chick" | "medication" | "other";
  dayRangeStart: string;
  dayRangeEnd: string;
  unitSizeKg: string;
  unitPriceZmw: string;
  intakePerBirdKg: string;
  sortOrder: number;
  isNew: boolean;
  isFromTemplate: boolean;
}

const emptyForm: SupplierFormData = {
  name: "",
  description: "",
  chickenType: "",
  contact: "",
  isActive: true,
  isDefault: false,
};

function stageToForm(stage: FeedStage): StageFormData {
  return {
    id: stage.id,
    stageName: stage.stageName,
    stageType: stage.stageType,
    dayRangeStart: stage.dayRangeStart?.toString() ?? "",
    dayRangeEnd: stage.dayRangeEnd?.toString() ?? "",
    unitSizeKg: stage.unitSizeKg.toString(),
    unitPriceZmw: stage.unitPriceZmw.toString(),
    intakePerBirdKg: stage.intakePerBirdKg.toString(),
    sortOrder: stage.sortOrder,
    isNew: false,
    isFromTemplate: false,
  };
}

function templateItemToForm(item: SupplierCategoryTemplateItem, tempId: number): StageFormData {
  const defaults = item.defaultFields || {};
  return {
    id: `temp-${tempId}`,
    stageName: item.itemName,
    stageType: item.itemType,
    dayRangeStart: defaults.dayRangeStart?.toString() ?? "",
    dayRangeEnd: defaults.dayRangeEnd?.toString() ?? "",
    unitSizeKg: defaults.unitSizeKg?.toString() ?? "",
    unitPriceZmw: "",
    intakePerBirdKg: defaults.intakePerBirdKg?.toString() ?? "",
    sortOrder: item.sortOrder,
    isNew: true,
    isFromTemplate: true,
  };
}

function emptyStageForm(tempId: number): StageFormData {
  return {
    id: `temp-${tempId}`,
    stageName: "",
    stageType: "feed",
    dayRangeStart: "",
    dayRangeEnd: "",
    unitSizeKg: "",
    unitPriceZmw: "",
    intakePerBirdKg: "",
    sortOrder: tempId,
    isNew: true,
    isFromTemplate: false,
  };
}

function SortableStageTab({
  stage,
  isActive,
  onRemove,
}: {
  stage: StageFormData;
  isActive: boolean;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TabsTrigger
        value={stage.id}
        className="relative pr-6 select-none"
        data-state={isActive ? "active" : "inactive"}
      >
        <span
          {...listeners}
          className="cursor-grab active:cursor-grabbing mr-1 text-muted-foreground hover:text-foreground"
          title="Drag to reorder"
        >
          <GripVertical className="h-3 w-3" />
        </span>
        {stage.stageName || "New Stage"}
        <button
          type="button"
          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(stage.id);
          }}
          title="Remove stage"
        >
          <X className="h-3 w-3" />
        </button>
      </TabsTrigger>
    </div>
  );
}

export default function SuppliersPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [feedTemplate, setFeedTemplate] = useState<SupplierCategoryTemplate | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormData>(emptyForm);
  const [formLoading, setFormLoading] = useState(false);

  const [stageForms, setStageForms] = useState<StageFormData[]>([]);
  const [activeStageTab, setActiveStageTab] = useState<string>("");
  const [deletedStageIds, setDeletedStageIds] = useState<string[]>([]);
  const [newStageCounter, setNewStageCounter] = useState(1);

  const [activeCategory, setActiveCategory] = useState("feed");

  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stagePrice, setStagePrice] = useState("");
  const [priceSaving, setPriceSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: () => null as any,
    })
  );

  const canCreateEdit = user?.role === "owner" || user?.role === "manager";
  const canDelete = user?.role === "owner";

  function loadSuppliers() {
    apiFetch<Supplier[]>("/api/v1/suppliers")
      .then(setSuppliers)
      .catch((err) => setError(err.message));
  }

  function loadFeedTemplate() {
    apiFetch<SupplierCategoryTemplate>("/api/v1/supplier-templates/feed")
      .then(setFeedTemplate)
      .catch((err) => console.error("Failed to load feed template:", err.message));
  }

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      loadSuppliers();
      loadFeedTemplate();
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  function getSortedStages(supplier: Supplier): (FeedStage | { missing: true; item: SupplierCategoryTemplateItem })[] {
    if (!feedTemplate) return supplier.feedStages;

    const stageMap = new Map(supplier.feedStages.map((s) => [s.stageName, s]));
    const result: (FeedStage | { missing: true; item: SupplierCategoryTemplateItem })[] = [];

    for (const item of feedTemplate.items) {
      const stage = stageMap.get(item.itemName);
      if (stage) {
        result.push(stage);
      } else if (item.isRequired) {
        result.push({ missing: true, item });
      }
    }

    for (const stage of supplier.feedStages) {
      if (!feedTemplate.items.find((i) => i.itemName === stage.stageName)) {
        result.push(stage);
      }
    }

    return result;
  }

  function getMissingTemplateItems(supplier: Supplier): SupplierCategoryTemplateItem[] {
    if (!feedTemplate) return [];
    const existingNames = new Set(supplier.feedStages.map((s) => s.stageName));
    return feedTemplate.items.filter((item) => !existingNames.has(item.itemName));
  }

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

    let counter = 1;
    const stages: StageFormData[] = [];

    if (feedTemplate) {
      const stageMap = new Map(supplier.feedStages.map((s) => [s.stageName, s]));
      for (const item of feedTemplate.items) {
        const stage = stageMap.get(item.itemName);
        if (stage) {
          stages.push(stageToForm(stage));
        } else {
          stages.push(templateItemToForm(item, counter++));
        }
      }
      for (const stage of supplier.feedStages) {
        if (!feedTemplate.items.find((i) => i.itemName === stage.stageName)) {
          stages.push(stageToForm(stage));
        }
      }
    } else {
      stages.push(...supplier.feedStages.map(stageToForm));
    }

    setStageForms(stages);
    setActiveStageTab(stages.length > 0 ? stages[0].id : "");
    setDeletedStageIds([]);
    setNewStageCounter(counter);
    setEditOpen(true);
  }

  function openCreate() {
    setEditingSupplier(null);
    setForm(emptyForm);

    let counter = 1;
    const stages: StageFormData[] = [];
    if (feedTemplate) {
      for (const item of feedTemplate.items) {
        stages.push(templateItemToForm(item, counter++));
      }
    } else {
      const initialStage = emptyStageForm(1);
      stages.push(initialStage);
      counter = 2;
    }

    setStageForms(stages);
    setActiveStageTab(stages.length > 0 ? stages[0].id : "");
    setDeletedStageIds([]);
    setNewStageCounter(counter);
    setCreateOpen(true);
  }

  function openDelete(supplier: Supplier) {
    setDeletingSupplier(supplier);
    setDeleteOpen(true);
  }

  function addStage() {
    if (editingSupplier && feedTemplate) {
      const existingNames = new Set(stageForms.map((s) => s.stageName));
      const missingItem = feedTemplate.items.find((item) => !existingNames.has(item.itemName));
      if (missingItem) {
        const newStage = templateItemToForm(missingItem, newStageCounter);
        setStageForms((prev) => [...prev, newStage]);
        setActiveStageTab(newStage.id);
        setNewStageCounter((n) => n + 1);
        return;
      }
    }
    const newStage = emptyStageForm(newStageCounter);
    setStageForms((prev) => [...prev, newStage]);
    setActiveStageTab(newStage.id);
    setNewStageCounter((n) => n + 1);
  }

  function removeStage(stageId: string) {
    setStageForms((prev) => prev.filter((s) => s.id !== stageId));
    if (!stageId.startsWith("temp-")) {
      setDeletedStageIds((prev) => [...prev, stageId]);
    }
    setActiveStageTab((active) => {
      const remaining = stageForms.filter((s) => s.id !== stageId);
      if (active === stageId && remaining.length > 0) {
        return remaining[0].id;
      }
      return active;
    });
  }

  function updateStage(stageId: string, updates: Partial<StageFormData>) {
    setStageForms((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, ...updates } : s))
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setStageForms((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const moved = arrayMove(prev, oldIndex, newIndex);
      return moved.map((s, idx) => ({ ...s, sortOrder: idx }));
    });
  }

  async function handleCreate() {
    setFormLoading(true);
    try {
      const supplier = await apiFetch<Supplier>("/api/v1/suppliers", {
        method: "POST",
        body: JSON.stringify(form),
      });
      await Promise.all(
        stageForms.map((s) =>
          apiFetch("/api/v1/feed-stages", {
            method: "POST",
            body: JSON.stringify({
              supplierId: supplier.id,
              stageName: s.stageName,
              stageType: s.stageType,
              dayRangeStart: s.dayRangeStart ? Number(s.dayRangeStart) : undefined,
              dayRangeEnd: s.dayRangeEnd ? Number(s.dayRangeEnd) : undefined,
              unitSizeKg: Number(s.unitSizeKg) || 0,
              unitPriceZmw: Number(s.unitPriceZmw) || 0,
              intakePerBirdKg: Number(s.intakePerBirdKg) || 0,
              sortOrder: s.sortOrder,
            }),
          })
        )
      );
      setSuccess("Supplier created successfully.");
      setCreateOpen(false);
      setForm(emptyForm);
      setStageForms([]);
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

      await Promise.all(
        stageForms
          .filter((s) => !s.isNew)
          .map((s) =>
            apiFetch(`/api/v1/feed-stages/${s.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                stageName: s.stageName,
                stageType: s.stageType,
                dayRangeStart: s.dayRangeStart ? Number(s.dayRangeStart) : undefined,
                dayRangeEnd: s.dayRangeEnd ? Number(s.dayRangeEnd) : undefined,
                unitSizeKg: Number(s.unitSizeKg) || 0,
                unitPriceZmw: Number(s.unitPriceZmw) || 0,
                intakePerBirdKg: Number(s.intakePerBirdKg) || 0,
                sortOrder: s.sortOrder,
              }),
            })
          )
      );

      await Promise.all(
        stageForms
          .filter((s) => s.isNew)
          .map((s) =>
            apiFetch("/api/v1/feed-stages", {
              method: "POST",
              body: JSON.stringify({
                supplierId: editingSupplier.id,
                stageName: s.stageName,
                stageType: s.stageType,
                dayRangeStart: s.dayRangeStart ? Number(s.dayRangeStart) : undefined,
                dayRangeEnd: s.dayRangeEnd ? Number(s.dayRangeEnd) : undefined,
                unitSizeKg: Number(s.unitSizeKg) || 0,
                unitPriceZmw: Number(s.unitPriceZmw) || 0,
                intakePerBirdKg: Number(s.intakePerBirdKg) || 0,
                sortOrder: s.sortOrder,
              }),
            })
          )
      );

      await Promise.all(
        deletedStageIds.map((id) =>
          apiFetch(`/api/v1/feed-stages/${id}`, { method: "DELETE" })
        )
      );

      setSuccess("Supplier updated successfully.");
      setEditOpen(false);
      setEditingSupplier(null);
      setForm(emptyForm);
      setStageForms([]);
      setDeletedStageIds([]);
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
      await apiFetch(`/api/v1/suppliers/${deletingSupplier.id}`, {
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
    const value = Number(stagePrice);
    if (Number.isNaN(value) || value < 0) {
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
          <p className="text-muted-foreground">Manage suppliers by category</p>
        </div>
        {canCreateEdit && activeCategory === "feed" && (
          <Button onClick={openCreate}>
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

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-6">
        <TabsList>
          <TabsTrigger value="feed">Feed & Chicks</TabsTrigger>
          <TabsTrigger value="vaccine">Vaccine</TabsTrigger>
          <TabsTrigger value="labour">Labour</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="misc">Misc.</TabsTrigger>
        </TabsList>

        <TabsContent value="feed">
          <div className="grid gap-6">
            {suppliers.map((supplier) => {
              const missingItems = getMissingTemplateItems(supplier);
              const sortedStages = getSortedStages(supplier);
              return (
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
                          {missingItems.length > 0 && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {missingItems.length} missing
                            </Badge>
                          )}
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
                        {sortedStages.map((stageOrMissing, idx) => {
                          if ("missing" in stageOrMissing) {
                            const item = stageOrMissing.item;
                            return (
                              <TableRow key={`missing-${idx}`} className="bg-destructive/5">
                                <TableCell className="font-medium text-destructive flex items-center gap-2">
                                  <AlertTriangle className="h-3 w-3" />
                                  {item.itemName}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{item.itemType}</Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm italic">—</TableCell>
                                <TableCell className="text-muted-foreground text-sm italic">—</TableCell>
                                <TableCell className="text-muted-foreground text-sm italic">—</TableCell>
                                <TableCell className="text-muted-foreground text-sm italic">—</TableCell>
                              </TableRow>
                            );
                          }
                          const stage = stageOrMissing as FeedStage;
                          return (
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="vaccine">
          <PlaceholderTab title="Vaccine" icon="💉" />
        </TabsContent>
        <TabsContent value="labour">
          <PlaceholderTab title="Labour" icon="👷" />
        </TabsContent>
        <TabsContent value="equipment">
          <PlaceholderTab title="Equipment" icon="🔧" />
        </TabsContent>
        <TabsContent value="misc">
          <PlaceholderTab title="Miscellaneous" icon="📦" />
        </TabsContent>
      </Tabs>

      <Dialog
        open={createOpen || editOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditOpen(false);
            setEditingSupplier(null);
            setForm(emptyForm);
            setStageForms([]);
            setDeletedStageIds([]);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{editingSupplier ? "Edit" : "Create"} Supplier</DialogTitle>
            <DialogDescription>
              {editingSupplier ? "Update supplier details and feed stages." : "Add a new supplier with feed stages."}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto px-6 py-4 space-y-4">
            <div className="grid gap-3">
              <div>
                <Label htmlFor="sup-name">Name</Label>
                <Input id="sup-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="sup-desc">Description</Label>
                <Input id="sup-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="sup-contact">Contact</Label>
                <Input id="sup-contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              </div>
              <div className="flex gap-4 items-center">
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

            <hr />

            {stageForms.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Feed Stages</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addStage}>
                    <Plus className="h-3 w-3 mr-1" /> Add Stage
                  </Button>
                </div>
                <Tabs value={activeStageTab} onValueChange={setActiveStageTab}>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={stageForms.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
                      <TabsList className="flex-wrap h-auto">
                        {stageForms.map((stage) => (
                          <SortableStageTab
                            key={stage.id}
                            stage={stage}
                            isActive={activeStageTab === stage.id}
                            onRemove={removeStage}
                          />
                        ))}
                      </TabsList>
                    </SortableContext>
                  </DndContext>
                  {stageForms.map((stage) => (
                    <TabsContent key={stage.id} value={stage.id} className="space-y-3 mt-3">
                      <div>
                        <Label>Stage Name</Label>
                        <Input
                          value={stage.stageName}
                          placeholder="e.g., Starter"
                          onChange={(e) => updateStage(stage.id, { stageName: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Stage Type</Label>
                        <select
                          className="w-full border rounded-md p-2 bg-background text-foreground"
                          value={stage.stageType}
                          onChange={(e) => updateStage(stage.id, { stageType: e.target.value as any })}
                        >
                          <option value="feed">feed</option>
                          <option value="chick">chick</option>
                          <option value="medication">medication</option>
                          <option value="other">other</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Day Range Start</Label>
                          <Input
                            type="number"
                            value={stage.dayRangeStart}
                            placeholder="0"
                            onChange={(e) => updateStage(stage.id, { dayRangeStart: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Day Range End</Label>
                          <Input
                            type="number"
                            value={stage.dayRangeEnd}
                            placeholder="7"
                            onChange={(e) => updateStage(stage.id, { dayRangeEnd: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Unit Size (kg)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={stage.unitSizeKg}
                          placeholder="50"
                          onChange={(e) => updateStage(stage.id, { unitSizeKg: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Unit Price (ZMW)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={stage.unitPriceZmw}
                          placeholder="0.00"
                          onChange={(e) => updateStage(stage.id, { unitPriceZmw: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Intake/Bird (kg)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={stage.intakePerBirdKg}
                          placeholder="0.00"
                          onChange={(e) => updateStage(stage.id, { intakePerBirdKg: e.target.value })}
                        />
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-0">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditOpen(false); }} disabled={formLoading}>
              Cancel
            </Button>
            <Button onClick={editingSupplier ? handleUpdate : handleCreate} disabled={formLoading}>
              {formLoading ? "Saving..." : (editingSupplier ? "Save Changes" : "Create Supplier")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingSupplier?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={formLoading}>
              {formLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlaceholderTab({ title, icon }: { title: string; icon: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <div className="text-4xl mb-4">{icon}</div>
        <CardTitle className="text-lg mb-2">{title} Suppliers</CardTitle>
        <p className="text-muted-foreground text-sm">{title} supplier management coming soon.</p>
      </CardContent>
    </Card>
  );
}
