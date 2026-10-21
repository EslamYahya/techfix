# 03 — آلات الحالات

المصدر في الكود: `src/domain/request-state.ts`، `quote.ts`، `payments.ts`. الحالات منفصلة عمدًا: **حالة الطلب/المهمة** و**حالة العرض** و**حالة الدفع** و**حالات المهندس** لا تختلط.

## 1) الطلب/المهمة
```
REQUESTED ─system→ MATCHING ─customer→ ENGINEER_SELECTED ─engineer→ ENGINEER_ACCEPTED
   ENGINEER_SELECTED ─engineer reject / system timeout→ MATCHING
   ENGINEER_ACCEPTED ─engineer→ QUOTE_SENT ─customer→ QUOTE_ACCEPTED | QUOTE_REJECTED
   QUOTE_REJECTED ─engineer→ QUOTE_SENT (عرض معدّل)  | ─customer→ MATCHING (تغيير المهندس)
   QUOTE_ACCEPTED ─customer(cash) / system(webhook)→ CONFIRMED
   CONFIRMED → ON_THE_WAY → ARRIVED → IN_PROGRESS → COMPLETION_PENDING ─customer→ COMPLETED ─customer→ RATED
   CANCELLED (من العميل/الإدارة)
```

| الحدث | من | الفاعل | إلى |
|---|---|---|---|
| START_MATCHING | REQUESTED | النظام | MATCHING |
| SELECT_ENGINEER | MATCHING | عميل/إدارة | ENGINEER_SELECTED |
| ENGINEER_ACCEPT | ENGINEER_SELECTED | مهندس | ENGINEER_ACCEPTED |
| ENGINEER_REJECT / ENGINEER_TIMEOUT | ENGINEER_SELECTED | مهندس / النظام | MATCHING |
| CHANGE_ENGINEER | SELECTED, ACCEPTED, QUOTE_SENT, QUOTE_REJECTED | عميل/إدارة | MATCHING |
| SEND_QUOTE | ENGINEER_ACCEPTED, QUOTE_REJECTED | مهندس | QUOTE_SENT |
| ACCEPT_QUOTE / REJECT_QUOTE | QUOTE_SENT | عميل | QUOTE_ACCEPTED / QUOTE_REJECTED |
| CONFIRM_BOOKING | QUOTE_ACCEPTED | عميل (نقدًا) / النظام (webhook) | CONFIRMED |
| START_TRIP / ARRIVE / START_JOB | CONFIRMED / ON_THE_WAY / ARRIVED | مهندس | ON_THE_WAY / ARRIVED / IN_PROGRESS |
| COMPLETE_JOB | IN_PROGRESS | مهندس | COMPLETION_PENDING |
| CONFIRM_COMPLETION | COMPLETION_PENDING | عميل | COMPLETED |
| RATE | COMPLETED | عميل | RATED |
| CANCEL | حتى CONFIRMED مجانًا؛ ON_THE_WAY..IN_PROGRESS إدارة فقط | عميل/إدارة | CANCELLED |

أخطاء: فاعل غير مسموح → `FORBIDDEN` (403)، حالة لا تسمح → `INVALID_STATE_TRANSITION` (409).

### قواعد إضافية
- **تغيير المهندس / اعتذاره** يُلغي أي عرض `SENT` (يصبح `CANCELLED`) ويُسجَّل المهندس في `engineer_rejections` فلا يظهر ثانية لهذا الطلب.
- **انتهاء المهلة:** مهمة دورية تنقل `ENGINEER_SELECTED` المتأخر إلى MATCHING (المهلة قرار مفتوح).
- **الإنهاء** ممنوع إن وُجد عرض إضافي `SENT` (`PENDING_ADDITIONAL_QUOTE`).
- **البلاغ بدل التأكيد:** `report-problem` في COMPLETION_PENDING يفتح نزاعًا ويُبقي الحالة كما هي ويُخطر الإدارة والمهندس.
- **عدم الحضور (No-Show):** حدث يفتح نزاعًا من العميل (المهندس لم يصل) أو المهندس (العميل غائب بعد ARRIVED). لا رسوم تلقائية في الإصدار الأول لكن النموذج يسمح بها.
- `jobs.status` يعكس الطلب منذ CONFIRMED؛ مصدر الحقيقة واحد: الانتقال يُحدّث الاثنين في معاملة واحدة.

## 2) عرض السعر
`DRAFT → SENT → ACCEPTED | REJECTED | EXPIRED`، و`CANCELLED` عند السحب/الاستبدال. المقبول **غير قابل للتعديل**؛ تعديل السعر = عرض جديد. العرض الإضافي (`kind=ADDITIONAL`) يُنشأ فقط في IN_PROGRESS وعرض واحد معلّق كحد أقصى. السعر المتفق عليه = الأساسي المقبول + الإضافيات المقبولة (`agreedTotal`).
- رفض العرض الإضافي: العمل يستمر بالنطاق الأصلي، أو يفتح المهندس نزاعًا (يجب أن يكون واضحًا في الواجهة).
- انتهاء الصلاحية: مهمة دورية تنقل `SENT` المنتهي إلى EXPIRED وتُخطر العميل (مدة الصلاحية قرار مفتوح).

## 3) الدفع
```
PENDING ─webhook ok / cash confirmed→ PAID ─→ REFUNDED | PARTIALLY_REFUNDED
PENDING ─webhook fail→ FAILED ─retry→ PENDING
```
حالة العرض في الواجهة (لم يُدفع / جزئي / مدفوع) **مشتقة** من مجموع المدفوع مقابل السعر المتفق عليه، لا مخزّنة.

## 4) المهندس (ثلاثة محاور مستقلة)
- **الحساب:** ACTIVE ⇄ SUSPENDED (PENDING عند التسجيل). الإيقاف يخفيه من الترشيح ويمنعه من طلبات جديدة؛ المهام الجارية بسياسة خاصة؛ **لا حذف بيانات**.
- **التوثيق:** PENDING → VERIFIED | REJECTED (سبب إلزامي عند الرفض). المهندس غير الموثّق لا يقبل طلبات ولا يغيّر توفره.
- **التوفر:** AVAILABLE / BUSY / OFFLINE. OFFLINE يُستبعد من الترشيح؛ BUSY يبقى مؤهلًا بترتيب أقل.
