# خريطة الصفحات وطريقة ربطها

افتح `prototype/index.html` (أو `prototype/guide.html` لخريطة حيّة). النموذج صفحات HTML مترابطة فعلًا، وحالته تُحفظ في المتصفح، فتغيير دور من شريط «عرض تجريبي» يعرض نفس الطلب من وجهة نظر الدور الآخر.

## الصفحات والمسارات الفعلية المقترحة
| ملف النموذج | المسار في المشروع الفعلي |
|---|---|
| index / login / register | `/` · `/login` · `/register` |
| customer/home | `/customer` |
| customer/new-request (4 خطوات) | `/customer/requests/new` |
| customer/matching | `/customer/requests/:id/engineers` |
| customer/engineer | `/customer/engineers/:id` |
| customer/requests · request · invoice | `/customer/requests` · `/:id` · `/:id/invoice` |
| customer/notifications · profile | `/customer/notifications` · `/customer/profile` |
| engineer/home · requests · request | `/engineer` · `/engineer/requests` · `/:id` |
| engineer/earnings · notifications · profile | `/engineer/earnings` · `/notifications` · `/profile` |
| admin/home · engineers · requests · matching · finance | `/admin` · `/admin/engineers` · `/admin/requests[/:id]` · `/admin/matching` · `/admin/finance` |

## منطق الانتقال بين الصفحات
**الزائر**: الرئيسية ← اختيار خدمة ← (إن لم يسجّل الدخول) تسجيل الدخول مع `next` ← يعود إلى نموذج الطلب. بعد الدخول يذهب كل دور إلى بوابته.

**العميل** (كل خطوة تنقل تلقائيًا للصفحة التالية الصحيحة):
1. `new-request` ← إرسال ← `matching` (حالة «اختر المهندس»).
2. `matching` ← «عرض الملف» ← `engineer` ← «اختيار» ← `request`.
3. `request` يعرض الإجراء المناسب لكل حالة: اختيار المهندس، انتظار الرد، مراجعة العرض، اختيار الدفع، متابعة الطريق/التنفيذ، تأكيد الإنجاز، السداد والتقييم.
4. بعد التقييم: `invoice`. كل الإشعارات روابط عميقة إلى `request?r=…`.
5. صفحة `matching` تحوّل تلقائيًا إلى `request` إن لم يكن الطلب في مرحلة الاختيار.

**المهندس**: `home`/`requests` ← `request` ثم إجراء واحد بارز حسب الحالة: قبول/اعتذار ← نموذج عرض السعر ← انتظار ← انطلاق ← وصول ← بدء ← (عرض إضافي) ← إنهاء ← تأكيد استلام النقد. العنوان والهاتف يظهران بعد تأكيد الحجز.

**المشرف**: `home` ← «يحتاج إجراءً» ← `engineers` (توثيق) أو `requests?r=` (بلاغ). تغيير الأوزان في `matching` يظهر أثره فورًا في المعاينة.

## تحقق الصلاحية في الصفحات
- دخول بوابة بدور خاطئ ← `login?next=…`.
- فتح طلب لا يخصّ المستخدم ← شاشة «لا يمكن عرض هذا الطلب» (لا يُكشف وجوده).
- كل زر إجراء يُخفى/يُعطّل حسب الحالة، وكل إجراء يُتحقق منه ثانية في `TF.A.*` (محاكاة للخادم).

## ما بين الأدوار (قصة واحدة للعرض)
طارق (عميل) ← طلب «تركيب كاميرات جديدة» مع أحمد حسن، عرض سعر 2,200 ج.م جاهز (R-1061). أحمد لديه طلب جديد من منى (R-1063)، وحجز مؤكد (R-1060)، وطلب منجز بانتظار تأكيد استلام النقد (R-1055). المشرف لديه مهندسان بانتظار التوثيق.
