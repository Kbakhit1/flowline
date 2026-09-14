import type {
  AuditEntry,
  DbSnapshot,
  DeadlineLog,
  L,
  Message,
  Notification,
  Request,
  RequestType,
  User,
} from "./types";
import { DAY, HOUR } from "./rules";

/**
 * Demo dataset: a contracting company running one tower project.
 * All timestamps are relative to "now" so the demo never looks stale.
 * Rename the company / people here — nothing else references the names.
 */

const C = "co_1";

/** Bump when the seed changes: persisted demos older than this are re-seeded. */
export const SEED_VERSION = 5;

const l = (ar: string, en: string): L => ({ ar, en });

export function buildSeed(now = Date.now()): DbSnapshot {
  const ago = (h: number) => new Date(now - h * HOUR).toISOString();
  const inDays = (d: number) => new Date(now + d * DAY).toISOString();

  const users: User[] = [
    u("u1", "عبدالله الحربي", "Abdullah Al-Harbi", "المدير العام", "General Manager", "d_mgmt", null, "executive", 200),
    u("u2", "م. أحمد الراشد", "Eng. Ahmed Al-Rashed", "مسؤول المشروع", "Project Manager", "d_projects", "u1", "project_manager", 170),
    u("u3", "م. سارة العتيبي", "Eng. Sara Al-Otaibi", "مهندسة مدني", "Civil Engineer", "d_eng", "u2", "employee", 300),
    u("u4", "م. محمد حسن", "Eng. Mohamed Hassan", "مهندس كهروميكانيك", "MEP Engineer", "d_eng", "u2", "employee", 30),
    u("u5", "م. خالد النجار", "Eng. Khaled Al-Najjar", "مهندس تشطيبات", "Finishing Engineer", "d_eng", "u2", "employee", 260),
    u("u6", "فهد الدوسري", "Fahad Al-Dosari", "مشرف الموقع", "Site Supervisor", "d_projects", "u2", "site_supervisor", 80),
    u("u7", "عبدالله القحطاني", "Abdullah Al-Qahtani", "مشرف قسم العمالة", "Labor Dept. Supervisor", "d_labor", "u1", "dept_supervisor", 120),
    u("u8", "يوسف عمر", "Youssef Omar", "منسق عمالة", "Labor Coordinator", "d_labor", "u7", "employee", 140),
    u("u9", "نورة الشمري", "Noura Al-Shammari", "محاسبة المشروع", "Project Accountant", "d_finance", "u1", "employee", 330),
    u("u10", "سلطان المطيري", "Sultan Al-Mutairi", "مسؤول مشتريات", "Procurement Officer", "d_proc", "u1", "employee", 50),
    u("u11", "حسن علي", "Hassan Ali", "مشرف حديد", "Rebar Foreman", "d_eng", "u3", "employee", 10),
    u("u12", "طارق مصطفى", "Tarek Mostafa", "مشرف كهرباء", "Electrical Foreman", "d_eng", "u4", "employee", 220),
    u("u13", "ريم العنزي", "Reem Al-Anazi", "مدير النظام", "System Admin", "d_mgmt", "u1", "sysadmin", 280),
  ];

  const requestTypes: RequestType[] = [
    {
      id: "t_task",
      companyId: C,
      name: l("مهمة", "Task"),
      fields: [],
      routing: {
        firstRecipient: { kind: "chosen" },
        approval: "none",
        defaultDeadlineDays: 3,
        requiredAttachments: [],
        hasLines: false,
      },
    },
    {
      id: "t_labor",
      companyId: C,
      name: l("طلب عمالة", "Labor request"),
      fields: [
        { key: "trade", label: l("التخصص", "Trade"), kind: "select", options: [l("عامل عادي", "General worker"), l("حداد", "Steel fixer"), l("نجار", "Carpenter"), l("كهربائي", "Electrician")], required: true },
        { key: "count", label: l("العدد", "Count"), kind: "number", required: true },
        { key: "days", label: l("المدة بالأيام", "Duration (days)"), kind: "number" },
      ],
      routing: {
        firstRecipient: { kind: "department", departmentId: "d_labor" },
        approval: "project_manager",
        defaultDeadlineDays: 5,
        requiredAttachments: [],
        hasLines: true,
      },
    },
    {
      id: "t_material",
      companyId: C,
      name: l("شراء مواد", "Material purchase"),
      fields: [
        { key: "item", label: l("الصنف", "Item"), kind: "text", required: true },
        { key: "qty", label: l("الكمية", "Quantity"), kind: "number", required: true },
        { key: "unit", label: l("الوحدة", "Unit"), kind: "select", options: [l("م²", "m²"), l("م³", "m³"), l("طن", "ton"), l("قطعة", "piece")] },
      ],
      routing: {
        firstRecipient: { kind: "department", departmentId: "d_proc" },
        approval: "project_manager",
        defaultDeadlineDays: 7,
        requiredAttachments: [l("عرض سعر", "Quotation")],
        hasLines: false,
      },
    },
    {
      id: "t_permit",
      companyId: C,
      name: l("تصريح", "Permit"),
      fields: [
        { key: "authority", label: l("الجهة", "Authority"), kind: "text", required: true },
        { key: "permitKind", label: l("نوع التصريح", "Permit kind"), kind: "select", options: [l("حفر", "Excavation"), l("إغلاق طريق", "Road closure"), l("عمل ليلي", "Night work")] },
      ],
      routing: {
        firstRecipient: { kind: "project_manager" },
        approval: "project_manager",
        defaultDeadlineDays: 10,
        requiredAttachments: [],
        hasLines: false,
      },
    },
  ];

  const P1 = "p1";
  const P2 = "p2";

  const requests: Request[] = [
    r({
      id: "r1", ref: "REQ-1041", projectId: P1, typeId: "t_labor", creatorId: "u6", ownerId: "u7", returnToId: "u6",
      status: "awaiting_subrequests", priority: "urgent",
      text: l("20 عاملاً إضافياً لصب خرسانة الدور الخامس، الصبّ صباح الخميس", "20 extra workers for the 5th-floor concrete pour, Thursday morning"),
      fields: { trade: "عامل عادي", count: 20, days: 3 },
      lines: [{ id: "ln1", description: l("عمال صب", "Pour crew"), unit: l("عامل", "worker"), qtyRequested: 20, qtyDone: 8 }],
      createdAt: ago(26), deadline: inDays(2), seenBy: ["u6", "u2", "u7"],
    }),
    r({
      id: "r1a", ref: "REQ-1041-1", projectId: P1, typeId: "t_task", parentId: "r1", lineId: "ln1", creatorId: "u7", ownerId: "u8", returnToId: "u7",
      status: "in_progress", priority: "urgent",
      text: l("12 عاملاً من المقاول الفرعي الأمانة، تأكيد الحضور يوم الأربعاء", "12 workers from Al-Amana subcontractor, confirm attendance for Wednesday"),
      createdAt: ago(22), deadline: inDays(1), seenBy: ["u7", "u8"],
    }),
    r({
      id: "r1b", ref: "REQ-1041-2", projectId: P1, typeId: "t_task", parentId: "r1", lineId: "ln1", creatorId: "u7", ownerId: "u7", returnToId: "u7",
      status: "complete", priority: "urgent",
      text: l("8 عمال من شركة التوريد المتحدة، تم التعاقد معهم", "8 workers from United Supply, contracted"),
      createdAt: ago(22), deadline: inDays(1), seenBy: ["u7", "u8"],
    }),
    r({
      id: "r1a1", ref: "REQ-1041-1-1", projectId: P1, typeId: "t_task", parentId: "r1a", creatorId: "u8", ownerId: "u8", returnToId: "u8",
      status: "closed", priority: "urgent",
      text: l("أمر شراء خدمات عمالة للمقاول الفرعي الأمانة", "Purchase order for Al-Amana labor services"),
      createdAt: ago(21), deadline: inDays(1), closedAt: ago(9), seenBy: ["u8", "u10"],
    }),
    r({
      id: "r2a", ref: "REQ-1042-1", projectId: P1, typeId: "t_task", parentId: "r2", creatorId: "u3", ownerId: "u3", returnToId: "u3",
      status: "closed", priority: "normal",
      text: l("قياس منسوب قاع الحفر في الموقع ومقارنته بالمخطط", "Measure the excavation level on site against the drawing"),
      createdAt: ago(60), deadline: inDays(-1), closedAt: ago(40), seenBy: ["u3", "u11"],
    }),
    r({
      id: "r10a", ref: "REQ-1040-1", projectId: P1, typeId: "t_task", parentId: "r10", creatorId: "u9", ownerId: "u6", returnToId: "u9",
      status: "in_progress", priority: "normal",
      text: l("تأكيد الكميات المنفذة في أغسطس لإعداد المستخلص", "Confirm the quantities executed in August for the invoice"),
      createdAt: ago(30), deadline: inDays(1), seenBy: ["u9", "u6"],
    }),
    r({
      id: "r2", ref: "REQ-1042", projectId: P1, typeId: "t_task", creatorId: "u2", ownerId: "u3", returnToId: "u2",
      status: "in_progress", priority: "normal",
      text: l("مراجعة مخططات الأساسات المعدلة من الاستشاري وإرسال الملاحظات", "Review the consultant's revised foundation drawings and send comments"),
      createdAt: ago(72), deadline: inDays(2), seenBy: ["u2", "u3"],
    }),
    r({
      id: "r3", ref: "REQ-1038", projectId: P1, typeId: "t_task", creatorId: "u2", ownerId: "u4", returnToId: "u2",
      status: "in_progress", priority: "normal",
      text: l("تسليم جدول أحمال الكهرباء النهائي إلى شركة الكهرباء", "Deliver the final electrical load schedule to the utility company"),
      createdAt: ago(144), deadline: inDays(-1), escalatedAt: ago(20), seenBy: ["u2", "u4"],
    }),
    r({
      id: "r4", ref: "REQ-1043", projectId: P1, typeId: "t_task", creatorId: "u3", ownerId: "u11", returnToId: "u3",
      status: "in_progress", priority: "urgent",
      text: l("تجهيز حديد أعمدة الدور الخامس قبل الأربعاء", "Prepare 5th-floor column rebar before Wednesday"),
      createdAt: ago(20), deadline: inDays(1), seenBy: ["u3", "u11"],
    }),
    r({
      id: "r5", ref: "REQ-1044", projectId: P1, typeId: "t_material", creatorId: "u5", ownerId: "u2", returnToId: "u5",
      status: "pending_approval", priority: "normal",
      text: l("بلاط بورسلين 600×600 للدورين 3 و4، الكمية 1,200 م²", "600×600 porcelain tiles for floors 3 and 4, 1,200 m²"),
      fields: { item: "بلاط بورسلين 600×600", qty: 1200, unit: "م²" },
      createdAt: ago(5), deadline: inDays(7), seenBy: ["u5"],
    }),
    r({
      id: "r6", ref: "REQ-1039", projectId: P1, typeId: "t_task", creatorId: "u2", ownerId: "u2", returnToId: "u2",
      status: "complete", priority: "normal",
      text: l("عينات الدهانات الخارجية لاعتماد العميل (3 درجات)", "Exterior paint samples for client approval (3 shades)"),
      createdAt: ago(96), deadline: inDays(1), seenBy: ["u2", "u5"],
    }),
    r({
      id: "r7", ref: "REQ-1045", projectId: P1, typeId: "t_permit", creatorId: "u6", ownerId: "u6", returnToId: "u6",
      status: "pending_clarification", priority: "normal",
      text: l("تصريح إغلاق جزئي للشارع الجانبي لتركيب الرافعة", "Partial closure permit for the side street to install the crane"),
      fields: { authority: "أمانة المنطقة", permitKind: "إغلاق طريق" },
      createdAt: ago(30), deadline: inDays(10), seenBy: ["u6", "u2"],
    }),
    r({
      id: "r8", ref: "REQ-1031", projectId: P1, typeId: "t_task", creatorId: "u4", ownerId: "u12", returnToId: "u4",
      status: "closed", priority: "normal",
      text: l("فحص لوحات التوزيع الرئيسية قبل التوصيل", "Inspect the main distribution boards before energizing"),
      createdAt: ago(288), deadline: ago(200), closedAt: ago(192), seenBy: ["u4", "u12"],
    }),
    r({
      id: "r9", ref: "REQ-1046", projectId: P1, typeId: "t_task", creatorId: "u3", ownerId: "u2", returnToId: "u3",
      status: "in_progress", priority: "normal",
      text: l("اعتماد زيادة سماكة بلاطة السطح من 20 إلى 25 سم حسب توصية الاستشاري", "Approve increasing the roof slab thickness from 20 to 25 cm per the consultant"),
      createdAt: ago(8), deadline: inDays(3), seenBy: ["u3", "u2"],
    }),
    r({
      id: "r10", ref: "REQ-1040", projectId: P1, typeId: "t_task", creatorId: "u2", ownerId: "u9", returnToId: "u2",
      status: "awaiting_subrequests", priority: "normal",
      text: l("إعداد مستخلص شهر أغسطس وإرساله إلى العميل", "Prepare the August progress invoice and send it to the client"),
      createdAt: ago(48), deadline: inDays(2), seenBy: ["u2", "u9"],
    }),
    r({
      id: "r11", ref: "REQ-1037", projectId: P1, typeId: "t_task", creatorId: "u1", ownerId: "u2", returnToId: "u1",
      status: "in_progress", priority: "normal",
      text: l("تقرير التقدم الأسبوعي لبرج الواحة", "Weekly progress report for Al-Waha Tower"),
      createdAt: ago(70), deadline: inDays(1), seenBy: ["u1", "u2"],
    }),
    r({
      id: "r12", ref: "REQ-1036", projectId: P1, typeId: "t_task", creatorId: "u6", ownerId: "u2", returnToId: "u6",
      status: "rejected", priority: "normal",
      text: l("رافعة برجية إضافية للواجهة الشرقية", "Additional tower crane for the east façade"),
      createdAt: ago(168), deadline: ago(96), closedAt: ago(150), seenBy: ["u6", "u2"],
    }),
    r({
      id: "r13", ref: "REQ-1035", projectId: P1, typeId: "t_task", creatorId: "u2", ownerId: "u10", returnToId: "u2",
      status: "closed", priority: "normal",
      text: l("تسعير 40 طن حديد 16 مم من 3 موردين", "Quote 40 tons of 16 mm rebar from 3 suppliers"),
      createdAt: ago(360), deadline: ago(260), closedAt: ago(240), seenBy: ["u2", "u10"],
    }),
    r({
      id: "r14", ref: "REQ-2007", projectId: P2, typeId: "t_task", creatorId: "u2", ownerId: "u3", returnToId: "u2",
      status: "in_progress", priority: "normal",
      text: l("مراجعة تقرير فحص التربة وتحديد نوع الأساسات", "Review the soil report and decide the foundation type"),
      createdAt: ago(24), deadline: inDays(4), seenBy: ["u2", "u3"],
    }),
    r({
      id: "r15", ref: "REQ-1047", projectId: P1, typeId: "t_task", creatorId: "u2", ownerId: "u6", returnToId: "u2",
      status: "approved", priority: "normal",
      text: l("تصوير تقدم الأعمال يومياً ورفعه إلى قناة المشروع", "Photograph daily progress and post it in the project channel"),
      createdAt: ago(2), deadline: inDays(1), seenBy: ["u2"],
    }),
    r({
      id: "r16", ref: "REQ-1033", projectId: P1, typeId: "t_task", creatorId: "u5", ownerId: "u10", returnToId: "u5",
      status: "cancelled", priority: "normal",
      text: l("شراء 50 لتر دهان أساس للواجهة", "Buy 50 liters of façade primer"),
      createdAt: ago(216), deadline: ago(120), closedAt: ago(190), seenBy: ["u5", "u10"],
    }),
  ];

  let aid = 0;
  const a = (
    requestId: string,
    action: AuditEntry["action"],
    actorId: string,
    at: string,
    toUserId: string | null = null,
    note: L = l("", ""),
    offPath = false,
  ): AuditEntry => ({ id: `a${++aid}`, requestId, action, actorId, toUserId, at, note, offPath });

  const audit: AuditEntry[] = [
    // r1: the full scenario
    a("r1", "created", "u6", ago(26)),
    a("r1", "submitted", "u6", ago(26), "u2", l("الصبّ يوم الخميس، ويلزم توفر العدد يوم الأربعاء", "Pour is Thursday, crew must be on site Wednesday")),
    a("r1", "approved", "u2", ago(24), "u7", l("معتمد. نسّق التوقيت مع فهد", "Approved. Coordinate timing with Fahad")),
    a("r1", "started", "u7", ago(23)),
    a("r1", "subrequest_created", "u7", ago(22), "u8", l("قسّمته على مصدرين لضمان العدد", "Split across two sources to guarantee the count")),
    a("r1", "subrequest_created", "u7", ago(22), "u8"),
    a("r1a", "created", "u7", ago(22), "u8"),
    a("r1a", "started", "u8", ago(20)),
    a("r1b", "created", "u7", ago(22), "u8"),
    a("r1b", "started", "u8", ago(20)),
    a("r1b", "completed", "u8", ago(6), "u7", l("تم التعاقد مع التوريد المتحدة، 8 عمال ابتداءً من الأربعاء", "Contracted United Supply, 8 workers from Wednesday")),
    a("r1", "progress", "u8", ago(6), null, l("8 من 20", "8 of 20")),
    a("r1a", "subrequest_created", "u8", ago(21), "u10", l("يلزم أمر شراء رسمي قبل البدء", "They need a formal PO before they start")),
    a("r1a1", "created", "u8", ago(21), "u10"),
    a("r1a1", "started", "u10", ago(19)),
    a("r1a1", "completed", "u10", ago(10), "u8", l("أُرسل أمر الشراء رقم PO-2214 إلى الأمانة", "PO-2214 sent to Al-Amana")),
    a("r1a1", "closed", "u8", ago(9)),
    a("r2", "subrequest_created", "u3", ago(60), "u11"),
    a("r2a", "created", "u3", ago(60), "u11"),
    a("r2a", "started", "u11", ago(58)),
    a("r2a", "completed", "u11", ago(42), "u3", l("المنسوب مطابق بفارق 2 سم", "Level matches within 2 cm")),
    a("r2a", "closed", "u3", ago(40)),
    a("r2", "subrequest_returned", "u3", ago(40), "u3"),
    a("r10", "subrequest_created", "u9", ago(30), "u6", l("أحتاج الكميات الفعلية قبل إغلاق المستخلص", "I need the actual quantities before closing the invoice"), true),
    a("r10a", "created", "u9", ago(30), "u6"),
    a("r10a", "started", "u6", ago(28)),
    // r2 with one extension
    a("r2", "created", "u2", ago(72), "u3"),
    a("r2", "started", "u3", ago(70)),
    a("r2", "extended", "u3", ago(30), null, l("تأخر الاستشاري في إرسال النسخة المعدلة", "The consultant sent the revision late")),
    // r3 late + escalated
    a("r3", "created", "u2", ago(144), "u4"),
    a("r3", "started", "u4", ago(140)),
    a("r3", "escalated", "u2", ago(20), "u2", l("تجاوز المهلة", "Deadline exceeded")),
    // r4
    a("r4", "created", "u3", ago(20), "u11", l("الصبّ يوم الخميس، ويجب أن يكون الحديد جاهزاً قبله بيوم", "Pour is Thursday, rebar must be ready the day before")),
    a("r4", "started", "u11", ago(18)),
    // r5 pending approval
    a("r5", "created", "u5", ago(5)),
    a("r5", "submitted", "u5", ago(5), "u2", l("مرفق عرض سعر الجزيرة، أقل من الميزانية بنسبة 4%", "Al-Jazeera quotation attached, 4% under budget")),
    // r6 complete
    a("r6", "created", "u2", ago(96), "u5"),
    a("r6", "started", "u5", ago(90)),
    a("r6", "completed", "u5", ago(4), "u2", l("العينات الثلاث في مكتب الموقع، وقد اطلع عليها العميل ويميل إلى الدرجة الوسطى", "All 3 samples are at the site office; the client leans to the middle shade")),
    // r7 clarification loop
    a("r7", "created", "u6", ago(30)),
    a("r7", "submitted", "u6", ago(30), "u2"),
    a("r7", "clarification_requested", "u2", ago(26), "u6", l("يلزم تحديد تاريخ الإغلاق المتوقع والمدة بالساعات", "Need the expected closure date and the duration in hours")),
    // r8 closed history
    a("r8", "created", "u4", ago(288), "u12"),
    a("r8", "started", "u12", ago(280)),
    a("r8", "completed", "u12", ago(200), "u4", l("اللوحات الأربع سليمة، وتقرير الفحص مرفق", "All 4 boards passed, inspection report attached")),
    a("r8", "closed", "u4", ago(192)),
    // r9 up the tree
    a("r9", "created", "u3", ago(8), "u2", l("وفق خطاب الاستشاري رقم 118", "Per consultant letter no. 118")),
    a("r9", "started", "u2", ago(6)),
    // r10 cross-branch
    a("r10", "created", "u2", ago(48), "u9", l("يجب أن يصل المستخلص إلى العميل قبل 5 من الشهر", "Invoice must reach the client before the 5th"), true),
    a("r10", "started", "u9", ago(44)),
    // r11
    a("r11", "created", "u1", ago(70), "u2"),
    a("r11", "started", "u2", ago(60)),
    // r12 rejected
    a("r12", "created", "u6", ago(168)),
    a("r12", "submitted", "u6", ago(168), "u2"),
    a("r12", "rejected", "u2", ago(150), "u6", l("الرافعة الحالية ستغطي الواجهة الشرقية بعد نقلها الأسبوع القادم", "The current crane covers the east façade after next week's relocation")),
    // r13 closed with a transfer in the path
    a("r13", "created", "u2", ago(360), "u9", l("نورة، اطلبي التسعير من الموردين المعتمدين", "Noura, request quotes from the approved suppliers")),
    a("r13", "transferred", "u9", ago(340), "u10", l("التسعير من اختصاص المشتريات", "Quoting is procurement's job"), true),
    a("r13", "started", "u10", ago(330)),
    a("r13", "completed", "u10", ago(250), "u2", l("3 عروض مرفقة، أقلها 2,850 ريال/طن", "3 quotes attached, lowest 2,850 SAR/ton")),
    a("r13", "closed", "u2", ago(240)),
    // r14 (project 2)
    a("r14", "created", "u2", ago(24), "u3"),
    a("r14", "started", "u3", ago(20)),
    // r15 new, not started
    a("r15", "created", "u2", ago(2), "u6"),
    // r16 cancelled
    a("r16", "created", "u5", ago(216), "u10"),
    a("r16", "cancelled", "u5", ago(190), null, l("أُدرج ضمن طلب الدهانات الرئيسي", "Folded into the main paint order")),
  ];

  const deadlineLogs: DeadlineLog[] = [
    { id: "dl1", requestId: "r2", seq: 1, from: inDays(-1), to: inDays(2), reason: l("تأخر الاستشاري في إرسال النسخة المعدلة", "The consultant sent the revision late"), actorId: "u3", at: ago(30) },
  ];

  let mid = 0;
  const m = (projectId: string, requestId: string | null, senderId: string, at: string, ar: string, en: string, converted: string | null = null): Message => ({
    id: `m${++mid}`, projectId, requestId, senderId, text: l(ar, en), at, convertedToRequestId: converted,
  });

  const messages: Message[] = [
    m(P1, null, "u6", ago(28), "تأكد موعد صبّ الدور الخامس: صباح الخميس", "5th-floor pour confirmed for Thursday morning"),
    m(P1, null, "u2", ago(27.5), "حسناً. هل العدد الحالي كافٍ؟", "Good. Is the current crew enough?"),
    m(P1, null, "u6", ago(27), "لا، نحتاج 20 عاملاً إضافياً", "No, we need 20 more workers", "r1"),
    m(P1, null, "u3", ago(21), "حديد الأعمدة سيكون جاهزاً مساء الأربعاء", "Column rebar will be ready Wednesday night"),
    m(P1, null, "u4", ago(19), "طلبت شركة الكهرباء نسخة إضافية من جدول الأحمال بختم الاستشاري", "The utility asked for an extra copy of the load schedule stamped by the consultant"),
    m(P1, null, "u2", ago(18.5), "محمد، هذا متأخر أسبوعاً. أحتاج موعداً نهائياً", "Mohamed, that's a week late. I need a final date"),
    m(P1, null, "u5", ago(6), "اطلع العميل على عينات الدهان ويميل إلى الدرجة الوسطى", "The client saw the paint samples and leans to the middle shade"),
    m(P1, null, "u9", ago(3), "يُغلق مستخلص أغسطس غداً بإذن الله", "The August invoice closes tomorrow"),
    m(P1, "r1", "u7", ago(22.5), "فهد، قسّمته على مصدرين لضمان العدد", "Fahad, I split it across two sources to guarantee the count"),
    m(P1, "r1", "u6", ago(22), "حسناً، المهم أن يكونوا في الموقع الأربعاء الساعة 7", "Fine, as long as they're on site Wednesday at 7"),
    m(P1, "r1", "u8", ago(6), "أكدت التوريد المتحدة 8 عمال. الأمانة لم تؤكد الـ 12 بعد", "United Supply confirmed 8. Al-Amana is still confirming the 12"),
    m(P1, "r3", "u4", ago(21), "أعاد الاستشاري الجدول بملاحظتين، سأنهيهما اليوم", "The consultant returned the schedule with 2 comments, finishing today"),
    m(P1, "r3", "u2", ago(20.5), "حسناً، لكن المهلة انتهت. اطلب تمديداً بسبب واضح", "OK, but the deadline passed. Request an extension with a clear reason"),
  ];

  let nid = 0;
  const n = (userId: string, tier: Notification["tier"], kind: Notification["kind"], requestId: string | null, at: string, ar: string, en: string, read = false): Notification => ({
    id: `n${++nid}`, userId, tier, kind, requestId, text: l(ar, en), at, readAt: read ? at : null,
  });

  const notifications: Notification[] = [
    n("u2", "direct", "new_request", "r5", ago(5), "خالد النجار يطلب اعتماد: بلاط بورسلين 600×600", "Khaled Al-Najjar requests approval: 600×600 porcelain tiles"),
    n("u2", "direct", "new_request", "r9", ago(8), "سارة العتيبي أرسلت إليك: اعتماد زيادة سماكة بلاطة السطح", "Sara Al-Otaibi sent you: approve the roof slab thickness increase"),
    n("u2", "escalation", "escalated", "r3", ago(20), "متأخر يوماً: جدول أحمال الكهرباء لدى محمد حسن", "1 day late: electrical load schedule with Mohamed Hassan"),
    n("u2", "direct", "returned", "r6", ago(4), "خالد النجار أنجز: عينات الدهانات الخارجية. للمراجعة والإغلاق", "Khaled Al-Najjar completed: exterior paint samples. Review and close"),
    n("u2", "digest", "digest", null, ago(1), "ملخص فرعك: 9 طلبات مفتوحة، 1 متأخر، 2 أُنجزا اليوم", "Your branch: 9 open, 1 late, 2 completed today"),
    n("u3", "direct", "new_request", "r2", ago(72), "أحمد الراشد أرسل إليك: مراجعة مخططات الأساسات المعدلة", "Ahmed Al-Rashed sent you: review the revised foundation drawings", true),
    n("u3", "digest", "digest", null, ago(1), "ملخص فرعك: حسن علي يعمل على حديد الأعمدة، والمهلة غداً", "Your branch: Hassan Ali is on the column rebar, due tomorrow"),
    n("u4", "direct", "overdue", "r3", ago(24), "انتهت المهلة: جدول أحمال الكهرباء النهائي", "Deadline passed: final electrical load schedule"),
    n("u4", "direct", "deadline_soon", "r3", ago(48), "المهلة غداً: جدول أحمال الكهرباء النهائي", "Due tomorrow: final electrical load schedule", true),
    n("u6", "direct", "clarification", "r7", ago(26), "أحمد الراشد طلب توضيحاً على: تصريح إغلاق الشارع الجانبي", "Ahmed Al-Rashed asked for clarification on: side street closure permit"),
    n("u6", "direct", "approved", "r1", ago(24), "اعتُمد طلبك: 20 عاملاً إضافياً. وُجّه إلى قسم العمالة", "Your request was approved: 20 extra workers. Routed to Labor", true),
    n("u6", "direct", "new_request", "r15", ago(2), "أحمد الراشد أرسل إليك: تصوير تقدم الأعمال يومياً", "Ahmed Al-Rashed sent you: photograph daily progress"),
    n("u7", "direct", "new_request", "r1", ago(24), "وصلك طلب معتمد: 20 عاملاً إضافياً لصب الدور الخامس (عاجل)", "Approved request arrived: 20 extra workers for the 5th-floor pour (urgent)", true),
    n("u7", "direct", "subrequest_returned", "r1b", ago(6), "يوسف عمر أنجز: 8 عمال من التوريد المتحدة. للمراجعة والإغلاق", "Youssef Omar completed: 8 workers from United Supply. Review and close"),
    n("u8", "direct", "new_request", "r1a", ago(22), "عبدالله القحطاني أرسل إليك: 12 عاملاً من المقاول الفرعي (عاجل)", "Abdullah Al-Qahtani sent you: 12 workers from the subcontractor (urgent)", true),
    n("u11", "direct", "new_request", "r4", ago(20), "سارة العتيبي أرسلت إليك: تجهيز حديد أعمدة الدور الخامس (عاجل)", "Sara Al-Otaibi sent you: prepare 5th-floor column rebar (urgent)", true),
    n("u9", "direct", "new_request", "r10", ago(48), "أحمد الراشد أرسل إليك: إعداد مستخلص شهر أغسطس", "Ahmed Al-Rashed sent you: prepare the August invoice", true),
    n("u1", "digest", "digest", null, ago(1), "الشركة: 12 طلباً مفتوحاً في مشروعين، 1 متأخر ومصعّد، 0 بانتظار اعتمادك", "Company: 12 open requests across 2 projects, 1 late and escalated, 0 awaiting you"),
    n("u1", "escalation", "escalated", "r3", ago(20), "تصعيد: جدول أحمال الكهرباء متأخر يوماً لدى محمد حسن", "Escalation: electrical load schedule 1 day late with Mohamed Hassan", true),
    n("u5", "direct", "new_request", "r6", ago(96), "أحمد الراشد أرسل إليك: عينات الدهانات الخارجية", "Ahmed Al-Rashed sent you: exterior paint samples", true),
  ];

  return {
    company: {
      id: C,
      name: l("شركة البناء الحديث للمقاولات", "Modern Build Contracting"),
      settings: {
        projectChatEnabled: true,
        numerals: "latin",
        calendar: "gregory",
        workingDays: [0, 1, 2, 3, 4],
        deadlineMode: "working",
      },
    },
    departments: [
      { id: "d_mgmt", companyId: C, name: l("الإدارة العامة", "Management"), supervisorId: "u1" },
      { id: "d_projects", companyId: C, name: l("إدارة المشاريع", "Projects"), supervisorId: "u2" },
      { id: "d_eng", companyId: C, name: l("الهندسة", "Engineering"), supervisorId: "u2" },
      { id: "d_labor", companyId: C, name: l("العمالة", "Labor"), supervisorId: "u7" },
      { id: "d_finance", companyId: C, name: l("المالية", "Finance"), supervisorId: "u9" },
      { id: "d_proc", companyId: C, name: l("المشتريات", "Procurement"), supervisorId: "u10" },
    ],
    users,
    projects: [
      {
        id: P1, companyId: C, ref: "PRJ-24-017",
        name: l("برج الواحة السكني", "Al-Waha Residential Tower"),
        client: l("شركة الواحة العقارية", "Al-Waha Real Estate"),
        phase: "execution", managerId: "u2", siteSupervisorId: "u6",
        memberIds: ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9", "u10", "u11", "u12"],
      },
      {
        id: P2, companyId: C, ref: "PRJ-25-003",
        name: l("مستودعات الخليج اللوجستية", "Gulf Logistics Warehouses"),
        client: l("مجموعة الخليج للتخزين", "Gulf Storage Group"),
        phase: "study", managerId: "u2", siteSupervisorId: "u6",
        memberIds: ["u1", "u2", "u3", "u4", "u6", "u9"],
      },
    ],
    requestTypes,
    requests,
    audit,
    deadlineLogs,
    attachments: [
      { id: "at1", requestId: "r5", name: "عرض سعر - الجزيرة للسيراميك.pdf", size: 412_000, byId: "u5", at: ago(5) },
      { id: "at2", requestId: "r8", name: "inspection-report-DB-1-4.pdf", size: 1_240_000, byId: "u12", at: ago(200) },
      { id: "at3", requestId: "r13", name: "quotes-rebar-16mm.xlsx", size: 88_000, byId: "u10", at: ago(250) },
    ],
    messages,
    notifications,
  };
}

/** An empty company for the training sheet: one owner, one department, the base request type. */
export function buildBlank(): DbSnapshot {
  return {
    company: {
      id: C,
      name: l("", ""),
      settings: { projectChatEnabled: true, numerals: "latin", calendar: "gregory", workingDays: [0, 1, 2, 3, 4], deadlineMode: "working" },
    },
    departments: [{ id: "d_mgmt", companyId: C, name: l("الإدارة العامة", "Management"), supervisorId: "owner" }],
    users: [u("owner", "", "", "", "", "d_mgmt", null, "executive", 170)],
    projects: [],
    requestTypes: [
      {
        id: "t_task",
        companyId: C,
        name: l("مهمة", "Task"),
        fields: [],
        routing: { firstRecipient: { kind: "chosen" }, approval: "none", defaultDeadlineDays: 3, requiredAttachments: [], hasLines: false },
      },
    ],
    requests: [],
    audit: [],
    deadlineLogs: [],
    attachments: [],
    messages: [],
    notifications: [],
  };
}

/* ---------- small constructors ---------- */

function u(
  id: string, ar: string, en: string, tAr: string, tEn: string,
  departmentId: string, managerId: string | null, role: User["role"], hue: number,
): User {
  return { id, companyId: C, name: l(ar, en), title: l(tAr, tEn), departmentId, managerId, role, hue, active: true };
}

type RInput = Partial<Request> &
  Pick<Request, "id" | "ref" | "projectId" | "typeId" | "creatorId" | "ownerId" | "returnToId" | "status" | "priority" | "text" | "createdAt" | "deadline">;

function r(x: RInput): Request {
  return {
    companyId: C,
    parentId: null,
    lineId: null,
    fields: {},
    lines: [],
    closedAt: null,
    escalatedAt: null,
    version: 1,
    seenBy: [],
    ...x,
  };
}
