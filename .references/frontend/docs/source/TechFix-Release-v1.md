# TechFix (Project)

# 📘 Product Blueprint — v0.1

## 1. Product Vision

### الفكرة الأساسية

منصة تربط **العميل** بالمهندس المتخصص في:

- Satellite
- CCTV
- Intercom
- Networking
- Installation & Maintenance

بحيث العميل لا يحتاج للبحث عن فني بشكل عشوائي، وإنما:

```
Customer
   ↓
Choose Service
   ↓
Set Location
   ↓
Create Request
   ↓
Platform Matching
   ↓
Suitable Engineers
   ↓
Engineer Accepts
   ↓
Service
   ↓
Rating
```

وفي نفس الوقت يستطيع المهندس استخدام المنصة للحصول على عملاء وإدارة خدماته.

ولو المهندس يمتلك محلًا، فالمنصة تتحول أيضًا إلى **Online Shop** له.

---

# 2. المشكلة التي نحلها

## Customer Problems

العميل حاليًا ممكن يواجه:

- لا يعرف فنيًا موثوقًا.
- لا يعرف سعر الخدمة.
- لا يعرف هل الفني متخصص فعلًا.
- صعوبة العثور على فني قريب.
- لا يعرف موعد وصول الفني.
- لا يوجد تاريخ للخدمات السابقة.
- لا يوجد نظام واضح للتقييم.

### المنصة تحاول تحويل هذا:

```
"محتاج حد يركبلي كاميرات"
             ↓
فتح التطبيق
             ↓
CCTV Installation
             ↓
Location
             ↓
Engineers
             ↓
اختيار/مطابقة
             ↓
طلب الخدمة
```

---

# 3. Engineer Problems

المهندس أو الفني قد يعاني من:

- الاعتماد على المعارف.
- صعوبة الحصول على عملاء جدد.
- عدم وجود Profile احترافي.
- صعوبة بناء Reputation.
- عدم وجود نظام لإدارة الطلبات.
- لو عنده محل، المتجر غير متصل بالخدمات.

المنصة تعطيه:

```
Professional Profile
        +
Customers
        +
Jobs
        +
Reviews
        +
Location
        +
Shop
        +
Products
```

---

# 4. أنواع الحسابات

أقترح **عدم عمل Role منفصل للمحل**.

نستخدم:

```
User
 │
 ├── Customer
 │
 └── Engineer
       │
       ├── Freelance
       │
       └── Shop Owner
```

يعني:

```
accountType = ENGINEER

hasShop = false
```

أو:

```
accountType = ENGINEER

hasShop = true
```

وده أفضل معماريًا من إنشاء User Role اسمه `shop`.

---

# 5. Roles

## 👤 Customer

يستطيع:

- إنشاء حساب.
- إدارة Profile.
- تحديد Location.
- استعراض الخدمات.
- إنشاء Service Request.
- مشاهدة المهندسين.
- قبول عرض/مهندس.
- متابعة حالة الطلب.
- تقييم المهندس.
- مشاهدة الطلبات السابقة.

---

## 🔧 Engineer

يستطيع:

- إنشاء حساب مهندس.
- تحديد نوع العمل.
- إضافة التخصصات.
- تحديد Location.
- تحديد مناطق العمل.
- تحديد Availability.
- استقبال الطلبات.
- قبول/رفض الطلب.
- تحديث حالة العمل.
- مشاهدة العملاء السابقين.
- الحصول على Reviews.

---

## 🏪 Engineer + Shop

كل صلاحيات Engineer بالإضافة إلى:

- إنشاء Shop.
- إضافة المنتجات.
- إدارة الأسعار.
- إدارة المخزون.
- استقبال Product Orders.
- إدارة الطلبات.
- عرض المتجر للعملاء.

---

## 🛡️ Admin

مسؤول عن:

- Users
- Engineers
- Customers
- Services
- Service Requests
- Shops
- Products
- Reviews
- Verification
- Reports
- Complaints
- Platform Settings

---

# 6. Service Categories

## 📡 Satellite

```
Satellite Installation
Satellite Alignment
LNB Installation
Signal Troubleshooting
Dish Maintenance
Receiver Setup
Cable Installation
Central Dish
Multi-Satellite
```

## 📹 CCTV

```
Camera Installation
Camera Maintenance
DVR Installation
NVR Installation
Camera Configuration
Remote Viewing
Network Cameras
Troubleshooting
```

## 📞 Intercom

```
Intercom Installation
Video Intercom
Intercom Maintenance
Wiring
Troubleshooting
```

## 🌐 Networking

```
Router Installation
Switch Installation
Access Point
Network Cabling
Cat6
Network Troubleshooting
```

> دي **مسودة Catalog**، ولسه محتاجين نقرر هل الخدمات دي كلها تدخل الـMVP أم نبدأ بعدد أصغر.
> 

---

# 7. Service Request

دي واحدة من أهم Entities في المشروع.

العميل ينشئ:

```
ServiceRequest
```

ويحتوي مثلًا على:

```
customer
service
description
location
preferredDate
preferredTime
attachments
status
assignedEngineer
createdAt
completedAt
```

مثال:

```
Customer:
Ahmed

Service:
CCTV Installation

Description:
عايز تركيب 4 كاميرات في محل

Location:
...

Preferred Time:
Tomorrow 5 PM
```

---

# 8. Request Lifecycle

نثبت الـworkflow المبدئي:

```
REQUESTED
    ↓
MATCHING
    ↓
ACCEPTED
    ↓
ON_THE_WAY
    ↓
ARRIVED
    ↓
IN_PROGRESS
    ↓
COMPLETED
    ↓
RATED
```

ولو المهندس رفض:

```
REQUESTED
    ↓
REJECTED
    ↓
MATCHING
```

والعميل ممكن يلغي:

```
REQUESTED
    ↓
CANCELLED
```

---

# 9. Matching Engine

دي ممكن تكون **الميزة الأساسية التي تميز المنتج**.

بدل:

```
Nearest Engineer
```

نعمل:

```
Engineer Matching Score
```

يعتمد على:

```
Distance
+
Service Compatibility
+
Availability
+
Rating
+
Experience
+
Response Rate
```

مثال:

```
Engineer A
Distance: 2 km
Rating: 4.8
CCTV: Expert
Available: Yes

Engineer B
Distance: 1 km
Rating: 4.2
CCTV: Basic
Available: Yes
```

مش شرط B يظهر قبل A.

---

# 10. Engineer Location

المهندس عنده:

```
latitude
longitude
```

لكن **مش لازم في الـMVP نعمل Live Tracking طوال اليوم**.

نبدأ بـ:

```
Profile Location
+
Availability
```

ومستقبلًا:

```
Active Job
    ↓
Live Location
    ↓
Customer Tracking
```

وده يقلل جدًا التعقيد والتكلفة في البداية.

---

# 11. Engineer Profile

صفحة المهندس تعرض:

```
Name
Profile Photo
Verification Status
Specializations
Service Areas
Rating
Completed Jobs
Experience
Availability
Shop
Reviews
```

مثال:

```
Mohamed Ahmed
✓ Verified Engineer

CCTV
Satellite
Networking

⭐ 4.8

127 Completed Jobs

Available Now
```

---

# 12. Verification

دي مهمة جدًا لأننا بنتعامل مع أشخاص يدخلوا بيوت ومحلات العملاء.

نقدر نعمل:

```
UNVERIFIED
    ↓
PENDING_VERIFICATION
    ↓
VERIFIED
```

والـAdmin يراجع المهندس.

وفي الـUI:

```
✓ Verified
```

لكن **تفاصيل مستندات التحقق** نحددها لاحقًا حسب نموذج التشغيل والقوانين المحلية.

---

# 13. Shop

لو المهندس عنده محل:

```
Engineer
   ↓
Shop
```

والـShop يحتوي:

```
name
description
location
phone
workingHours
logo
cover
```

ويستطيع إضافة:

```
Products
```

مثلاً:

```
CCTV Camera
DVR
NVR
LNB
Satellite Dish
Cable
Connectors
Power Supply
Intercom
Router
Switch
```

---

# 14. E-commerce

المستخدم يستطيع:

```
Browse Shops
      ↓
Browse Products
      ↓
Product Details
      ↓
Add To Cart
      ↓
Checkout
      ↓
Order
```

لكن هنا عندي **قرار استراتيجي مهم**:

أنا لا أنصح أن نضع الـE-commerce الكامل في أول Version.

الأفضل:

### MVP

```
Service Marketplace
```

ثم:

### Phase 2

```
Shop
+
Products
```

ثم:

### Phase 3

```
Cart
+
Orders
+
Payments
+
Inventory
```

لأن الـMarketplace وحده منتج كبير بما يكفي.

---

# 15. Rating System

بعد اكتمال الخدمة:

```
Customer
    ↓
Rate Engineer
```

مثلاً:

```
⭐ 1 - 5
```

وفي المستقبل:

```
Quality
Professionalism
Punctuality
Communication
```

لكن MVP:

**Rating + Review فقط.**

---

# 16. Notifications

مبدئيًا:

```
New Service Request
Request Accepted
Engineer On The Way
Engineer Arrived
Job Completed
New Review
```

والقنوات مستقبلًا:

```
In-App
Push Notification
SMS
WhatsApp
```

لكن مش لازم كلها في أول نسخة.

---

# 17. Business Model

نقدر مستقبلًا نحقق دخل من:

### Service Commission

```
Customer pays 500
       ↓
Platform commission
       ↓
Engineer receives remainder
```

### Product Commission

من مبيعات المتاجر.

### Featured Engineers

المهندس يدفع مقابل ظهور أفضل.

### Featured Products

المنتجات تظهر في أماكن مميزة.

### Subscription

مستقبلًا:

```
Free
Pro
Business
```

لكن **لا نقرر نموذج التسعير النهائي قبل اختبار السوق**.

---

# 18. MVP الحقيقي

لو أنا المسؤول عن أول Release، هخليه:

### Customer

```
Register
Login
Profile
Choose Service
Location
Create Request
Find Engineer
Request Status
Rating
History
```

### Engineer

```
Register
Profile
Specializations
Location
Availability
Requests
Accept / Reject
Job Status
History
Reviews
```

### Admin

```
Dashboard
Customers
Engineers
Verification
Services
Requests
Reviews
```

### خارج الـMVP

```
Shop
Products
Cart
Payments
Wallet
Live Tracking
Chat
Coupons
Subscriptions
Advanced Analytics
```

---

# 📘 Product Blueprint — Decisions v0.2

## 1. Engineer Selection — Hybrid Model ✅

هنستخدم **Hybrid Matching**.

يعني المنصة مش هتجبر العميل على مهندس واحد فقط.

الـFlow يكون:

```
Customer
   ↓
Choose Service
   ↓
Set Location
   ↓
Create Request
   ↓
Matching Engine
   ↓
Recommended Engineers
   ↓
┌─────────────────────────────┐
│ Engineer A ⭐ 4.9 — 2.1 km │
│ Engineer B ⭐ 4.7 — 3.0 km │
│ Engineer C ⭐ 4.6 — 3.5 km │
└─────────────────────────────┘
   ↓
Customer chooses
   ↓
Engineer receives request
```

### ولو الـApp اختار/رشح مهندس والعميل مش عايزه؟

العميل يقدر يقول:

**"مش مناسب"**

ثم تظهر له:

> **مهندسين مقترحين آخرين لنفس الخدمة والمنطقة.**
> 

وده قرار ممتاز من ناحية الـUX لأنه يقلل الاحتكاك بين العميل والمهندس.

---

# 2. لكن نحتاج نفرق بين "Recommendation" و "Assignment"

دي نقطة مهمة جدًا.

الـMatching Engine **لا يعين المهندس بشكل نهائي**.

هو يقوم بـ:

```
Matching Engine
      ↓
Ranking
      ↓
Recommended Engineers
```

وليس:

```
Matching Engine
      ↓
Engineer A
      ↓
Done
```

وبالتالي القرار النهائي:

```
Customer
   ↓
Select Engineer
   ↓
Request Sent
   ↓
Engineer Accept / Reject
```

لو المهندس رفض:

```
Engineer Rejects
       ↓
Matching Engine
       ↓
Other Recommended Engineers
```

---

# 3. Engineer Pricing — Engineer Sets Price ✅

ثبتنا:

> **المهندس هو الذي يحدد سعر الخدمة.**
> 

وده مناسب جدًا لأن نفس الخدمة ممكن تختلف تكلفتها حسب:

- حجم العمل
- عدد الكاميرات
- نوع الأجهزة
- صعوبة التركيب
- المسافة
- الخامات
- حالة المكان

لكن هنا لازم ننتبه لنقطة مهمة جدًا:

## السعر النهائي لا يجب أن يكون مجرد رقم ثابت عند المهندس.

مثلاً:

```
CCTV Installation
Starting Price: 500 EGP
```

لكن الطلب الحقيقي:

```
4 Cameras
+
50m Cable
+
DVR Installation
+
Configuration
```

فممكن المهندس يقدم:

```
Service Price
+
Materials
+
Additional Work
=
Final Price
```

**دي نقطة هنصممها بالتفصيل لما نوصل للـService Request والـQuote System.**

---

# 4. Payment — Cash + Online ✅

هنسمح بالاثنين:

```
Payment Method
       │
       ├── Cash
       │
       └── Online
```

لكن مهم جدًا:

**ما نبدأش تنفيذ Payment Gateway في أول مرحلة قبل تحديد الـPayment Flow بالكامل.**

لأننا محتاجين نقرر لاحقًا:

```
Customer
   ↓
Request
   ↓
Engineer Quote
   ↓
Customer Accept
   ↓
Payment
   ↓
Service
   ↓
Completion
```

والـOnline Payment يحتاج كمان قواعد للـRefunds وCancellations وDisputes.

---

# 5. Launch Strategy — One City ✅

وده قرار ممتاز للـMVP.

هنبني النظام من البداية بحيث يدعم:

```
Country
   ↓
City
      ↓
Areas
```

لكن الـLaunch الأول يكون:

```
One City
   ↓
Limited Engineers
   ↓
Real Customers
   ↓
Measure
   ↓
Improve
   ↓
Expand
```

وده مهم جدًا لأننا نريد اختبار **Marketplace Liquidity**.

يعني:

> هل عندما العميل يطلب خدمة، نقدر فعلًا نوفر له مهندس مناسب بسرعة؟
> 

دي أهم من إن يكون عندنا 50 شاشة في التطبيق.

---

# 🔥 الآن عندنا Model أوضح

الـCore Loop أصبح:

```
                    CUSTOMER
                       │
                       ▼
                 Choose Service
                       │
                       ▼
                    Location
                       │
                       ▼
                Create Request
                       │
                       ▼
              ┌─────────────────┐
              │ Matching Engine │
              └─────────────────┘
                       │
                       ▼
             Recommended Engineers
                       │
              ┌────────┴────────┐
              ▼                 ▼
        Customer Choice     Alternative
              │
              ▼
       Engineer Receives
              │
        ┌─────┴─────┐
        ▼           ▼
     Accept       Reject
        │           │
        ▼           ▼
     Quote       Matching Again
        │
        ▼
 Customer Accepts Quote
        │
        ▼
     Payment
   ┌────┴────┐
   ▼         ▼
 Cash      Online
   │         │
   └────┬────┘
        ▼
      Service
        │
        ▼
     Complete
        │
        ▼
      Rating
```

وده في رأيي بدأ يبقى **Product حقيقي** مش مجرد فكرة Directory للفنيين.

---

# ⚠️ لكن ظهر عندنا الآن قرار جديد مهم

بسبب إن **المهندس هو اللي يحدد السعر**، أنا أقترح نضيف مفهوم:

## `Quote`

بدل ما العميل يطلب:

> "تركيب كاميرات — 500 جنيه"
> 

الطلب يكون:

```
Service Request
       ↓
Engineer
       ↓
Creates Quote
```

مثلاً:

```
┌──────────────────────────────┐
│ CCTV Installation            │
│                              │
│ Labor             700 EGP    │
│ Materials         1,200 EGP  │
│ Extra Work          300 EGP  │
│ ──────────────────────────── │
│ Total            2,200 EGP   │
└──────────────────────────────┘
```

ثم:

```
Customer
   ↓
Accept Quote
```

وبعدها يبدأ تنفيذ الخدمة.

وده هيخلينا لاحقًا نقدر ندعم **Cash وOnline Payment** بشكل أنظف.

---

# 🧠 قرار آخر أقترحه

نعمل الفرق بين:

### `Service Request`

طلب العميل نفسه:

> محتاج تركيب 4 كاميرات.
> 

و:

### `Quote`

عرض المهندس:

> أقدر أنفذها بـ 2200 جنيه.
> 

و:

### `Job`

العمل بعد قبول العرض:

> المهندس بدأ التنفيذ.
> 

يعني:

```
ServiceRequest
      ↓
Quote
      ↓
Accepted Quote
      ↓
Job
      ↓
Completed
      ↓
Review
```

وده هيخلّي الـDatabase والـBusiness Logic أنظف جدًا.

---

# 📌 القرارات المثبتة حتى الآن

| القرار | الحالة |
| --- | --- |
| Customer يختار Engineer | ✅ |
| Platform تقدم Recommendations | ✅ |
| Alternative Engineers | ✅ |
| Engineer يحدد السعر | ✅ |
| Quote System | 🔶 مقترح قوي |
| Cash Payment | ✅ |
| Online Payment | ✅ |
| Launch في مدينة واحدة | ✅ |
| Live Tracking | ⏳ لاحقًا |
| Shop | ⏳ Phase 2 |
| E-commerce | ⏳ Phase 2/3 |
| Chat | ⏳ لاحقًا |

---

# 📘 Product Blueprint — Customer Journey v0.3

هنصمم الـCustomer Journey على أساس القرارات اللي ثبتناها:

- العميل يختار الخدمة.
- النظام يعرض له مهندسين مناسبين.
- العميل يختار المهندس بنفسه.
- المهندس يحدد السعر من خلال Quote.
- الدفع Cash أو Online.
- الإطلاق الأول في مدينة واحدة.

---

# 1. دخول العميل لأول مرة

```
Open App
   ↓
Welcome
   ↓
Login / Register
```

بعد التسجيل:

```
Create Account
├── Name
├── Phone
├── Password
└── Basic Location
```

### مهم

مش لازم نجبر العميل يحدد موقعه الدقيق أثناء التسجيل.

ممكن:

```
Registration
    ↓
Profile
    ↓
Location when needed
```

وده أفضل من إجبار المستخدم على إعطاء Location من أول لحظة.

---

# 2. الصفحة الرئيسية

الـHome لازم تكون بسيطة جدًا.

مثلاً:

```
┌──────────────────────────────┐
│ صباح الخير، أحمد 👋          │
│ 📍 الجيزة                    │
│                              │
│ محتاج فني في إيه؟            │
│                              │
│ 📡 Satellite                 │
│ 📹 CCTV                      │
│ 📞 Intercom                  │
│ 🌐 Networking                │
│                              │
│ طلباتي الحالية               │
│ [CCTV Installation]          │
└──────────────────────────────┘
```

### الهدف

العميل يدخل ويعرف فورًا:

> **أطلب خدمة إزاي؟**
> 

مش محتاج Dashboard مليانة معلومات.

---

# 3. اختيار الخدمة

العميل يختار:

```
CCTV
```

فتظهر:

```
CCTV Services

[ تركيب كاميرات ]

[ صيانة كاميرات ]

[ تركيب DVR / NVR ]

[ إعداد المشاهدة عن بعد ]

[ مشكلة في الكاميرات ]
```

### هنا نحتاج Service Category + Service Type

مثلاً:

```
Category = CCTV
Service = Camera Installation
```

وده مهم جدًا في الـMatching.

---

# 4. وصف المشكلة / الطلب

بعد اختيار الخدمة:

```
What do you need?
```

مثلاً:

> عايز 4 كاميرات للمحل وعايز أشوفهم من الموبايل.
> 

العميل يقدر يضيف:

- Description
- Photos
- Videos لاحقًا
- Number of devices
- Optional notes

مثال:

```
Description:
تركيب 4 كاميرات

Photos:
[image]
[image]

Notes:
المحل في الدور الثاني
```

---

# 5. تحديد الموقع

العميل يحدد:

```
Service Location
```

والخيارات:

```
Use Current Location
أو
Choose on Map
أو
Enter Address
```

ويظهر:

```
Map
  📍 Customer Location
```

### هنا عندنا 3 بيانات مختلفة لازم ما نخلطهمش:

```
Latitude
Longitude
Address
```

الـGPS يستخدم للـMatching، والـAddress يستخدم للعرض والتنفيذ.

---

# 6. اختيار الموعد

العميل يحدد:

```
Preferred Date
Preferred Time
```

مثلاً:

```
Tomorrow
5:00 PM - 7:00 PM
```

لكن أنا أقترح نسميها:

> **Preferred Time**
> 

مش:

> **Booking Time**
> 

لأن المهندس لسه ما وافقش.

---

# 7. إنشاء Service Request

العميل يضغط:

**Find Engineers**

وهنا الطلب يصبح:

```
REQUESTED
```

ثم:

```
MATCHING
```

---

# 8. Matching Engine

النظام يطلع أفضل المهندسين.

مثلاً:

```
Recommended Engineers

┌──────────────────────────────┐
│ Ahmed Ali              ✓     │
│ ⭐ 4.9                      │
│ CCTV • Networking            │
│ 2.1 km away                  │
│ 120 jobs                     │
│ Available                    │
│                              │
│ [View Profile] [Choose]      │
└──────────────────────────────┘
```

ثم:

```
Mohamed Hassan
⭐ 4.7
3.2 km
98 jobs

[View Profile] [Choose]
```

---

# 9. اختيار المهندس

العميل يدخل Profile المهندس:

```
Engineer Profile

Photo
Name
✓ Verified

⭐ 4.9

Completed Jobs: 120

Specializations:
CCTV
Networking

Service Area:
...

Reviews:
...
```

ثم:

**Choose Engineer**

---

# 10. ماذا يحدث بعد اختيار المهندس؟

هنا عندنا حالة مهمة.

الطلب يصبح:

```
ENGINEER_SELECTED
```

ثم يروح للمهندس:

```
New Service Request
```

بكل المعلومات الأساسية:

```
Service
Location
Description
Preferred Time
Customer Notes
```

والخيارات:

```
[Accept]
[Reject]
```

---

# 11. المهندس يقبل

إذا وافق:

```
REQUEST_ACCEPTED
```

ثم ينشئ Quote.

مثلاً:

```
Quote

Labor              700 EGP
Materials         1,200 EGP
Additional Work     300 EGP
--------------------------------
Total             2,200 EGP
```

ويرسل للعميل.

---

# 12. العميل يستقبل الـQuote

التطبيق:

```
Engineer sent you a quote
Total: 2,200 EGP
```

العميل يشاهد:

```
Service
Price Breakdown
Engineer
Estimated Work
```

ثم:

```
[Accept Quote]
[Reject Quote]
```

وممكن لاحقًا:

```
[Ask for Changes]
```

لكن دي **Feature لاحقة** وليست ضرورية للـMVP.

---

# 13. العميل يقبل الـQuote

الطلب:

```
QUOTE_ACCEPTED
```

ثم النظام يحدد:

```
Payment Method
```

```
○ Cash
○ Online
```

---

# 14. Cash Flow

لو اختار Cash:

```
Quote Accepted
      ↓
Cash Selected
      ↓
Job Confirmed
```

والـEngineer يقدر يبدأ التحرك.

```
ON_THE_WAY
```

---

# 15. Online Payment Flow

لو اختار Online:

```
Quote Accepted
      ↓
Payment
      ↓
Payment Confirmed
      ↓
Job Confirmed
```

لكن هنا سنحتاج لاحقًا تحديد:

- Payment Provider
- Payment Authorization
- Successful Payment
- Failed Payment
- Refund
- Cancellation
- Dispute

لذلك نعتبره **Payment Subsystem مستقل** في الـArchitecture.

---

# 16. المهندس في الطريق

إذا بدأ المهندس الرحلة:

```
ON_THE_WAY
```

والعميل يرى:

```
Ahmed Ali
✓ Verified

On the way

Estimated arrival:
30 min
```

### Live Location؟

في أول MVP لا نحتاج Tracking لحظي.

ممكن فقط:

```
ON_THE_WAY
```

ثم لاحقًا:

```
Live Location
```

---

# 17. المهندس وصل

```
ARRIVED
```

العميل:

```
Engineer has arrived
```

---

# 18. بدء العمل

المهندس يضغط:

**Start Job**

فتصبح:

```
IN_PROGRESS
```

العميل يرى:

```
Service in progress
```

---

# 19. انتهاء العمل

المهندس:

**Complete Job**

لكن لا أريد أن يتم الإغلاق بشكل أعمى.

الأفضل:

```
Engineer marks completed
        ↓
Customer sees
"Service completed?"
        ↓
Confirm
```

وبالتالي:

```
COMPLETION_PENDING
```

ثم:

```
COMPLETED
```

بعد تأكيد العميل.

---

# 20. الدفع النقدي بعد الخدمة

في حالة Cash:

```
Service Completed
      ↓
Customer Pays Cash
      ↓
Engineer Confirms Payment
      ↓
Payment Status = PAID
```

وده مهم لأن:

> `Job Completed` ≠ `Payment Completed`
> 

لازم نفصل الاثنين.

---

# 21. التقييم

بعد إتمام الطلب:

```
Rate Your Experience

⭐⭐⭐⭐⭐

Write a review
```

ثم:

```
RATED
```

---

# 22. الطلب انتهى

العميل يقدر بعد كده يشوف:

```
My Requests
```

مثلاً:

```
CCTV Installation
Ahmed Ali
Completed
2,200 EGP
Sep 15, 2026
⭐ 5.0
```

---

# 🔥 Customer Journey كاملة

إذن الـFlow الرسمي المبدئي:

```
REGISTERED
    ↓
BROWSE_SERVICE
    ↓
REQUEST_CREATED
    ↓
MATCHING
    ↓
ENGINEER_SELECTED
    ↓
ENGINEER_ACCEPTED
    ↓
QUOTE_SENT
    ↓
QUOTE_ACCEPTED
    ↓
PAYMENT_PENDING
    ↓
PAYMENT_CONFIRMED
    ↓
ON_THE_WAY
    ↓
ARRIVED
    ↓
IN_PROGRESS
    ↓
COMPLETION_PENDING
    ↓
COMPLETED
    ↓
RATED
```

---

# ⚠️ لكن هنا ظهر عندنا شيء مهم جدًا

مش كل شيء يمشي في المسار المثالي.

لازم نصمم **Edge Cases** من الآن.

## الحالة 1 — المهندس رفض

```
ENGINEER_SELECTED
       ↓
ENGINEER_REJECTED
       ↓
RECOMMENDED_ENGINEERS
```

ويظهر:

> مهندس آخر مناسب لنفس الخدمة.
> 

---

## الحالة 2 — العميل رفض الـQuote

```
QUOTE_SENT
     ↓
QUOTE_REJECTED
```

ثم:

```
Choose Another Engineer
```

أو:

```
Cancel Request
```

---

## الحالة 3 — العميل رفض المهندس من البداية

```
Recommended Engineers
        ↓
Not Interested
        ↓
Other Engineers
```

وده من أساس الـHybrid Model اللي اتفقنا عليه.

---

## الحالة 4 — المهندس لا يرد

مثلاً:

```
REQUEST_SENT
      ↓
WAITING
      ↓
TIMEOUT
```

ثم النظام يرشح مهندسًا آخر.

وده محتاج قرار لاحق:

> كام دقيقة نعتبر بعدها الطلب Expired؟
> 

---

## الحالة 5 — العميل ألغى الطلب

```
Any Early Stage
      ↓
CANCELLED
```

لكن لازم نحدد:

**متى يسمح بالإلغاء مجانًا؟**

قبل قبول الـQuote؟

بعد قبول الـQuote؟

بعد وصول المهندس؟

دي جزء مهم جدًا من الـBusiness Rules.

---

# 23. حاجة أريد تثبيتها من الآن

أنا شايف إن الـRequest والـJob والـPayment لازم يكونوا **كيانات منفصلة منطقيًا**.

يعني:

```
ServiceRequest
      ↓
Quote
      ↓
Job
      ↓
Payment
      ↓
Review
```

مش Entity واحدة ضخمة اسمها `Order`.

لأن عندنا هنا **Service Marketplace** وليس E-commerce فقط.

---

# 24. أول مجموعة Business Rules

نثبت مبدئيًا:

### Rule 1

العميل يقدر يختار مهندس من التوصيات.

### Rule 2

المهندس يجب أن يقبل الطلب قبل إرسال Quote.

### Rule 3

العميل لا يعتبر الطلب مؤكدًا قبل قبول الـQuote.

### Rule 4

`Job Completed` و `Payment Paid` حالتان منفصلتان.

### Rule 5

التقييم متاح بعد اكتمال الخدمة.

### Rule 6

لو المهندس رفض أو لم يرد، المنصة تقدم بدائل.

### Rule 7

المهندس يحدد سعره من خلال الـQuote.

---

# 📘 Product Blueprint — Engineer Journey v0.4

## 1. تسجيل المهندس

المهندس يختار:

```
Create Account
      ↓
Engineer
```

ثم:

```
Basic Information
├── Name
├── Phone
├── Password
└── Profile Photo
```

بعدها:

```
Engineer Type

○ Freelance
○ Shop Owner
```

وهنا **مش بنعمل Role مختلف**.

كلاهما:

```
role = ENGINEER
```

والاختلاف:

```
hasShop = false / true
```

---

# 2. تحديد التخصصات

المهندس يختار الخدمات التي يستطيع تنفيذها:

```
Specializations

☑ CCTV
☑ Satellite
☐ Intercom
☑ Networking
```

لكن في مستوى أدق:

```
CCTV
├── Camera Installation
├── DVR
├── NVR
├── Remote Viewing
└── Maintenance
```

وده مهم جدًا لأن الـMatching هيعتمد على **الخدمة الدقيقة**، مش مجرد Category.

---

# 3. تحديد منطقة العمل

المهندس يحدد:

```
Service Area
```

مثلاً:

```
City: Giza

Areas:
☑ Faisal
☑ Haram
☑ Dokki
☑ Mohandessin
```

وممكن أيضًا يكون عنده:

```
Maximum Travel Distance
```

مثلاً:

```
Maximum Radius: 15 KM
```

وده هيفيدنا جدًا في الـMatching.

---

# 4. تحديد الـLocation

المهندس يحدد موقعه الأساسي:

```
Location
├── Latitude
├── Longitude
└── Address
```

ولو عنده Shop:

```
Shop Location
```

ممكن تكون مختلفة عن مكان سكنه أو مكان عمله.

---

# 5. Availability

دي مهمة جدًا.

المهندس عنده:

```
Availability
```

مثلاً:

```
Saturday    10 AM → 8 PM
Sunday      10 AM → 8 PM
Monday      10 AM → 8 PM
...
```

وفي الوقت الحالي:

```
Available
Offline
Busy
```

ونفرق بين:

### Availability

هل هو شغال عادةً؟

### Current Status

هل هو متاح **الآن**؟

مثلاً:

```
Availability = TRUE
Current Status = BUSY
```

يعني بيشتغل، لكن حاليًا عنده Job.

---

# 6. Verification

بعد التسجيل:

```
Engineer
   ↓
PENDING_VERIFICATION
```

والـAdmin يراجع البيانات.

بعد الموافقة:

```
VERIFIED
```

لو مرفوض:

```
REJECTED
```

والـEngineer لا يظهر في الـMarketplace إلا حسب قواعد التفعيل التي نحددها لاحقًا.

---

# 7. Engineer Dashboard

الصفحة الرئيسية للمهندس تختلف تمامًا عن العميل.

ممكن تكون:

```
┌────────────────────────────────┐
│ Good Morning, Ahmed 👋         │
│                                │
│ 🟢 Available                   │
│                                │
│ New Requests       4           │
│ Active Jobs        2           │
│ Completed          127         │
│ Rating             4.9 ⭐      │
│                                │
│ Today's Jobs                   │
│                                │
│ CCTV Installation              │
│ 5:00 PM                        │
└────────────────────────────────┘
```

---

# 8. استقبال Request

يوصل للمهندس:

```
New Service Request
```

مثلاً:

```
┌─────────────────────────────┐
│ CCTV Installation           │
│                             │
│ Customer: Ahmed             │
│ Distance: 3.2 km            │
│                             │
│ 4 Cameras Installation      │
│                             │
│ Preferred: 5 PM             │
│                             │
│ [View Details]              │
└─────────────────────────────┘
```

ثم:

```
[Accept]
[Reject]
```

---

# 9. المهندس قبل الطلب

بعد:

```
Accept
```

الحالة:

```
ENGINEER_ACCEPTED
```

لكن **لسه مفيش Job نهائي**.

الخطوة التالية:

> Engineer creates Quote.
> 

---

# 10. إنشاء الـQuote

المهندس يدخل:

```
Create Quote
```

ويحدد:

```
Labor
Materials
Additional Costs
Notes
Estimated Duration
```

مثلاً:

```
Labor             700 EGP
Materials        1200 EGP
Additional        300 EGP
-------------------------
Total            2200 EGP

Estimated Time:
3 Hours
```

ثم:

```
Send Quote
```

---

# 11. العميل يرفض الـQuote

المهندس يستلم:

```
Quote Rejected
```

وهنا **لا نفترض أن الطلب انتهى فورًا**.

نحتاج حالة:

```
QUOTE_REJECTED
```

والمنصة تقدر تعرض للعميل:

```
Other Recommended Engineers
```

أو تسمح له بإلغاء الطلب.

---

# 12. العميل يقبل

بعد:

```
Customer → Accept Quote
```

المهندس يرى:

```
JOB_CONFIRMED
```

ويظهر:

```
Service Details
Customer Location
Date / Time
Payment Method
```

---

# 13. المهندس يبدأ التحرك

يضغط:

```
Start Trip
```

فتصبح:

```
ON_THE_WAY
```

وفي الـMVP ممكن نكتفي بالـStatus.

لاحقًا:

```
Live Location
```

---

# 14. الوصول

عندما يصل:

```
I Arrived
```

الحالة:

```
ARRIVED
```

والعميل يتلقى:

> Engineer has arrived.
> 

---

# 15. بدء العمل

المهندس:

```
Start Job
```

فتصبح:

```
IN_PROGRESS
```

---

# 16. لو ظهر عمل إضافي أثناء التنفيذ

دي نقطة **مهمة جدًا** في طبيعة شغل المهندسين.

مثلاً:

العميل طلب تركيب 4 كاميرات.

بعد وصول المهندس اكتشف أنه يحتاج:

```
+20m Cable
+Power Supply
```

لازم **ما نسمحش بتعديل السعر مباشرة بشكل مخفي**.

نعمل:

```
Additional Quote
```

مثلاً:

```
Additional Materials
400 EGP
```

ثم:

```
Engineer
   ↓
Additional Quote
   ↓
Customer Accept
```

وبالتالي يصبح:

```
Original Quote
2200 EGP

Additional Quote
400 EGP

Final Total
2600 EGP
```

دي من الحاجات اللي ممكن تحمي الطرفين من النزاعات.

---

# 17. إتمام العمل

المهندس:

```
Complete Job
```

فتصبح:

```
COMPLETION_PENDING
```

ويرسل للعميل:

> هل تم الانتهاء من الخدمة؟
> 

والعميل يؤكد.

ثم:

```
COMPLETED
```

---

# 18. Payment

هنا عندنا فرعين:

## Cash

```
Customer Pays Cash
        ↓
Engineer Confirms
        ↓
PAID
```

## Online

```
Online Payment
      ↓
Payment Gateway
      ↓
PAID
```

وفي الحالتين:

```
Job Status = COMPLETED
Payment Status = PAID
```

ممكن يكونوا مستقلين.

---

# 19. Earnings

بعد الدفع:

المهندس يشوف:

```
Earnings
```

مثلاً:

```
Today
1,800 EGP

This Week
7,500 EGP

This Month
28,400 EGP
```

لكن هنا لازم نفتكر:

**Gross Earnings ≠ Net Earnings**

لأن بعدين هيكون عندنا:

```
Service Price
- Platform Commission
- Payment Fees
= Engineer Net
```

لذلك من الآن الأفضل تصميم النظام ليستوعب ده.

---

# 20. Reviews

بعد الإتمام:

```
Customer → Rate Engineer
```

المهندس يقدر يشوف:

```
Rating
4.9 ⭐

127 Reviews
```

ونقدر لاحقًا نعمل:

```
Quality
Punctuality
Professionalism
```

لكن MVP:

```
Stars + Comment
```

---

# 21. Engineer History

المهندس عنده:

```
My Jobs
```

بها:

```
Upcoming
Active
Completed
Cancelled
Rejected
```

---

# 22. حالات المهندس العامة

محتاجين نفرق بين **Account Status** و **Availability** و **Job Status**.

### Account

```
PENDING_VERIFICATION
ACTIVE
SUSPENDED
REJECTED
```

### Availability

```
AVAILABLE
OFFLINE
BUSY
```

### Job

```
REQUESTED
ACCEPTED
QUOTE_SENT
QUOTE_ACCEPTED
ON_THE_WAY
ARRIVED
IN_PROGRESS
COMPLETION_PENDING
COMPLETED
CANCELLED
```

الفصل بينهم مهم جدًا.

---

# 🔥 الآن وصلنا لنقطة قوية جدًا

عندنا رحلتين:

## Customer

```
Request
→ Choose Engineer
→ Receive Quote
→ Accept
→ Pay
→ Service
→ Review
```

## Engineer

```
Receive Request
→ Accept
→ Create Quote
→ Customer Accepts
→ Go To Customer
→ Perform Service
→ Complete
→ Get Paid
→ Receive Review
```

وبالتالي نقدر نعمل **State Machine حقيقية** للمشروع.

---

# 23. الـService Request State Machine

أنا أقترح الشكل ده:

```
                         ┌──────────────┐
                         │   CANCELLED  │
                         └──────────────┘
                                ▲
                                │
REQUESTED → MATCHING → ENGINEER_SELECTED
                         │
                    ┌────┴─────┐
                    │          │
                  REJECT      ACCEPT
                    │          │
                    │          ▼
                    │      QUOTE_SENT
                    │          │
                    │     ┌────┴────┐
                    │     │         │
                    │   REJECT    ACCEPT
                    │     │         │
                    │     ▼         ▼
                    │  CANCELLED  CONFIRMED
                    │                │
                    │                ▼
                    │           ON_THE_WAY
                    │                │
                    │                ▼
                    │             ARRIVED
                    │                │
                    │                ▼
                    │          IN_PROGRESS
                    │                │
                    │                ▼
                    │      COMPLETION_PENDING
                    │                │
                    │                ▼
                    └──────────── COMPLETED
                                     │
                                     ▼
                                   RATED
```

وده تقريبًا أصبح **قلب الـBusiness Logic**.

---

# ⚠️ Edge Cases لازم نحفظها من الآن

مشاكل حقيقية متوقعة:

### العميل اختار مهندس والمهندس لم يرد

→ Timeout

→ Re-Matching

### المهندس قبل لكن العميل لم يقبل Quote

→ Quote Expired

### العميل ألغى

→ Cancellation Policy

### المهندس ألغى بعد قبول العميل

→ Engineer Cancellation

### العميل لم يكن موجودًا

→ Customer No-show

### المهندس وصل ولم يجد العميل

→ Engineer No-show

### ظهر شغل إضافي

→ Additional Quote

### العميل اشتكى على جودة العمل

→ Dispute

### الدفع فشل

→ Payment Failed

---

# 📘 Product Blueprint — Core Domain Model v0.5

دلوقتي هنحوّل الـCustomer Journey والـEngineer Journey إلى **نموذج Domain واضح**.

وده قبل الـDatabase، لأننا الأول نحدد **إيه الكيانات اللي النظام فعلًا محتاجها وإيه مسؤولية كل كيان**.

---

## 1. User

ده الحساب الأساسي في النظام.

```
User
├── id
├── name
├── phone
├── email
├── password
├── role
├── status
└── timestamps
```

والـ`role` مبدئيًا:

```
CUSTOMER
ENGINEER
ADMIN
```

ونستخدم Profile منفصل حسب نوع المستخدم بدل ما نحط كل البيانات في `User`.

---

# 2. CustomerProfile

خاص بالعميل:

```
CustomerProfile
├── userId
├── defaultLocation
├── addresses
└── preferences
```

ومستقبلًا ممكن يحتوي:

```
Preferred Services
Favorite Engineers
```

لكن مش ضروري في MVP.

---

# 3. EngineerProfile

ده أهم جزء في الطرف الثاني.

```
EngineerProfile
├── userId
├── engineerType
├── bio
├── experienceYears
├── verificationStatus
├── rating
├── completedJobs
├── currentAvailability
├── location
└── serviceAreas
```

`engineerType`:

```
FREELANCE
SHOP_OWNER
```

وده مش Role جديد؛ زي ما اتفقنا.

---

# 4. ServiceCategory

التصنيف الرئيسي:

```
ServiceCategory

Satellite
CCTV
Intercom
Networking
```

---

# 5. Service

الخدمة الفعلية.

مثلاً:

```
ServiceCategory
   └── CCTV
         ├── Camera Installation
         ├── Camera Maintenance
         ├── DVR Installation
         ├── NVR Installation
         └── Remote Viewing
```

فالعلاقة:

```
Category 1 ──── * Services
```

---

# 6. EngineerService

لا نحط الخدمات مباشرة داخل `EngineerProfile`.

نعمل علاقة:

```
Engineer
    │
    └── EngineerService
             │
             └── Service
```

مثلاً:

```
Ahmed
 ├── CCTV Installation
 ├── DVR Installation
 └── Network Cabling
```

وده مهم جدًا للـMatching.

---

# 7. Location

أفضل نفصل مفهوم الموقع.

```
Location
├── latitude
├── longitude
├── address
├── city
└── area
```

وبالتالي نستطيع استخدام نفس الـEntity في:

- Customer
- Engineer
- Shop
- Service Request

---

# 8. Availability

المهندس عنده Availability Rules:

```
Availability
├── engineerId
├── dayOfWeek
├── startTime
└── endTime
```

مثلاً:

```
Sunday
10:00 → 20:00
```

وفي المقابل حالة المهندس الحالية:

```
AVAILABLE
OFFLINE
BUSY
```

ودي نقطة منفصلة.

---

# 9. ServiceRequest ⭐

ده قلب الـMarketplace.

يمثل:

> العميل محتاج خدمة.
> 

```
ServiceRequest
├── id
├── customerId
├── serviceId
├── description
├── locationId
├── preferredDate
├── preferredTime
├── status
├── selectedEngineerId
└── timestamps
```

مثال:

```
Customer:
Ahmed

Service:
CCTV Installation

Description:
4 cameras for shop

Location:
Giza

Preferred:
5 PM
```

---

# 10. Request Matching

أنا لا أنصح نخلي الـMatching مجرد Logic داخل `ServiceRequest`.

الأفضل يكون عندنا مفهوم:

```
Matching Engine
```

وهو Service/Domain Component وليس بالضرورة Database Collection مستقلة.

وظيفته:

```
ServiceRequest
      ↓
Find eligible engineers
      ↓
Filter
      ↓
Score
      ↓
Rank
      ↓
Recommend
```

---

# 11. EngineerRecommendation

ممكن لاحقًا نحتاج نسجل:

```
EngineerRecommendation
├── requestId
├── engineerId
├── score
├── distance
├── rank
└── generatedAt
```

لكن هنا عندي ملاحظة:

**مش ضروري نخزّن كل نتائج الـMatching في الـMVP.**

ممكن الحساب يكون Dynamic، ونحفظ فقط القرار النهائي.

---

# 12. Quote ⭐

بعد موافقة المهندس على الطلب:

```
ServiceRequest
      ↓
Quote
```

الـQuote:

```
Quote
├── id
├── requestId
├── engineerId
├── laborAmount
├── materialsAmount
├── additionalAmount
├── totalAmount
├── estimatedDuration
├── notes
├── status
└── expiresAt
```

الحالات:

```
DRAFT
SENT
ACCEPTED
REJECTED
EXPIRED
CANCELLED
```

---

# 13. Quote Items

وعندي اقتراح أقوى من تخزين:

```
laborAmount
materialsAmount
```

فقط.

الأفضل:

```
Quote
   └── QuoteItems
```

مثلاً:

```
Quote
├── Labor
│   700
├── Cable
│   800
├── Power Supply
│   200
└── Installation
   500
```

ويبقى الـTotal محسوب من الـItems.

ده هيفيدنا جدًا في:

- Invoice
- Order history
- Disputes
- Reporting

---

# 14. Job ⭐

بعد قبول الـQuote:

```
ServiceRequest
      ↓
Accepted Quote
      ↓
Job
```

الـJob يمثل **التنفيذ الفعلي**.

```
Job
├── id
├── requestId
├── quoteId
├── customerId
├── engineerId
├── scheduledAt
├── startedAt
├── arrivedAt
├── completedAt
├── status
└── timestamps
```

وده يفصل بين:

> "أنا طلبت خدمة"
> 

و:

> "أنا بدأت تنفيذ الخدمة."
> 

---

# 15. Payment

الـPayment لازم يكون مستقل.

```
Payment
├── id
├── jobId
├── amount
├── method
├── status
├── transactionId
├── paidAt
└── metadata
```

Methods:

```
CASH
ONLINE
```

Statuses:

```
PENDING
PAID
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

وده قابل للتوسع جدًا.

---

# 16. Review

بعد اكتمال Job:

```
Review
├── id
├── jobId
├── customerId
├── engineerId
├── rating
├── comment
└── timestamps
```

في الـMVP:

```
rating = 1..5
comment = optional
```

---

# 17. Notification

المشروع هيحتاج Notifications من بدري.

```
Notification
├── userId
├── type
├── title
├── body
├── readAt
└── createdAt
```

أمثلة:

```
NEW_SERVICE_REQUEST
QUOTE_RECEIVED
QUOTE_ACCEPTED
JOB_STARTED
ENGINEER_ARRIVED
JOB_COMPLETED
PAYMENT_SUCCESS
NEW_REVIEW
```

---

# 18. Complaint / Dispute

بما إن المنصة تربط شخصين حقيقيين، لازم من التصميم نفكر في المشاكل.

مثلاً:

```
Dispute
├── id
├── jobId
├── openedBy
├── reason
├── description
├── status
└── resolution
```

مش لازم نعمل UI كامل للـMVP، لكن **الـDomain لازم يسمح بوجوده**.

---

# 19. Shop

ده Phase 2.

```
Shop
├── id
├── engineerId
├── name
├── description
├── locationId
├── phone
├── workingHours
└── status
```

العلاقة:

```
Engineer 1 ──── 0..1 Shop
```

يعني المهندس الحر ممكن **ما عندوش Shop**.

---

# 20. Product

Phase 2:

```
Product
├── id
├── shopId
├── name
├── description
├── price
├── stock
├── category
├── images
└── status
```

---

# 21. Order

لما ندخل الـE-commerce:

```
Customer
   ↓
Order
   ↓
Shop
   ↓
OrderItems
   ↓
Products
```

وده **مش نفس ServiceRequest**.

ودي نقطة مهمة جدًا:

```
ServiceRequest ≠ ProductOrder
```

لأن:

> طلب فني يركب لك كاميرات
> 

مختلف عن:

> طلب 4 كاميرات من متجر.
> 

وممكن مستقبلًا الاثنين يتجمعوا في رحلة واحدة، لكن Domain-wise يفضل يظلوا منفصلين.

---

# 22. العلاقات الأساسية

الصورة الحالية أصبحت:

```
User
├── CustomerProfile
└── EngineerProfile
      ├── EngineerService
      ├── Availability
      ├── Location
      └── Shop
```

ثم:

```
Customer
   │
   ▼
ServiceRequest
   │
   ├── Service
   ├── Location
   ├── Engineer
   │
   ▼
Quote
   │
   ▼
Job
   │
   ├── Payment
   └── Review
```

---

# 23. الصورة الكاملة للمشروع

```
                         PLATFORM
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
    SERVICES                                SHOPS
        │                                       │
        ▼                                       ▼
   SERVICE REQUEST                          PRODUCTS
        │                                       │
        ▼                                       ▼
    MATCHING                                  ORDER
        │
        ▼
   ENGINEER
        │
        ▼
     QUOTE
        │
        ▼
       JOB
     ┌──┴──┐
     ▼     ▼
 PAYMENT  REVIEW
```

وده بالنسبة لي أول **Domain Model محترم** للمشروع.

---

## **Domain Rules & Permission Matrix**

لأن لازم نعرف:

> مين يقدر يعمل إيه، وفي أي حالة.
> 

مثلاً:

| Action | Customer | Engineer | Admin |
| --- | --- | --- | --- |
| Create Request | ✅ | ❌ | ✅ |
| Choose Engineer | ✅ | ❌ | ✅ |
| Accept Request | ❌ | ✅ | ✅ |
| Create Quote | ❌ | ✅ | ✅ |
| Accept Quote | ✅ | ❌ | ✅ |
| Start Job | ❌ | ✅ | ✅ |
| Complete Job | ❌ | ✅ | ✅ |
| Rate Engineer | ✅ | ❌ | ✅ |
| Verify Engineer | ❌ | ❌ | ✅ |

---

# 📘 Product Blueprint — Permissions & State Rules v0.6

## 1. الـRoles الأساسية

| Role | المسؤولية |
| --- | --- |
| `CUSTOMER` | طلب الخدمات واختيار المهندسين والدفع والتقييم |
| `ENGINEER` | تنفيذ الخدمات واستقبال الطلبات وإرسال الأسعار |
| `ADMIN` | إدارة ومراقبة المنصة |
| `SHOP_OWNER` | **ليس Role مستقل**؛ هو Engineer لديه Shop |

يعني:

```
ENGINEER
   │
   ├── hasShop = false → Freelance
   │
   └── hasShop = true  → Shop Owner
```

---

# 2. Customer Permissions

العميل يستطيع:

```
CUSTOMER
├── profile.read
├── profile.update
├── services.read
├── requests.create
├── requests.read.own
├── requests.cancel.own
├── engineers.read
├── engineers.choose
├── quotes.read.own
├── quotes.accept.own
├── quotes.reject.own
├── payments.create
├── payments.read.own
├── jobs.read.own
├── reviews.create
└── notifications.read.own
```

### مثال

العميل لا يستطيع:

```
quote.create
job.start
engineer.verify
```

حتى لو حاول إرسال API مباشرة.

الـBackend هو اللي يمنع العملية، مش الـFrontend فقط.

---

# 3. Engineer Permissions

```
ENGINEER
├── profile.read
├── profile.update
├── services.manage.own
├── availability.manage.own
├── location.manage.own
├── requests.read.assigned
├── requests.accept
├── requests.reject
├── quotes.create
├── quotes.read.own
├── jobs.read.assigned
├── jobs.start
├── jobs.arrive
├── jobs.complete
├── payments.read.own
└── reviews.read.own
```

### Engineer لا يستطيع:

```
requests.create
engineers.verify
quotes.accept
payment.refund
```

---

# 4. Admin Permissions

Admin عنده نطاق أكبر:

```
ADMIN
├── users.read
├── users.update
├── users.suspend
├── engineers.read
├── engineers.verify
├── engineers.suspend
├── customers.read
├── services.manage
├── requests.read
├── requests.manage
├── quotes.read
├── jobs.read
├── payments.read
├── reviews.read
├── reviews.moderate
├── disputes.manage
├── shops.manage
├── products.manage
└── platform.settings.manage
```

والأفضل معماريًا أننا نستخدم **Permissions** بدل `if role === ADMIN` في كل مكان.

يعني:

```
requirePermission("engineers.verify")
```

بدل:

```
if (user.role!=="ADMIN")
```

---

# 5. أهم شيء: State-Based Authorization

الـRole وحده غير كافي.

مثلاً:

> Engineer عنده permission `quotes.create`
> 

ده لا يعني أنه يقدر يعمل Quote لأي Request.

لازم:

```
Engineer
+
Request is assigned to him
+
Request.status allows quote creation
=
Allowed
```

يعني عندنا:

```
Authorization =
Role/Permission
+
Resource Ownership
+
Current State
```

وده ممتاز جدًا للمشروع.

---

# 6. Service Request State Machine

نثبت الحالات الأساسية:

```
REQUESTED
    ↓
MATCHING
    ↓
ENGINEER_SELECTED
    ↓
ENGINEER_ACCEPTED
    ↓
QUOTE_SENT
    ↓
QUOTE_ACCEPTED
    ↓
CONFIRMED
    ↓
ON_THE_WAY
    ↓
ARRIVED
    ↓
IN_PROGRESS
    ↓
COMPLETION_PENDING
    ↓
COMPLETED
    ↓
RATED
```

---

# 7. Transitions المسموحة

| Current State | Action | Who | Next State |
| --- | --- | --- | --- |
| `REQUESTED` | Start Matching | System | `MATCHING` |
| `MATCHING` | Select Engineer | Customer | `ENGINEER_SELECTED` |
| `ENGINEER_SELECTED` | Accept | Engineer | `ENGINEER_ACCEPTED` |
| `ENGINEER_SELECTED` | Reject | Engineer | `MATCHING` |
| `ENGINEER_ACCEPTED` | Send Quote | Engineer | `QUOTE_SENT` |
| `QUOTE_SENT` | Accept | Customer | `QUOTE_ACCEPTED` |
| `QUOTE_SENT` | Reject | Customer | `QUOTE_REJECTED` |
| `QUOTE_ACCEPTED` | Confirm Payment/Booking | System | `CONFIRMED` |
| `CONFIRMED` | Start Trip | Engineer | `ON_THE_WAY` |
| `ON_THE_WAY` | Arrive | Engineer | `ARRIVED` |
| `ARRIVED` | Start Job | Engineer | `IN_PROGRESS` |
| `IN_PROGRESS` | Complete | Engineer | `COMPLETION_PENDING` |
| `COMPLETION_PENDING` | Confirm | Customer | `COMPLETED` |
| `COMPLETED` | Rate | Customer | `RATED` |

---

# 8. Cancellation Rules

لازم نضيف cancellation بشكل رسمي.

### Customer

ممكن يلغي في مراحل معينة:

```
REQUESTED
MATCHING
ENGINEER_SELECTED
QUOTE_SENT
```

لكن بعد:

```
ON_THE_WAY
ARRIVED
IN_PROGRESS
```

الموضوع يدخل في **Cancellation Policy**.

مش معنى كده أن الإلغاء ممنوع؛ لكن قد تكون هناك:

- رسوم إلغاء
- مراجعة Admin
- Dispute

---

# 9. Quote State Machine

```
DRAFT
   ↓
SENT
   ├── ACCEPTED
   ├── REJECTED
   └── EXPIRED
```

ولو احتجنا تعديل السعر:

**لا نعدل Quote المقبول بشكل مباشر.**

ننشئ:

```
Additional Quote
```

أو نسخة جديدة منه.

ده يحافظ على الـAudit Trail.

---

# 10. Payment State Machine

```
PENDING
   │
   ├── PAID
   │
   └── FAILED
          │
          └── RETRY
```

وبعدها:

```
PAID
 │
 └── REFUNDED
```

لكن:

```
Job Status
```

و

```
Payment Status
```

لازم يفضلوا منفصلين.

---

# 11. Ownership Rules

دي مهمة جدًا للأمان.

مثلاً:

### Customer

يقدر يشوف:

```
request.customerId === currentUser.id
```

فقط.

### Engineer

يقدر يشوف:

```
request.engineerId === currentUser.id
```

فقط، بالنسبة للطلبات المسندة إليه.

### Admin

يستطيع الوصول حسب صلاحياته.

---

# 12. Additional Quote

أثناء الشغل:

```
IN_PROGRESS
     ↓
Additional Work Required
     ↓
Additional Quote
     ↓
Customer Accepts
     ↓
Continue Job
```

ولو العميل رفض:

```
Customer Rejects
      ↓
Engineer decides:
Continue without extra work
or
Stop / Dispute
```

وده لازم يكون واضح في الـUX.

---

# 13. No-Show

نضيف Event مهم:

### Customer No-Show

```
Engineer
   ↓
ARRIVED
   ↓
Customer absent
   ↓
Report No-Show
```

### Engineer No-Show

```
Customer waiting
   ↓
Engineer doesn't arrive
   ↓
Report
```

وفي الحالتين:

```
Dispute / Admin Review
```

مش لازم نطبق رسوم أو عقوبات من أول إصدار، لكن الـDomain لازم يسمح بها.

---

# 14. Verification Rules

Engineer:

```
PENDING_VERIFICATION
      ↓
VERIFIED
```

ولو:

```
SUSPENDED
```

فهو:

- لا يظهر في Matching.
- لا يستقبل طلبات جديدة.
- الطلبات النشطة تحتاج Policy خاصة.

مثلاً:

```
ACTIVE → SUSPENDED
```

يجب ألا يؤدي إلى تدمير البيانات أو حذف الحساب.

---

# 15. Matching Eligibility

مهندس يظهر للعميل فقط لو:

```
Engineer.status = ACTIVE
AND
verificationStatus = VERIFIED
AND
service matches
AND
within service area
AND
available
```

وبعدين نعمل Ranking:

```
Match Score
├── Distance
├── Service Match
├── Availability
├── Rating
├── Completed Jobs
└── Response Rate
```

ودي نقطة مهمة:

**Eligibility أولًا، Ranking ثانيًا.**

يعني ما ينفعش مهندس ممتاز يظهر في النتائج وهو غير متاح أو غير مؤهل للخدمة.

---

# 16. شكل الـDomain Rules ككل

النظام عندنا بقى:

```
                   USER
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
     CUSTOMER                 ENGINEER
         │                       │
         │                  Verification
         │                       │
         │                  Availability
         │                       │
         └───────┐       ┌───────┘
                 ▼       ▼
              SERVICE REQUEST
                     │
                     ▼
                MATCHING
                     │
                     ▼
                  ENGINEER
                     │
                     ▼
                   QUOTE
                     │
                     ▼
                  PAYMENT
                     │
                     ▼
                    JOB
                ┌────┴────┐
                ▼         ▼
              REVIEW   DISPUTE
```

---

# 📘 Product Blueprint — Database Architecture v0.7

# 1. الشكل العام للـDatabase

```
users
 │
 ├────────────── customers
 │
 └────────────── engineers
                   │
                   ├── engineer_services
                   ├── availabilities
                   ├── engineer_locations
                   └── shops
                        │
                        └── products

service_categories
        │
        └── services
                │
                └── engineer_services

customers
   │
   └── service_requests
           │
           ├── request_locations
           ├── quotes
           │    └── quote_items
           │
           └── jobs
                ├── payments
                ├── reviews
                └── disputes
```

---

# 2. `users`

أول جدول.

```
users
────────────────────────
id
name
email
phone
password_hash
role
status
created_at
updated_at
```

### `role`

```
CUSTOMER
ENGINEER
ADMIN
```

### `status`

```
ACTIVE
SUSPENDED
PENDING
```

مهم جدًا:

**Shop Owner مش Role.**

---

# 3. `customer_profiles`

```
customer_profiles
────────────────────────
id
user_id FK
created_at
updated_at
```

ممكن نضيف لاحقًا:

```
default_address_id
```

لكن مبدئيًا مش لازم.

---

# 4. `engineer_profiles`

```
engineer_profiles
────────────────────────
id
user_id FK UNIQUE
engineer_type
bio
experience_years
verification_status
rating_average
completed_jobs_count
availability_status
created_at
updated_at
```

### `engineer_type`

```
FREELANCE
SHOP_OWNER
```

### `verification_status`

```
PENDING
VERIFIED
REJECTED
```

### `availability_status`

```
AVAILABLE
OFFLINE
BUSY
```

---

# 5. `service_categories`

```
service_categories
────────────────────────
id
name
slug
description
is_active
created_at
updated_at
```

مثلاً:

```
satellite
cctv
intercom
networking
```

---

# 6. `services`

```
services
────────────────────────
id
category_id FK
name
slug
description
is_active
created_at
updated_at
```

مثلاً:

```
CCTV
  ├── Camera Installation
  ├── DVR Installation
  ├── NVR Installation
  └── Remote Viewing
```

---

# 7. `engineer_services`

جدول Many-to-Many:

```
engineer_services
────────────────────────
id
engineer_id FK
service_id FK
created_at
```

والـconstraint:

```
UNIQUE(engineer_id, service_id)
```

عشان ما نكرر نفس التخصص مرتين.

---

# 8. Locations 🌍

هنا PostgreSQL + PostGIS يبدأ يبان قوته.

بدل:

```
latitude
longitude
```

فقط، نخزن:

```
location
```

بنمط PostGIS:

```
geography(Point, 4326)
```

ونقدر نخزن أيضًا:

```
address
city
area
```

---

# 9. `engineer_locations`

```
engineer_locations
────────────────────────
id
engineer_id FK
point
address
city
area
is_primary
created_at
updated_at
```

ولأن عندنا Geo search، نعمل:

```
GIST INDEX(point)
```

وده يسمح لنا لاحقًا نعمل:

> أقرب مهندسين إلى العميل.
> 

بدون حسابات lat/lng بدائية.

---

# 10. `availabilities`

```
availabilities
────────────────────────
id
engineer_id FK
day_of_week
start_time
end_time
is_active
```

مثلاً:

```
Engineer A
Sunday
10:00 → 20:00
```

---

# 11. `service_requests` ⭐

قلب النظام:

```
service_requests
────────────────────────
id
customer_id FK
service_id FK
selected_engineer_id FK NULL
description
preferred_date
preferred_start_time
preferred_end_time
status
created_at
updated_at
```

### ليه `selected_engineer_id` ممكن يكون NULL؟

لأن في البداية:

```
REQUESTED
```

لسه مفيش مهندس مختار.

ثم:

```
ENGINEER_SELECTED
```

يتم تسجيله.

---

# 12. الصور والملفات

لا أنصح نحط صور العميل داخل `service_requests` نفسها.

نضيف:

```
service_request_attachments
────────────────────────
id
request_id FK
file_url
file_type
created_at
```

لأن:

> صورة المشكلة
> 

ممكن تكون مهمة في التقييم أو الـdispute لاحقًا.

---

# 13. `quotes` ⭐

```
quotes
────────────────────────
id
request_id FK
engineer_id FK
status
subtotal
total
notes
estimated_duration_minutes
expires_at
created_at
updated_at
```

---

# 14. `quote_items`

وده القرار اللي اتفقنا عليه.

```
quote_items
────────────────────────
id
quote_id FK
item_type
description
quantity
unit_price
total_price
created_at
```

مثلاً:

```
Labor
1 × 700

Cable
20 × 40

Power Supply
1 × 200
```

والـ`total_price` لكل item.

---

# 15. `jobs`

```
jobs
────────────────────────
id
request_id FK UNIQUE
quote_id FK UNIQUE
customer_id FK
engineer_id FK

scheduled_at
started_at
arrived_at
completed_at

status

created_at
updated_at
```

### Job Status

```
CONFIRMED
ON_THE_WAY
ARRIVED
IN_PROGRESS
COMPLETION_PENDING
COMPLETED
CANCELLED
```

---

# 16. ليه `jobs` منفصل عن `service_requests`؟

لأن:

```
ServiceRequest
```

يعني:

> العميل طلب خدمة.
> 

بينما:

```
Job
```

يعني:

> فيه تنفيذ فعلي للخدمة.
> 

ده فصل مهم جدًا.

---

# 17. `payments` 💰

```
payments
────────────────────────
id
job_id FK
amount
method
status
provider
transaction_id
paid_at
created_at
updated_at
```

### method

```
CASH
ONLINE
```

### status

```
PENDING
PAID
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

---

# 18. `reviews`

```
reviews
────────────────────────
id
job_id FK UNIQUE
customer_id FK
engineer_id FK
rating
comment
created_at
updated_at
```

ونعمل:

```
CHECK rating >= 1 AND rating <= 5
```

---

# 19. `disputes`

```
disputes
────────────────────────
id
job_id FK
opened_by_user_id FK
reason
description
status
resolution
resolved_by
resolved_at
created_at
updated_at
```

### status

```
OPEN
UNDER_REVIEW
RESOLVED
REJECTED
```

---

# 20. Notifications

```
notifications
────────────────────────
id
user_id FK
type
title
body
data JSONB
read_at
created_at
```

هنا `JSONB` منطقي جدًا.

مثلاً Notification خاصة بطلب:

```
{
  "requestId":"...",
  "jobId":"..."
}
```

---

# 21. Audit Logs

أنا أنصح من البداية نعمل:

```
audit_logs
────────────────────────
id
actor_user_id
action
entity_type
entity_id
before_data JSONB
after_data JSONB
created_at
```

وده مهم جدًا في نظام فيه:

- Payments
- Engineer Verification
- Disputes
- Admin actions
- Price changes
- Status changes

---

# 22. Shop — Phase 2

```
shops
────────────────────────
id
engineer_id FK UNIQUE
name
description
location_id
phone
status
created_at
updated_at
```

---

# 23. Products — Phase 2

```
products
────────────────────────
id
shop_id FK
name
description
sku
price
stock_quantity
is_active
created_at
updated_at
```

---

# 24. Orders — Phase 2

نفضل فصلها عن ServiceRequest:

```
orders
────────────────────────
id
customer_id
shop_id
status
subtotal
shipping_fee
total
payment_status
created_at
updated_at
```

و:

```
order_items
────────────────────────
id
order_id
product_id
quantity
unit_price
total_price
```

---

# 25. أهم الـIndexes

دي نقطة مش شكلية.

## Matching

```
GIST(engineer_locations.point)
```

## Requests

```
INDEX(service_requests.customer_id)
INDEX(service_requests.selected_engineer_id)
INDEX(service_requests.status)
INDEX(service_requests.service_id)
```

## Jobs

```
INDEX(jobs.engineer_id, jobs.status)
INDEX(jobs.customer_id, jobs.status)
```

## Quotes

```
INDEX(quotes.request_id)
INDEX(quotes.engineer_id, quotes.status)
```

## Reviews

```
INDEX(reviews.engineer_id)
```

---

# 26. أهم Constraints

نعمل حماية من مستوى الـDB أيضًا.

مثلاً:

```
users.email UNIQUE
users.phone UNIQUE
engineer_profiles.user_id UNIQUE
customer_profiles.user_id UNIQUE

engineer_services
UNIQUE(engineer_id, service_id)

reviews.job_id UNIQUE

jobs.request_id UNIQUE
jobs.quote_id UNIQUE
```

يعني حتى لو الـBackend فيه Bug، الـDatabase نفسها تساعد تمنع بعض أنواع البيانات الفاسدة.

---

# 27. Multi-Tenant؟

هنا عندنا قرار مهم جدًا:

**المشروع الحالي ليس SaaS متعدد الشركات مثل FWMS.**

المنصة نفسها هي الـMarketplace.

يعني:

```
Platform
   ├── Customers
   ├── Engineers
   ├── Shops
   └── Services
```

مش:

```
Organization
   ├── Users
   └── Branches
```

وده يخلي الـArchitecture أبسط بكثير من FWMS.

---

# 28. MVP Database

لكن مش لازم ننفذ كل الجداول من أول يوم.

### Phase 1

```
users
customer_profiles
engineer_profiles
service_categories
services
engineer_services
engineer_locations
availabilities
service_requests
service_request_attachments
quotes
quote_items
jobs
payments
reviews
notifications
audit_logs
```

### Phase 2

```
shops
products
orders
order_items
inventory
```

### Phase 3

```
disputes advanced
wallet
commissions
subscriptions
promotions
analytics
```

---

# 📘 Product Blueprint — System Architecture v0.8

```
                    ┌─────────────────────┐
                    │   Customer App/Web  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │    Engineer App/Web │
                    └──────────┬──────────┘
                               │
                         HTTPS / API
                               │
                    ┌──────────▼──────────┐
                    │      Backend API    │
                    │   Modular Monolith  │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
      Auth Module         Marketplace Module    Matching Module
         │                     │                     │
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                   ┌───────────▼───────────┐
                   │ PostgreSQL + PostGIS  │
                   └───────────────────────┘
```

---

# 1. لماذا Modular Monolith؟

لأن المشروع في البداية ما زال:

- منتج جديد
- مستخدمين محدودين
- مدينة واحدة
- فريق صغير غالبًا
- الـDomain لسه بيتطور

لو بدأنا Microservices من اليوم الأول، هنضيف:

```
Service Discovery
Message Broker
Multiple Deployments
Distributed Logging
Network Failures
Tracing
```

بدون حاجة حقيقية.

الأفضل:

```
Monolith
   ↓
Good Module Boundaries
   ↓
Scale
   ↓
Extract Services Later
```

يعني نبني صح من البداية، لكن بدون overengineering.

---

# 2. Backend Modules

أقسم الـBackend بالشكل ده:

```
src/
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── customers/
│   ├── engineers/
│   ├── services/
│   ├── requests/
│   ├── matching/
│   ├── quotes/
│   ├── jobs/
│   ├── payments/
│   ├── reviews/
│   ├── notifications/
│   ├── disputes/
│   ├── shops/
│   └── products/
│
├── common/
│   ├── middleware/
│   ├── errors/
│   ├── validation/
│   ├── auth/
│   ├── database/
│   └── utils/
│
├── config/
└── app/
```

لكن مش كل Module لازم يدخل الـMVP.

---

# 3. Auth Module

مسؤوليته:

```
Register
Login
Refresh Token
Logout
Password Reset
Phone/Email Verification
```

ومعاه:

```
Authentication
Authorization
Role / Permission
```

---

# 4. Engineer Module

مسؤوليته:

```
Engineer Profile
Verification
Specializations
Availability
Location
Service Area
```

مثلاً:

```
GET /engineers/me
PATCH /engineers/me
GET /engineers/:id
PATCH /engineers/availability
PATCH /engineers/location
```

---

# 5. Service Module

```
Categories
Services
Engineer Services
```

Endpoints مثل:

```
GET /services
GET /services/:id
GET /categories
```

والـAdmin:

```
POST /admin/services
PATCH /admin/services/:id
DELETE /admin/services/:id
```

---

# 6. Request Module ⭐

ده قلب الـMarketplace.

```
POST   /service-requests
GET    /service-requests
GET    /service-requests/:id
POST   /service-requests/:id/select-engineer
POST   /service-requests/:id/cancel
```

لكن مهم:

الـController ما يحتويش كل الـBusiness Logic.

مثلاً:

```
Controller
    ↓
Service
    ↓
Domain Rules
    ↓
Repository
```

---

# 7. Matching Module ⭐⭐⭐

ده لازم يكون **Module مستقل منطقيًا** حتى لو داخل نفس Backend.

مثلاً:

```
matching/
├── matching.service.ts
├── matching.scorer.ts
├── matching.repository.ts
└── matching.types.ts
```

العملية:

```
ServiceRequest
       ↓
Eligibility Filter
       ↓
Geo Query
       ↓
Service Match
       ↓
Availability
       ↓
Scoring
       ↓
Ranking
       ↓
Recommendations
```

---

# 8. Matching Algorithm

نقدر نبدأ بشيء بسيط.

مثلاً:

```
score =
  serviceMatch * 0.35
+ distanceScore * 0.25
+ availabilityScore * 0.15
+ ratingScore * 0.15
+ experienceScore * 0.10
```

لكن دي **Initial Formula**، مش قانون نهائي.

بعد الإطلاق نستخدم البيانات الحقيقية لتحسينها.

---

# 9. Quote Module

```
POST /service-requests/:id/quotes
GET  /service-requests/:id/quotes
POST /quotes/:id/accept
POST /quotes/:id/reject
```

والـBackend يتحقق:

```
Is engineer assigned?
Is request in valid state?
Is quote allowed?
Is engineer owner?
```

---

# 10. Job Module

مسؤوليته:

```
Start Trip
Arrive
Start Job
Complete Job
Cancel Job
```

مثلاً:

```
POST /jobs/:id/start-trip
POST /jobs/:id/arrive
POST /jobs/:id/start
POST /jobs/:id/complete
```

كل endpoint يمر من خلال **State Transition Validation**.

مش:

```
update job set status = 'COMPLETED'
```

بشكل مباشر.

لكن:

```
JobStateMachine.transition(
  currentState,
  event
)
```

وده يحافظ على الـBusiness Rules.

---

# 11. Payment Module

نخليه مستقل منطقيًا:

```
payments/
├── payment.service
├── payment.provider
├── cash.payment
└── online.payment
```

ونستخدم abstraction:

```
PaymentProvider
       │
       ├── CashProvider
       └── OnlineProvider
```

وفي المستقبل نقدر نضيف Provider جديد بدون تغيير الـJob domain.

---

# 12. Notifications

نحتاج abstraction:

```
NotificationService
        │
        ├── InApp
        ├── Push
        ├── SMS
        └── WhatsApp
```

لكن الـMVP ممكن يبدأ بـ:

```
In-App
+
Push
```

والباقي لاحقًا.

---

# 13. Maps & Geolocation

نحتاج External Maps Provider، لكن ما نخليش الـBusiness Logic مربوط مباشرة بمزود واحد.

مثلاً:

```
LocationService
       │
       ├── Geocoding
       ├── Reverse Geocoding
       └── Distance
```

أما الـMatching الجغرافي الأساسي فيعتمد على:

**PostGIS**

مش على حساب المسافة في JavaScript.

---

# 14. File Storage

صور الخدمة وصور الـProfile والـShop مستقبلًا.

لا نخزن الملفات داخل PostgreSQL.

نستخدم:

```
Object Storage
      ↓
S3-compatible storage
```

والـDatabase تخزن:

```
file_url
file_type
metadata
```

---

# 15. API Structure

أفضل API Versioning من البداية:

```
/api/v1/auth
/api/v1/customers
/api/v1/engineers
/api/v1/services
/api/v1/service-requests
/api/v1/quotes
/api/v1/jobs
/api/v1/payments
/api/v1/reviews
```

وبالتالي لما نوصل مستقبلًا:

```
/api/v2
```

مش نكسر الـClients القديمة.

---

# 16. Authentication

ممكن نستخدم:

```
Access Token
+
Refresh Token
```

والـAccess Token قصير العمر.

لكن الأهم:

```
Authentication
+
Authorization
+
Ownership Checks
+
State Checks
```

كلهم مع بعض.

---

# 17. Request Lifecycle داخليًا

لما العميل يعمل:

`POST /service-requests`

الرحلة:

```
API Request
    ↓
Auth Middleware
    ↓
Validation
    ↓
Request Controller
    ↓
Request Service
    ↓
Create ServiceRequest
    ↓
Matching Service
    ↓
Find Eligible Engineers
    ↓
Rank Engineers
    ↓
Create Notifications
    ↓
Response
```

---

# 18. Event-driven Internally

مش لازم Kafka أو RabbitMQ من البداية.

لكن نخلي الـCode مستعد لفكرة Events:

```
ServiceRequestCreated
EngineerSelected
QuoteSent
QuoteAccepted
JobStarted
JobCompleted
PaymentSucceeded
ReviewCreated
```

مثلاً:

```
JobCompleted
      ↓
Notification
      +
Payment Logic
      +
Review Availability
      +
Analytics Event
```

ممكن تنفيذ ده بـInternal Event Bus بسيط في البداية.

---

# 19. Background Jobs

هنحتاج Worker من بدري لبعض المهام:

```
Expire Quotes
Expire Requests
Send Notifications
Cleanup
Recalculate Ratings
```

مثلاً:

```
Quote expiresAt reached
        ↓
Background Worker
        ↓
Quote → EXPIRED
        ↓
Notify Customer
```

---

# 20. Production Architecture

مبدئيًا:

```
                   Internet
                      │
                    HTTPS
                      │
                 ┌────▼────┐
                 │  Nginx  │
                 └────┬────┘
                      │
                ┌─────▼─────┐
                │ Node API   │
                │ PM2        │
                └─────┬──────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
     PostgreSQL    Object      Worker
      + PostGIS    Storage
```

ومستقبلًا:

```
Load Balancer
      ↓
API Instances
  ├── API 1
  ├── API 2
  └── API 3
```

بدون تغيير الـDomain architecture.

---

# 21. Security Baseline

من البداية:

```
HTTPS
JWT Security
Password Hashing
Rate Limiting
Input Validation
RBAC / Permissions
Ownership Checks
State Validation
SQL Injection Protection
Secure File Uploads
Audit Logs
Secrets via Environment
```

وبالنسبة للـLocation:

لا نكشف **الموقع الدقيق للمهندس للعميل بشكل دائم**.

العميل يحتاج location مناسب للـservice، وليس tracking مفتوح.

والـLive Location، لو أضفناه لاحقًا، يكون أثناء الـJob فقط وبحدود واضحة.

---

# 22. Observability

من البداية على الأقل:

```
Structured Logs
Error Tracking
Request IDs
Audit Logs
Basic Metrics
```

ومستقبلًا:

```
Prometheus
Grafana
Sentry
Distributed Tracing
```

مش لازم نركب الـStack كامل في الـMVP.

---

# 23. المشروع الآن بقى عنده Architecture واضحة

```
                    CLIENT
              ┌─────────┴─────────┐
              │                   │
          Customer            Engineer
              │                   │
              └─────────┬─────────┘
                        ▼
                   REST API
                        │
               ┌────────▼────────┐
               │   AUTH MODULE   │
               └────────┬────────┘
                        │
   ┌────────────────────┼────────────────────┐
   │                    │                    │
   ▼                    ▼                    ▼
Requests             Matching             Engineers
   │                    │                    │
   ▼                    ▼                    ▼
Quotes              PostGIS             Availability
   │
   ▼
Jobs
 ┌─┴───────┐
 ▼         ▼
Payment   Review
   │
   ▼
Notifications
```

---

# 📘 Product Blueprint — API Contract v0.9

دلوقتي هنحوّل الـDomain والـArchitecture إلى **API Contract** واضح.

الهدف إن الـFrontend والـBackend يشتغلوا على نفس العقد، وما نبدأش نكتب Endpoints بشكل عشوائي.

---

# 1. API Principles

كل الـAPI تحت:

```
/api/v1
```

والـResponse الموحد يكون تقريبًا:

```
{
  "success":true,
  "data": {},
  "meta": {}
}
```

وفي الخطأ:

```
{
  "success":false,
  "error": {
    "code":"VALIDATION_ERROR",
    "message":"Invalid request",
    "details": []
  }
}
```

وده هيسهل جدًا على الـFrontend التعامل مع الـAPI.

---

# 2. Auth API

## Register

```
POST /api/v1/auth/register
```

Request:

```
{
  "name":"Ahmed Ali",
  "phone":"01000000000",
  "password":"********",
  "role":"CUSTOMER"
}
```

---

## Login

```
POST /api/v1/auth/login
```

Response:

```
{
  "user": {
    "id":"uuid",
    "name":"Ahmed Ali",
    "role":"CUSTOMER"
  },
  "accessToken":"...",
  "refreshToken":"..."
}
```

---

## Refresh

```
POST /api/v1/auth/refresh
```

---

## Logout

```
POST /api/v1/auth/logout
```

---

# 3. Customer API

## Profile

```
GET /api/v1/customers/me
PATCH /api/v1/customers/me
```

---

# 4. Engineer API

## Profile

```
GET /api/v1/engineers/me
PATCH /api/v1/engineers/me
```

## Public Profile

```
GET /api/v1/engineers/:engineerId
```

## Availability

```
GET /api/v1/engineers/me/availability
PUT /api/v1/engineers/me/availability
```

## Current Availability Status

```
PATCH /api/v1/engineers/me/status
```

Request:

```
{
  "status":"AVAILABLE"
}
```

## Location

```
PATCH /api/v1/engineers/me/location
```

Request:

```
{
  "latitude":29.9,
  "longitude":31.1
}
```

لكن الـBackend هو اللي يتحقق من صحة الإحداثيات، ولا نثق في الـClient.

---

# 5. Services API

## Categories

```
GET /api/v1/service-categories
```

## Services

```
GET /api/v1/services
GET /api/v1/services/:serviceId
```

مثلاً:

```
GET /api/v1/services?category=cctv
```

---

# 6. Engineer Specializations

```
GET    /api/v1/engineers/me/services
POST   /api/v1/engineers/me/services
DELETE /api/v1/engineers/me/services/:serviceId
```

لكن لازم الـBackend يتحقق إن الخدمة موجودة وActive.

---

# 7. Service Request API ⭐

## Create Request

```
POST /api/v1/service-requests
```

Request:

```
{
  "serviceId":"uuid",
  "description":"عايز تركيب 4 كاميرات",
  "preferredDate":"2026-09-16",
  "preferredStartTime":"17:00",
  "preferredEndTime":"19:00",
  "location": {
    "latitude":29.9,
    "longitude":31.1,
    "address":"..."
  }
}
```

Response:

```
{
  "id":"uuid",
  "status":"MATCHING"
}
```

---

# 8. Request Details

```
GET /api/v1/service-requests/:requestId
```

الرد ممكن يحتوي:

```
Request
Service
Customer
Selected Engineer
Quote
Job
Payment
```

لكن نرجع فقط البيانات المسموح بها حسب الـRole.

---

# 9. Engineer Recommendations

```
GET /api/v1/service-requests/:requestId/recommendations
```

مثلاً:

```
{
  "data": [
    {
      "engineerId":"1",
      "name":"Ahmed",
      "rating":4.9,
      "distanceKm":2.1,
      "completedJobs":120,
      "isAvailable":true
    }
  ]
}
```

لاحظ:

**إحنا لا نرجع الـmatching score الخام للمستخدم.**

ممكن نستخدمه داخليًا للترتيب.

---

# 10. اختيار المهندس

```
POST /api/v1/service-requests/:requestId/select-engineer
```

Request:

```
{
  "engineerId":"uuid"
}
```

Backend يتحقق:

```
Request belongs to customer
Engineer is eligible
Engineer matches service
Engineer is active
Engineer is available
Request state allows selection
```

---

# 11. Reject / Change Engineer

لو العميل عايز مهندس تاني:

```
POST /api/v1/service-requests/:requestId/change-engineer
```

ممكن النظام يستثني المهندس الحالي:

```
{
  "excludeEngineerId":"uuid"
}
```

ويرجع Recommendations جديدة.

---

# 12. Engineer Request Actions

المهندس:

```
GET /api/v1/engineer/requests
```

أو:

```
GET /api/v1/service-requests?scope=assigned
```

وأنا أفضل الـAPI الأولى لو هدفنا readability:

```
GET /engineer/requests
```

## Accept

```
POST /api/v1/service-requests/:requestId/accept
```

## Reject

```
POST /api/v1/service-requests/:requestId/reject
```

---

# 13. Quote API ⭐

## Create Quote

```
POST /api/v1/service-requests/:requestId/quotes
```

Request:

```
{
  "items": [
    {
      "type":"LABOR",
      "description":"Installation",
      "quantity":1,
      "unitPrice":700
    },
    {
      "type":"MATERIAL",
      "description":"Cable",
      "quantity":20,
      "unitPrice":40
    }
  ],
  "estimatedDurationMinutes":180,
  "notes":"يشمل التركيب والإعداد"
}
```

الـBackend يحسب الـtotal.

**لا نثق في `total` المرسل من الـFrontend.**

---

# 14. Accept Quote

```
POST /api/v1/quotes/:quoteId/accept
```

لكن لازم:

```
Current user = Customer
Customer owns request
Quote belongs to request
Quote status = SENT
Request state = QUOTE_SENT
```

---

# 15. Reject Quote

```
POST /api/v1/quotes/:quoteId/reject
```

وممكن نطلب:

```
{
  "reason":"PRICE_TOO_HIGH"
}
```

ودي هتساعدنا لاحقًا في تحليل ليه العملاء بيرفضوا عروض الأسعار.

---

# 16. Job API

بعد قبول الـQuote:

```
GET /api/v1/jobs/:jobId
```

Engineer actions:

```
POST /api/v1/jobs/:jobId/start-trip
POST /api/v1/jobs/:jobId/arrive
POST /api/v1/jobs/:jobId/start
POST /api/v1/jobs/:jobId/complete
```

كل Endpoint يتحقق من الحالة الحالية.

مثلاً:

```
start-trip
CONFIRMED → ON_THE_WAY
```

لو Job:

```
COMPLETED
```

وحاول المهندس ينفذ:

```
start-trip
```

نرجع:

```
409 Conflict
```

مثلاً:

```
{
  "success":false,
  "error": {
    "code":"INVALID_STATE_TRANSITION",
    "message":"Job cannot start from COMPLETED state"
  }
}
```

---

# 17. Completion Confirmation

لأننا اتفقنا إن الإتمام لا يكون أعمى:

```
POST /api/v1/jobs/:jobId/confirm-completion
```

العميل يؤكد:

```
COMPLETION_PENDING
        ↓
COMPLETED
```

---

# 18. Additional Quote

أثناء العمل:

```
POST /api/v1/jobs/:jobId/additional-quotes
```

مثلاً:

```
{
  "items": [
    {
      "description":"Additional Cable",
      "quantity":10,
      "unitPrice":40
    }
  ],
  "notes":"المسافة الفعلية أكبر من المتوقع"
}
```

العميل:

```
POST /api/v1/additional-quotes/:quoteId/accept
POST /api/v1/additional-quotes/:quoteId/reject
```

---

# 19. Payment API

## Create Payment

```
POST /api/v1/jobs/:jobId/payments
```

Request:

```
{
  "method":"CASH"
}
```

أو:

```
{
  "method":"ONLINE"
}
```

---

# 20. Online Payment

لـOnline:

```
Create Payment
      ↓
Payment Provider
      ↓
Checkout
      ↓
Webhook
      ↓
Verify Payment
      ↓
PAID
```

مهم جدًا:

**ما نعتبرش الدفع ناجحًا بناءً على Frontend redirect فقط.**

الـWebhook / provider verification هو مصدر الحقيقة.

---

# 21. Payment Webhook

مثلاً:

```
POST /api/v1/payments/webhook
```

وده endpoint خاص بالـProvider.

لا يعتمد على JWT الخاص بالمستخدم، لكن يعتمد على:

```
Signature Verification
```

---

# 22. Reviews API

```
POST /api/v1/jobs/:jobId/review
GET  /api/v1/engineers/:engineerId/reviews
```

Request:

```
{
  "rating":5,
  "comment":"شغل ممتاز"
}
```

والـBackend يمنع:

```
Customer has not completed this job
```

من عمل Review.

---

# 23. Notifications API

```
GET  /api/v1/notifications
POST /api/v1/notifications/:id/read
POST /api/v1/notifications/read-all
```

---

# 24. Admin API

بشكل منفصل:

```
/api/v1/admin/...
```

مثلاً:

```
GET /api/v1/admin/engineers
POST /api/v1/admin/engineers/:id/verify
POST /api/v1/admin/engineers/:id/suspend

GET /api/v1/admin/service-requests
GET /api/v1/admin/payments
GET /api/v1/admin/reviews
```

---

# 25. HTTP Status Codes

نثبت Convention من البداية:

```
200 OK
201 Created
204 No Content

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests

500 Internal Server Error
```

خصوصًا:

### 401

المستخدم غير authenticated.

### 403

Authenticated لكن لا يملك permission.

### 409

العملية صحيحة لكن حالة الـresource تمنعها.

مثلاً:

```
Quote already accepted
```

---

# 26. Idempotency

دي مهمة جدًا في:

- Payments
- Accept Quote
- Complete Job
- Create requests أحيانًا

مثلاً لو الـClient ضغط Payment مرتين.

لا نريد:

```
Payment #1
Payment #2
```

بدون قصد.

لذلك ممكن نستخدم:

```
Idempotency-Key: unique-request-id
```

خصوصًا في الـpayment endpoints.

---

# 27. API → Domain Layer

أنا أريد Architecture بالشكل ده:

```
HTTP Controller
      ↓
Application Service
      ↓
Domain Rules
      ↓
Repository
      ↓
PostgreSQL
```

مثلاً:

```
POST /quotes/:id/accept
        ↓
QuoteController
        ↓
AcceptQuoteService
        ↓
QuoteStateMachine
        ↓
Payment/Job creation
        ↓
Transaction
        ↓
Repository
```

مش:

```
Controller
   ↓
SQL
   ↓
Response
```

لأن المشروع هيكبر.

---

# 28. Transaction Boundaries

بعض العمليات لازم تحصل داخل Database Transaction واحدة.

مثلاً:

## Accept Quote

```
BEGIN

Validate Quote
Validate Request

Quote → ACCEPTED
Request → QUOTE_ACCEPTED
Create Job

COMMIT
```

لو إنشاء الـJob فشل:

```
ROLLBACK
```

وممنوع نطلع بنتيجة:

```
Quote = ACCEPTED
Job = missing
```

---

# 29. Matching Architecture

Matching نفسه:

```
MatchingService
      │
      ├── EligibilityFilter
      │
      ├── GeoSearch
      │
      ├── AvailabilityChecker
      │
      └── RankingEngine
```

مثلاً:

```
1. Service compatibility
2. Active + verified
3. Availability
4. Geographic radius
5. Score
6. Return top N
```

---

# 30. قاعدة مهمة جدًا للـMatching

لا نبحث في كل المهندسين في المدينة ثم نحسب كل شيء.

الأفضل:

```
PostGIS
   ↓
Get engineers within radius
   ↓
Filter service
   ↓
Filter availability
   ↓
Calculate ranking
```

وده أفضل أداءً وقابل للتوسع.

---

# 31. الـAPI الآن أصبح واضح

عندنا Domains:

```
/auth
/customers
/engineers
/services
/service-requests
/quotes
/jobs
/payments
/reviews
/notifications
/admin
```

والـShop/e-commerce يدخل بعدين:

```
/shops
/products
/orders
```

---

# 📘 Product Blueprint — Frontend Architecture v1.0

دلوقتي بعد ما خلصنا الـAPI، هنحدد **شكل التطبيق من ناحية الـFrontend**.

وأنا أقترح من البداية نفصل الواجهات حسب نوع المستخدم، لكن من غير ما نعمل 3 مشاريع منفصلة.

---

# 1. Frontend Structure

```
client/
├── app/
│   ├── router/
│   ├── providers/
│   └── layouts/
│
├── modules/
│   ├── auth/
│   ├── customer/
│   ├── engineer/
│   ├── services/
│   ├── requests/
│   ├── quotes/
│   ├── jobs/
│   ├── payments/
│   ├── reviews/
│   ├── notifications/
│   └── admin/
│
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   ├── constants/
│   └── types/
│
└── api/
    ├── client.ts
    └── endpoints/
```

وده هيساعدنا جدًا لما التطبيق يكبر.

---

# 2. Routing

نقسم الـRoutes بدل ملف ضخم:

```
app/router/
├── auth.routes.tsx
├── customer.routes.tsx
├── engineer.routes.tsx
└── admin.routes.tsx
```

ثم:

```
createBrowserRouter([
  ...authRoutes,
  ...customerRoutes,
  ...engineerRoutes,
  ...adminRoutes,
])
```

---

# 3. Authentication Guard

مثلاً:

```
ProtectedRoute
```

يتأكد إن المستخدم Logged In.

وبعدها:

```
CustomerRoute
EngineerRoute
AdminRoute
```

لكن الأفضل لاحقًا نضيف Permission Guard:

```
<PermissionGuardpermission="requests.create">
```

لأن الـRole وحده غير كافٍ.

---

# 4. Customer Navigation

ممكن تكون:

```
Home
Services
Requests
Notifications
Profile
```

### Mobile Bottom Navigation

```
🏠 Home
📋 Requests
🔔 Notifications
👤 Profile
```

و`Services` تكون واضحة داخل Home.

---

# 5. Customer Pages

```
/customer
/customer/services
/customer/services/:serviceId
/customer/requests/new
/customer/requests/:requestId
/customer/requests/:requestId/engineers
/customer/requests/:requestId/quote
/customer/requests/:requestId/payment
/customer/requests/:requestId/rating
/customer/history
/customer/profile
/customer/notifications
```

---

# 6. Customer Request Wizard

بدل صفحة طويلة جدًا، نخلي إنشاء الطلب على خطوات:

```
Step 1
Choose Service
      ↓
Step 2
Describe Problem
      ↓
Step 3
Location
      ↓
Step 4
Preferred Time
      ↓
Step 5
Review
      ↓
Find Engineers
```

وده أفضل UX بفرق كبير.

---

# 7. Engineers Screen

بعد الـMatching:

```
/customer/requests/:id/engineers
```

تظهر Cards:

```
┌────────────────────────────┐
│ Ahmed Ali            ✓     │
│ ⭐ 4.9                    │
│ CCTV • Networking          │
│ 2.1 km                     │
│ 120 jobs                   │
│                            │
│ [View Profile]             │
│ [Choose Engineer]          │
└────────────────────────────┘
```

---

# 8. Engineer Profile

```
/engineers/:engineerId
```

يعرض:

```
Photo
Name
Verification
Rating
Completed Jobs
Experience
Specializations
Service Area
Reviews
Shop
```

---

# 9. Engineer Navigation

```
Dashboard
Requests
Active Job
Jobs History
Availability
Services
Reviews
Earnings
Profile
```

ولو عنده Shop:

```
Shop
Products
Orders
```

---

# 10. Engineer Pages

```
/engineer
/engineer/requests
/engineer/requests/:requestId
/engineer/quotes/:quoteId
/engineer/jobs
/engineer/jobs/:jobId
/engineer/availability
/engineer/services
/engineer/reviews
/engineer/earnings
/engineer/profile
```

---

# 11. Engineer Request Details

المهندس يشوف:

```
Service
Customer Description
Photos
Location
Preferred Time
Distance
```

ثم:

```
[Accept Request]
[Reject Request]
```

بعد Accept:

```
Create Quote
```

---

# 12. Quote Builder

مهم جدًا نعمله UX جيد.

```
Quote

Items
──────────────────
Installation   700
Cable          800
Power Supply   200

[+ Add Item]

Estimated Duration:
3 Hours

Notes:
...

Total:
1,700 EGP

[Send Quote]
```

والـTotal **محسوب أوتوماتيك**.

---

# 13. Active Job

للمهندس:

```
CCTV Installation

Customer
Ahmed Ali

Location
...

Status:
CONFIRMED

[Start Trip]
```

بعد الضغط:

```
ON THE WAY

[Arrived]
```

ثم:

```
ARRIVED

[Start Job]
```

ثم:

```
IN PROGRESS

[Complete Job]
```

---

# 14. Customer Active Request

العميل يرى Timeline:

```
✓ Request Created
      ↓
✓ Engineer Selected
      ↓
✓ Quote Accepted
      ↓
✓ Payment
      ↓
● Engineer On The Way
      ↓
○ Arrived
      ↓
○ Work in Progress
      ↓
○ Completed
```

ده هيكون من أهم Screens في التطبيق.

---

# 15. Admin Dashboard

الـAdmin عنده Web Dashboard منفصلة:

```
/admin
```

Navigation:

```
Dashboard
Engineers
Customers
Services
Requests
Jobs
Payments
Reviews
Disputes
Settings
```

---

# 16. Admin Dashboard Metrics

في البداية:

```
Total Customers
Total Engineers
Active Engineers
Requests Today
Completed Jobs
Revenue
Pending Verifications
Open Disputes
```

وبعدين Analytics متقدمة.

---

# 17. Server State vs UI State

دي نقطة مهمة جدًا في React.

### Server State

نستخدم React Query / TanStack Query مثلًا لـ:

```
Requests
Engineers
Quotes
Jobs
Notifications
Profile
Services
```

### UI State

نستخدم local state لـ:

```
Modal open
Selected tab
Form step
Filter
Drawer
```

ما نخلطش الاتنين.

---

# 18. Caching

مثلاً Services:

```
GET /services
```

بيانات شبه ثابتة → Cache طويل.

لكن:

```
Active Job
```

بيانات متغيرة → stale time قصير / refetch حسب الحاجة.

---

# 19. Notifications

الـFrontend يبدأ بـ:

```
In-App Notifications
```

مثلاً:

```
🔔 Engineer accepted your request
🔔 New quote received
🔔 Engineer is on the way
🔔 Job completed
```

ثم بعدين نضيف Push Notifications.

---

# 20. Loading / Error States

كل Screen لازم يكون عندها:

```
Loading
Empty
Error
Success
```

مثلاً:

### No Requests

```
You don't have any service requests yet.

[Request a Service]
```

### API Error

```
Something went wrong.

[Try Again]
```

مش نسيب الصفحة فاضية.

---

# 21. Mobile First

بما إن معظم العملاء هيستخدموا Mobile، فأنا أعتبر:

> **Mobile-first UX**
> 

خصوصًا:

- Customer
- Engineer

أما:

> Admin Dashboard
> 

فممكن Desktop-first.

---

# 22. التطبيق عنده 3 Experiences

وده مهم جدًا:

```
                 PLATFORM
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
     Customer    Engineer      Admin
      Mobile      Mobile       Web
```

مش لازم الثلاثة يبقوا بنفس التصميم.

---

# 23. أهم Screens في الـMVP

لو اضطرينا نختصر جدًا:

### Customer

```
Login
Home
Service Selection
Create Request
Engineer Selection
Request Details
Quote
Payment
Active Job
Rating
History
```

### Engineer

```
Login
Dashboard
Requests
Request Details
Quote Builder
Active Job
History
Availability
Profile
Earnings
```

### Admin

```
Login
Dashboard
Engineers
Customers
Requests
Services
Verification
Reviews
```

---

# 🚀 MVP Roadmap

## Phase 0 — Project Foundation

### الهدف

تجهيز المشروع تقنيًا قبل بناء الـFeatures.

### Backend

```
Node.js
TypeScript
PostgreSQL
PostGIS
ORM
REST API
Validation
Authentication
Logging
Testing
```

### Frontend

```
React
TypeScript
Routing
TanStack Query
Forms
Validation
UI System
```

### Infrastructure

```
Docker
Environment Variables
Git
CI
Basic Logging
```

### Definition of Done

```
Backend runs
Database connected
Migration system working
Frontend runs
API client working
CI passes
Basic health endpoint works
```

---

# Phase 1 — Authentication & Users

نبني الأساس.

## Backend

```
users
customer_profiles
engineer_profiles
```

Endpoints:

```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout

GET  /customers/me
PATCH /customers/me

GET  /engineers/me
PATCH /engineers/me
```

## Frontend

### Customer

```
Login
Register
Profile
```

### Engineer

```
Register
Engineer Type
Profile Setup
```

### Tests

- Register
- Duplicate email/phone
- Login
- Refresh
- Invalid token
- Role authorization
- Ownership

### Definition of Done

المستخدم يقدر ينشئ حساب ويسجل دخول ويكمل Profile حسب نوعه.

---

# Phase 2 — Services & Engineer Setup

## Backend

```
service_categories
services
engineer_services
availabilities
engineer_locations
```

Endpoints:

```
GET /service-categories
GET /services

GET  /engineers/me/services
POST /engineers/me/services
DELETE /engineers/me/services/:serviceId

GET  /engineers/me/availability
PUT  /engineers/me/availability

PATCH /engineers/me/location
PATCH /engineers/me/status
```

## Frontend

### Customer

```
Services
Service Details
```

### Engineer

```
Specializations
Availability
Location
Available / Offline
```

### Definition of Done

المهندس يقدر يحدد:

> ماذا يعمل + أين يعمل + متى يعمل.
> 

---

# Phase 3 — Service Requests

🔥 هنا نبدأ الـMarketplace الحقيقي.

## Backend

```
service_requests
service_request_attachments
```

Endpoints:

```
POST /service-requests
GET  /service-requests
GET  /service-requests/:id
POST /service-requests/:id/cancel
```

ثم:

```
GET /service-requests/:id/recommendations
POST /service-requests/:id/select-engineer
POST /service-requests/:id/change-engineer
```

## Frontend

### Customer

```
Choose Service
Describe Problem
Upload Photos
Location
Preferred Time
Review Request
Recommended Engineers
Engineer Profile
Choose Engineer
Request Tracking
```

### Definition of Done

العميل يقدر يبدأ من:

> "محتاج تركيب كاميرات"
> 

وينتهي عند:

> "اخترت المهندس."
> 

---

# Phase 4 — Matching Engine ⭐

ده أول جزء نحتاج نختبره بشكل حقيقي.

## Pipeline

```
Request
   ↓
Geo Filter
   ↓
Service Filter
   ↓
Availability Filter
   ↓
Verification Filter
   ↓
Ranking
   ↓
Top Engineers
```

### Initial Scoring

```
Service Match       35%
Distance            25%
Availability        15%
Rating              15%
Experience          10%
```

لكن نخلي الـweights Configurable.

يعني ما نثبتهاش داخل الكود.

```
matching.config.ts
```

### Tests

لازم نختبر:

- الأقرب
- الأكثر تخصصًا
- غير المتاح
- غير الموثق
- خارج نطاق الخدمة
- المهندس suspended
- لا يوجد مهندس مناسب

### Definition of Done

كل Request يحصل على نتائج منطقية ومبررة.

---

# Phase 5 — Quotes

## Backend

```
quotes
quote_items
```

Endpoints:

```
POST /service-requests/:id/quotes
GET  /service-requests/:id/quotes

POST /quotes/:id/accept
POST /quotes/:id/reject
```

## Frontend

### Engineer

```
Quote Builder
Add Item
Quantity
Unit Price
Estimated Duration
Notes
Send Quote
```

### Customer

```
Quote Details
Items
Total
Estimated Duration

[Accept]
[Reject]
```

### Definition of Done

العميل والمهندس يكملوا الرحلة:

```
Request
→ Engineer
→ Quote
→ Customer Decision
```

---

# Phase 6 — Jobs

🔥 هنا يتحول الـRequest إلى تنفيذ فعلي.

## Backend

```
jobs
```

Endpoints:

```
GET  /jobs/:id

POST /jobs/:id/start-trip
POST /jobs/:id/arrive
POST /jobs/:id/start
POST /jobs/:id/complete

POST /jobs/:id/confirm-completion
```

## Frontend

### Engineer

```
Job Details
Start Trip
Arrived
Start Job
Complete Job
```

### Customer

```
Request Timeline
Engineer Status
Job Status
Confirm Completion
```

### Definition of Done

الـState Machine تمنع أي Transition غير قانوني.

مثلاً:

```
COMPLETED → START_TRIP
```

مرفوض.

---

# Phase 7 — Payments

## MVP

```
Cash
Online
```

## Backend

```
payments
```

ونفصل:

```
PaymentService
PaymentProvider
```

### Cash

```
Customer chooses Cash
      ↓
Job
      ↓
Engineer confirms payment
      ↓
PAID
```

### Online

```
Create Payment
      ↓
Provider
      ↓
Webhook
      ↓
Verification
      ↓
PAID
```

### Important

الـFrontend redirect **ليس مصدر الحقيقة**.

المصدر الحقيقي:

```
Payment Provider
+
Verified Webhook
```

---

# Phase 8 — Reviews + Notifications

## Reviews

```
POST /jobs/:id/review
GET /engineers/:id/reviews
```

## Notifications

```
notifications
```

الأحداث:

```
Request Created
Engineer Selected
Request Accepted
Quote Sent
Quote Accepted
Engineer On The Way
Engineer Arrived
Job Completed
Payment Successful
Review Received
```

### Definition of Done

العميل لا يفوّت التغييرات المهمة في الطلب.

---

# Phase 9 — Admin Dashboard

الـAdmin لا نبنيه قبل ما يكون الـCore Marketplace شغال.

### Dashboard

```
Customers
Engineers
Requests
Jobs
Payments
Reviews
```

### Verification

```
Pending Engineers
      ↓
Review
      ↓
Verify / Reject
```

### Moderation

```
Reviews
Disputes
Suspended Engineers
```

---

# Phase 10 — Security & Hardening

قبل Pilot حقيقي:

```
Authentication
Authorization
Rate Limiting
Validation
Ownership Checks
State Checks
File Upload Security
SQL Injection Protection
Audit Logs
Secure Headers
CORS
Secrets Management
```

ونعمل Security Testing:

```
IDOR
Privilege Escalation
Broken Access Control
Token Abuse
Rate Limit Bypass
Invalid State Transitions
Payment Abuse
```

---

# Phase 11 — Testing

هنقسم الاختبارات:

## Unit Tests

مثلاً:

```
Matching Score
Quote Calculation
State Transitions
Permission Rules
```

## Integration Tests

```
Create Request
Select Engineer
Create Quote
Accept Quote
Create Job
Complete Job
```

## E2E

السيناريو الأهم:

```
Customer Register
      ↓
Choose CCTV
      ↓
Create Request
      ↓
Choose Engineer
      ↓
Engineer Accepts
      ↓
Engineer Sends Quote
      ↓
Customer Accepts
      ↓
Payment
      ↓
Engineer Completes
      ↓
Customer Confirms
      ↓
Review
```

ده لازم يشتغل من أوله لآخره.

---

# Phase 12 — Pilot Launch

مش نفتح مصر كلها.

نختار:

```
One City
```

ثم مثلاً:

```
20–50 Engineers
```

ونراقب:

```
Requests
Acceptance Rate
Quote Acceptance Rate
Completion Rate
Average Response Time
Cancellation Rate
Average Rating
Repeat Customers
```

---

# 📊 أهم Metrics من أول يوم

مش عايزين نكتشف بعد 6 أشهر إن التطبيق عنده مستخدمين لكن مفيش Marketplace حقيقي.

## Marketplace Health

### Time To First Engineer

كم يستغرق العميل لحد ما يلاقي مهندس مناسب؟

### Engineer Acceptance Rate

كم مهندس يقبل الطلبات؟

### Quote Acceptance Rate

كام Quote العميل يوافق عليه؟

### Completion Rate

كم طلب يتحول إلى خدمة مكتملة؟

### Cancellation Rate

كام طلب بيتم إلغاؤه؟

### Repeat Rate

هل العميل يرجع يستخدم التطبيق مرة ثانية؟

---

# 🧠 أهم Metric في المشروع كله

أقترح نعتبر:

> **Successful Service Completion**
> 

هو الـNorth-Star Metric.

يعني:

```
Customer Need
      ↓
Matched Engineer
      ↓
Accepted Quote
      ↓
Service Completed
      ↓
Satisfied Customer
```

مش عدد Downloads.

مش عدد Accounts.

مش عدد Engineers.

**عدد الخدمات الناجحة المكتملة.**

---

# 🧩 Development Order النهائي

أنا أرشح الترتيب ده:

```
Foundation
   ↓
Auth
   ↓
Profiles
   ↓
Services
   ↓
Engineer Availability/Location
   ↓
Service Requests
   ↓
Matching
   ↓
Engineer Selection
   ↓
Quotes
   ↓
Jobs
   ↓
Payments
   ↓
Reviews
   ↓
Notifications
   ↓
Admin
   ↓
Security
   ↓
Testing
   ↓
Pilot
```

---

# 🚫 حاجات لا نبنيها الآن

مهم جدًا نقاوم إغراء الـFeatures 😂

**لا نبدأ الآن بـ:**

```
Chat
Live GPS
Wallet
Coupons
Subscriptions
Advanced Analytics
E-commerce
Multi-city
Multi-country
AI Assistant
Complex Loyalty System
```

مش لأنها وحشة، بالعكس؛ لكنها هتشتت المشروع عن الـCore Loop.

---

# 🎯 الـCore Loop النهائي للـMVP

عايزين نوصل للنقطة دي:

```
              CUSTOMER
                  │
                  ▼
           Choose Service
                  │
                  ▼
            Add Details
                  │
                  ▼
              Location
                  │
                  ▼
             Matching
                  │
                  ▼
       Choose Engineer
                  │
                  ▼
        Engineer Accepts
                  │
                  ▼
             QUOTE
                  │
                  ▼
        Customer Accepts
                  │
                  ▼
             PAYMENT
                  │
                  ▼
           ENGINEER JOB
                  │
                  ▼
             COMPLETED
                  │
                  ▼
               REVIEW
```

**لو الـLoop دي مستقرة واشتغلت مع مستخدمين حقيقيين، يبقى عندنا MVP فعلي يستحق التوسع.**

# 🧱 1. Tech Stack المقترح

## Backend

أرشح:

```
Node.js
TypeScript
NestJS
PostgreSQL
PostGIS
Prisma
Redis
```

### لماذا NestJS؟

لأن المشروع بدأ يدخل في Domains كثيرة:

```
Auth
Users
Engineers
Services
Requests
Matching
Quotes
Jobs
Payments
Reviews
Notifications
Admin
```

وNestJS مناسب جدًا لتنظيمها كـModules واضحة.

---

# 2. Frontend

أرشح:

```
React
TypeScript
Vite
TanStack Router
TanStack Query
React Hook Form
Zod
Tailwind CSS
```

والـAdmin Dashboard يمكن أن يكون نفس المشروع مع Layout مختلف.

---

# 3. Mobile

وهنا عندنا قرار مهم.

أنا **لا أنصح ببناء Mobile Native منفصل في البداية**.

الـMVP:

```
Responsive Web App / PWA
```

ثم بعد إثبات الـProduct:

```
React Native / Expo
```

والـBackend نفسه يخدم الاثنين.

```
             Backend API
            /           \
           /             \
      Web/PWA        Mobile App
```

ده يقلل تكلفة البداية.

---

# 4. Database

ثبتنا:

```
PostgreSQL
+
PostGIS
```

مع Prisma للـORM.

لكن عند استخدام PostGIS، أي شيء جغرافي حساس للأداء نتركه للاستعلامات الجغرافية المناسبة بدل محاولة عمل كل شيء من خلال ORM abstraction.

---

# 5. Redis

نستخدم Redis عند الحاجة لـ:

```
Caching
Rate Limiting
Temporary Data
Background Jobs
Locks
```

ومع Worker:

```
BullMQ
```

مثل:

```
Quote Expiration
Notifications
Request Timeout
Cleanup Jobs
```

---

# 6. Storage

ملفات المستخدمين:

```
Object Storage
```

مثل S3-compatible storage.

Database تخزن:

```
fileKey
url
mimeType
size
```

وليس Binary files.

---

# 7. Backend Structure

أقترح:

```
server/
├── src/
│
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── common/
│   │   ├── guards/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   ├── dto/
│   │   └── utils/
│   │
│   ├── config/
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── customers/
│   │   ├── engineers/
│   │   ├── services/
│   │   ├── requests/
│   │   ├── matching/
│   │   ├── quotes/
│   │   ├── jobs/
│   │   ├── payments/
│   │   ├── reviews/
│   │   ├── notifications/
│   │   ├── disputes/
│   │   └── admin/
│   │
│   └── infrastructure/
│       ├── database/
│       ├── storage/
│       ├── payments/
│       ├── maps/
│       └── notifications/
│
├── prisma/
├── test/
└── package.json
```

---

# 8. داخل كل Module

مثلاً `requests`:

```
requests/
├── requests.controller.ts
├── requests.service.ts
├── requests.repository.ts
├── requests.module.ts
├── dto/
├── entities/
├── types/
└── policies/
```

والـMatching:

```
matching/
├── matching.module.ts
├── matching.service.ts
├── matching.scorer.ts
├── matching.repository.ts
├── matching.policy.ts
└── types/
```

---

# 9. Frontend Structure

```
client/
├── src/
│
│   ├── app/
│   │   ├── router/
│   │   │   ├── auth.routes.tsx
│   │   │   ├── customer.routes.tsx
│   │   │   ├── engineer.routes.tsx
│   │   │   └── admin.routes.tsx
│   │   │
│   │   ├── providers/
│   │   └── layouts/
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── customer/
│   │   ├── engineer/
│   │   ├── requests/
│   │   ├── quotes/
│   │   ├── jobs/
│   │   ├── payments/
│   │   ├── reviews/
│   │   ├── notifications/
│   │   └── admin/
│   │
│   ├── shared/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── constants/
│   │   └── types/
│   │
│   └── lib/
│       ├── api/
│       ├── auth/
│       └── query/
```

---

# 10. قاعدة مهمة في الـFrontend

ما نعملش:

```
components/
  Everything
```

في ملف واحد ضخم.

كل Feature يكون له ownership واضح.

مثلاً:

```
requests/
├── pages/
├── components/
├── hooks/
├── api/
└── types/
```

---

# 11. API Layer

الـFrontend لا يعمل:

```
fetch(...)
```

في كل Component.

نعمل:

```
lib/api/
```

مثلاً:

```
requests.api.ts
engineers.api.ts
quotes.api.ts
jobs.api.ts
payments.api.ts
```

ثم:

```
Component
   ↓
Hook
   ↓
API Function
   ↓
HTTP Client
```

---

# 12. React Query

كل Server State عن طريق TanStack Query.

مثلاً:

```
useMyRequests()
useRequest()
useRecommendedEngineers()
useEngineerJobs()
useQuote()
useNotifications()
```

وعند mutation:

```
useCreateRequest()
useSelectEngineer()
useAcceptQuote()
useStartJob()
```

---

# 13. Forms

كل Form:

```
React Hook Form
+
Zod
```

مثلاً:

```
CreateServiceRequestSchema
CreateQuoteSchema
EngineerProfileSchema
PaymentSchema
```

والـBackend يعيد نفس قواعد التحقق بشكل مستقل.

**الـFrontend validation للـUX، والـBackend validation للأمان.**

---

# 14. Naming Conventions

نثبت من البداية:

### Database

```
snake_case
```

مثل:

```
service_requests
engineer_profiles
quote_items
```

### TypeScript

```
camelCase
```

مثل:

```
serviceRequestIdengineerIdcreatedAt
```

### React Components

```
PascalCase
```

مثل:

```
RequestCard
EngineerCard
QuoteBuilder
JobTimeline
```

### API

```
kebab-case
```

مثل:

```
/service-requests
```

---

# 15. State Management

لا نستخدم Redux لمجرد وجود React.

في البداية:

```
TanStack Query
+
React Context
+
Local State
```

ونضيف Zustand أو Redux فقط لو ظهر احتياج حقيقي.

---

# 16. Error Handling

Backend يملك Error Codes ثابتة.

مثلاً:

```
INVALID_STATE_TRANSITION
FORBIDDEN
RESOURCE_NOT_FOUND
QUOTE_EXPIRED
ENGINEER_UNAVAILABLE
PAYMENT_FAILED
REQUEST_ALREADY_ASSIGNED
```

والـFrontend يعمل mapping لها:

```
QUOTE_EXPIRED
→ "انتهت صلاحية عرض السعر."
```

بدل عرض رسائل تقنية للمستخدم.

---

# 17. Logging

كل Request مهم يكون له:

```
requestId
userId
action
duration
status
```

وفي العمليات الحساسة:

```
actor
entity
before
after
```

---

# 18. Testing Structure

### Backend

```
test/
├── unit/
├── integration/
└── e2e/
```

### Frontend

```
tests/
├── unit/
├── integration/
└── e2e/
```

وأهم E2E هو:

```
Customer
→ Request
→ Matching
→ Engineer
→ Quote
→ Payment
→ Job
→ Review
```

---

# 19. CI/CD

من البداية:

```
Pull Request
    ↓
Lint
    ↓
Type Check
    ↓
Unit Tests
    ↓
Integration Tests
    ↓
Build
    ↓
Deploy
```

ولا نسمح بدمج الكود إذا فشلت الاختبارات الأساسية.

---

# 20. Git Strategy

نستخدم:

```
main
develop
feature/*
fix/*
```

مثلاً:

```
feature/service-request
feature/matching-engine
feature/quote-system
```

وكل Feature تكون PR مستقلة.

---

# 21. Environment

```
.env
.env.development
.env.test
.env.production
```

لكن الأسرار الحقيقية لا تدخل Git.

مثل:

```
DATABASE_URL
JWT_SECRET
PAYMENT_SECRET
STORAGE_SECRET
MAPS_API_KEY
```

---

# 22. Docker

للتطوير:

```
docker-compose
```

مثلاً:

```
┌──────────────┐
│ PostgreSQL   │
│ + PostGIS    │
└──────────────┘

┌──────────────┐
│ Redis        │
└──────────────┘

┌──────────────┐
│ API          │
└──────────────┘

┌──────────────┐
│ Worker       │
└──────────────┘
```

الـFrontend ممكن يشغل محليًا بشكل منفصل أثناء التطوير.

---

# 23. Definition of Done

أي Feature لا تعتبر مكتملة إلا لما يكون عندها:

```
✅ Database changes
✅ Migration
✅ Backend logic
✅ Validation
✅ Authorization
✅ API endpoint
✅ API tests
✅ Frontend
✅ Loading state
✅ Error state
✅ Empty state
✅ Audit/notification where needed
✅ Documentation
```

مش:

> "الصفحة ظهرت، يبقى Feature خلصت." 😂
> 

---

# 24. أول Release

بعد كل ده، الـMVP الأول يكون:

```
Customer
├── Auth
├── Services
├── Create Request
├── Location
├── Matching
├── Choose Engineer
├── Quote
├── Payment
├── Active Job
├── History
└── Review

Engineer
├── Auth
├── Profile
├── Services
├── Availability
├── Location
├── Requests
├── Quote
├── Active Job
├── Earnings
└── Reviews

Admin
├── Dashboard
├── Customers
├── Engineers
├── Verification
├── Requests
├── Services
└── Reviews
```

---