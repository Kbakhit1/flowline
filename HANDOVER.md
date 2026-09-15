# HANDOVER — FlowLine (فلو لاين)

آخر تحديث: 15 سبتمبر 2026 · الجلسة الثانية (Claude Code) · الكاتب: Claude لصالح خالد بخيت

الملف ده هو نقطة الدخول لأي جلسة جديدة. اقرأه كامل قبل أي شغل، وحدّثه في نهاية كل جلسة.

---

## 1. المشروع في 5 سطور

- **العميل:** أستاذ إبراهيم، شركة كيوب لاين (Cube Line). السوق: السعودية + مصر.
- **المنتج:** SaaS داخلي للشركات لإدارة الطلبات/المهام على الهيكل الوظيفي بدل الإيميل والواتساب. الوحدة الأساسية «فقاعة» (Request): تنزل لتحت للفريق، تتفرّع لطلبات فرعية، وترجع بالنتيجة لصاحبها. شات جوه المشروع. القاعدة الحاكمة: البساطة قبل الميزات.
- **الاسم:** **FlowLine / فلو لاين** (اتفق عليه 14 سبتمبر). قبلها كان اسم مؤقت «مِرسال / Mirsal» — لا يُستخدم.
- **المرحلة الحالية:** Demo تفاعلي كامل منشور على GitHub Pages، مبني كواجهة حقيقية بطبقة بيانات وهمية (mock engine) بحيث لما نبدأ البناء الفعلي نبدّل الطبقة دي بـ API ونسيب الشاشات.
- **الـ Stack المتفق عليه للبناء الفعلي:** Cloudflare (Workers + Hono API، D1، Durable Objects للـ real-time، R2، Queues، Cron) + Next.js static export + Better Auth + Resend. **ممنوع Firebase / Google Cloud** لهذا المشروع (مشاكل في السعودية وصعوبة تفعيل الفوترة عبر cntxt).

## 2. الروابط

| ماذا | أين |
|---|---|
| الديمو المنشور | https://kbakhit1.github.io/flowline/ |
| صفحة الهوية (البراند) | https://kbakhit1.github.io/flowline/brand/ |
| الشاشة المقسومة | https://kbakhit1.github.io/flowline/split/ |
| المستودع (عام) | https://github.com/Kbakhit1/flowline — فرع `main` — النشر تلقائي مع كل push (GitHub Actions ← Pages) |
| صفحة الرد الرسمي على مستند إبراهيم (Artifact، محدّثة 15 سبتمبر بروابط الديمو والشاشة المقسومة والهوية) | https://claude.ai/artifact/D2HaZZbDnfdKewD64MBspm (نفسها: https://claude.ai/code/artifact/615b9fe8-98a8-437b-bae4-9d2d231a84ca) |
| صفحة الهوية (Artifact) | https://claude.ai/artifact/96UNhpHfq2v2BWMHVT24Rw (نفسها: https://claude.ai/code/artifact/418cb2b5-73fc-44db-b9ba-01e882fbcb5a) |

## 3. المسارات على الجهاز

- **جذر المشروع:** `C:\Users\khali\kkkkk` (git repo، remote = origin/main على GitHub).
- **التطبيق:** `C:\Users\khali\kkkkk\apps\web` (Next.js 16.3 App Router، Tailwind v4، shadcn base-nova على @base-ui/react، zustand، React Flow + dagre).
- **ملفات خاصة (مش في Git، مجلد `private/` في .gitignore):**
  - `private/project-spec-v2.docx` — مستند مواصفات إبراهيم الأصلي (17 قسم + 8 معايير قبول).
  - `private/project-spec-v2-text.txt` — نصه مستخرج.
  - `private/reply-to-spec.html` — مصدر صفحة الرد الرسمي (نفس الـ Artifact أعلاه).
  - `private/brand-artifact.html` — مصدر صفحة الهوية.
- **ذاكرة Claude للمشروع:** `C:\Users\khali\.claude\projects\C--Users-khali-kkkkk\memory\` وفيها:
  - `project-cubeline-tasks-saas.md` — ملخص المشروع والقرارات.
  - `feedback-product-copy-white-arabic.md` — قاعدة نصوص المنتج (عربية بيضاء).
  - `MEMORY.md` — الفهرس.
- **Skills المستخدمة:** `khalid-stack` (الـ stack وكتالوج المشاريع)، `humanizer` (نبرة خالد في رسائله للعملاء)، `artifact-design` (عند إنشاء صفحات).
- **إعداد سيرفر التطوير للـ Browser pane:** `.claude/launch.json` — اسم الإعداد `flowline-web`، المنفذ 3050.

## 4. تشغيل وتحقق

```bash
npm install                      # من الجذر (workspaces)
npm run dev                      # apps/web على المنفذ الافتراضي
npm run typecheck --prefix apps/web
npm run build                    # static export في apps/web/out
```

- على ويندوز داخل Git Bash: لبناء نسخة Pages محلياً `MSYS_NO_PATHCONV=1 NEXT_PUBLIC_BASE_PATH=/flowline npx next build`.
- الـ CI في `.github/workflows/pages.yml`: `npm ci` ثم تثبيت binaries لينكس يدوياً (`lightningcss-linux-x64-gnu`, `@tailwindcss/oxide-linux-x64-gnu`, `@next/swc-linux-x64-gnu`) لأن الـ lockfile مكتوب على ويندوز. لو رفعت إصدار Next أو Tailwind حدّث الأرقام هناك.
- لنشر على Cloudflare بدل Pages: `npm run deploy` من `apps/web` (`wrangler.jsonc` جاهز، اسم `flowline-demo`).

## 5. بنية الكود (المهم)

```
apps/web/src
├── app/
│   ├── page.tsx                 صفحة الدخول: الجولتان، ورقة التدريب، الشاشة المقسومة، شخصيات الديمو
│   ├── split/page.tsx           الشاشة المقسومة (iframe لكل نصف بـ ?persona=)
│   └── app/                     الشاشات: page (الفقاعات) · tree (الهيكل/الخطوط) · chat · notifications · dashboard · settings · setup · setup/print
├── components/
│   ├── bubbles/                 composer (الفقاعة) · bubble-card · request-sheet (التفاصيل والإجراءات) · pickers (اختيار شخص/نوع + إضافة)
│   ├── tree/                    org-tree (React Flow) · flow-canvas (الخطوط) · line-story (قصة الخط + تشغيل)
│   ├── shell/app-shell.tsx      الإطار: sidebar / topbar / bottom nav / قائمة الشخصيات / قائمة الجولات
│   ├── tour.tsx                 كارت الجولة التفاعلية
│   ├── setup-banner.tsx · error-boundary.tsx · providers.tsx · common.tsx · logo.tsx
│   └── ui/                      shadcn (base-nova). ملاحظة: أي DropdownMenuLabel لازم يكون داخل DropdownMenuGroup وإلا Base UI يرمي error #31
├── lib/
│   ├── engine/types.ts          نموذج البيانات بمفردات مستند إبراهيم (Request, Sub-request, Return-to, RoutingRule, AuditTrail, DeadlineLog, version)
│   ├── engine/rules.ts          الحالات (11) ↔ المراحل البصرية (4)، التأخر، أيام العمل، الشجرة، الإجراءات المسموحة
│   ├── engine/store.ts          «الـ API الوهمي» (zustand + persist في localStorage مفتاح flowline-demo). كل mutation هنا = endpoint مستقبلي
│   ├── engine/seed.ts           بيانات الديمو (شركة مقاولات، برج سكني). SEED_VERSION=5 — ارفعه مع أي تغيير في البيانات
│   ├── engine/setup.ts          ورقة الإعداد + التعبئة التلقائية
│   ├── engine/tour.ts           تعريف الجولتين (cycle: 11 خطوة، replies: 14 خطوة)
│   └── i18n/dict.ts             كل نصوص الواجهة عربي + إنجليزي
└── public/brand/                ملفات الشعار SVG + صفحة الهوية index.html
```

## 6. القرارات الثابتة

1. **الشعار إنجليزي (FlowLine)** والواجهة بلغتين. الاسم: كلمة واحدة FlowLine بحرفين كبيرين؛ بالعربي «فلو لاين».
2. **نصوص المنتج عربية بيضاء احترافية** (بدون لهجة): المراحل «لديك / في الانتظار / منجز / متوقف»، الأزرار كأسماء «إرسال، اعتماد، تحويل، إغلاق». رسائل خالد للعملاء تفضل بلهجته المصرية الاحترافية (skill humanizer). **لا تخلط الاتنين.**
3. **المحرك بمفردات مستند إبراهيم**: Request/Sub-request/Return-to/RoutingRule/Audit، 11 حالة في المحرك و4 مراحل في الواجهة. الاعتماد خاصية في نوع الطلب (نوع «مهمة» بدون اعتماد). الحقول الإضافية 5 أشكال كـ JSON. الصندوق نقي (اللي أملكه بس) + تبويب «المرسلة» للقراءة + «بانتظار العودة».
4. **الشات**: thread على كل طلب إلزامي، شات المشروع اختياري بمفتاح في الإعدادات (رأينا: مفعّل، بانتظار قرار إبراهيم).
5. **الهوية**: Deep Teal #0E6B55، Mint #63CFA9، Ink #17201C، Paper #F4F7F3، Night #131917 + ألوان دلالية (Amber انتظار، Leaf منجز، Signal متأخر، Ember عاجل). خطوط IBM Plex Sans / Plex Sans Arabic / Plex Mono. الشعار: حرف F مرسوم كخط واحد بفقاعات في أطراف الأفرع.

## 7. اللي اتبنى في الديمو (كامل)

- الفقاعات: صندوق بـ 5 تبويبات (لديّ، بانتظار اعتمادي، بانتظار العودة، المرسلة، فريقي)، الفقاعة (نص + شخص + نوع + مهلة محسوبة + عاجل)، بحث وإضافة شخص/نوع من داخل الفقاعة.
- تفاصيل الطلب: المسار الكامل، الحالة الدقيقة، الفرعيات، سجل المهلة، المرفقات، الـ thread، وكل الإجراءات (اعتماد/رفض/توضيح/الرد/بدء/إنجاز/تحويل بملاحظة/فرعي/تمديد بسبب/إعادة للمرسل/إغلاق/إعادة للمنفذ/إلغاء/تسجيل كميات).
- الهيكل الوظيفي (React Flow، طيّ/فتح، الضغط على شخص يفتح لوحة طلباته) + الموبايل drill-down.
- الخطوط (Make/n8n): فقاعة لكل طلب، خط صادر وخط راجع، تسميات، إبراز السلسلة، قصة الخط بزر تشغيل.
- الشات: قناة المشروع + محادثات الطلبات + «تحويلها إلى فقاعة».
- الإشعارات بدرجاتها (مباشر/ملخّص/تصعيد)، اللوحة التنفيذية، الإعدادات (لغة، مظهر، أرقام، هجري، أيام العمل، أنواع الطلبات، الأعضاء، إعادة ضبط).
- ورقة التدريب الفارغة (6 خطوات من الصفر) + تعبئة تلقائية + نسخة للطباعة A4.
- جولتان تفاعليتان: «الدورة الكاملة» (11 خطوة) و«الردود» (14 خطوة)، كل خطوة تبدّل الشخصية وتفتح الشاشة وتحوّط العنصر ويمكن تنفيذها تلقائياً.
- الشاشة المقسومة: نصفان بشخصيتين على نفس البيانات مع مزامنة لحظية (storage event)، فاصل قابل للسحب ونسب جاهزة.
- PWA (manifest + service worker آمن)، عربي/إنجليزي، فاتح/داكن، موبايل/ويب، error boundary بزر إعادة ضبط.

## 8. مشاكل حُلّت (لا تعيد اكتشافها)

- كراش عند فتح قائمة الشخصية/المشروع: Base UI error #31 لأن `DropdownMenuLabel` كان خارج `DropdownMenuGroup`. اتصلح. **القاعدة: أي عنصر واجهة جديد اضغطه بالماوس بنفسك قبل الرفع.**
- Chrome «This page couldn't load»: الـ service worker كان ممكن يرجع undefined؛ اتعمل بحيث يرجع Response دايماً.
- React Flow في RTL: الـ canvas مُجبر LTR وبنعكس إحداثيات dagre يدوياً. نقرات العقد عبر `onNodeClick` مش onClick داخلي.
- zustand: أي selector يرجع كائن/مصفوفة جديدة يعمل loop — استخدم `useShallow` أو selectors مستقرة.
- CI على لينكس: binaries الـ native ناقصة من lockfile ويندوز (شوف القسم 4).
- الحالة القديمة على الأجهزة: ارفع `SEED_VERSION` مع أي تغيير في شكل البيانات.
- **رعشة الشاشة مع تبويبين مفتوحين (15 سبتمبر):** المزامنة بين التبويبات كانت بتكتب النسخة المستلمة في localStorage تاني، فالتبويبان يتبادلوا كل اللقطات الوسيطة للأبد (ظهرت مع التعبئة التلقائية = 23 حفظة). الحل: علم `adopting` في `store.ts` يمنع الكتابة أثناء `adoptDb`. **لا تعيد الكتابة داخل adoptDb أبداً.** (`4d7f806`)
- **التعبئة التلقائية «لا تظهر في الحقول» (15 سبتمبر):** خطوة المشروع بقت مربوطة بالمشروع الحالي (`updateProject`) وخطوة أول فقاعة بتملأ الفقاعة وتسيب الإرسال للمستخدم (`useSetupDraft`)، و«تعبئة الورقة كاملة» بتخلّص كل شيء. ترقيم الطلبات بقى بعد أعلى رقم موجود (شركة جديدة تبدأ من REQ-1001). (`263f5a8`)

## 9. بانتظار قرار إبراهيم (من صفحة الرد)

1. شات المشروع مفعّل افتراضياً ولا مقفول؟ (رأينا: مفعّل)
2. تبويب «المرسلة» للموظف العادي؟ (رأينا: نعم)
3. تقسيم المرحلة الأولى إلى 1أ / 1ب / 1ج؟ (رأينا: نعم)

## 10. الخطوات القادمة (من هنا نكمل)

1. ~~تأكيد كراش قائمة الشخصية~~ **تم 15 سبتمبر:** خالد أكد إنه اختفى.
2. ~~جولة اختبار نهائية~~ **تمت 15 سبتمبر** على النسخة المنشورة: الجولتان (11 + 14 خطوة بالتنفيذ التلقائي)، الشاشة المقسومة (الإطاران والنسب والمزامنة)، ورقة التدريب والطباعة، الموبايل 375px (الفقاعات، التفاصيل، الهيكل/الخطوط، المحادثات، الإعدادات)، الإنجليزي والفاتح. ملاحظة تقنية: أدوات الـ Browser pane ما بتقدرش تكتب داخل iframes الشاشة المقسومة، فالمزامنة اتقاست بعدّاد الـ storage events بدل الكتابة اليدوية.
3. **إرسال الحزمة لإبراهيم** (التالي مباشرة): صفحة الرد (فيها لينك الديمو + الشاشة المقسومة + الهوية) + طلب الـ 3 قرارات. الرسالة بلهجة خالد (skill humanizer).
4. **التحضير للبناء الفعلي (المرحلة 1أ)** بعد الرد: وثيقة تقنية بها: schema D1 (بنفس types.ts)، routes Hono (نفس mutations في store.ts)، Durable Object لكل مشروع للـ real-time، R2 للمرفقات، Queues + Cron للتصعيد والملخصات، Better Auth، Web Push، ثم تقدير الجدول والسعر بأسلوب خالد (skill freelance-proposals لو لزم).
5. أفكار مؤجلة لو طلبها: WhatsApp (Cloud API) للإشعارات، الذكاء الاصطناعي (تصنيف الطلب من النص، تقدير المدد من السجل)، الالتزامات المالية، البحث التاريخي، اللوحة التنفيذية الموسّعة.

## 11. عادات الشغل مع خالد

- يكتب بالمصري ويحب الإجابات المباشرة والمنظمة؛ الأرقام بالأرقام.
- بيجرّب بنفسه على Chrome ويندوز وعلى الموبايل، وبيبعت فيديو/صورة لأي مشكلة (ffmpeg متاح لاستخراج لقطات من mp4).
- بعد كل تعديل: typecheck → build → تجربة فعلية في المتصفح (بما فيها الضغط على القوائم) → commit → push → انتظار نجاح الـ Pages workflow → إبلاغه باللينك.
- الـ commits باللغة الإنجليزية مع `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
