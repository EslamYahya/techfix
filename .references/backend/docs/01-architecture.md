# 01 — البنية المعمارية

## القرار
**Modular Monolith** على NestJS + PostgreSQL/PostGIS + Redis/BullMQ. السبب (من Release v1): منتج جديد، مدينة واحدة، فريق صغير، ونطاق ما زال يتشكل. نبني حدود وحدات نظيفة الآن، ويمكن استخراج خدمات لاحقًا دون تغيير النطاق.

```
Customer/Engineer/Admin clients ──HTTPS──▶ Nginx ──▶ API (NestJS, /api/v1)
                                                     │        │
                                              PostgreSQL   Redis ◀── Worker (BullMQ)
                                              + PostGIS         │
                                                     Object storage (S3-compatible)
                                      Payment provider ◀──webhook──▶ API
```

## الطبقات داخل كل وحدة
```
Controller (HTTP، تحقق DTO)
   ↓
Application Service  ← يفتح المعاملة، ينسّق
   ↓
Domain Rules (src/domain: authorize / transition / computeQuote / recommend)
   ↓
Repository (Prisma)
```
المتحكم لا يحتوي منطق عمل. الخدمة التطبيقية هي الوحيدة التي تعرف قاعدة البيانات.

## الوحدات
| الوحدة | المسؤولية | المرحلة |
|---|---|---|
| auth | تسجيل، دخول، تجديد، خروج، استعادة كلمة المرور | 1 |
| users / customers / engineers | الملفات، التوثيق، التوفر، الموقع، التخصصات | 1 |
| services | التصنيفات والخدمات | 1 |
| requests | إنشاء الطلب، اختيار/تغيير المهندس، الإلغاء | 1 |
| matching | الأهلية + الترتيب (وحدة منطقية مستقلة) | 1 |
| quotes | العرض الأساسي والإضافي | 1 |
| jobs | رحلة التنفيذ (انطلاق، وصول، بدء، إنهاء، تأكيد) | 1 |
| payments | نقدًا/إلكترونيًا، webhook، استرداد | 1 |
| reviews | التقييم وإشراف التقييمات | 1 |
| notifications | داخل التطبيق + Push | 1 |
| admin | واجهات الإدارة (بصلاحيات، لا `if role`) | 1 |
| disputes | البلاغات: أساسي في 1، متقدم لاحقًا | 1→3 |
| shops / products / orders | المتجر | 2 |
| wallet / commissions / subscriptions | الماليات المتقدمة | 3 |

## التواصل بين الوحدات: أحداث داخلية
ناقل أحداث بسيط داخل العملية (EventEmitter) الآن، يُستبدل بـ BullMQ/Broker عند الحاجة:
`ServiceRequestCreated, EngineerSelected, EngineerAccepted, QuoteSent, QuoteAccepted, BookingConfirmed, JobStarted, JobCompleted, CompletionConfirmed, PaymentSucceeded, ReviewCreated`.
المستمعون: الإشعارات، تحديث تجميعات المهندس، التحليلات. **لا يُنفَّذ أثر جانبي مهم (إشعار/بريد) داخل المعاملة؛** يُسجَّل في outbox ثم يُرسَل من الـ worker (انظر 08).

## المعاملات (Transaction Boundaries)
كل انتقال حالة = معاملة واحدة تضم: قفل متفائل على `service_requests.version` + تحديث الحالة + سجل `request_events` + `audit_logs` + إدراج outbox. أمثلة:
- **قبول العرض:** العرض→ACCEPTED، الطلب→QUOTE_ACCEPTED، إنشاء Job. إن فشل إنشاء المهمة يُلغى كل شيء.
- **اختيار المهندس:** إعادة فحص الأهلية داخل المعاملة (الصفحة قد تكون قديمة).
- **webhook الدفع:** تخزين الحدث الخام + تحديث الدفع + (إن لزم) تأكيد الحجز.

## بنية المجلدات المقترحة
```
src/
  app/ config/ common/{auth,errors,validation,middleware,database,utils}
  modules/<module>/{controller,service,domain,repository,dto}
  domain/            ← هذا المرجع (يُنسخ أو يُنشر كحزمة)
prisma/ test/ openapi.yaml
```

## النشر
Nginx → Node (PM2/Docker) ← PostgreSQL+PostGIS، Redis، تخزين كائنات، Worker منفصل بنفس الصورة. بيئات: local / staging / production، الأسرار من المتغيرات البيئية. مراقبة من البداية: سجلات منظّمة، `X-Request-Id`، تتبع أخطاء، مقاييس أساسية.
