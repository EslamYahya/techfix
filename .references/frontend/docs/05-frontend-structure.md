# هيكل الواجهة الفعلية (Release v1)

المكدّس: React + TypeScript + Vite + TanStack Router/Query + React Hook Form + Zod + Tailwind، PWA أولًا. الخلفية: NestJS + PostgreSQL/PostGIS.

```
src/
├─ app/
│  ├─ router/            auth.routes · customer.routes · engineer.routes · admin.routes · guards
│  ├─ layouts/           PublicLayout · AppShell (قائمة جانبية + شريط سفلي)
│  └─ providers/         QueryClient · Theme · Toasts
├─ modules/
│  ├─ auth/              login · register · session
│  ├─ requests/          wizard · request-details · status-rail · cancel
│  ├─ matching/          engineers-list · engineer-profile
│  ├─ quotes/            quote-builder · quote-view · accept/reject
│  ├─ payments/          method-picker · gateway-return (ينتظر webhook) · cash-confirm
│  ├─ jobs/              engineer-actions (انطلاق، وصول، بدء، إنهاء، عرض إضافي)
│  ├─ reviews/
│  ├─ notifications/
│  ├─ engineer-profile/  verification · availability
│  └─ admin/             engineers · requests · matching-settings · finance
├─ shared/
│  ├─ ui/                Button · Field · Chip · Ticket · Rail · Table · Sheet · Toast · EmptyState
│  ├─ labels/            statusLabel.ts · enums.ts · errors.ts   ← قاموس النصوص (docs/03)
│  └─ lib/               money · date · distance
└─ lib/api/              client · envelope · errorMapper (رمز الخطأ ← جملة عربية)
```

## مطابقة ملفات النموذج
| النموذج | الفعلي |
|---|---|
| `js/techfix.js` — STATUS/ERR/ITEM_TYPES | `shared/labels/*` |
| `js/techfix.js` — `TF.A.*` (آلة الحالات) | **الخادم** (NestJS) + hooks في `modules/*/api` |
| `js/techfix.js` — `TF.match` | خدمة الترشيح في الخادم (PostGIS للمسافة) |
| `js/techfix.js` — rail/seg/quoteTable/reqCard | `shared/ui/*` و`modules/requests/*` |
| `js/shared.js` — gateway/map/engCard | `modules/payments`, الخريطة الحقيقية, `modules/matching` |
| `js/customer.js` · `engineer.js` · `admin.js` · `public.js` | صفحات المسارات المقابلة |
| `css/techfix.css` | إعداد Tailwind (tokens) + مكوّنات `shared/ui` |

## قواعد التنفيذ
- حالة الخادم في TanStack Query، وحالة الواجهة (تبويب، معالج الطلب) محلية. مسوّدة الطلب تُحفظ محليًا.
- غلاف موحّد للاستجابة `{ data, error: { code, fields? } }`، وكل `code` له جملة عربية.
- بعد كل إجراء: إبطال استعلام الطلب وإشعاراته (النموذج يعيد الرسم).
- الإشعارات تبدأ داخل التطبيق؛ الدفع الإلكتروني نظام فرعي مستقل (بوابة + webhook + إعادة محاولة).
- لا يُحسب إجمالي عرض السعر ولا نتيجة الترشيح في الواجهة؛ الواجهة تعرض ما يرجعه الخادم.
