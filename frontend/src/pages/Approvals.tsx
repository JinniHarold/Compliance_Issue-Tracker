import { Fragment, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  Alert,
  Button,
  Card,
  Collapse,
  EmptyState,
  ExpandToggle,
  Field,
  Heading,
  Pagination,
  RevealLink,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Textarea,
} from "../components/ui";
import { ApiError, api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { can } from "../lib/permissions";
import { useConfirm } from "../lib/useConfirm";
import type { PendingAction, Paged } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const PAGE_SIZE = 20;
const STATUSES = ["pending", "approved", "rejected"] as const;
type ActionStatus = (typeof STATUSES)[number];

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const ACTION_LABELS: Record<PendingAction["action_type"], string> = {
  start: "Start",
  request_review: "Request review",
  request_revision: "Send back",
  complete: "Complete",
  reopen: "Reopen",
  update_severity: "Raise severity",
};

function isActionStatus(value: string | null): value is ActionStatus {
  return value !== null && STATUSES.includes(value as ActionStatus);
}

export default function Approvals() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get("status");
  const status = isActionStatus(statusParam) ? statusParam : "pending";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const params = new URLSearchParams({ status, page: String(page), limit: String(PAGE_SIZE) });
  const { data, error, loading, reload } = useFetch<Paged<PendingAction, "pending_actions">>(
    `/pending-actions?${params.toString()}`
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const isAdmin = can(user?.role, "approvals:decide");
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function setStatus(nextStatus: string) {
    const next = new URLSearchParams(searchParams);
    next.set("status", nextStatus);
    next.delete("page");
    setSearchParams(next);
  }

  function setPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(nextPage));
    setSearchParams(next);
  }

  async function decide(action: PendingAction, decision: "approve" | "reject") {
    const note = notes[action.id] ?? "";
    setErrors((previous) => ({ ...previous, [action.id]: "" }));
    setFieldErrors((previous) => ({ ...previous, [action.id]: "" }));
    if (decision === "reject" && !(await confirm({
      title: "Reject proposal",
      message: "Reject this proposal?",
      confirmLabel: "Reject",
      tone: "danger",
    }))) return;
    setBusyId(action.id);
    try {
      await api(`/pending-actions/${encodeURIComponent(action.id)}/${decision}`, {
        method: "POST",
        body: { note },
      });
      setNotes((previous) => ({ ...previous, [action.id]: "" }));
      setExpandedId(null);
      reload();
      window.dispatchEvent(new Event("pending-actions-updated"));
    } catch (reason: unknown) {
      setErrors((previous) => ({
        ...previous,
        [action.id]: reason instanceof Error ? reason.message : `Could not ${decision} proposal.`,
      }));
      if (reason instanceof ApiError) {
        const noteError = reason.details?.find((detail) => detail.path === "note")?.message;
        if (noteError) setFieldErrors((previous) => ({ ...previous, [action.id]: noteError }));
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <Heading level={1}>Approvals</Heading>
      <Tabs items={STATUS_TABS} value={status} onChange={setStatus} />
      {error && <Alert>{error.message}</Alert>}
      {loading ? (
        <Spinner label="Loading proposals..." />
      ) : !error && data && data.pending_actions.length === 0 ? (
        <Card><EmptyState>No {status} proposals.</EmptyState></Card>
      ) : !error && data ? (
        <>
          <div className="hidden md:block">
            <Card className="p-0">
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Issue</TableHeader>
                      <TableHeader>Action</TableHeader>
                      <TableHeader>Requested by</TableHeader>
                      <TableHeader>Created</TableHeader>
                      <TableHeader>Status</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.pending_actions.map((item) => (
                      <Fragment key={item.id}>
                      <TableRow>
                        <TableCell>
                          <RevealLink to={`/issues/${item.issue_id}`} keyboardOrigin="row">{item.issue_title}</RevealLink>
                          {" · "}
                          <ExpandToggle
                            expanded={expandedId === item.id}
                            controls={`approval-details-desktop-${item.id}`}
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                          />
                        </TableCell>
                        <TableCell>{ACTION_LABELS[item.action_type]}</TableCell>
                        <TableCell>{item.requested_by_name}</TableCell>
                        <TableCell>{formatDateTime(item.created_at)}</TableCell>
                        <TableCell>{item.status}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={5} className="collapse-table-cell">
                          <Collapse id={`approval-details-desktop-${item.id}`} expanded={expandedId === item.id}>
                            <div className="space-y-3 py-2">
                              <p><strong>Rationale:</strong> {item.rationale}</p>
                              {item.payload.comment && <p><strong>Comment:</strong> {item.payload.comment}</p>}
                              {item.payload.severity && <p><strong>New severity:</strong> {item.payload.severity}</p>}
                              {item.status !== "pending" && (
                                <div className="space-y-1">
                                  <p>Decided by {item.decided_by_name ?? "Unknown"}</p>
                                  {item.decided_at && <p>{formatDateTime(item.decided_at)}</p>}
                                  {item.decision_note && <p><strong>Decision note:</strong> {item.decision_note}</p>}
                                </div>
                              )}
                              {isAdmin && item.status === "pending" && (
                                <div className="space-y-3">
                                  {errors[item.id] && <Alert>{errors[item.id]}</Alert>}
                                  <Field id={`decision-note-${item.id}`} label="Note" error={fieldErrors[item.id]}>
                                    <Textarea
                                      id={`decision-note-${item.id}`}
                                      maxLength={500}
                                      rows={2}
                                      value={notes[item.id] ?? ""}
                                      onChange={(event) => setNotes((previous) => ({ ...previous, [item.id]: event.target.value }))}
                                    />
                                  </Field>
                                  <div className="flex flex-wrap gap-2">
                                    <Button disabled={busyId === item.id} onClick={() => decide(item, "approve")}>
                                      {busyId === item.id ? "Working..." : "Approve"}
                                    </Button>
                                    <Button variant="secondary" disabled={busyId === item.id} onClick={() => decide(item, "reject")}>
                                      Reject
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </div>
          <div className="grid gap-3 md:hidden">
            {data.pending_actions.map((item) => (
              <Card key={item.id}>
                <div className="space-y-3">
                  <RevealLink to={`/issues/${item.issue_id}`}>{item.issue_title}</RevealLink>
                  <ExpandToggle
                    expanded={expandedId === item.id}
                    controls={`approval-details-mobile-${item.id}`}
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  />
                  <p>{ACTION_LABELS[item.action_type]} · {item.status}</p>
                  <p>Requested by {item.requested_by_name}</p>
                  <p>{formatDateTime(item.created_at)}</p>
                  <Collapse id={`approval-details-mobile-${item.id}`} expanded={expandedId === item.id}>
                    <div className="space-y-3 py-2">
                      <p><strong>Rationale:</strong> {item.rationale}</p>
                      {item.payload.comment && <p><strong>Comment:</strong> {item.payload.comment}</p>}
                      {item.payload.severity && <p><strong>New severity:</strong> {item.payload.severity}</p>}
                      {item.status !== "pending" && (
                        <div>
                          <p>Decided by {item.decided_by_name ?? "Unknown"}</p>
                          {item.decided_at && <p>{formatDateTime(item.decided_at)}</p>}
                          {item.decision_note && <p><strong>Decision note:</strong> {item.decision_note}</p>}
                        </div>
                      )}
                      {isAdmin && item.status === "pending" && (
                        <div className="space-y-3">
                          {errors[item.id] && <Alert>{errors[item.id]}</Alert>}
                          <Field id={`decision-note-mobile-${item.id}`} label="Note" error={fieldErrors[item.id]}>
                            <Textarea
                              id={`decision-note-mobile-${item.id}`}
                              maxLength={500}
                              rows={2}
                              value={notes[item.id] ?? ""}
                              onChange={(event) => setNotes((previous) => ({ ...previous, [item.id]: event.target.value }))}
                            />
                          </Field>
                          <div className="flex flex-wrap gap-2">
                            <Button disabled={busyId === item.id} onClick={() => decide(item, "approve")}>Approve</Button>
                            <Button variant="secondary" disabled={busyId === item.id} onClick={() => decide(item, "reject")}>Reject</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </Collapse>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={page} pages={pages} total={total} onChange={setPage} />
        </>
      ) : null}
    </div>
  );
}
