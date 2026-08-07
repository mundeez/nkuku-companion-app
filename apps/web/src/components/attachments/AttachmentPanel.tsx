"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, apiUpload, API_URL } from "@/lib/api/client";
import { DocumentRecord } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileText, Trash2, Download, Upload, File, Search, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

/**
 * Props for the AttachmentPanel.
 * Pass exactly one of: flockId, financialRecordId, journalEntryId, saleRecordId.
 * flockId can be combined with financialRecordId/saleRecordId (the flock is
 * inferred from the record), but flockId alone is for general flock documents.
 */
interface AttachmentPanelProps {
  flockId?: string;
  financialRecordId?: string;
  journalEntryId?: string;
  saleRecordId?: string;
  title?: string;
  canManage?: boolean;
  canDelete?: boolean;
}

const categoryOptions = [
  "receipt", "invoice", "quotation", "other",
  "bank_statement", "contract", "delivery_note",
];

const acceptedFileTypes = ".pdf,.jpg,.png,.webp,.doc,.docx,.csv,.xlsx,.xls";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

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
  const res = await fetch(`${API_URL}/api/v1/documents/${doc.id}/download`, {
    credentials: "include",
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

async function viewFile(doc: DocumentRecord) {
  const res = await fetch(`${API_URL}/api/v1/documents/${doc.id}/view`, {
    credentials: "include",
  });
  if (!res.ok) {
    alert("Failed to view file.");
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function AttachmentPanel({
  flockId,
  financialRecordId,
  journalEntryId,
  saleRecordId,
  title = "Attachments",
  canManage = true,
  canDelete = true,
}: AttachmentPanelProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DocumentRecord[] | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("receipt");

  // Build the query params for listing documents
  const buildListParams = useCallback(() => {
    const params = new URLSearchParams();
    if (financialRecordId) params.set("financialRecordId", financialRecordId);
    if (journalEntryId) params.set("journalEntryId", journalEntryId);
    if (saleRecordId) params.set("saleRecordId", saleRecordId);
    if (flockId && !financialRecordId && !saleRecordId) params.set("flockId", flockId);
    return params.toString();
  }, [flockId, financialRecordId, journalEntryId, saleRecordId]);

  const loadDocuments = useCallback(() => {
    setLoading(true);
    const qs = buildListParams();
    if (!qs) {
      setLoading(false);
      return;
    }
    apiFetch<DocumentRecord[]>(`/api/v1/documents?${qs}`)
      .then(setDocuments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [buildListParams]);

  // Build form data for upload
  function buildFormData(file: File, category: string): FormData {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    if (financialRecordId) formData.append("financialRecordId", financialRecordId);
    if (journalEntryId) formData.append("journalEntryId", journalEntryId);
    if (saleRecordId) formData.append("saleRecordId", saleRecordId);
    if (flockId && !financialRecordId && !saleRecordId && !journalEntryId) {
      formData.append("flockId", flockId);
    }
    return formData;
  }

  async function uploadFile(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      alert("Please select a file to upload.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert("File exceeds 25MB limit.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const formData = buildFormData(file, category);
      await apiUpload("/api/v1/documents", formData);
      setFile(null);
      setCategory("receipt");
      loadDocuments();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(id: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await apiFetch(`/api/v1/documents/${id}`, { method: "DELETE" });
      loadDocuments();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function searchDocuments() {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const params = new URLSearchParams();
    params.set("q", searchQuery.trim());
    if (financialRecordId) params.set("financialRecordId", financialRecordId);
    if (journalEntryId) params.set("journalEntryId", journalEntryId);
    if (saleRecordId) params.set("saleRecordId", saleRecordId);
    if (flockId && !financialRecordId && !saleRecordId) params.set("flockId", flockId);
    try {
      const results = await apiFetch<DocumentRecord[]>(`/api/v1/documents/search?${params.toString()}`);
      setSearchResults(results);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Auto-refresh to update extraction status
  useEffect(() => {
    const hasPending = documents.some((d) => d.extractionStatus === "pending");
    if (!hasPending) return;
    const timer = setTimeout(() => loadDocuments(), 5000);
    return () => clearTimeout(timer);
  }, [documents, loadDocuments]);

  const displayDocs = searchResults ?? documents;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4" /> {title}
          {documents.length > 0 && (
            <span className="text-sm text-muted-foreground font-normal">
              ({documents.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Search bar */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search attachment contents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchDocuments()}
            className="flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm"
          />
          <Button variant="outline" size="sm" onClick={searchDocuments}>
            <Search className="h-4 w-4" />
          </Button>
          {searchResults && (
            <Button variant="ghost" size="sm" onClick={() => { setSearchResults(null); setSearchQuery(""); }}>
              Clear
            </Button>
          )}
        </div>

        {/* Upload form */}
        {canManage && (
          <form onSubmit={uploadFile} className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="att-file">File (max 25MB)</Label>
              <input
                id="att-file"
                type="file"
                accept={acceptedFileTypes}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="flex w-full rounded-md border border-input bg-transparent text-sm shadow-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer p-1"
              />
            </div>
            <div>
              <Label htmlFor="att-category">Category</Label>
              <select
                id="att-category"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={saving || !file}>
                {saving ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </form>
        )}

        {/* Document list */}
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : displayDocs.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            {searchResults ? "No results found." : "No attachments yet."}
          </div>
        ) : (
          <div className="space-y-2">
            {displayDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {fileIcon(doc.mimeType)}
                  <div className="min-w-0">
                    <div className="font-medium truncate text-sm">{doc.fileName}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      {fmtSize(doc.fileSizeKb)} · {new Date(doc.createdAt).toLocaleDateString()}
                      {doc.scanStatus === "clean" && (
                        <span className="flex items-center gap-0.5 text-green-600">
                          <ShieldCheck className="h-3 w-3" />
                        </span>
                      )}
                      {doc.scanStatus === "skipped" && (
                        <span className="flex items-center gap-0.5 text-yellow-600">
                          <ShieldAlert className="h-3 w-3" />
                        </span>
                      )}
                      {doc.extractionStatus === "pending" && (
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => viewFile(doc)}>
                    View
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadFile(doc)}>
                    <Download className="h-4 w-4" />
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
