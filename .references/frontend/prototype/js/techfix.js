/* ==========================================================================
   TechFix — النواة المشتركة للنموذج التجريبي
   ما تفعله هذه الملفات في النموذج هو ما سيفعله الخادم في المشروع الفعلي:
   آلة الحالات، التحقق من الصلاحية (الدور + الملكية + الحالة)، المطابقة، الإشعارات.
   كل نص يظهر للمستخدم يمرّ عبر قاموس الأسماء العربية (LABELS) — لا تظهر أي رموز داخلية.
   ========================================================================== */
(function () {
  "use strict";
  const TF = (window.TF = {});
  const KEY = "tf.release1",
    VER = 3;

  /* ------------------------------------------------------------------ أدوات */
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const ic = (n, c = "") =>
    `<svg class="i ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const num = (n) => Number(n || 0).toLocaleString("en-US");
  const money = (n) => `<span class="num">${num(n)}</span> ج.م`;
  const moneyTxt = (n) => `${num(n)} ج.م`;
  const MIN = 60000,
    HOUR = 3600000,
    DAY = 86400000;
  const ago = (ms) => Date.now() - ms;
  const dayISO = (offset = 0) => {
    const d = new Date(Date.now() + offset * DAY);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  };
  const timeFmt = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateFmt = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const shortDate = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    day: "numeric",
    month: "short",
  });
  const sameDay = (a, b) =>
    new Date(a).toDateString() === new Date(b).toDateString();
  function when(ts) {
    const diff = Date.now() - ts;
    if (diff < MIN) return "الآن";
    if (diff < HOUR) return `منذ ${Math.floor(diff / MIN)} دقيقة`;
    if (sameDay(ts, Date.now())) return "اليوم " + timeFmt.format(ts);
    if (sameDay(ts, Date.now() - DAY)) return "أمس " + timeFmt.format(ts);
    return shortDate.format(ts) + " " + timeFmt.format(ts);
  }
  function dayLabel(iso) {
    if (iso === dayISO(0)) return "اليوم";
    if (iso === dayISO(1)) return "غدا";
    return dateFmt.format(new Date(iso + "T12:00:00"));
  }
  const hue = (s) =>
    [...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const avatar = (name, cls = "") =>
    `<span class="avatar ${cls}" style="--h:${hue(name)}" aria-hidden="true">${esc([...name][0] || "؟")}</span>`;
  const stars = (v, size) =>
    `<span class="stars" role="img" aria-label="${v} من 5">${[1, 2, 3, 4, 5].map((i) => `<svg class="i ${v + 0.25 >= i ? "" : "off"}"><use href="#i-star"/></svg>`).join("")}</span>`;
  const firstName = (n) => String(n).split(" ")[0];
  Object.assign(TF, {
    esc,
    ic,
    $,
    $$,
    num,
    money,
    moneyTxt,
    when,
    dayLabel,
    dayISO,
    avatar,
    stars,
    firstName,
    timeFmt,
    shortDate,
    MIN,
    HOUR,
    DAY,
  });

  /* --------------------------------------------------------- قاموس الأسماء */
  const SERVICES = {
    SATELLITE: {
      name: "الأقمار الصناعية",
      icon: "satellite-dish",
      blurb: "تركيب الأطباق وضبط الإشارة وصيانة الكابلات",
      subs: [
        "تركيب وتوجيه طبق",
        "ضبط إشارة الاستقبال",
        "صيانة كابلات وجهاز استقبال",
        "تغيير جهاز الاستقبال",
      ],
    },
    CCTV: {
      name: "كاميرات المراقبة",
      icon: "cctv",
      blurb: "تركيب وصيانة الكاميرات وأجهزة التسجيل",
      subs: [
        "تركيب كاميرات جديدة",
        "صيانة وإصلاح",
        "إعداد جهاز التسجيل والمشاهدة عن بعد",
        "نقل وإعادة تركيب",
      ],
    },
    INTERCOM: {
      name: "الإنتركم",
      icon: "phone-call",
      blurb: "أنظمة صوتية ومرئية وتمديداتها",
      subs: ["تركيب نظام مرئي", "تركيب نظام صوتي", "مد تمديدات وصيانة"],
    },
    NETWORK: {
      name: "الشبكات",
      icon: "network",
      blurb: "راوترات ونقاط وصول ومد كابلات",
      subs: [
        "تركيب راوتر أو نقطة وصول",
        "مد شبكة كابلات",
        "تحسين تغطية الإنترنت",
        "تركيب موزع شبكة",
      ],
    },
  };
  const SLOTS = {
    MORNING: "صباحا (9 – 12)",
    NOON: "ظهرا (12 – 4)",
    EVENING: "مساء (4 – 8)",
  };
  const ITEM_TYPES = {
    LABOR: "أجر العمل",
    MATERIAL: "خامات وقطع",
    OTHER: "بنود أخرى",
  };
  const PAY = { CASH: "نقدا عند الانتهاء", ONLINE: "دفع إلكتروني" };
  const PAYSTATE = {
    UNPAID: "لم يُدفع بعد",
    PARTIAL: "مدفوع جزئيًا",
    PAID: "مدفوع",
  };
  const VERIF = {
    PENDING: "قيد المراجعة",
    VERIFIED: "موثق",
    REJECTED: "مرفوض",
  };
  const ACCOUNT = { ACTIVE: "نشط", SUSPENDED: "موقوف" };
  const AVAIL = {
    AVAILABLE: "متاح الآن",
    BUSY: "مشغول حاليا",
    OFFLINE: "غير متاح",
  };
  const ROLE = { CUSTOMER: "عميل", ENGINEER: "مهندس", ADMIN: "مشرف" };

  // اسم الحالة كما يراها كل دور (الأسماء البرمجية تبقى في الخادم فقط)
  const STATUS = {
    REQUESTED: ["تم إرسال الطلب", "تم إرسال الطلب", "info"],
    MATCHING: ["اختر المهندس المناسب", "بانتظار اختيار العميل", "warn"],
    ENGINEER_SELECTED: ["بانتظار رد المهندس", "طلب جديد بانتظار ردك", "warn"],
    ENGINEER_ACCEPTED: ["بانتظار عرض السعر", "جهز عرض السعر", "info"],
    QUOTE_SENT: ["عرض السعر جاهز للمراجعة", "بانتظار موافقة العميل", "warn"],
    QUOTE_REJECTED: ["رفضت عرض السعر", "رفض العميل العرض", "bad"],
    QUOTE_ACCEPTED: ["اختر طريقة الدفع", "العميل يختار طريقة الدفع", "warn"],
    CONFIRMED: ["تم تأكيد الحجز", "جاهز للانطلاق", "ok"],
    ON_THE_WAY: ["المهندس في الطريق", "في الطريق إلى العميل", "live"],
    ARRIVED: ["المهندس وصل", "وصلت إلى الموقع", "live"],
    IN_PROGRESS: ["جار التنفيذ", "جار التنفيذ", "live"],
    COMPLETION_PENDING: [
      "بانتظار تأكيدك للإنجاز",
      "بانتظار تأكيد العميل",
      "warn",
    ],
    COMPLETED: ["تم الإنجاز", "تم الإنجاز", "ok"],
    RATED: ["تم التقييم", "تم التقييم", "ok"],
    CANCELLED: ["ملغي", "ملغي", "bad"],
  };
  const ADMIN_ST = {
    REQUESTED: "جديد",
    MATCHING: "بانتظار اختيار العميل",
    ENGINEER_SELECTED: "بانتظار رد المهندس",
    ENGINEER_ACCEPTED: "بانتظار عرض السعر",
    QUOTE_SENT: "بانتظار رد العميل على العرض",
    QUOTE_REJECTED: "العرض مرفوض",
    QUOTE_ACCEPTED: "بانتظار اختيار طريقة الدفع",
    CONFIRMED: "محجوز",
    ON_THE_WAY: "المهندس في الطريق",
    ARRIVED: "المهندس في الموقع",
    IN_PROGRESS: "قيد التنفيذ",
    COMPLETION_PENDING: "بانتظار تأكيد العميل",
    COMPLETED: "مكتمل",
    RATED: "مكتمل ومقيم",
    CANCELLED: "ملغي",
  };
  const statusText = (st, role) =>
    role === "admin"
      ? ADMIN_ST[st] || "—"
      : (STATUS[st] || ["—", "—"])[role === "customer" ? 0 : 1];
  const chip = (st, role) =>
    `<span class="chip chip--${(STATUS[st] || [])[2] || ""}">${esc(statusText(st, role))}</span>`;
  // مراحل «خط سير الخدمة» الظاهرة للعميل والمهندس
  const STAGES = [
    ["اختيار المهندس", ["REQUESTED", "MATCHING", "ENGINEER_SELECTED"]],
    ["عرض السعر", ["ENGINEER_ACCEPTED", "QUOTE_SENT", "QUOTE_REJECTED"]],
    ["الدفع وتأكيد الحجز", ["QUOTE_ACCEPTED"]],
    [
      "التنفيذ في الموقع",
      ["CONFIRMED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"],
    ],
    ["تأكيد الإنجاز", ["COMPLETION_PENDING"]],
    ["السداد والتقييم", ["COMPLETED", "RATED"]],
  ];
  const stageOf = (st) => STAGES.findIndex((s) => s[1].includes(st));
  const ERR = {
    FORBIDDEN: "لا تملك صلاحية تنفيذ هذا الإجراء.",
    NOT_FOUND: "لم نجد هذا الطلب. قد يكون محذوفًا أو غير تابع لحسابك.",
    INVALID_STATE:
      "لا يمكن تنفيذ هذا الإجراء في المرحلة الحالية من الطلب. حدث الصفحة وحاول مرة أخرى.",
    VALIDATION: "راجع الحقول المطلوبة وحاول مرة أخرى.",
    PENDING_EXTRA:
      "يوجد عرض سعر إضافي بانتظار رد العميل. انتظر قراره قبل إنهاء العمل.",
    NOT_VERIFIED: "حسابك قيد المراجعة. ستتلقى طلبات بعد توثيقه من الإدارة.",
    SUSPENDED: "هذا الحساب موقوف حاليا.",
    UNAVAILABLE: "هذا المهندس لم يعد متاحا. اختر مهندسا آخر من القائمة.",
    PAYMENT_UNVERIFIED:
      "لم نتلق تأكيد الدفع من بوابة الدفع بعد. إن خُصم المبلغ فسيتحدّث الطلب تلقائيًا خلال دقائق.",
  };
  TF.L = {
    STATUS,
    ADMIN_ST,
    SERVICES,
    SLOTS,
    ITEM_TYPES,
    PAY,
    PAYSTATE,
    VERIF,
    ACCOUNT,
    AVAIL,
    ROLE,
    STAGES,
    ERR,
  };
  Object.assign(TF, { statusText, chip, stageOf });

  /* ------------------------------------------------------- الحالة والتخزين */
  let S = null;
  const read = () => {
    try {
      const r = localStorage.getItem(KEY);
      if (r) return JSON.parse(r);
    } catch (e) {}
    try {
      if (window.name.startsWith("tf:"))
        return JSON.parse(window.name.slice(3));
    } catch (e) {}
    return null;
  };
  const save = () => {
    const s = JSON.stringify(S);
    try {
      localStorage.setItem(KEY, s);
    } catch (e) {}
    try {
      window.name = "tf:" + s;
    } catch (e) {}
  };
  function seed() {
    const mkEv = (arr) => arr.map(([t, st, text]) => ({ t, st, text }));
    const E = (id, o) => ({
      id,
      phone: "0100 000 0000",
      bio: "",
      services: [],
      subs: null,
      years: 3,
      rating: 0,
      reviews: 0,
      jobs: 0,
      lat: 30.04,
      lng: 31.21,
      area: "الجيزة",
      radius: 15,
      verification: "VERIFIED",
      account: "ACTIVE",
      availability: "AVAILABLE",
      hasShop: false,
      shop: "",
      docs: [
        { k: "الهوية الشخصية", ok: true },
        { k: "شهادة أو خبرة موثقة", ok: true },
      ],
      ...o,
    });
    const engineers = [
      E("e1", {
        name: "أحمد حسن",
        email: "ahmed@demo.techfix",
        phone: "0111 222 3344",
        bio: "فني مراقبة وشبكات بخبرة تسع سنوات. أنفذ التركيب والصيانة بخامات أصلية وضمان على التنفيذ.",
        services: ["CCTV", "INTERCOM", "NETWORK"],
        years: 9,
        rating: 4.9,
        reviews: 128,
        jobs: 342,
        lat: 30.045,
        lng: 31.205,
        area: "الدقي",
        hasShop: true,
        shop: "هاي لاين للأنظمة الذكية",
      }),
      E("e2", {
        name: "محمود سمير",
        email: "mahmoud@demo.techfix",
        phone: "0122 333 4455",
        bio: "متخصص في الأقمار الصناعية وضبط الإشارة منذ ست سنوات.",
        services: ["SATELLITE"],
        years: 6,
        rating: 4.7,
        reviews: 86,
        jobs: 190,
        lat: 30.056,
        lng: 31.2,
        area: "المهندسين",
      }),
      E("e3", {
        name: "كريم عادل",
        email: "karim@demo.techfix",
        phone: "0100 777 8899",
        bio: "شبكات منزلية وتجارية وكاميرات مراقبة.",
        services: ["NETWORK", "CCTV"],
        years: 5,
        rating: 4.6,
        reviews: 54,
        jobs: 120,
        lat: 30.06,
        lng: 31.21,
        area: "العجوزة",
        availability: "BUSY",
      }),
      E("e4", {
        name: "ياسر فتحي",
        email: "yasser@demo.techfix",
        phone: "0109 111 2233",
        bio: "تركيب أنظمة الإنتركم والمراقبة للمباني السكنية.",
        services: ["CCTV", "INTERCOM"],
        years: 8,
        rating: 4.8,
        reviews: 97,
        jobs: 210,
        lat: 30.0626,
        lng: 31.33,
        area: "مدينة نصر",
        radius: 25,
      }),
      E("e5", {
        name: "هشام رجب",
        email: "hisham@demo.techfix",
        phone: "0155 444 5566",
        bio: "أطباق وشبكات منزلية.",
        services: ["SATELLITE", "NETWORK"],
        years: 3,
        rating: 4.4,
        reviews: 31,
        jobs: 64,
        lat: 30.013,
        lng: 31.209,
        area: "الجيزة",
      }),
      E("e6", {
        name: "مصطفى نبيل",
        email: "mostafa@demo.techfix",
        phone: "0102 888 9900",
        services: ["CCTV"],
        years: 7,
        rating: 4.7,
        reviews: 70,
        jobs: 150,
        lat: 30.04,
        lng: 31.215,
        area: "الدقي",
        availability: "OFFLINE",
      }),
      E("e7", {
        name: "عمرو طلعت",
        email: "amr@demo.techfix",
        phone: "0128 555 6677",
        bio: "مهندس شبكات.",
        services: ["NETWORK"],
        years: 4,
        lat: 30.05,
        lng: 31.22,
        area: "الزمالك",
        verification: "PENDING",
        docs: [
          { k: "الهوية الشخصية", ok: true },
          { k: "شهادة أو خبرة موثقة", ok: false },
        ],
      }),
      E("e8", {
        name: "سامي بكر",
        email: "samy@demo.techfix",
        phone: "0114 666 7788",
        bio: "فني كاميرات.",
        services: ["CCTV"],
        years: 2,
        lat: 30.03,
        lng: 31.19,
        area: "إمبابة",
        verification: "PENDING",
        docs: [
          { k: "الهوية الشخصية", ok: true },
          { k: "شهادة أو خبرة موثقة", ok: true },
        ],
      }),
      E("e9", {
        name: "ماجد عوض",
        email: "maged@demo.techfix",
        phone: "0106 222 1100",
        services: ["SATELLITE"],
        years: 10,
        rating: 3.6,
        reviews: 22,
        jobs: 80,
        lat: 30.02,
        lng: 31.2,
        area: "الجيزة",
        account: "SUSPENDED",
        availability: "OFFLINE",
      }),
    ];
    const customers = [
      {
        id: "c1",
        name: "طارق محمود",
        email: "tarek@demo.techfix",
        phone: "0100 123 4567",
        addresses: [
          {
            id: "a1",
            label: "المنزل",
            text: "شارع التحرير، الدقي",
            area: "الدقي",
            lat: 30.0382,
            lng: 31.2118,
          },
        ],
      },
      {
        id: "c2",
        name: "منى السيد",
        email: "mona@demo.techfix",
        phone: "0112 345 6789",
        addresses: [],
      },
      {
        id: "c3",
        name: "هبة جمال",
        email: "heba@demo.techfix",
        phone: "0101 987 6543",
        addresses: [],
      },
    ];
    const q = (id, kind, status, items, duration, notes, at) => ({
      id,
      kind,
      status,
      items,
      duration,
      notes,
      total: items.reduce((a, i) => a + i.qty * i.price, 0),
      at,
    });
    const R = (o) => ({
      rejectedBy: [],
      quotes: [],
      payment: null,
      rating: null,
      dispute: null,
      cancelReason: "",
      ...o,
    });
    const requests = [
      R({
        id: "R-1048",
        customerId: "c1",
        service: "CCTV",
        sub: "صيانة وإصلاح",
        desc: "كاميرتان لا تعملان ليلا وتظهر الصورة سوداء.",
        address: "شارع التحرير، الدقي",
        area: "الدقي",
        lat: 30.0382,
        lng: 31.2118,
        when: { date: dayISO(-11), slot: "NOON" },
        status: "RATED",
        engineerId: "e1",
        createdAt: ago(12 * DAY),
        quotes: [
          q(
            "Q-1048a",
            "MAIN",
            "ACCEPTED",
            [
              {
                type: "LABOR",
                desc: "فحص وإصلاح الكاميرات",
                qty: 1,
                price: 600,
              },
              {
                type: "MATERIAL",
                desc: "مصدر طاقة للكاميرا",
                qty: 2,
                price: 225,
              },
            ],
            "ساعتان",
            "",
            ago(12 * DAY),
          ),
        ],
        payment: {
          method: "CASH",
          paid: 1050,
          status: "PAID",
          paidAt: ago(11 * DAY),
        },
        rating: {
          stars: 5,
          text: "التزم بالموعد وترك المكان نظيفا.",
          at: ago(11 * DAY),
        },
        events: mkEv([
          [ago(12 * DAY), "REQUESTED", "أرسلت الطلب"],
          [ago(12 * DAY - 10 * MIN), "ENGINEER_SELECTED", "اخترت أحمد حسن"],
          [ago(12 * DAY - 40 * MIN), "ENGINEER_ACCEPTED", "قبل المهندس الطلب"],
          [ago(12 * DAY - 90 * MIN), "QUOTE_SENT", "وصل عرض السعر"],
          [
            ago(12 * DAY - 2 * HOUR),
            "CONFIRMED",
            "قبلت العرض واخترت الدفع نقدًا",
          ],
          [ago(11 * DAY), "COMPLETED", "أُنجز العمل"],
          [ago(11 * DAY - 10 * MIN), "RATED", "قيمت المهندس"],
        ]),
      }),
      R({
        id: "R-1052",
        customerId: "c1",
        service: "NETWORK",
        sub: "تحسين تغطية الإنترنت",
        desc: "ضعف التغطية في الدور الثاني.",
        address: "شارع التحرير، الدقي",
        area: "الدقي",
        lat: 30.0382,
        lng: 31.2118,
        when: { date: dayISO(-5), slot: "MORNING" },
        status: "CANCELLED",
        engineerId: null,
        cancelReason: "تغيّرت خطتي",
        createdAt: ago(6 * DAY),
        events: mkEv([
          [ago(6 * DAY), "REQUESTED", "أرسلت الطلب"],
          [ago(6 * DAY - HOUR), "CANCELLED", "ألغيت الطلب"],
        ]),
      }),
      R({
        id: "R-1061",
        customerId: "c1",
        service: "CCTV",
        sub: "تركيب كاميرات جديدة",
        desc: "تركيب أربع كاميرات خارجية وجهاز تسجيل لفيلا من طابقين، مع إمكانية المشاهدة من الهاتف.",
        address: "شارع التحرير، الدقي",
        area: "الدقي",
        lat: 30.0382,
        lng: 31.2118,
        when: { date: dayISO(1), slot: "MORNING" },
        status: "QUOTE_SENT",
        engineerId: "e1",
        createdAt: ago(3 * HOUR),
        quotes: [
          q(
            "Q-1061a",
            "MAIN",
            "SENT",
            [
              {
                type: "LABOR",
                desc: "أجر التركيب والإعداد",
                qty: 1,
                price: 700,
              },
              {
                type: "MATERIAL",
                desc: "كابل شبكة بالمتر",
                qty: 20,
                price: 40,
              },
              { type: "MATERIAL", desc: "مصدر طاقة مركزي", qty: 1, price: 200 },
              {
                type: "OTHER",
                desc: "تمديد داخل الحوائط والتثبيت",
                qty: 1,
                price: 500,
              },
            ],
            "يوم عمل واحد",
            "الأسعار تشمل التشغيل التجريبي وشرح الاستخدام. أجهزة التسجيل غير مشمولة.",
            ago(40 * MIN),
          ),
        ],
        events: mkEv([
          [ago(3 * HOUR), "REQUESTED", "أرسلت الطلب"],
          [ago(3 * HOUR - 8 * MIN), "ENGINEER_SELECTED", "اخترت أحمد حسن"],
          [ago(2 * HOUR), "ENGINEER_ACCEPTED", "قبل المهندس الطلب"],
          [ago(40 * MIN), "QUOTE_SENT", "وصل عرض السعر"],
        ]),
      }),
      R({
        id: "R-1063",
        customerId: "c2",
        service: "INTERCOM",
        sub: "تركيب نظام مرئي",
        desc: "تركيب إنتركم مرئي لشقة في الدور الرابع، والتمديدات موجودة.",
        address: "شارع جامعة الدول العربية، المهندسين",
        area: "المهندسين",
        lat: 30.0561,
        lng: 31.2003,
        when: { date: dayISO(2), slot: "NOON" },
        status: "ENGINEER_SELECTED",
        engineerId: "e1",
        createdAt: ago(25 * MIN),
        events: mkEv([
          [ago(25 * MIN), "REQUESTED", "أرسلت الطلب"],
          [ago(20 * MIN), "ENGINEER_SELECTED", "اختارتك العميلة لتنفيذ الطلب"],
        ]),
      }),
      R({
        id: "R-1060",
        customerId: "c3",
        service: "NETWORK",
        sub: "مد شبكة كابلات",
        desc: "مد كابلات شبكة لثلاث غرف وتركيب موزع.",
        address: "شارع الحرية، العجوزة",
        area: "العجوزة",
        lat: 30.0605,
        lng: 31.2095,
        when: { date: dayISO(1), slot: "EVENING" },
        status: "CONFIRMED",
        engineerId: "e1",
        createdAt: ago(1 * DAY),
        quotes: [
          q(
            "Q-1060a",
            "MAIN",
            "ACCEPTED",
            [
              {
                type: "LABOR",
                desc: "أجر مد الكابلات والتركيب",
                qty: 1,
                price: 800,
              },
              {
                type: "MATERIAL",
                desc: "كابل شبكة بالمتر",
                qty: 15,
                price: 30,
              },
              { type: "MATERIAL", desc: "موزع شبكة", qty: 1, price: 150 },
            ],
            "نصف يوم",
            "",
            ago(20 * HOUR),
          ),
        ],
        payment: { method: "CASH", paid: 0, status: "UNPAID" },
        events: mkEv([
          [ago(1 * DAY), "REQUESTED", "أرسلت الطلب"],
          [ago(1 * DAY - 10 * MIN), "ENGINEER_SELECTED", "اختارتك العميلة"],
          [ago(23 * HOUR), "ENGINEER_ACCEPTED", "قبلت الطلب"],
          [ago(20 * HOUR), "QUOTE_SENT", "أرسلت عرض السعر"],
          [
            ago(19 * HOUR),
            "CONFIRMED",
            "قبلت العميلة العرض واختارت الدفع نقدا",
          ],
        ]),
      }),
      R({
        id: "R-1055",
        customerId: "c2",
        service: "CCTV",
        sub: "صيانة وإصلاح",
        desc: "تغيير جهاز تسجيل معطل.",
        address: "شارع سوريا، المهندسين",
        area: "المهندسين",
        lat: 30.0555,
        lng: 31.2,
        when: { date: dayISO(0), slot: "MORNING" },
        status: "COMPLETED",
        engineerId: "e1",
        createdAt: ago(2 * DAY),
        quotes: [
          q(
            "Q-1055a",
            "MAIN",
            "ACCEPTED",
            [
              {
                type: "LABOR",
                desc: "أجر التغيير والإعداد",
                qty: 1,
                price: 300,
              },
              {
                type: "MATERIAL",
                desc: "جهاز تسجيل أربع قنوات",
                qty: 1,
                price: 600,
              },
            ],
            "ساعتان",
            "",
            ago(2 * DAY),
          ),
        ],
        payment: { method: "CASH", paid: 0, status: "UNPAID" },
        events: mkEv([
          [ago(2 * DAY), "REQUESTED", "أرسلت الطلب"],
          [ago(2 * DAY - 10 * MIN), "ENGINEER_SELECTED", "اختارتك العميلة"],
          [ago(2 * DAY - 40 * MIN), "ENGINEER_ACCEPTED", "قبلت الطلب"],
          [ago(2 * DAY - HOUR), "QUOTE_SENT", "أرسلت عرض السعر"],
          [ago(1 * DAY), "CONFIRMED", "قبلت العميلة العرض"],
          [ago(3 * HOUR), "COMPLETION_PENDING", "أنهيت العمل"],
          [ago(2 * HOUR), "COMPLETED", "أكدت العميلة الإنجاز"],
        ]),
      }),
      R({
        id: "R-1040",
        customerId: "c3",
        service: "NETWORK",
        sub: "تركيب راوتر أو نقطة وصول",
        desc: "تركيب نقطتي وصول.",
        address: "العجوزة",
        area: "العجوزة",
        lat: 30.0605,
        lng: 31.2095,
        when: { date: dayISO(-3), slot: "NOON" },
        status: "RATED",
        engineerId: "e1",
        createdAt: ago(4 * DAY),
        quotes: [
          q(
            "Q-1040a",
            "MAIN",
            "ACCEPTED",
            [
              { type: "LABOR", desc: "أجر التركيب والضبط", qty: 1, price: 900 },
              { type: "MATERIAL", desc: "نقطة وصول", qty: 2, price: 700 },
            ],
            "نصف يوم",
            "",
            ago(4 * DAY),
          ),
        ],
        payment: {
          method: "ONLINE",
          paid: 2300,
          status: "PAID",
          paidAt: ago(3 * DAY),
        },
        rating: {
          stars: 5,
          text: "شغل ممتاز والتغطية تحسنت كثيرا.",
          at: ago(3 * DAY),
        },
        events: mkEv([
          [ago(4 * DAY), "REQUESTED", "أرسلت الطلب"],
          [ago(3 * DAY), "COMPLETED", "أُنجز العمل"],
          [ago(3 * DAY - HOUR), "RATED", "قيمت المهندس"],
        ]),
      }),
      R({
        id: "R-1044",
        customerId: "c2",
        service: "INTERCOM",
        sub: "مد تمديدات وصيانة",
        desc: "إصلاح خط صوت منقطع.",
        address: "المهندسين",
        area: "المهندسين",
        lat: 30.0561,
        lng: 31.2003,
        when: { date: dayISO(-6), slot: "MORNING" },
        status: "RATED",
        engineerId: "e1",
        createdAt: ago(7 * DAY),
        quotes: [
          q(
            "Q-1044a",
            "MAIN",
            "ACCEPTED",
            [
              {
                type: "LABOR",
                desc: "أجر الفحص والإصلاح",
                qty: 1,
                price: 1000,
              },
              { type: "MATERIAL", desc: "كابلات وتوصيلات", qty: 1, price: 600 },
            ],
            "ساعتان",
            "",
            ago(7 * DAY),
          ),
        ],
        payment: {
          method: "CASH",
          paid: 1600,
          status: "PAID",
          paidAt: ago(6 * DAY),
        },
        rating: {
          stars: 4,
          text: "جيد، تأخر قليلا عن الموعد.",
          at: ago(6 * DAY),
        },
        events: mkEv([
          [ago(7 * DAY), "REQUESTED", "أرسلت الطلب"],
          [ago(6 * DAY), "COMPLETED", "أُنجز العمل"],
          [ago(6 * DAY - HOUR), "RATED", "قيمت المهندس"],
        ]),
      }),
    ];
    const n = (to, text, link, mins, read) => ({
      id: "n" + Math.random().toString(36).slice(2, 8),
      to,
      text,
      link,
      t: ago(mins * MIN),
      read: !!read,
    });
    return {
      v: VER,
      seq: 1064,
      session: { role: null, id: null },
      customers,
      engineers,
      requests,
      reviews: [
        {
          eid: "e1",
          name: "طارق م.",
          stars: 5,
          text: "التزم بالموعد وترك المكان نظيفا.",
          t: ago(11 * DAY),
        },
        {
          eid: "e1",
          name: "هبة ج.",
          stars: 5,
          text: "شغل ممتاز والتغطية تحسنت كثيرا.",
          t: ago(3 * DAY),
        },
        {
          eid: "e1",
          name: "منى س.",
          stars: 4,
          text: "جيد، تأخر قليلا عن الموعد.",
          t: ago(6 * DAY),
        },
      ],
      notifs: [
        n(
          "c1",
          "وصل عرض سعر من أحمد حسن لطلب «تركيب كاميرات جديدة». راجعه واتخذ قرارك.",
          "request.html?r=R-1061",
          40,
        ),
        n(
          "e1",
          "طلب جديد: «تركيب نظام مرئي» في المهندسين. بانتظار ردك.",
          "request.html?r=R-1063",
          20,
        ),
        n(
          "e1",
          "أكدت العميلة إنجاز طلب «صيانة وإصلاح». أكد استلام المبلغ نقدا.",
          "request.html?r=R-1055",
          120,
        ),
        n(
          "admin",
          "مهندسان جديدان بانتظار مراجعة التوثيق.",
          "engineers.html",
          90,
        ),
      ],
      settings: {
        weights: {
          service: 35,
          distance: 25,
          availability: 15,
          rating: 15,
          experience: 10,
        },
        commission: 10,
        services: {
          SATELLITE: true,
          CCTV: true,
          INTERCOM: true,
          NETWORK: true,
        },
        city: "القاهرة الكبرى",
      },
      draft: null,
    };
  }
  TF.init = () => {
    S = read();
    if (!S || S.v !== VER) {
      S = seed();
      save();
    }
    TF.S = S;
  };
  TF.reset = () => {
    S = seed();
    TF.S = S;
    save();
  };
  TF.save = () => {
    save();
  };
  TF.get = () => S;

  /* ------------------------------------------------------------- الجلسة */
  const USERS = () => [
    ...S.customers.map((u) => ({ ...u, role: "customer" })),
    ...S.engineers.map((u) => ({ ...u, role: "engineer" })),
    {
      id: "a1",
      name: "إدارة المنصة",
      email: "admin@demo.techfix",
      role: "admin",
    },
  ];
  TF.me = () => {
    const ses = S.session;
    if (!ses.role) return null;
    const user =
      ses.role === "customer"
        ? S.customers.find((c) => c.id === ses.id)
        : ses.role === "engineer"
          ? S.engineers.find((e) => e.id === ses.id)
          : { id: "a1", name: "إدارة المنصة" };
    return user ? { role: ses.role, id: ses.id, user } : null;
  };
  TF.login = (email, password) => {
    if (!email || !password)
      return { ok: false, msg: "أدخل البريد الإلكتروني وكلمة المرور." };
    const u = USERS().find(
      (x) => x.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!u || (password !== "demo1234" && password !== u.password))
      return { ok: false, msg: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
    if (u.account === "SUSPENDED")
      return { ok: false, msg: ERR.SUSPENDED + " تواصل مع الدعم." };
    S.session = { role: u.role, id: u.id };
    save();
    return { ok: true, role: u.role };
  };
  TF.logout = () => {
    S.session = { role: null, id: null };
    save();
    location.href = TF.root + "login.html";
  };
  TF.home = (role) => TF.root + role + "/home.html";
  TF.switchTo = (role) => {
    S.session = {
      role,
      id: role === "customer" ? "c1" : role === "engineer" ? "e1" : "a1",
    };
    save();
    location.href = TF.home(role);
  };

  /* ------------------------------------------------------------- المطابقة */
  const km = (a, b, c, d) => {
    const R = 6371,
      t = Math.PI / 180,
      dLa = (c - a) * t,
      dLo = (d - b) * t;
    const x =
      Math.sin(dLa / 2) ** 2 +
      Math.cos(a * t) * Math.cos(c * t) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  TF.km = km;
  // الأهلية أولًا (التخصص، التوثيق، الحساب، التوفر، النطاق) ثم الترتيب بأوزان قابلة للضبط.
  TF.match = (r, weights) => {
    const W = weights || S.settings.weights;
    const tot = Object.values(W).reduce((a, b) => a + b, 0) || 1;
    return S.engineers
      .filter(
        (e) =>
          e.services.includes(r.service) &&
          e.verification === "VERIFIED" &&
          e.account === "ACTIVE" &&
          e.availability !== "OFFLINE" &&
          !(r.rejectedBy || []).includes(e.id),
      )
      .map((e) => ({ e, d: km(r.lat, r.lng, e.lat, e.lng) }))
      .filter((x) => x.d <= x.e.radius)
      .map(({ e, d }) => {
        const part = {
          service: e.subs && !e.subs.includes(r.sub) ? 0.7 : 1,
          distance: Math.max(0, 1 - d / e.radius),
          availability: e.availability === "AVAILABLE" ? 1 : 0.5,
          rating: e.rating / 5,
          experience: Math.min(e.years / 10, 1),
        };
        const score =
          Object.keys(W).reduce((a, k) => a + part[k] * W[k], 0) / tot;
        const reasons = [];
        if (d < 3) reasons.push("قريب منك");
        if (e.rating >= 4.8) reasons.push("تقييم مرتفع");
        if (e.availability === "AVAILABLE") reasons.push("متاح الآن");
        if (e.years >= 8) reasons.push("خبرة طويلة");
        return {
          e,
          d,
          score,
          reasons: reasons.slice(0, 3),
          eta: Math.round(d * 3 + 8),
        };
      })
      .sort((a, b) => b.score - a.score);
  };

  /* -------------------------------------------------------- آلة الحالات */
  const find = (id) => S.requests.find((r) => r.id === id);
  TF.req = find;
  const total = (r) =>
    r.quotes
      .filter((x) => x.status === "ACCEPTED")
      .reduce((a, x) => a + x.total, 0);
  const pendingQuote = (r) => r.quotes.find((x) => x.status === "SENT");
  const payInfo = (r) => {
    const t = total(r),
      paid = r.payment ? r.payment.paid : 0;
    return {
      total: t,
      paid,
      due: Math.max(0, t - paid),
      state: !t || paid <= 0 ? "UNPAID" : paid >= t ? "PAID" : "PARTIAL",
    };
  };
  Object.assign(TF, { total, pendingQuote, payInfo });
  const push = (to, text, link) =>
    S.notifs.unshift({
      id: "n" + Math.random().toString(36).slice(2, 8),
      to,
      text,
      link,
      t: Date.now(),
      read: false,
    });
  const ev = (r, st, text) => {
    r.status = st;
    r.events.push({ t: Date.now(), st, text });
  };
  const eng = (r) => S.engineers.find((e) => e.id === r.engineerId);
  const fail = (code) => ({ ok: false, code, msg: ERR[code] });
  const OK = (extra) => {
    save();
    return { ok: true, ...extra };
  };
  // حارس موحّد: الدور + الملكية + الحالة الحالية
  function guard(rid, role, states) {
    const me = TF.me();
    if (!me || me.role !== role) return { err: fail("FORBIDDEN") };
    const r = find(rid);
    if (!r) return { err: fail("NOT_FOUND") };
    if (role === "customer" && r.customerId !== me.id)
      return { err: fail("NOT_FOUND") };
    if (role === "engineer" && r.engineerId !== me.id)
      return { err: fail("NOT_FOUND") };
    if (states && !states.includes(r.status))
      return { err: fail("INVALID_STATE") };
    return { r, me };
  }
  const CANCELLABLE = [
    "REQUESTED",
    "MATCHING",
    "ENGINEER_SELECTED",
    "ENGINEER_ACCEPTED",
    "QUOTE_SENT",
    "QUOTE_REJECTED",
    "QUOTE_ACCEPTED",
    "CONFIRMED",
  ];
  const A = (TF.A = {});
  A.createRequest = (d) => {
    const me = TF.me();
    if (!me || me.role !== "customer") return fail("FORBIDDEN");
    if (
      !d.service ||
      !d.sub ||
      (d.desc || "").trim().length < 10 ||
      !(d.address || "").trim() ||
      !d.when ||
      !d.when.date ||
      !d.when.slot
    )
      return fail("VALIDATION");
    const id = "R-" + S.seq++;
    const r = {
      id,
      customerId: me.id,
      service: d.service,
      sub: d.sub,
      desc: d.desc.trim(),
      address: d.address.trim(),
      area: d.area || d.address.split("،").pop().trim(),
      notes: d.notes || "",
      lat: d.lat || 30.0382,
      lng: d.lng || 31.2118,
      when: d.when,
      status: "MATCHING",
      engineerId: null,
      rejectedBy: [],
      quotes: [],
      payment: null,
      rating: null,
      dispute: null,
      cancelReason: "",
      createdAt: Date.now(),
      events: [],
    };
    r.events.push(
      { t: Date.now(), st: "REQUESTED", text: "أرسلت الطلب" },
      {
        t: Date.now() + 1,
        st: "MATCHING",
        text: "رشحنا لك المهندسين المناسبين",
      },
    );
    S.requests.unshift(r);
    S.draft = null;
    return OK({ id });
  };
  A.chooseEngineer = (rid, eid) => {
    const { r, err } = guard(rid, "customer", ["MATCHING"]);
    if (err) return err;
    const e = S.engineers.find((x) => x.id === eid);
    const ok = e && TF.match(r).some((m) => m.e.id === eid);
    if (!ok) return fail("UNAVAILABLE");
    r.engineerId = eid;
    ev(r, "ENGINEER_SELECTED", "اخترت " + e.name);
    push(
      "e:" + eid,
      `طلب جديد: «${r.sub}» في ${r.area}. بانتظار ردك.`,
      "request.html?r=" + r.id,
    );
    return OK();
  };
  A.changeEngineer = (rid) => {
    const { r, err } = guard(rid, "customer", [
      "ENGINEER_SELECTED",
      "ENGINEER_ACCEPTED",
      "QUOTE_SENT",
      "QUOTE_REJECTED",
    ]);
    if (err) return err;
    const old = r.engineerId;
    r.quotes.forEach((x) => {
      if (x.status === "SENT") x.status = "WITHDRAWN";
    });
    r.engineerId = null;
    ev(r, "MATCHING", "اخترت تغيير المهندس");
    push("e:" + old, `سحب العميل طلب «${r.sub}».`, "requests.html");
    return OK();
  };
  A.engineerAccept = (rid) => {
    const { r, me, err } = guard(rid, "engineer", ["ENGINEER_SELECTED"]);
    if (err) return err;
    if (me.user.verification !== "VERIFIED") return fail("NOT_VERIFIED");
    if (me.user.account !== "ACTIVE") return fail("SUSPENDED");
    ev(r, "ENGINEER_ACCEPTED", "قبل " + me.user.name + " الطلب");
    push(
      "c:" + r.customerId,
      `قبل ${me.user.name} طلبك وسيرسل عرض السعر قريبا.`,
      "request.html?r=" + r.id,
    );
    return OK();
  };
  A.engineerReject = (rid, reason) => {
    const { r, me, err } = guard(rid, "engineer", ["ENGINEER_SELECTED"]);
    if (err) return err;
    r.rejectedBy.push(me.id);
    r.engineerId = null;
    ev(
      r,
      "MATCHING",
      "اعتذر " +
        me.user.name +
        " عن الطلب" +
        (reason ? " (" + reason + ")" : ""),
    );
    push(
      "c:" + r.customerId,
      `اعتذر ${me.user.name} عن تنفيذ طلبك. اختر مهندسًا آخر من القائمة.`,
      "matching.html?r=" + r.id,
    );
    return OK();
  };
  A.sendQuote = (rid, d, kind = "MAIN") => {
    const { r, me, err } = guard(
      rid,
      "engineer",
      kind === "MAIN"
        ? ["ENGINEER_ACCEPTED", "QUOTE_REJECTED"]
        : ["IN_PROGRESS"],
    );
    if (err) return err;
    const items = (d.items || []).map((i) => ({
      type: i.type,
      desc: (i.desc || "").trim(),
      qty: Number(i.qty),
      price: Number(i.price),
    }));
    if (
      !items.length ||
      items.some(
        (i) =>
          !i.desc || !(i.qty > 0) || !(i.price >= 0) || !ITEM_TYPES[i.type],
      ) ||
      !(d.duration || "").trim()
    )
      return fail("VALIDATION");
    if (kind === "ADDITIONAL" && pendingQuote(r)) return fail("PENDING_EXTRA");
    r.quotes
      .filter((x) => x.status === "SENT" && x.kind === "MAIN")
      .forEach((x) => (x.status = "REPLACED"));
    const qt = {
      id: "Q-" + r.id.slice(2) + String.fromCharCode(97 + r.quotes.length),
      kind,
      status: "SENT",
      items,
      duration: d.duration.trim(),
      notes: (d.notes || "").trim(),
      total: items.reduce((a, i) => a + i.qty * i.price, 0),
      at: Date.now(),
    };
    r.quotes.push(qt);
    if (kind === "MAIN") {
      ev(r, "QUOTE_SENT", "أرسل " + me.user.name + " عرض السعر");
      push(
        "c:" + r.customerId,
        `وصل عرض سعر من ${me.user.name} بقيمة ${moneyTxt(qt.total)}. راجعه واتخذ قرارك.`,
        "request.html?r=" + r.id,
      );
    } else {
      r.events.push({
        t: Date.now(),
        st: "IN_PROGRESS",
        text: "عرض سعر إضافي بقيمة " + moneyTxt(qt.total),
      });
      push(
        "c:" + r.customerId,
        `طلب المهندس إضافة بنود بقيمة ${moneyTxt(qt.total)}. وافق أو ارفض لمتابعة العمل.`,
        "request.html?r=" + r.id,
      );
    }
    return OK({ quote: qt });
  };
  A.rejectQuote = (rid, reason) => {
    const { r, err } = guard(rid, "customer", ["QUOTE_SENT", "IN_PROGRESS"]);
    if (err) return err;
    const qt = pendingQuote(r);
    if (!qt || (qt.kind === "ADDITIONAL") !== (r.status === "IN_PROGRESS"))
      return fail("INVALID_STATE");
    qt.status = "REJECTED";
    qt.reason = reason || "";
    if (qt.kind === "MAIN") {
      ev(r, "QUOTE_REJECTED", "رفضت عرض السعر");
      push(
        "e:" + r.engineerId,
        `رفض العميل عرض السعر لطلب «${r.sub}»${reason ? ": " + reason : ""}.`,
        "request.html?r=" + r.id,
      );
    } else {
      r.events.push({
        t: Date.now(),
        st: "IN_PROGRESS",
        text: "رفضت العرض الإضافي",
      });
      push(
        "e:" + r.engineerId,
        "رفض العميل العرض الإضافي. تابع العمل ضمن العرض الأصلي.",
        "request.html?r=" + r.id,
      );
    }
    return OK();
  };
  A.acceptQuote = (rid) => {
    const { r, err } = guard(rid, "customer", ["QUOTE_SENT", "IN_PROGRESS"]);
    if (err) return err;
    const qt = pendingQuote(r);
    if (!qt || (qt.kind === "ADDITIONAL") !== (r.status === "IN_PROGRESS"))
      return fail("INVALID_STATE");
    qt.status = "ACCEPTED";
    if (qt.kind === "MAIN") {
      ev(r, "QUOTE_ACCEPTED", "وافقت على عرض السعر");
      push(
        "e:" + r.engineerId,
        "وافق العميل على عرض السعر وسيختار طريقة الدفع.",
        "request.html?r=" + r.id,
      );
    } else {
      r.events.push({
        t: Date.now(),
        st: "IN_PROGRESS",
        text: "وافقت على العرض الإضافي",
      });
      push(
        "e:" + r.engineerId,
        "وافق العميل على العرض الإضافي. تابع التنفيذ.",
        "request.html?r=" + r.id,
      );
    }
    return OK();
  };
  A.payCash = (rid) => {
    const { r, err } = guard(rid, "customer", ["QUOTE_ACCEPTED"]);
    if (err) return err;
    r.payment = { method: "CASH", paid: 0, status: "UNPAID" };
    ev(r, "CONFIRMED", "اخترت الدفع نقدا — تم تأكيد الحجز");
    push(
      "e:" + r.engineerId,
      `تم تأكيد حجز «${r.sub}» (الدفع نقدا). أصبح العنوان ورقم العميل ظاهرين لك.`,
      "request.html?r=" + r.id,
    );
    return OK();
  };
  // الدفع الإلكتروني: عودة المتصفح من البوابة ليست إثباتًا. التأكيد يأتي فقط من إشعار البوابة (webhook).
  A.beginOnline = (rid) => {
    const { r, err } = guard(rid, "customer", ["QUOTE_ACCEPTED", "COMPLETED"]);
    if (err) return err;
    const due = r.status === "QUOTE_ACCEPTED" ? total(r) : payInfo(r).due;
    if (due <= 0) return fail("INVALID_STATE");
    r.payment = r.payment || { method: "ONLINE", paid: 0, status: "UNPAID" };
    r.payment.method = "ONLINE";
    r.payment.attempt = {
      ref: "PAY-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      amount: due,
      at: Date.now(),
    };
    return OK({ attempt: r.payment.attempt });
  };
  A.gatewayWebhook = (rid, ok) => {
    const r = find(rid);
    if (!r || !r.payment || !r.payment.attempt)
      return fail("PAYMENT_UNVERIFIED");
    const at = r.payment.attempt;
    r.payment.attempt = null;
    if (!ok) return OK({ paid: false });
    r.payment.paid += at.amount;
    r.payment.status = payInfo(r).state === "PAID" ? "PAID" : "UNPAID";
    r.payment.paidAt = Date.now();
    if (r.status === "QUOTE_ACCEPTED") {
      ev(r, "CONFIRMED", "تم الدفع إلكترونيا — تم تأكيد الحجز");
      push(
        "e:" + r.engineerId,
        `تم دفع ${moneyTxt(at.amount)} إلكترونيًا وتأكيد حجز «${r.sub}».`,
        "request.html?r=" + r.id,
      );
    } else {
      r.events.push({
        t: Date.now(),
        st: "COMPLETED",
        text: "سددت " + moneyTxt(at.amount) + " إلكترونيا",
      });
      push(
        "e:" + r.engineerId,
        `سدد العميل ${moneyTxt(at.amount)} إلكترونيا.`,
        "request.html?r=" + r.id,
      );
    }
    return OK({ paid: true });
  };
  const step = (from, to, text, notify) => (rid) => {
    const { r, me, err } = guard(rid, "engineer", from);
    if (err) return err;
    ev(r, to, text);
    if (notify)
      push(
        "c:" + r.customerId,
        notify.replace("{n}", me.user.name),
        "request.html?r=" + r.id,
      );
    return OK();
  };
  A.onTheWay = step(
    ["CONFIRMED"],
    "ON_THE_WAY",
    "انطلقت إلى العميل",
    "انطلق {n} إلى موقعك.",
  );
  A.arrived = step(
    ["ON_THE_WAY"],
    "ARRIVED",
    "وصلت إلى الموقع",
    "وصل {n} إلى موقعك.",
  );
  A.startWork = step(
    ["ARRIVED"],
    "IN_PROGRESS",
    "بدأت التنفيذ",
    "بدأ {n} تنفيذ العمل.",
  );
  A.finishWork = (rid) => {
    const { r, me, err } = guard(rid, "engineer", ["IN_PROGRESS"]);
    if (err) return err;
    if (pendingQuote(r)) return fail("PENDING_EXTRA");
    ev(r, "COMPLETION_PENDING", "أنهيت العمل");
    push(
      "c:" + r.customerId,
      `أنهى ${me.user.name} العمل. أكد الإنجاز بعد التأكد من النتيجة.`,
      "request.html?r=" + r.id,
    );
    return OK();
  };
  A.confirmCompletion = (rid) => {
    const { r, err } = guard(rid, "customer", ["COMPLETION_PENDING"]);
    if (err) return err;
    ev(r, "COMPLETED", "أكدت إنجاز العمل");
    push(
      "e:" + r.engineerId,
      payInfo(r).due > 0
        ? "أكد العميل الإنجاز. بانتظار السداد."
        : "أكد العميل الإنجاز.",
      "request.html?r=" + r.id,
    );
    return OK();
  };
  A.reportProblem = (rid, text) => {
    const { r, err } = guard(rid, "customer", ["COMPLETION_PENDING"]);
    if (err) return err;
    if ((text || "").trim().length < 5) return fail("VALIDATION");
    r.dispute = { text: text.trim(), at: Date.now() };
    r.events.push({
      t: Date.now(),
      st: "COMPLETION_PENDING",
      text: "أبلغت عن مشكلة في التنفيذ",
    });
    push("admin", `بلاغ مشكلة في الطلب ${r.id}.`, "requests.html?r=" + r.id);
    push(
      "e:" + r.engineerId,
      "أبلغ العميل عن ملاحظة على التنفيذ. تواصل معه لمعالجتها.",
      "request.html?r=" + r.id,
    );
    return OK();
  };
  A.confirmCash = (rid) => {
    const { r, err } = guard(rid, "engineer", ["COMPLETED"]);
    if (err) return err;
    const p = payInfo(r);
    if (!r.payment || r.payment.method !== "CASH" || p.due <= 0)
      return fail("INVALID_STATE");
    r.payment.paid = p.total;
    r.payment.status = "PAID";
    r.payment.paidAt = Date.now();
    r.events.push({
      t: Date.now(),
      st: "COMPLETED",
      text: "أكد المهندس استلام " + moneyTxt(p.total) + " نقدا",
    });
    push(
      "c:" + r.customerId,
      "أكد المهندس استلام المبلغ. يمكنك الآن تقييم الخدمة.",
      "request.html?r=" + r.id,
    );
    return OK();
  };
  A.rate = (rid, stars, text) => {
    const { r, me, err } = guard(rid, "customer", ["COMPLETED"]);
    if (err) return err;
    if (payInfo(r).state !== "PAID") return fail("INVALID_STATE");
    if (!(stars >= 1 && stars <= 5)) return fail("VALIDATION");
    r.rating = { stars, text: (text || "").trim(), at: Date.now() };
    ev(r, "RATED", "قيمت المهندس");
    const e = eng(r);
    e.rating =
      Math.round(((e.rating * e.reviews + stars) / (e.reviews + 1)) * 10) / 10;
    e.reviews++;
    e.jobs++;
    S.reviews.unshift({
      eid: e.id,
      name:
        firstName(me.user.name) +
        " " +
        [...(me.user.name.split(" ")[1] || "")][0] +
        ".",
      stars,
      text: r.rating.text,
      t: Date.now(),
    });
    push(
      "e:" + e.id,
      `قيّمك ${firstName(me.user.name)} بـ ${stars} من 5.`,
      "request.html?r=" + r.id,
    );
    return OK();
  };
  A.cancel = (rid, reason) => {
    const { r, err } = guard(rid, "customer", CANCELLABLE);
    if (err) return err;
    r.cancelReason = reason || "";
    const e = r.engineerId;
    ev(r, "CANCELLED", "ألغيت الطلب");
    if (e) push("e:" + e, `ألغى العميل طلب «${r.sub}».`, "requests.html");
    return OK();
  };
  A.adminCancel = (rid, reason) => {
    const me = TF.me();
    if (!me || me.role !== "admin") return fail("FORBIDDEN");
    const r = find(rid);
    if (!r) return fail("NOT_FOUND");
    if (!CANCELLABLE.includes(r.status)) return fail("INVALID_STATE");
    r.cancelReason = reason || "إلغاء من الإدارة";
    ev(r, "CANCELLED", "ألغت الإدارة الطلب");
    push(
      "c:" + r.customerId,
      `ألغت الإدارة طلبك ${r.id}.`,
      "request.html?r=" + r.id,
    );
    if (r.engineerId)
      push("e:" + r.engineerId, `ألغت الإدارة الطلب ${r.id}.`, "requests.html");
    return OK();
  };
  A.setAvailability = (v) => {
    const me = TF.me();
    if (!me || me.role !== "engineer") return fail("FORBIDDEN");
    if (me.user.verification !== "VERIFIED") return fail("NOT_VERIFIED");
    me.user.availability = v;
    return OK();
  };
  A.verify = (eid, ok, reason) => {
    const me = TF.me();
    if (!me || me.role !== "admin") return fail("FORBIDDEN");
    const e = S.engineers.find((x) => x.id === eid);
    if (!e || e.verification !== "PENDING") return fail("INVALID_STATE");
    e.verification = ok ? "VERIFIED" : "REJECTED";
    e.rejectReason = ok ? "" : reason || "";
    push(
      "e:" + eid,
      ok
        ? "تم توثيق حسابك. يمكنك الآن استقبال الطلبات."
        : "لم نتمكن من توثيق حسابك" + (reason ? ": " + reason : "") + ".",
      "profile.html",
    );
    return OK();
  };
  A.setAccount = (eid, v) => {
    const me = TF.me();
    if (!me || me.role !== "admin") return fail("FORBIDDEN");
    const e = S.engineers.find((x) => x.id === eid);
    if (!e) return fail("NOT_FOUND");
    e.account = v;
    if (v === "SUSPENDED") e.availability = "OFFLINE";
    return OK();
  };
  A.saveSettings = (patch) => {
    const me = TF.me();
    if (!me || me.role !== "admin") return fail("FORBIDDEN");
    if (
      patch.weights &&
      Object.values(patch.weights).reduce((a, b) => a + b, 0) !== 100
    )
      return { ok: false, msg: "مجموع الأوزان يجب أن يساوي 100%." };
    Object.assign(S.settings, patch);
    return OK();
  };
  A.register = (d) => {
    const email = (d.email || "").trim().toLowerCase();
    if (!d.name || !email || !d.phone || (d.password || "").length < 8)
      return fail("VALIDATION");
    if (USERS().some((u) => u.email.toLowerCase() === email))
      return {
        ok: false,
        msg: "هذا البريد الإلكتروني مسجل بالفعل. سجل الدخول بدلا من إنشاء حساب جديد.",
      };
    if (d.role === "engineer") {
      if (!d.services || !d.services.length)
        return { ok: false, msg: "اختر تخصصا واحدا على الأقل." };
      const id = "e" + (S.engineers.length + 1);
      S.engineers.push({
        id,
        name: d.name.trim(),
        email,
        password: d.password,
        phone: d.phone,
        bio: "",
        services: d.services,
        subs: null,
        years: Number(d.years) || 1,
        rating: 0,
        reviews: 0,
        jobs: 0,
        lat: 30.04,
        lng: 31.21,
        area: d.area || "القاهرة",
        radius: 15,
        verification: "PENDING",
        account: "ACTIVE",
        availability: "OFFLINE",
        hasShop: !!d.hasShop,
        shop: d.shop || "",
        docs: [
          { k: "الهوية الشخصية", ok: false },
          { k: "شهادة أو خبرة موثقة", ok: false },
        ],
      });
      S.session = { role: "engineer", id };
      push(
        "admin",
        `مهندس جديد بانتظار التوثيق: ${d.name.trim()}.`,
        "engineers.html",
      );
    } else {
      const id = "c" + (S.customers.length + 1);
      S.customers.push({
        id,
        name: d.name.trim(),
        email,
        password: d.password,
        phone: d.phone,
        addresses: [],
      });
      S.session = { role: "customer", id };
    }
    return OK({ role: d.role });
  };

  /* ----------------------------------------------- الإشعارات (حسب المستخدم) */
  TF.notifs = () => {
    const m = TF.me();
    if (!m) return [];
    const key =
      m.role === "admin"
        ? "admin"
        : (m.role === "customer" ? "c:" : "e:") + m.id;
    const legacy = m.role === "admin" ? "admin" : m.id;
    return S.notifs.filter((n) => n.to === key || n.to === legacy);
  };
  TF.markRead = () => {
    TF.notifs().forEach((n) => (n.read = true));
    save();
  };

  /* -------------------------------------------- مساعدات خاصة بالأدوار */
  const NEED = {
    customer: (r) =>
      [
        "MATCHING",
        "QUOTE_SENT",
        "QUOTE_ACCEPTED",
        "COMPLETION_PENDING",
      ].includes(r.status) ||
      (r.status === "IN_PROGRESS" && !!pendingQuote(r)) ||
      (r.status === "COMPLETED" && !r.rating),
    engineer: (r) =>
      [
        "ENGINEER_SELECTED",
        "ENGINEER_ACCEPTED",
        "QUOTE_REJECTED",
        "CONFIRMED",
        "ON_THE_WAY",
        "ARRIVED",
        "IN_PROGRESS",
      ].includes(r.status) ||
      (r.status === "COMPLETED" &&
        payInfo(r).due > 0 &&
        r.payment &&
        r.payment.method === "CASH"),
  };
  TF.needs = NEED;
  TF.myRequests = () => {
    const m = TF.me();
    if (!m) return [];
    return S.requests
      .filter((r) =>
        m.role === "customer"
          ? r.customerId === m.id
          : m.role === "engineer"
            ? r.engineerId === m.id
            : true,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  };
  const DONE = ["RATED", "CANCELLED"];
  TF.isOpen = (r) => !DONE.includes(r.status);
  TF.cancellable = (r) => CANCELLABLE.includes(r.status);

  /* ------------------------------------------------------- واجهة المستخدم */
  const U = (TF.ui = {});
  U.toast = (msg, kind = "") => {
    let box = $(".toasts");
    if (!box) {
      box = document.createElement("div");
      box.className = "toasts";
      box.setAttribute("role", "status");
      document.body.appendChild(box);
    }
    const t = document.createElement("div");
    t.className = "toast " + (kind ? "toast--" + kind : "");
    t.innerHTML =
      ic(kind === "bad" ? "circle-alert" : "circle-check") +
      "<span>" +
      esc(msg) +
      "</span>";
    box.appendChild(t);
    setTimeout(() => t.remove(), 3800);
  };
  U.sheet = (html, opt = {}) => {
    U.close();
    const s = document.createElement("div");
    s.className = "scrim";
    s.id = "sheet";
    s.innerHTML = `<div class="sheet ${opt.wide ? "sheet--wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(opt.title || "")}">${html}</div>`;
    s.addEventListener("click", (e) => {
      if (e.target === s) U.close();
    });
    document.body.appendChild(s);
    const f = $("input,textarea,select,button.btn", s);
    if (f && opt.focus !== false) f.focus();
    return s;
  };
  U.close = () => {
    const s = $("#sheet");
    if (s) s.remove();
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") U.close();
  });
  U.head = (title) =>
    `<div class="sheet__head"><h3>${esc(title)}</h3><button class="iconbtn" data-act="close" aria-label="إغلاق">${ic("x")}</button></div>`;
  U.confirm = ({
    title,
    body,
    ok = "تأكيد",
    danger = false,
    cancel = "رجوع",
    extra = "",
  }) =>
    new Promise((res) => {
      const s = U.sheet(
        `${U.head(title)}<p class="muted">${body}</p>${extra}<div class="row end mt" style="flex-wrap:wrap"><button class="btn btn--ghost" data-r="0">${esc(cancel)}</button><button class="btn ${danger ? "btn--danger" : "btn--primary"}" data-r="1">${esc(ok)}</button></div>`,
        { title },
      );
      s.addEventListener("click", (e) => {
        const b = e.target.closest("[data-r]");
        if (b) {
          const v =
            b.dataset.r === "1"
              ? { ok: true, val: ($("textarea,select", s) || {}).value }
              : null;
          U.close();
          res(v);
        }
        if (e.target.closest("[data-act=close]")) res(null);
      });
    });
  // نتيجة إجراء: نجاح برسالة، أو رسالة خطأ مفهومة (لا رموز أخطاء)
  U.done = (res, okMsg, then) => {
    if (res && res.ok) {
      if (okMsg) U.toast(okMsg, "ok");
      TF.refresh();
      if (then) then(res);
    } else U.toast((res && res.msg) || ERR.INVALID_STATE, "bad");
    return res;
  };
  U.empty = (icon, title, body, cta = "") =>
    `<div class="empty">${ic(icon)}<h3>${esc(title)}</h3><p class="muted sm">${body}</p>${cta}</div>`;
  U.stateBlock = (kind, msg) =>
    kind === "loading"
      ? `<div class="empty" aria-busy="true">${ic("refresh-cw")}<p>${esc(msg || "جار التحميل…")}</p></div>`
      : "";

  /* ---------------------------------------------------- المسار الزمني */
  TF.rail = (r, role) => {
    const cur = r.status === "CANCELLED" ? -1 : stageOf(r.status);
    const done = r.status === "RATED";
    return `<ol class="rail">${STAGES.map((s, i) => {
      const cls = done || i < cur ? "done" : i === cur ? "now" : "";
      const last = [...r.events].reverse().find((e) => stageOf(e.st) === i);
      const sub = cls
        ? i === cur && !done
          ? statusText(r.status, role)
          : last
            ? last.text
            : ""
        : "";
      return `<li class="${cls}"><span class="dot">${cls === "done" ? ic("check") : ""}</span><strong>${s[0]}</strong>${sub ? `<small>${esc(sub)}${last && cls ? " · " + when(last.t) : ""}</small>` : ""}</li>`;
    }).join("")}</ol>`;
  };
  TF.seg = (r) => {
    const cur = r.status === "CANCELLED" ? -1 : stageOf(r.status);
    return `<div class="seg" aria-hidden="true">${STAGES.map((s, i) => `<i class="${r.status === "RATED" || i < cur ? "done" : i === cur ? "now" : ""}"></i>`).join("")}</div>`;
  };
  TF.whenText = (w) => `${dayLabel(w.date)} · ${SLOTS[w.slot]}`;
  TF.quoteTable = (qt) =>
    `<div class="tablewrap"><table class="table items"><thead><tr><th>البند</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${qt.items.map((i) => `<tr><td>${esc(i.desc)}<div class="muted xs" style="font-weight:400">${ITEM_TYPES[i.type]}</div></td><td class="num">${num(i.qty)}</td><td class="num">${num(i.price)}</td><td class="num">${num(i.qty * i.price)}</td></tr>`).join("")}<tr class="sum"><td colspan="3">إجمالي ${qt.kind === "ADDITIONAL" ? "العرض الإضافي" : "عرض السعر"}</td><td class="num">${num(qt.total)} ج.م</td></tr></tbody></table></div>`;
  TF.reqCard = (r, role) => {
    const sv = SERVICES[r.service],
      e = eng(r),
      c = S.customers.find((x) => x.id === r.customerId);
    const who =
      role === "customer"
        ? e
          ? `<span class="row" style="gap:6px">${ic("user")} ${esc(e.name)}</span>`
          : '<span class="muted">لم يختر مهندس بعد</span>'
        : `<span class="row" style="gap:6px">${ic("user")} ${esc(firstName(c.name))} — ${esc(r.area)}</span>`;
    const need = NEED[role] && NEED[role](r);
    return `<a class="card card--link" href="request.html?r=${r.id}"><div class="row row--top"><span class="chip chip--brand" style="padding:8px">${ic(sv.icon)}</span><div class="grow"><div class="row between"><h4>${esc(r.sub)}</h4>${chip(r.status, role)}</div><div class="muted xs">${sv.name} · رقم ${r.id}</div></div></div><div class="mt">${TF.seg(r)}</div><div class="row between row--wrap mt sm"><span class="muted">${who}</span><span class="muted row" style="gap:6px">${ic("calendar")} ${TF.whenText(r.when)}</span></div>${need ? `<div class="sm mt bold" style="color:var(--accent-text,#A93F00)">${ic("circle-alert")} يحتاج إجراء منك</div>` : ""}</a>`;
  };

  /* ---------------------------------------------------------- هيكل الصفحة */
  const NAV = {
    customer: [
      ["home", "الرئيسية", "house"],
      ["requests", "طلباتي", "clipboard-list"],
      ["new-request", "طلب جديد", "plus"],
      ["notifications", "الإشعارات", "bell"],
      ["profile", "حسابي", "user"],
    ],
    engineer: [
      ["home", "لوحتي", "layout-dashboard"],
      ["requests", "الطلبات", "clipboard-list"],
      ["earnings", "الأرباح", "wallet"],
      ["notifications", "الإشعارات", "bell"],
      ["profile", "ملفي", "user"],
    ],
    admin: [
      ["home", "نظرة عامة", "layout-dashboard"],
      ["engineers", "المهندسون", "users"],
      ["requests", "الطلبات", "clipboard-list"],
      ["matching", "الترشيح والخدمات", "sliders-horizontal"],
      ["finance", "الماليات", "wallet"],
    ],
  };
  const THEME = "tf.theme";
  const theme = () => {
    try {
      return localStorage.getItem(THEME) || "light";
    } catch (e) {
      return "light";
    }
  };
  const applyTheme = (t) => {
    document.documentElement.setAttribute("data-theme", t);
  };
  TF.toggleTheme = () => {
    const t = theme() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME, t);
    } catch (e) {}
    applyTheme(t);
    TF.refresh();
  };
  const badge = (role, page) => {
    const m = TF.me();
    if (!m) return 0;
    if (page === "notifications")
      return TF.notifs().filter((n) => !n.read).length;
    if (page === "requests" && role !== "admin")
      return TF.myRequests().filter(NEED[role]).length;
    if (page === "engineers" && role === "admin")
      return S.engineers.filter((e) => e.verification === "PENDING").length;
    if (page === "requests" && role === "admin")
      return S.requests.filter((r) => r.dispute).length;
    return 0;
  };
  function shell(role, page, title) {
    const m = TF.me();
    const nav = NAV[role];
    const cls = {
      customer: "app--cust",
      engineer: "app--eng",
      admin: "app--adm",
    }[role];
    const link = ([p, t, i]) => {
      const b = badge(role, p);
      return [p, t, i, b];
    };
    const items = nav.map(link);
    const sub = { customer: "العميل", engineer: "المهندس", admin: "المشرف" }[
      role
    ];
    const bell =
      role !== "admin"
        ? `<a class="iconbtn" href="notifications.html" aria-label="الإشعارات">${ic("bell")}${badge(role, "notifications") ? `<span class="dot">${badge(role, "notifications")}</span>` : ""}</a>`
        : "";
    return `<div class="app ${cls}">
      <aside class="side" aria-label="القائمة الرئيسية">
        <div class="side__brand"><a class="brandmark" href="home.html"><img src="${TF.root}assets/brand/logo-app.png" alt=""><span>Tech<b>Fix</b></span></a></div>
        <nav>${items.map(([p, t, i, b]) => `<a class="nav" href="${p}.html" ${p === page ? 'aria-current="page"' : ""}>${ic(i)}<span>${t}</span>${b ? `<span class="count">${b}</span>` : ""}</a>`).join("")}
          <div class="side__group">المنصة</div>
          <a class="nav" href="${TF.root}index.html">${ic("globe")}<span>الموقع العام</span></a>
          <a class="nav" href="${TF.root}guide.html">${ic("map")}<span>خريطة الصفحات</span></a>
        </nav>
        <div class="side__foot">${avatar(m.user.name, "avatar--sm")}<div class="grow"><b class="truncate">${esc(m.user.name)}</b><small>${sub}</small></div><button class="iconbtn" data-act="theme" aria-label="تبديل المظهر">${ic(theme() === "dark" ? "sun" : "moon")}</button><button class="iconbtn" data-act="logout" aria-label="تسجيل الخروج">${ic("log-out")}</button></div>
      </aside>
      <div style="min-width:0"><header class="top"><a class="brandmark" href="home.html"><img src="${TF.root}assets/brand/logo-app.png" alt=""><span>Tech<b>Fix</b></span></a><h1 class="top__title" style="font-size:16px">${esc(title || "")}</h1><span class="grow"></span>${bell}<button class="iconbtn" data-act="theme" aria-label="تبديل المظهر">${ic(theme() === "dark" ? "sun" : "moon")}</button><button class="iconbtn" data-act="logout" aria-label="تسجيل الخروج">${ic("log-out")}</button></header>
      <main class="view ${role === "admin" ? "view--wide" : ""}" id="view"></main></div>
      <nav class="tabbar" aria-label="التنقل">${items.map(([p, t, i, b]) => `<a class="tab" href="${p}.html" ${p === page ? 'aria-current="page"' : ""}>${ic(i)}<span>${t}</span>${b && p !== "notifications" ? `<span class="count">${b}</span>` : b ? `<span class="count">${b}</span>` : ""}</a>`).join("")}</nav>
    </div>`;
  }
  const handlers = {};
  TF.on = (name, fn) => {
    handlers[name] = fn;
  };
  let PAGE = null,
    ctx = null;
  TF.refresh = () => {
    if (!PAGE) return;
    const keep = document.activeElement && document.activeElement.id;
    const sc = window.scrollY;
    mount();
    window.scrollTo(0, sc);
    if (keep) {
      const e = document.getElementById(keep);
      if (e) e.focus();
    }
  };
  function demoBar() {
    if ($(".demobar")) $(".demobar").remove();
    try {
      if (localStorage.getItem("tf.demo.hide") === "1") return;
    } catch (e) {}
    const m = TF.me(),
      cur = m ? m.role : "";
    const b = document.createElement("div");
    b.className = "demobar no-print";
    b.setAttribute("role", "group");
    b.setAttribute("aria-label", "أدوات العرض التجريبي");
    b.innerHTML = `<b>عرض تجريبي</b>${[
      ["customer", "عميل"],
      ["engineer", "مهندس"],
      ["admin", "مشرف"],
    ]
      .map(
        ([r, t]) =>
          `<button data-act="demo-role" data-role="${r}" ${cur === r ? 'style="background:var(--accent);color:var(--accent-ink)"' : ""}>${t}</button>`,
      )
      .join(
        "",
      )}<button data-act="demo-reset">إعادة الضبط</button><button data-act="demo-hide" aria-label="إخفاء">${ic("x")}</button>`;
    document.body.appendChild(b);
  }
  function mount() {
    const m = TF.me();
    if (PAGE.app) {
      if (!m || m.role !== PAGE.app) {
        location.replace(
          TF.root +
            "login.html?next=" +
            encodeURIComponent(
              location.pathname.split("/").slice(-2).join("/") +
                location.search,
            ),
        );
        return;
      }
    }
    ctx = { q: new URLSearchParams(location.search), me: m, S };
    const out = PAGE.render(ctx);
    if (out && out.redirect) {
      location.replace(out.redirect);
      return;
    }
    const host = $("#app");
    if (PAGE.app) {
      if (!host.firstChild || host.dataset.shell !== PAGE.page) {
        host.innerHTML = shell(PAGE.app, PAGE.page, PAGE.title);
        host.dataset.shell = PAGE.page;
      } else {
        /* تحديث الشارات فقط */ host.innerHTML = shell(
          PAGE.app,
          PAGE.page,
          PAGE.title,
        );
      }
      $("#view").innerHTML = out.html || out;
    } else host.innerHTML = out.html || out;
    document.title = (PAGE.title ? PAGE.title + " — " : "") + "TechFix";
    if (PAGE.after) PAGE.after(ctx);
    demoBar();
  }
  TF.page = (def) => {
    PAGE = def;
    TF.root = document.body.dataset.root || "";
    TF.init();
    applyTheme(theme());
    const inject = () => {
      if (!$("#tf-icons")) {
        const d = document.createElement("div");
        d.id = "tf-icons";
        d.innerHTML = window.TF_ICONS;
        document.body.prepend(d);
      }
    };
    inject();
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    mount();
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) {
        S = read() || S;
        TF.S = S;
        TF.refresh();
      }
    });
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-act]");
      if (!el) return;
      const name = el.dataset.act;
      const fn = handlers[name];
      if (fn) {
        if (el.tagName === "A" && !el.getAttribute("href")) e.preventDefault();
        fn(el, e, ctx);
      }
    });
    document.addEventListener("submit", (e) => {
      const f = e.target.closest("[data-form]");
      if (!f) return;
      e.preventDefault();
      const fn = handlers["form:" + f.dataset.form];
      if (fn) fn(f, e, ctx);
    });
    document.addEventListener("input", (e) => {
      const f = e.target.closest("[data-live]");
      if (f) {
        const fn = handlers["live:" + f.dataset.live];
        if (fn) fn(e.target, e, ctx);
      }
    });
    document.addEventListener("change", (e) => {
      const f = e.target.closest("[data-change]");
      if (f) {
        const fn = handlers["change:" + f.dataset.change];
        if (fn) fn(e.target, e, ctx);
      }
    });
  };
  // أوامر عامة
  TF.on("close", () => U.close());
  TF.on("theme", () => TF.toggleTheme());
  TF.on("logout", () => TF.logout());
  TF.on("demo-role", (el) => TF.switchTo(el.dataset.role));
  TF.on("demo-reset", () => {
    TF.reset();
    location.href = TF.home((TF.me() || { role: "customer" }).role);
  });
  TF.on("demo-hide", () => {
    try {
      localStorage.setItem("tf.demo.hide", "1");
    } catch (e) {}
    $(".demobar").remove();
  });
})();
