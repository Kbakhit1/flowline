# مِرسال · Mirsal

ديمو تفاعلي لنظام إدارة الطلبات على الهيكل الوظيفي (مشروع كيوب لاين).
كل طلب في الشركة "فقاعة" واحدة: تنزل للفريق، وترجع بخبر.

## تشغيل

```bash
npm install --prefix apps/web
npm run dev          # http://localhost:3000
npm run build        # static export في apps/web/out
npm run deploy       # next build + wrangler deploy (محتاج حساب Cloudflare)
```

## الشكل العام

```
apps/web/src
├── app/                 الصفحات (static export)
│   ├── page.tsx         صفحة الدخول واختيار الشخصية
│   └── app/             الفقاعات · الشجرة · الشات · الإشعارات · اللوحة · الإعدادات
├── components/
│   ├── bubbles/         الفقاعة (composer) · كارت الطلب · شاشة التفاصيل والإجراءات
│   ├── tree/            الهيكل الوظيفي (React Flow + dagre)
│   └── shell/           الإطار: sidebar / bottom nav / تبديل الشخصية
└── lib/
    ├── engine/
    │   ├── types.ts     نموذج البيانات بمفردات مستند المواصفات (Request, RoutingRule, AuditTrail…)
    │   ├── rules.ts     القواعد النقية: الحالات ↔ المراحل، التأخر، أيام العمل، الشجرة، الإجراءات المسموحة
    │   ├── seed.ts      بيانات الديمو (شركة مقاولات، برج سكني)
    │   └── store.ts     "الـ API" الوهمي: كل mutation هنا هي شكل endpoint مستقبلي على Workers
    └── i18n/            عربي/إنجليزي + التنسيق (أرقام، تقويم، مهل)
```

## حدود الديمو

- البيانات محفوظة في `localStorage` على الجهاز. زرار "رجّع الديمو" في الإعدادات.
- مفيش backend. لما نبدأ البناء الفعلي، `store.ts` بيتبدل بنداءات HTTP لـ Hono على Cloudflare
  (D1 + Durable Objects + R2 + Queues) والشاشات تفضل زي ما هي.
- الإشعارات داخلية بس. Push / واتساب / إيميل بتيجي مع الـ backend.

## تغيير أسماء الديمو

كل الأسماء (الشركة، الناس، المشاريع، الطلبات) في `apps/web/src/lib/engine/seed.ts` وبس.
بعد أي تعديل ارفع `SEED_VERSION` عشان الأجهزة اللي فتحت الديمو قبل كده تاخد النسخة الجديدة.
