"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, Search, ShieldBan, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { endpoint } from "@/lib/onboarding";

type Report = {
  id: string;
  reason: string;
  createdAt: string;
  reporter: { name: string };
  subject: { name: string; isActive: boolean };
};

export function ReportQueue() {
  const { getToken } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");
  const [suspendTarget, setSuspendTarget] = useState<Report | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(`${endpoint}/api/admin/reports`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          response.status === 403 ? "Administrator access required." : "Could not load reports.",
        );
      }
      setReports((await response.json()).reports);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(id: string, disposition: "DISMISSED" | "SUSPENDED") {
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(`${endpoint}/api/admin/reports/${id}/resolve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ disposition }),
      });
      if (!response.ok) throw new Error("Could not resolve this report.");
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not resolve this report.");
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => {
    const active = reports.filter((r) => r.subject.isActive).length;
    return {
      total: reports.length,
      active,
      suspended: reports.length - active,
    };
  }, [reports]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((report) => {
      if (filter === "active" && !report.subject.isActive) return false;
      if (filter === "suspended" && report.subject.isActive) return false;
      if (!q) return true;
      return (
        report.subject.name.toLowerCase().includes(q) ||
        report.reporter.name.toLowerCase().includes(q) ||
        report.reason.toLowerCase().includes(q)
      );
    });
  }, [reports, query, filter]);

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading reports">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Open reports
              </p>
              <p className="mt-1 font-serif text-3xl font-medium text-foreground">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active accounts
              </p>
              <p className="mt-1 font-serif text-3xl font-medium text-primary">{stats.active}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Already suspended
              </p>
              <p className="mt-1 font-serif text-3xl font-medium text-muted-foreground">
                {stats.suspended}
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <Tabs
              value={filter}
              onValueChange={(value) => setFilter(value as "all" | "active" | "suspended")}
            >
              <TabsList>
                <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
                <TabsTrigger value="suspended">Suspended ({stats.suspended})</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search member or reason…"
                  className="pl-9 h-10"
                  aria-label="Search reports"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                disabled={busy}
                onClick={() => void load()}
                aria-label="Refresh reports"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {!error && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-background/40 p-10 text-center space-y-2">
          <div className="mx-auto inline-flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </div>
          <p className="font-serif text-xl text-foreground">
            {reports.length === 0 ? "No open reports" : "No matching reports"}
          </p>
          <p className="text-sm text-muted-foreground">
            {reports.length === 0
              ? "The moderation queue is completely clear."
              : "Try clearing your search or switching the status filter."}
          </p>
        </div>
      )}

      {!error && filtered.length > 0 && (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Reported member</TableHead>
                  <TableHead>Reporter &amp; date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-foreground">{report.subject.name}</span>
                        <Badge variant={report.subject.isActive ? "success" : "destructive"}>
                          {report.subject.isActive ? "Active" : "Suspended"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <p className="font-medium text-foreground/85">{report.reporter.name}</p>
                      <p className="text-xs">{new Date(report.createdAt).toLocaleString()}</p>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm text-foreground leading-relaxed">{report.reason}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void resolve(report.id, "DISMISSED")}
                        >
                          <ShieldCheck className="size-4" />
                          <span>Dismiss</span>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => setSuspendTarget(report)}
                        >
                          <ShieldBan className="size-4" />
                          <span>Suspend</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filtered.map((report) => (
              <article
                key={report.id}
                className="rounded-2xl border border-border bg-background/60 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="font-serif text-lg font-medium text-foreground">
                    {report.subject.name}
                  </strong>
                  <Badge variant={report.subject.isActive ? "success" : "destructive"}>
                    {report.subject.isActive ? "Active" : "Suspended"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reported by{" "}
                  <span className="font-medium text-foreground">{report.reporter.name}</span> on{" "}
                  {new Date(report.createdAt).toLocaleString()}
                </p>
                <p className="rounded-xl bg-card border border-border/70 p-3 text-sm text-foreground leading-relaxed">
                  {report.reason}
                </p>
                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => void resolve(report.id, "DISMISSED")}
                  >
                    <ShieldCheck className="size-4" />
                    <span>Dismiss</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => setSuspendTarget(report)}
                  >
                    <ShieldBan className="size-4" />
                    <span>Suspend account</span>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <AlertDialog
        open={Boolean(suspendTarget)}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Suspend {suspendTarget?.subject.name}&apos;s account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the report as resolved and suspend their account from matching and
              signing in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!suspendTarget) return;
                const id = suspendTarget.id;
                setSuspendTarget(null);
                void resolve(id, "SUSPENDED");
              }}
            >
              Suspend account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
