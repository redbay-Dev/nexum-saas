import { useState } from "react";
import {
  FileText,
  Search,
  Upload,
  Download,
  Share2,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  useDocuments,
  useExpiringDocuments,
  useDeleteDocument,
  useCreatePublicLink,
} from "@frontend/api/documents.js";
import type { DocumentListParams, DocumentListItem } from "@frontend/api/documents.js";
import { Button } from "@frontend/components/ui/button.js";
import { Input } from "@frontend/components/ui/input.js";
import { Badge } from "@frontend/components/ui/badge.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@frontend/components/ui/card.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/components/ui/table.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/components/ui/select.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@frontend/components/ui/dialog.js";
import { Tabs, TabsList, TabsTrigger } from "@frontend/components/ui/tabs.js";
import { Skeleton } from "@frontend/components/ui/skeleton.js";
import { toast } from "sonner";
import { api } from "@frontend/lib/api-client.js";
import type { DownloadResponse } from "@frontend/api/documents.js";

type EntityTypeFilter = "all" | "employee" | "asset" | "company" | "job";

const ENTITY_TYPE_TABS: Array<{ value: EntityTypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "employee", label: "Employee" },
  { value: "asset", label: "Asset" },
  { value: "company", label: "Company" },
  { value: "job", label: "Job" },
];

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  expired: "destructive",
  pending: "secondary",
  archived: "outline",
};

const DOCUMENT_TYPES = [
  { value: "licence", label: "Licence" },
  { value: "registration", label: "Registration" },
  { value: "insurance", label: "Insurance" },
  { value: "certificate", label: "Certificate" },
  { value: "contract", label: "Contract" },
  { value: "photo", label: "Photo" },
  { value: "report", label: "Report" },
  { value: "other", label: "Other" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function UploadDialog(): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        <div className="py-8 text-center text-muted-foreground">
          <Upload className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">
            Drag and drop a file here, or click to browse.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Supported: PDF, JPG, PNG, DOCX, XLSX (max 25 MB)
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocumentActions({ doc }: { doc: DocumentListItem }): React.JSX.Element {
  const deleteDoc = useDeleteDocument();
  const createLink = useCreatePublicLink();

  async function handleDownload(): Promise<void> {
    try {
      const result = await api.get<DownloadResponse>(`/api/v1/documents/${doc.id}/download`);
      window.open(result.downloadUrl, "_blank");
    } catch {
      toast.error("Failed to generate download link");
    }
  }

  async function handleShare(): Promise<void> {
    try {
      const result = await createLink.mutateAsync({ documentId: doc.id });
      await navigator.clipboard.writeText(result.url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Failed to create share link");
    }
  }

  async function handleDelete(): Promise<void> {
    try {
      await deleteDoc.mutateAsync(doc.id);
      toast.success("Document deleted");
    } catch {
      toast.error("Failed to delete document");
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={() => void handleDownload()} title="Download">
        <Download className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => void handleShare()} title="Share">
        <Share2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void handleDelete()}
        title="Delete"
        disabled={deleteDoc.isPending}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

export function DocumentsPage(): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityTypeFilter>("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const params: DocumentListParams = {};
  if (search) params.search = search;
  if (entityTypeFilter !== "all") params.entityType = entityTypeFilter;
  if (documentTypeFilter && documentTypeFilter !== "all") params.documentType = documentTypeFilter;
  if (statusFilter && statusFilter !== "all") params.status = statusFilter;

  const { data, isLoading } = useDocuments(params);
  const { data: expiringData } = useExpiringDocuments(30);

  const documents = data?.data ?? [];
  const expiringDocs = expiringData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Manage files and documents across your organisation
          </p>
        </div>
        <UploadDialog />
      </div>

      {/* Expiring documents warning */}
      {expiringDocs.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-sm text-amber-800 dark:text-amber-200">
                Documents Expiring Soon
              </CardTitle>
            </div>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              {expiringDocs.length} document{expiringDocs.length !== 1 ? "s" : ""} expiring within 30 days
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {expiringDocs.slice(0, 5).map((doc) => (
                <Badge key={doc.id} variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-200">
                  {doc.fileName} -- expires {formatDate(doc.expiresAt)}
                </Badge>
              ))}
              {expiringDocs.length > 5 && (
                <Badge variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-200">
                  +{expiringDocs.length - 5} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entity type tabs */}
      <Tabs
        value={entityTypeFilter}
        onValueChange={(val) => setEntityTypeFilter(val as EntityTypeFilter)}
      >
        <TabsList>
          {ENTITY_TYPE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by filename..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {DOCUMENT_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>
                    {dt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No documents found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {doc.fileName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {doc.documentType}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{doc.entityType}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[doc.status] ?? "secondary"} className="capitalize">
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(doc.createdAt)}</TableCell>
                    <TableCell>{formatDate(doc.expiresAt)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatFileSize(doc.fileSize)}
                    </TableCell>
                    <TableCell>{formatDate(doc.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DocumentActions doc={doc} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && (
        <div className="text-xs text-muted-foreground">
          Showing {documents.length} of {data.total ?? documents.length} documents
        </div>
      )}
    </div>
  );
}
