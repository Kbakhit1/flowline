/**
 * Domain model — mirrors Ibrahim's spec vocabulary (Request, Sub-request, Return-to,
 * RoutingRule, AuditTrail, DeadlineLog…). The "bubble" is only the UI shape of a Request.
 */

export type Locale = "ar" | "en";

/** Bilingual string. Seeded data carries both; user-typed text is stored in both slots. */
export interface L {
  ar: string;
  en: string;
}

export type RoleKey =
  | "employee"
  | "site_supervisor"
  | "dept_supervisor"
  | "project_manager"
  | "executive"
  | "sysadmin";

export interface CompanySettings {
  projectChatEnabled: boolean;
  numerals: "latin" | "arabic";
  calendar: "gregory" | "islamic-umalqura";
  /** 0 = Sunday … 6 = Saturday */
  workingDays: number[];
  deadlineMode: "working" | "calendar";
}

export interface Company {
  id: string;
  name: L;
  settings: CompanySettings;
}

export interface Department {
  id: string;
  companyId: string;
  name: L;
  supervisorId: string;
}

export interface User {
  id: string;
  companyId: string;
  name: L;
  title: L;
  departmentId: string;
  /** Org tree edge. null = top of the tree. */
  managerId: string | null;
  role: RoleKey;
  /** 0–360, used to tint the avatar deterministically */
  hue: number;
  active: boolean;
}

export type ProjectPhase = "study" | "execution" | "closed";

export interface Project {
  id: string;
  companyId: string;
  ref: string;
  name: L;
  client: L;
  phase: ProjectPhase;
  managerId: string;
  siteSupervisorId: string;
  memberIds: string[];
}

export type FieldKind = "text" | "number" | "date" | "select" | "attachment";

export interface FieldDef {
  key: string;
  label: L;
  kind: FieldKind;
  options?: L[];
  required?: boolean;
}

export type FirstRecipient =
  | { kind: "chosen" } // the sender picks the person in the bubble
  | { kind: "creator_manager" }
  | { kind: "project_manager" }
  | { kind: "department"; departmentId: string };

export interface RoutingRule {
  firstRecipient: FirstRecipient;
  approval: "none" | "project_manager" | "dept_supervisor";
  defaultDeadlineDays: number;
  requiredAttachments: L[];
  hasLines: boolean;
}

export interface RequestType {
  id: string;
  companyId: string;
  name: L;
  fields: FieldDef[];
  routing: RoutingRule;
}

export type RequestStatus =
  | "draft"
  | "pending_approval"
  | "pending_clarification"
  | "rejected"
  | "approved"
  | "in_progress"
  | "awaiting_subrequests"
  | "partially_done"
  | "complete"
  | "closed"
  | "cancelled";

/** The 4 visual stages the UI shows on the bubble. */
export type Stage = "you" | "waiting" | "done" | "stopped";

export type Priority = "normal" | "urgent";

export interface RequestLine {
  id: string;
  description: L;
  unit: L;
  qtyRequested: number;
  qtyDone: number;
}

export interface Request {
  id: string;
  companyId: string;
  projectId: string;
  typeId: string;
  ref: string;
  parentId: string | null;
  lineId: string | null;
  creatorId: string;
  ownerId: string;
  returnToId: string;
  status: RequestStatus;
  priority: Priority;
  text: L;
  fields: Record<string, string | number>;
  lines: RequestLine[];
  /** Active deadline (ISO). Extensions replace it and are logged in DeadlineLog. */
  deadline: string;
  createdAt: string;
  closedAt: string | null;
  escalatedAt: string | null;
  /** Optimistic concurrency, as the spec requires. */
  version: number;
  /** ids of users who opened the request (read receipt, not acceptance). */
  seenBy: string[];
}

export type AuditAction =
  | "created"
  | "submitted"
  | "approved"
  | "rejected"
  | "clarification_requested"
  | "clarified"
  | "started"
  | "transferred"
  | "returned"
  | "subrequest_created"
  | "subrequest_returned"
  | "progress"
  | "completed"
  | "closed"
  | "reopened"
  | "cancelled"
  | "extended"
  | "escalated";

export interface AuditEntry {
  id: string;
  requestId: string;
  action: AuditAction;
  actorId: string;
  toUserId: string | null;
  at: string;
  note: L;
  offPath: boolean;
}

export interface DeadlineLog {
  id: string;
  requestId: string;
  seq: number;
  from: string;
  to: string;
  reason: L;
  actorId: string;
  at: string;
}

export interface Attachment {
  id: string;
  requestId: string;
  name: string;
  size: number;
  byId: string;
  at: string;
}

export interface Message {
  id: string;
  projectId: string;
  /** null = project channel; otherwise the request thread */
  requestId: string | null;
  senderId: string;
  text: L;
  at: string;
  convertedToRequestId: string | null;
}

export type NotificationTier = "direct" | "digest" | "escalation";

export type NotificationKind =
  | "new_request"
  | "approved"
  | "rejected"
  | "clarification"
  | "returned"
  | "subrequest_returned"
  | "deadline_soon"
  | "overdue"
  | "escalated"
  | "digest";

export interface Notification {
  id: string;
  userId: string;
  tier: NotificationTier;
  kind: NotificationKind;
  requestId: string | null;
  text: L;
  at: string;
  readAt: string | null;
}

export interface DbSnapshot {
  company: Company;
  departments: Department[];
  users: User[];
  projects: Project[];
  requestTypes: RequestType[];
  requests: Request[];
  audit: AuditEntry[];
  deadlineLogs: DeadlineLog[];
  attachments: Attachment[];
  messages: Message[];
  notifications: Notification[];
}
