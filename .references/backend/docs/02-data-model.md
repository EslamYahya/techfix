# 02 — نموذج البيانات

المصدر: `prisma/schema.prisma` (+ `postgis.sql`). ملخص القرارات:

## الكيانات
- **الهوية:** `users` (دور: CUSTOMER/ENGINEER/ADMIN، حالة)، `customer_profiles`، `engineer_profiles`، `refresh_tokens` (تخزين الـ hash فقط، عائلة رموز للكشف عن إعادة الاستخدام).
- **المهندس:** `engineer_profiles` يحمل ثلاث حالات منفصلة: **حالة الحساب** (`users.status`)، **التوثيق** (`verification_status`)، **التوفر** (`availability_status`). + `engineer_services` (تخصصات)، `engineer_locations` (PostGIS)، `availabilities` (جدول أسبوعي)، `engineer_documents`.
- **الكتالوج:** `service_categories` ← `services`. (الفئات الأربع: أقمار صناعية، مراقبة، إنتركم، شبكات؛ الخدمات الفرعية في الواجهة تُخزَّن الآن كنص `sub_service_label` وتصبح `services` عند اعتماد الكتالوج النهائي.)
- **السوق:** `service_requests` ← `request_locations`، `service_request_attachments`، `engineer_rejections`، `request_events`، `quotes` ← `quote_items`، `jobs`، `payments` (+`payment_refunds`)، `reviews`، `disputes`.
- **المنصة:** `notifications`، `device_tokens`، `audit_logs`، `platform_settings`، `webhook_events`.
- **المرحلة 2:** `shops`، `products` (`orders` و`order_items` تُضاف عندها).

## لماذا هذا الشكل
| قرار | السبب |
|---|---|
| `jobs` منفصل عن `service_requests` | الطلب = العميل طلب؛ المهمة = تنفيذ فعلي. يُنشأ Job عند قبول العرض. |
| `request_events` (إلحاقي فقط) | يغذّي «خط سير الخدمة» في الواجهات الثلاث ولا تُشتق منه الحالة. يحمل `code` آليًا لا نصًا. |
| `engineer_rejections` | المهندس الذي اعتذر/تأخر يُستبعد من جولة الترشيح التالية لهذا الطلب. |
| `quotes.kind` + `parent_quote_id` | العرض الإضافي مرتبط بالأصلي؛ المقبول لا يُعدَّل. |
| `payments` أكثر من صف لكل مهمة | عرض إضافي، محاولة إلكترونية فاشلة ثم إعادة، دفع جزئي. المبلغ المستحق يُشتق، لا يُخزَّن. |
| `webhook_events` | يحفظ الحدث الخام قبل المعالجة → قابل لإعادة التشغيل والتدقيق، ومفتاح فريد `(provider, external_id)` يمنع التكرار. |
| `service_requests.version` | قفل متفائل: طلبان متزامنان على نفس الانتقال → أحدهما يفشل بـ 409. |
| `public_number` | رقم عرض مثل `R-1064`؛ المعرّف الحقيقي UUID. |
| `request_locations.address` vs `.area` | العنوان الكامل مخفي عن المهندس حتى CONFIRMED؛ المنطقة ظاهرة من البداية. |
| `ratingAverage/completedJobsCount` | تجميعات يعيد حسابها الـ worker (تُصحَّح عند إخفاء تقييم). |

## القيود والفهارس الحرجة (تحميها قاعدة البيانات حتى لو أخطأ الكود)
- فريد: `users.email/phone`، `engineer_services(engineer_id, service_id)`، `reviews.job_id`، `jobs.request_id`، `jobs.quote_id`، `payments(provider, provider_ref)`، `payments(job_id, idempotency_key)`، `webhook_events(provider, external_id)`.
- جزئي (SQL): عرض مفتوح واحد (DRAFT/SENT) لكل `(request, kind)`؛ عرض أساسي مقبول واحد لكل طلب.
- CHECK: التقييم 1..5، يوم الأسبوع 0..6، كمية>0 وسعر≥0 للبنود، مبلغ الدفع>0.
- فهارس: `GIST(engineer_locations.point)`، `service_requests(customer_id,status)`، `(selected_engineer_id,status)`، `jobs(engineer_id,status)`، `quotes(engineer_id,status)`، `reviews(engineer_id)`، `notifications(user_id,read_at,created_at)`، `audit_logs(entity_type,entity_id)`.

## الأموال
`Decimal(12,2)`؛ الحساب في الكود بالقروش (أعداد صحيحة) لتفادي أخطاء الفاصلة العائمة. العملة جنيه مصري فقط الآن؛ إضافة عملة لاحقًا = عمود `currency` + قيد.

## حذف البيانات
لا حذف فعلي للمستخدمين/الطلبات/المدفوعات. الإيقاف (`SUSPENDED`) لا يمسح شيئًا. الحذف الناعم أو إخفاء الهوية يُحدَّد مع سياسة الخصوصية (قرار مفتوح).
