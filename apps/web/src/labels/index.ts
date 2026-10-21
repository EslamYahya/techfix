import type { components } from '@techfix/contracts';

/** Arabic labels. The API returns codes only; every visible sentence lives here. */
type Tone = 'info' | 'warn' | 'ok' | 'bad' | 'live';
export type Role = 'customer' | 'engineer' | 'admin';

export const STATUS: Record<string, readonly [customer: string, engineer: string, tone: Tone]> = {
  REQUESTED: ['تم إرسال الطلب', 'تم إرسال الطلب', 'info'],
  MATCHING: ['اختر المهندس المناسب', 'بانتظار اختيار العميل', 'warn'],
  ENGINEER_SELECTED: ['بانتظار رد المهندس', 'طلب جديد بانتظار ردّك', 'warn'],
  ENGINEER_ACCEPTED: ['بانتظار عرض السعر', 'جهّز عرض السعر', 'info'],
  QUOTE_SENT: ['عرض السعر جاهز للمراجعة', 'بانتظار موافقة العميل', 'warn'],
  QUOTE_REJECTED: ['رفضت عرض السعر', 'رفض العميل العرض', 'bad'],
  QUOTE_ACCEPTED: ['اختر طريقة الدفع', 'العميل يختار طريقة الدفع', 'warn'],
  CONFIRMED: ['تم تأكيد الحجز', 'جاهز للانطلاق', 'ok'],
  ON_THE_WAY: ['المهندس في الطريق', 'في الطريق إلى العميل', 'live'],
  ARRIVED: ['المهندس وصل', 'وصلت إلى الموقع', 'live'],
  IN_PROGRESS: ['جارٍ التنفيذ', 'جارٍ التنفيذ', 'live'],
  COMPLETION_PENDING: ['بانتظار تأكيدك للإنجاز', 'بانتظار تأكيد العميل', 'warn'],
  COMPLETED: ['تم الإنجاز', 'تم الإنجاز', 'ok'],
  RATED: ['تم التقييم', 'تم التقييم', 'ok'],
  CANCELLED: ['ملغي', 'ملغي', 'bad'],
};

export const ADMIN_STATUS: Record<string, string> = {
  REQUESTED: 'جديد',
  MATCHING: 'بانتظار اختيار العميل',
  ENGINEER_SELECTED: 'بانتظار رد المهندس',
  ENGINEER_ACCEPTED: 'بانتظار عرض السعر',
  QUOTE_SENT: 'بانتظار رد العميل على العرض',
  QUOTE_REJECTED: 'العرض مرفوض',
  QUOTE_ACCEPTED: 'بانتظار اختيار طريقة الدفع',
  CONFIRMED: 'محجوز',
  ON_THE_WAY: 'المهندس في الطريق',
  ARRIVED: 'المهندس في الموقع',
  IN_PROGRESS: 'قيد التنفيذ',
  COMPLETION_PENDING: 'بانتظار تأكيد العميل',
  COMPLETED: 'مكتمل',
  RATED: 'مكتمل ومُقيَّم',
  CANCELLED: 'ملغي',
};

export function statusText(status: string, role: Role): string {
  if (role === 'admin') return ADMIN_STATUS[status] ?? '—';
  const row = STATUS[status];
  return row ? row[role === 'customer' ? 0 : 1] : '—';
}

export type ErrorCode = components['schemas']['ErrorCode'];

export const ERRORS: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'راجع الحقول المطلوبة وحاول مرة أخرى.',
  UNAUTHORIZED: 'سجّل الدخول للمتابعة.',
  FORBIDDEN: 'لا تملك صلاحية تنفيذ هذا الإجراء.',
  NOT_FOUND: 'لم نجد هذا الطلب. قد يكون محذوفًا أو غير تابع لحسابك.',
  INVALID_STATE_TRANSITION:
    'لا يمكن تنفيذ هذا الإجراء في المرحلة الحالية من الطلب. حدّث الصفحة وحاول مرة أخرى.',
  PENDING_ADDITIONAL_QUOTE: 'يوجد عرض سعر إضافي بانتظار رد العميل. انتظر قراره قبل إنهاء العمل.',
  ENGINEER_NOT_ELIGIBLE: 'هذا المهندس لم يعد متاحًا. اختر مهندسًا آخر من القائمة.',
  ENGINEER_NOT_VERIFIED: 'حسابك قيد المراجعة. ستتلقى طلبات بعد توثيقه من الإدارة.',
  ACCOUNT_SUSPENDED: 'هذا الحساب موقوف حاليًا.',
  PAYMENT_NOT_VERIFIED:
    'لم نتلقَّ تأكيد الدفع من بوابة الدفع بعد. إن خُصم المبلغ فسيتحدّث الطلب تلقائيًا خلال دقائق.',
  IDEMPOTENCY_CONFLICT: 'تم تنفيذ هذا الإجراء من قبل. حدّث الصفحة.',
  CONFLICT: 'تغيّرت بيانات الطلب أثناء عملك. حدّث الصفحة وحاول مرة أخرى.',
  RATE_LIMITED: 'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.',
  INTERNAL: 'حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل.',
  UNAVAILABLE: 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.',
};

export const errorText = (code: string | undefined): string =>
  (code && (ERRORS as Record<string, string>)[code]) || ERRORS.INTERNAL;

export const VERIFICATION: Record<string, readonly [label: string, tone: Tone]> = {
  PENDING: ['قيد المراجعة', 'warn'],
  VERIFIED: ['موثّق', 'ok'],
  REJECTED: ['مرفوض', 'bad'],
};

export const ACCOUNT: Record<string, readonly [label: string, tone: Tone]> = {
  ACTIVE: ['نشط', 'ok'],
  SUSPENDED: ['موقوف', 'bad'],
  PENDING: ['بانتظار التفعيل', 'warn'],
};

export const AVAILABILITY: Record<string, string> = {
  AVAILABLE: 'متاح لاستقبال الطلبات',
  BUSY: 'مشغول',
  OFFLINE: 'غير متاح',
};

export const DOC_KIND: Record<string, string> = {
  NATIONAL_ID: 'بطاقة الرقم القومي',
  CERTIFICATE: 'شهادة',
  CRAFT_LICENSE: 'رخصة مهنة',
  OTHER: 'مستند آخر',
};

export const ROLE: Record<string, string> = { CUSTOMER: 'عميل', ENGINEER: 'مهندس', ADMIN: 'مشرف' };

/** Field-level wording for validation details ({ field, code } from the API). */
const FIELD_MESSAGES: Record<string, string> = {
  phone: 'اكتب رقم هاتف مصري صحيحًا، مثل 01012345678.',
  'password:too_small': 'كلمة المرور 8 أحرف على الأقل.',
  'password:too_big': 'كلمة المرور طويلة جدًا.',
  name: 'اكتب اسمك (حرفان على الأقل).',
  email: 'اكتب بريدًا إلكترونيًا صحيحًا.',
  'latitude:out_of_area': 'هذا الموقع خارج نطاق الخدمة الحالي.',
  reason: 'اكتب سببًا واضحًا للرفض.',
  serviceRadiusKm: 'نطاق الخدمة بين 1 و100 كم.',
  description: 'اشرح المشكلة في 10 أحرف على الأقل.',
  preferredDate: 'اختر تاريخًا من اليوم فصاعدًا.',
  preferredEndTime: 'وقت النهاية يجب أن يكون بعد وقت البداية.',
  'location:out_of_area': 'هذا الموقع خارج نطاق الخدمة الحالي.',
  location: 'اختر منطقتك واكتب العنوان.',
  serviceId: 'اختر الخدمة المطلوبة.',
  items: 'أضف بندًا واحدًا على الأقل بسعر وكمية صحيحين.',
  estimatedDurationMinutes: 'اكتب المدة المتوقعة بالدقائق.',
  'amount:too_big': 'المبلغ أكبر من المتبقي القابل للرد.',
  amount: 'اكتب مبلغًا صحيحًا.',
  resolution: 'اكتب قرارك في 5 أحرف على الأقل.',
  slots: 'تأكد من أن المواعيد لا تتداخل وأن وقت البداية قبل النهاية.',
};

export function fieldMessage(field: string, code: string): string | undefined {
  return FIELD_MESSAGES[`${field}:${code}`] ?? FIELD_MESSAGES[field];
}

export const DAYS = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const;

export const UI = {
  login: 'تسجيل الدخول',
  register: 'إنشاء حساب',
  logout: 'تسجيل الخروج',
  phoneOrEmail: 'رقم الهاتف أو البريد الإلكتروني',
  password: 'كلمة المرور',
  name: 'الاسم',
  phone: 'رقم الهاتف',
  emailOptional: 'البريد الإلكتروني (اختياري)',
  iAm: 'أنا',
  customer: 'عميل أحتاج خدمة',
  engineer: 'مهندس أقدّم خدمة',
  experience: 'سنوات الخبرة',
  hasShop: 'لدي محل أو ورشة',
  chooseServices: 'اختر خدماتك',
  save: 'حفظ',
  saving: 'جارٍ الحفظ…',
  loading: 'جارٍ التحميل…',
  retry: 'حاول مرة أخرى',
  noAccount: 'ليس لديك حساب؟',
  haveAccount: 'لديك حساب بالفعل؟',
} as const;

export const SLOT: Record<string, string> = {
  MORNING: 'صباحًا (9–12)',
  NOON: 'ظهرًا (12–4)',
  EVENING: 'مساءً (4–8)',
};

export const REASON: Record<string, string> = {
  NEARBY: 'قريب منك',
  TOP_RATED: 'تقييم ممتاز',
  AVAILABLE_NOW: 'متاح الآن',
  EXPERIENCED: 'خبرة طويلة',
};

/** Coarse service areas with a centre point; a map picker replaces this later. */
export const AREAS = [
  { name: 'وسط القاهرة', latitude: 30.0444, longitude: 31.2357 },
  { name: 'الدقي والمهندسين', latitude: 30.0386, longitude: 31.2123 },
  { name: 'مدينة نصر', latitude: 30.0561, longitude: 31.3301 },
  { name: 'مصر الجديدة', latitude: 30.0875, longitude: 31.3225 },
  { name: 'المعادي', latitude: 29.9602, longitude: 31.2569 },
  { name: 'الجيزة', latitude: 30.0131, longitude: 31.2089 },
  { name: 'الإسكندرية', latitude: 31.2001, longitude: 29.9187 },
] as const;

export const REQ_UI = {
  myRequests: 'طلباتي',
  newRequest: 'طلب خدمة جديد',
  noRequests: 'لا توجد طلبات بعد. ابدأ بطلب خدمة جديد.',
  service: 'الخدمة',
  problem: 'اشرح المشكلة',
  date: 'التاريخ المناسب',
  slot: 'الفترة المناسبة',
  area: 'المنطقة',
  address: 'العنوان بالتفصيل',
  submit: 'أرسل الطلب',
  submitting: 'جارٍ الإرسال…',
  chooseEngineer: 'اختر المهندس المناسب',
  noEngineers: 'لا يوجد مهندسون متاحون الآن في منطقتك. جرّب لاحقًا أو غيّر الموعد.',
  select: 'اختر هذا المهندس',
  changeEngineer: 'اختيار مهندس آخر',
  cancel: 'إلغاء الطلب',
  accept: 'قبول الطلب',
  reject: 'اعتذار',
  timeline: 'مراحل الطلب',
  inbox: 'الطلبات الواردة',
  noInbox: 'لا توجد طلبات واردة الآن.',
  back: 'رجوع',
} as const;

export const TIMELINE: Record<string, string> = {
  REQUEST_CREATED: 'تم إرسال الطلب',
  ENGINEER_SELECTED: 'تم اختيار مهندس',
  ENGINEER_ACCEPTED: 'قبل المهندس الطلب',
  ENGINEER_REJECTED: 'اعتذر المهندس',
  ENGINEER_CHANGED: 'اخترت مهندسًا آخر',
  REQUEST_CANCELLED: 'تم إلغاء الطلب',
  REQUEST_CANCELLED_BY_ADMIN: 'ألغت الإدارة الطلب',
  QUOTE_SENT: 'وصل عرض السعر',
  QUOTE_ACCEPTED: 'تمت الموافقة على عرض السعر',
  QUOTE_REJECTED: 'تم رفض عرض السعر',
  BOOKING_CONFIRMED: 'تم تأكيد الحجز',
  TRIP_STARTED: 'المهندس في الطريق',
  ARRIVED: 'وصل المهندس إلى الموقع',
  JOB_STARTED: 'بدأ تنفيذ العمل',
  JOB_COMPLETED: 'أنهى المهندس العمل',
  COMPLETION_CONFIRMED: 'تم تأكيد الإنجاز',
  REVIEWED: 'قيّمت المهندس',
};

export const ITEM_TYPE: Record<string, string> = {
  LABOR: 'أجر العمل',
  MATERIAL: 'خامات ومستلزمات',
  OTHER: 'أخرى',
};

export const QUOTE_STATUS: Record<string, readonly [label: string, tone: Tone]> = {
  SENT: ['بانتظار الرد', 'warn'],
  ACCEPTED: ['تمت الموافقة', 'ok'],
  REJECTED: ['مرفوض', 'bad'],
  EXPIRED: ['انتهت صلاحيته', 'bad'],
  CANCELLED: ['ملغي', 'bad'],
  DRAFT: ['مسودة', 'info'],
};

export const QUOTE_UI = {
  title: 'عرض السعر',
  extraTitle: 'عمل إضافي مطلوب',
  total: 'الإجمالي',
  agreed: 'المتفق عليه',
  due: 'المتبقي للسداد',
  duration: 'المدة المتوقعة',
  minutes: 'دقيقة',
  accept: 'أوافق على العرض',
  reject: 'أرفض العرض',
  acceptExtra: 'أوافق على العمل الإضافي',
  rejectExtra: 'لا أوافق',
  sendQuote: 'أرسل عرض السعر',
  sendExtra: 'اطلب عملًا إضافيًا',
  addItem: 'إضافة بند',
  removeItem: 'حذف',
  itemType: 'النوع',
  itemDesc: 'الوصف',
  quantity: 'الكمية',
  unitPrice: 'سعر الوحدة',
  notes: 'ملاحظات للعميل',
  estimate: 'المدة المتوقعة (بالدقائق)',
  preview: 'الإجمالي التقريبي — يحسبه النظام عند الإرسال',
  currency: 'جنيه',
} as const;

export const JOB_UI = {
  startTrip: 'بدأت التحرك إلى العميل',
  arrive: 'وصلت إلى الموقع',
  start: 'ابدأ التنفيذ',
  complete: 'أنهيت العمل',
  confirm: 'أؤكد أن العمل تم',
  report: 'الإبلاغ عن مشكلة',
  reportText: 'اشرح المشكلة',
  reportSend: 'أرسل البلاغ',
  reportDone: 'وصلنا بلاغك وسيراجعه فريق الدعم.',
  openRequest: 'افتح الطلب',
} as const;

export const PAYMENT_STATE: Record<string, readonly [label: string, tone: Tone]> = {
  UNPAID: ['لم يُدفع بعد', 'warn'],
  PARTIAL: ['مدفوع جزئيًا', 'info'],
  PAID: ['مدفوع بالكامل', 'ok'],
};

export const PAY_UI = {
  title: 'الدفع',
  chooseTitle: 'اختر طريقة الدفع لتأكيد الحجز',
  cash: 'الدفع نقدًا للمهندس',
  cashHint: 'يتأكد حجزك فورًا، وتدفع للمهندس بعد انتهاء العمل وتأكيدك له.',
  online: 'الدفع إلكترونيًا عبر فوري',
  onlineHint:
    'تحصل على رقم سداد وتدفعه من أي منفذ فوري أو من تطبيق فوري. يتأكد الحجز بمجرد وصول تأكيد الدفع من فوري.',
  payRest: 'ادفع المتبقي عبر فوري',
  refTitle: 'رقم السداد في فوري',
  refHelp: 'استخدم هذا الرقم عند الدفع في أي منفذ فوري أو من تطبيق فوري.',
  amount: 'المبلغ',
  expires: 'صالح حتى',
  verifying:
    'بانتظار تأكيد الدفع من فوري. لا تحتاج لفعل شيء — تتحدّث الصفحة تلقائيًا بمجرد وصول التأكيد.',
  cashPending: 'ستدفع نقدًا للمهندس بعد انتهاء العمل.',
  paid: 'تم الدفع',
  confirmCash: 'استلمت المبلغ نقدًا',
  confirmCashHelp: 'اضغط بعد أن تستلم المبلغ المستحق من العميل.',
  cashDue: 'المبلغ المطلوب تحصيله',
  methodCash: 'نقدًا',
  methodOnline: 'فوري',
  rateTitle: 'قيّم المهندس',
  rateHelp: 'تقييمك يساعد العملاء الآخرين على الاختيار.',
  rating: 'التقييم',
  stars: 'نجوم',
  comment: 'تعليق (اختياري)',
  rateSend: 'أرسل التقييم',
  rated: 'شكرًا لتقييمك.',
  yourRating: 'تقييمك',
} as const;

export const NOTIF_UI = {
  title: 'الإشعارات',
  bell: 'الإشعارات',
  unread: 'غير مقروء',
  empty: 'لا توجد إشعارات حتى الآن.',
  markAll: 'تعليم الكل كمقروء',
  back: 'رجوع',
} as const;

/** What each notification says in the app. Unknown types fall back to the text the server sent. */
export const NOTIF_TYPE: Record<string, string> = {
  ENGINEER_SELECTED: 'طلب جديد بانتظار ردّك',
  ENGINEER_CHANGED: 'اختار العميل مهندسًا آخر',
  ENGINEER_ACCEPTED: 'قبل المهندس طلبك',
  ENGINEER_REJECTED: 'اعتذر المهندس عن الطلب',
  REQUEST_CANCELLED: 'تم إلغاء الطلب',
  QUOTE_SENT: 'وصلك عرض سعر',
  QUOTE_ACCEPTED: 'وافق العميل على عرضك',
  QUOTE_REJECTED: 'رفض العميل عرضك',
  EXTRA_QUOTE_SENT: 'عمل إضافي يحتاج موافقتك',
  EXTRA_QUOTE_ACCEPTED: 'وافق العميل على العمل الإضافي',
  EXTRA_QUOTE_REJECTED: 'رفض العميل العمل الإضافي',
  BOOKING_CONFIRMED: 'تم تأكيد الحجز',
  TRIP_STARTED: 'المهندس في الطريق إليك',
  ARRIVED: 'وصل المهندس',
  JOB_STARTED: 'بدأ تنفيذ العمل',
  JOB_COMPLETED: 'أنهى المهندس العمل',
  COMPLETION_CONFIRMED: 'أكّد العميل الإنجاز',
  PAYMENT_PAID: 'تم استلام الدفعة',
  PAYMENT_FAILED: 'لم تكتمل عملية الدفع',
  CASH_RECEIVED: 'أكّد المهندس استلام المبلغ',
  REVIEWED: 'وصلك تقييم جديد',
  PAYMENT_NEEDS_REVIEW: 'دفعة تحتاج مراجعة',
  REQUEST_CANCELLED_BY_ADMIN: 'ألغت الإدارة الطلب',
  PAYMENT_REFUNDED: 'تم رد مبلغ إليك',
  DISPUTE_OPENED: 'مشكلة جديدة تحتاج مراجعة',
  DISPUTE_RESOLVED: 'تمت مراجعة المشكلة',
};

export const ADMIN_UI = {
  nav: {
    engineers: 'المهندسون',
    requests: 'الطلبات',
    finance: 'المالية',
    disputes: 'المشكلات',
    reviews: 'التقييمات',
  },
  all: 'الكل',
  noRows: 'لا توجد نتائج.',
  status: 'الحالة',
  method: 'طريقة الدفع',
  customer: 'العميل',
  engineer: 'المهندس',
  notAssigned: 'لم يُحدَّد',
  hasDispute: 'بها مشكلة',
  // requests
  cancelRequest: 'إلغاء الطلب',
  cancelReason: 'سبب الإلغاء (يظهر في السجل)',
  cancelConfirm: 'تأكيد الإلغاء',
  // finance
  collected: 'صافي المحصّل',
  cash: 'نقدًا',
  onlineFawry: 'عبر فوري',
  refunded: 'المردود',
  pending: 'بانتظار السداد',
  amount: 'المبلغ',
  refund: 'تسجيل ردّ مبلغ',
  refundAmount: 'المبلغ المردود',
  refundReason: 'سبب الرد',
  refundConfirm: 'تسجيل الرد',
  refundNote:
    'تسجيل الرد هنا لا يحوّل مالًا بنفسه: أعد المبلغ للعميل نقدًا أو من لوحة فوري ثم سجّله لتبقى الأرقام صحيحة.',
  paidAt: 'تاريخ السداد',
  reference: 'رقم السداد',
  // disputes
  resolve: 'إنهاء المراجعة',
  resolution: 'القرار (يُحفظ في السجل)',
  outcomeLabel: 'نتيجة المراجعة',
  opened: 'فتحها',
  // reviews
  hide: 'إخفاء',
  show: 'إظهار',
  hiddenChip: 'مخفي',
  onlyHidden: 'المخفية فقط',
} as const;

export const PAYMENT_STATUS: Record<string, readonly [label: string, tone: Tone]> = {
  PENDING: ['بانتظار السداد', 'warn'],
  PAID: ['مدفوع', 'ok'],
  FAILED: ['لم يكتمل', 'bad'],
  REFUNDED: ['تم رد المبلغ', 'info'],
  PARTIALLY_REFUNDED: ['رُدّ جزء منه', 'info'],
};
export const PAY_METHOD: Record<string, string> = { CASH: 'نقدًا', ONLINE: 'فوري' };

export const DISPUTE_STATUS: Record<string, readonly [label: string, tone: Tone]> = {
  OPEN: ['مفتوحة', 'warn'],
  UNDER_REVIEW: ['قيد المراجعة', 'info'],
  RESOLVED: ['تم الحل', 'ok'],
  REJECTED: ['مرفوضة', 'bad'],
};
export const DISPUTE_REASON: Record<string, string> = {
  PROBLEM_REPORTED: 'مشكلة في العمل',
  QUALITY: 'جودة العمل',
  PRICE: 'السعر',
  CUSTOMER_NO_SHOW: 'غياب العميل',
  ENGINEER_NO_SHOW: 'غياب المهندس',
  OTHER: 'أخرى',
};
export const DISPUTE_OUTCOME: Record<string, string> = {
  CONFIRM_COMPLETION: 'العمل سليم: أؤكد الإنجاز نيابةً عن العميل',
  CLOSE: 'أغلق المشكلة بقرار مكتوب فقط (يبقى الطلب كما هو)',
  REJECT: 'الشكوى غير صحيحة: أرفضها',
};
