# 05 — المطابقة والترشيح

**الأهلية أولًا، الترتيب ثانيًا.** مهندس ممتاز غير مؤهل لا يظهر أبدًا. الكود: `src/domain/matching.ts`.

## بوابات الأهلية (كلها لازمة)
حساب ACTIVE ∧ موثّق ∧ يقدّم الخدمة ∧ ليس OFFLINE ∧ ليس ضمن مستبعدي هذا الطلب ∧ المسافة ≤ نصف قطر خدمته.

## الترتيب (صيغة أولية قابلة للضبط من الإدارة، المجموع 100)
`خدمة 35 + مسافة 25 + توفر 15 + تقييم 15 + خبرة 10`
- الخدمة: 1، أو 0.7 إن كان تخصصه الفرعي لا يغطي الطلب.
- المسافة: `1 − d/نصف القطر`. التوفر: 1 متاح، 0.5 مشغول. التقييم: `/5`. الخبرة: `min(سنوات/10, 1)`.
- التعادل يُكسر بالأقرب ثم بالمعرّف (ترتيب حتمي).
- Release v1 يذكر أيضًا «معدل الاستجابة» و«المهام المنجزة»: **لم تُدخَل في الصيغة الأولية** لعدم توفر بيانات الإطلاق؛ تُضاف كأوزان بعد القياس (قرار مفتوح).

## ما يراه العميل
قائمة مرتبة + أسباب مقروءة (`NEARBY`, `TOP_RATED`, `AVAILABLE_NOW`, `EXPERIENCED`) + المسافة والوقت المتوقع. **لا تُعاد الدرجة الخام** (`toPublicRecommendation` تحذفها). العميل هو من يختار؛ المحرّك يوصي فقط.

## الاستعلام (PostGIS، لا حساب مسافة في JavaScript)
```sql
SELECT ep.id, ST_Distance(el.point, rl.point)/1000 AS distance_km
FROM engineer_locations el
JOIN engineer_profiles ep ON ep.id = el.engineer_id AND ep.verification_status='VERIFIED'
                         AND ep.availability_status <> 'OFFLINE'
JOIN users u ON u.id = ep.user_id AND u.status = 'ACTIVE'
JOIN engineer_services es ON es.engineer_id = ep.id AND es.service_id = $service
JOIN request_locations rl ON rl.request_id = $request
WHERE el.is_primary
  AND ST_DWithin(el.point, rl.point, ep.service_radius_km * 1000)
  AND ep.id <> ALL($excluded);
```
النتيجة تُحوَّل إلى `Candidate[]` ثم `recommend()`. (الفحص بالجدول الأسبوعي `availabilities` للموعد المفضل يُضاف كبوابة اختيارية في مرحلة لاحقة.)

## عند الاختيار
`select-engineer` يعيد تنفيذ الأهلية داخل المعاملة (`assertStillEligible`)؛ فشلها ⇒ `ENGINEER_NOT_ELIGIBLE` والواجهة تقول «لم يعد متاحًا، اختر آخر».

## الإدارة
الأوزان تُحفظ في `platform_settings` وتتحقق بـ `validateWeights` (مجموع 100) وكل تغيير مدقَّق. تجربة الأثر قبل الحفظ (محاكاة على طلبات حديثة) تحسين لاحق.
