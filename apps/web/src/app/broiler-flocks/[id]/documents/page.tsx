"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, apiUpload, getToken, API_URL } from "@/lib/api/client";
import { BroilerFlock, DocumentRecord } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileText, Trash2, Download, Upload, File } from "lucide-react";
import { FlockSubNav } from "@/components/flock-subnav";

const categoryOptions = ["Receipt", "Invoice", "Quotation", "Other"];

const acceptedFileTypes = ".pdf,.jpg,.png,.webp,.doc,.docx,.csv";

function fmtSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <File className="h-5 w-5 text-blue-500" />;
  if (mimeType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

async function downloadFile(doc: DocumentRecord) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/documents/${doc.id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    alert("Failed to download file.");
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = doc.fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;

  const [flock, setFlock] = useState<BroilerFlock | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("Receipt");

  const canManageDocuments =
    user?.role === "owner" ||
    user?.role === "manager" ||
    user?.role === "flock_minder" ||
    user?.role === "sales_person";
  const canDelete = user?.role === "owner" || user?.role === "manager";

  function loadAll() {
    apiFetch<BroilerFlock>(`/api/v1/broiler-flocks/${flockId}`)
      .then(setFlock)
      .catch((err) => setError(err.message));
    apiFetch<DocumentRecord[]>(`/api/v1/documents?flockId=${flockId}`)
      .then(setDocuments)
      .catch((err) => setError(err.message));
  }

  async function uploadFile(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      alert("Please select a file to upload.");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("flockId", flockId);
      formData.append("category", category);
      await apiUpload("/api/v1/documents", formData);
      setFile(null);
      setCategory("Receipt");
      loadAll();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(id: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await apiFetch(`/api/v1/documents/${id}`, { method: "DELETE" });
      loadAll();
    } catch (e: any) {
      alert(e.message);
    }
  }

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user && flockId) loadAll();
  }, [user, isLoading, flockId, router]);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!user) return null;

  // Group documents by category
  const grouped = documents.reduce((acc, doc) => {
    const cat = doc.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {} as Record<string, DocumentRecord[]>);

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

      {/* Upload Form */}
      {canManageDocuments && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Upload Document
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={uploadFile} className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label htmlFor="file">File</Label>
                <input
                  id="file"
                  type="file"
                  accept={acceptedFileTypes}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="flex w-full rounded-md border border-input bg-transparent text-sm shadow-sm transition-colors file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer p-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Accepted: {acceptedFileTypes}
                </p>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <Button type="submit" disabled={saving || !file}>
                  {saving ? "Uploading..." : "Upload Document"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Documents grouped by category */}
      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No documents yet</h3>
          <p className="text-muted-foreground">
            Upload receipts, invoices, quotations, or other files for this flock.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, docs]) => (
          <div key={cat}>
            <h2 className="text-lg font-semibold mb-3">{cat}</h2>
            <div className="space-y-3">
              {docs.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {fileIcon(doc.mimeType)}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{doc.fileName}</div>
                          <div className="text-xs text-muted-foreground">
                            {fmtSize(doc.fileSizeKb)} ·{" "}
                            {new Date(doc.createdAt).toLocaleDateString()}
                            {doc.uploadedBy && ` · ${doc.uploadedBy}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadFile(doc)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => deleteDocument(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
