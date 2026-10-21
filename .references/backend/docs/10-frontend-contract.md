# 10 — العقد مع الواجهة الأمامية

النموذج التجريبي (`techfix-frontend-reference/prototype`) يحاكي الخادم عبر `TF.A.*` في localStorage. هذا الجدول يربط كل إجراء بنقطة API ليصبح استبدال المحاكاة بطلبات حقيقية مباشرًا.

## الإجراءات
| `TF.A.*` (محاكاة) | الدور | نقطة API | ملاحظة |
|---|---|---|---|
| createRequest | عميل | `POST /service-requests` | يعيد `MATCHING` مباشرة (START_MATCHING نظامي) |
| (TF.match) | عميل | `GET /service-requests/:id/recommendations` | بلا درجة؛ أسباب برموز |
| chooseEngineer | عميل | `POST …/select-engineer` | `ENGINEER_NOT_ELIGIBLE` ⇒ «لم يعد متاحًا» |
| changeEngineer | عميل | `POST …/change-engineer` | يلغي عرضًا معلّقًا |
| engineerAccept / engineerReject | مهندس | `POST …/accept` / `…/reject` | موثّق فقط |
| sendQuote (MAIN) | مهندس | `POST …/quotes` | لا total في الجسم |
| sendQuote (ADDITIONAL) | مهندس | `POST /jobs/:id/additional-quotes` | في IN_PROGRESS فقط |
| acceptQuote / rejectQuote | عميل | `POST /quotes/:id/accept|reject` (+`/additional-quotes/…`) | القبول ينشئ Job |
| payCash | عميل | `POST /jobs/:id/payments {CASH}` | يؤكد الحجز |
| beginOnline | عميل | `POST /jobs/:id/payments {ONLINE}` | يعيد `checkoutUrl` |
| gatewayWebhook | مزوّد | `POST /payments/webhook` | الواجهة لا تستدعيه أبدًا |
| onTheWay / arrived / startWork | مهندس | `POST /jobs/:id/start-trip|arrive|start` | |
| finishWork | مهندس | `POST /jobs/:id/complete` | `PENDING_ADDITIONAL_QUOTE` |
| confirmCompletion | عميل | `POST /jobs/:id/confirm-completion` | |
| reportProblem | عميل | `POST /jobs/:id/report-problem` | يفتح نزاعًا |
| confirmCash | مهندس | `POST /jobs/:id/payments/confirm-cash` | بعد COMPLETED |
| rate | عميل | `POST /jobs/:id/review` | |
| cancel / adminCancel | عميل / إدارة | `POST …/cancel` / `/admin/service-requests/:id/cancel` | |
| setAvailability | مهندس | `PATCH /engineers/me/status` | |
| verify / setAccount | إدارة | `POST /admin/engineers/:id/verify|suspend|reinstate` | |
| saveSettings | إدارة | `PUT /admin/settings` | مجموع الأوزان 100 |
| register / login | عام | `POST /auth/register|login` | |
| notifs / markRead | الكل | `GET /notifications`, `POST …/read-all` | |

## رموز الأخطاء ⇄ جمل الواجهة (`TF.L.ERR`)
| رمز الخادم | مفتاح الواجهة |
|---|---|
| FORBIDDEN | FORBIDDEN |
| NOT_FOUND | NOT_FOUND |
| INVALID_STATE_TRANSITION | INVALID_STATE |
| VALIDATION_ERROR | VALIDATION |
| PENDING_ADDITIONAL_QUOTE | PENDING_EXTRA |
| ENGINEER_NOT_VERIFIED | NOT_VERIFIED |
| ACCOUNT_SUSPENDED | SUSPENDED |
| ENGINEER_NOT_ELIGIBLE | UNAVAILABLE |
| PAYMENT_NOT_VERIFIED | PAYMENT_UNVERIFIED |
الباقي (`UNAUTHORIZED`, `CONFLICT`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`, `INTERNAL`) تحتاج جملًا عربية جديدة في قاموس الواجهة. **الخادم لا يرسل نصًا عربيًا كعقد.**

## القواميس (تبقى في الواجهة)
`STATUS` (اسم الحالة لكل دور)، `ADMIN_ST`، `ITEM_TYPES`، `PAY`، `PAYSTATE`، `VERIF`، `ACCOUNT`، `AVAIL`، `SLOTS`، وأسباب الترشيح (`NEARBY`⇒«قريب منك» …). الخادم يرسل الرموز فقط، والاختبار `contract.test.ts` يتأكد أن كل حالة في الواجهة موجودة في الخادم.

## فروق النموذج عن الخادم الحقيقي (مقصودة ويجب معالجتها عند الربط)
1. النموذج يخزّن `payment.paid` رقمًا؛ الخادم صفوف `payments` والمتبقي **مشتق** (`paymentSummary`).
2. النموذج يخزّن العروض داخل الطلب بحالات `WITHDRAWN/REPLACED`؛ الخادم يستخدم `CANCELLED` فقط.
3. معرّفات النموذج `R-1064`؛ الخادم UUID + `number` للعرض.
4. النموذج يعطي المهندس العنوان كاملًا حسب الحالة من الواجهة؛ الخادم **لا يرسله أصلًا** قبل CONFIRMED.
5. المهلة وانتهاء العرض غير ممثّلين في النموذج؛ تأتي من الـ worker.
6. حقل `availableActions` جديد: بدل أن تحسب الواجهة «ماذا يظهر» من الحالة (`TF.needs`)، تستهلكه مباشرة.
