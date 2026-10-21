import type { NotificationType } from '@techfix/domain';

export type Audience = 'CUSTOMER' | 'ENGINEER' | 'BOTH' | 'ADMIN';

/**
 * Who hears about what, and the Arabic fallback text. The web app resolves its own wording from `type`
 * (labels dictionary); title/body are what a push channel or an old client shows.
 */
export const NOTIFICATION_RULES: Record<
  NotificationType,
  { to: Audience; title: string; body: string }
> = {
  ENGINEER_SELECTED: {
    to: 'ENGINEER',
    title: 'طلب جديد بانتظار ردّك',
    body: 'اختارك عميل لتنفيذ الطلب {n}. راجع التفاصيل واقبل أو اعتذر.',
  },
  ENGINEER_CHANGED: {
    to: 'ENGINEER',
    title: 'اختار العميل مهندسًا آخر',
    body: 'لم يعد الطلب {n} مُسندًا إليك.',
  },
  ENGINEER_ACCEPTED: {
    to: 'CUSTOMER',
    title: 'قبل المهندس طلبك',
    body: 'سيرسل لك المهندس عرض السعر للطلب {n} قريبًا.',
  },
  ENGINEER_REJECTED: {
    to: 'CUSTOMER',
    title: 'اعتذر المهندس عن الطلب',
    body: 'اختر مهندسًا آخر للطلب {n}.',
  },
  REQUEST_CANCELLED: { to: 'ENGINEER', title: 'تم إلغاء الطلب', body: 'ألغى العميل الطلب {n}.' },
  QUOTE_SENT: {
    to: 'CUSTOMER',
    title: 'وصلك عرض سعر',
    body: 'راجع عرض السعر للطلب {n} ووافق عليه أو ارفضه.',
  },
  QUOTE_ACCEPTED: {
    to: 'ENGINEER',
    title: 'وافق العميل على عرضك',
    body: 'تمت الموافقة على عرض السعر للطلب {n}.',
  },
  QUOTE_REJECTED: { to: 'ENGINEER', title: 'رفض العميل عرضك', body: 'تم رفض عرض السعر للطلب {n}.' },
  EXTRA_QUOTE_SENT: {
    to: 'CUSTOMER',
    title: 'عمل إضافي يحتاج موافقتك',
    body: 'أرسل المهندس عرضًا لعمل إضافي في الطلب {n}.',
  },
  EXTRA_QUOTE_ACCEPTED: {
    to: 'ENGINEER',
    title: 'وافق العميل على العمل الإضافي',
    body: 'يمكنك متابعة العمل في الطلب {n}.',
  },
  EXTRA_QUOTE_REJECTED: {
    to: 'ENGINEER',
    title: 'رفض العميل العمل الإضافي',
    body: 'تابع بدون العمل الإضافي في الطلب {n}.',
  },
  BOOKING_CONFIRMED: {
    to: 'BOTH',
    title: 'تم تأكيد الحجز',
    body: 'الحجز للطلب {n} مؤكَّد. يظهر العنوان ورقم الهاتف للطرفين الآن.',
  },
  TRIP_STARTED: {
    to: 'CUSTOMER',
    title: 'المهندس في الطريق إليك',
    body: 'بدأ المهندس التحرك لتنفيذ الطلب {n}.',
  },
  ARRIVED: { to: 'CUSTOMER', title: 'وصل المهندس', body: 'وصل المهندس إلى موقعك للطلب {n}.' },
  JOB_STARTED: {
    to: 'CUSTOMER',
    title: 'بدأ تنفيذ العمل',
    body: 'بدأ المهندس العمل في الطلب {n}.',
  },
  JOB_COMPLETED: {
    to: 'CUSTOMER',
    title: 'أنهى المهندس العمل',
    body: 'راجع العمل في الطلب {n} وأكّد الإنجاز.',
  },
  COMPLETION_CONFIRMED: {
    to: 'ENGINEER',
    title: 'أكّد العميل الإنجاز',
    body: 'أكّد العميل إنجاز الطلب {n}.',
  },
  PAYMENT_PAID: { to: 'BOTH', title: 'تم استلام الدفعة', body: 'تم سداد دفعة للطلب {n}.' },
  PAYMENT_FAILED: {
    to: 'CUSTOMER',
    title: 'لم تكتمل عملية الدفع',
    body: 'لم يتم سداد الطلب {n}. يمكنك المحاولة مرة أخرى.',
  },
  CASH_RECEIVED: {
    to: 'CUSTOMER',
    title: 'أكّد المهندس استلام المبلغ',
    body: 'تم تسجيل سداد الطلب {n} نقدًا.',
  },
  REVIEWED: { to: 'ENGINEER', title: 'وصلك تقييم جديد', body: 'قيّمك العميل بعد الطلب {n}.' },
  PAYMENT_NEEDS_REVIEW: {
    to: 'ADMIN',
    title: 'دفعة تحتاج مراجعة',
    body: 'دفعة للطلب {n} لا يمكن إكمالها تلقائيًا (مبلغ مختلف أو طلب ملغى).',
  },
  REQUEST_CANCELLED_BY_ADMIN: {
    to: 'BOTH',
    title: 'ألغت الإدارة الطلب',
    body: 'تم إلغاء الطلب {n} من قِبل إدارة المنصة.',
  },
  PAYMENT_REFUNDED: {
    to: 'CUSTOMER',
    title: 'تم رد مبلغ إليك',
    body: 'سجّلت الإدارة ردّ مبلغ من الطلب {n}.',
  },
  DISPUTE_OPENED: {
    to: 'ADMIN',
    title: 'مشكلة جديدة تحتاج مراجعة',
    body: 'أبلغ العميل عن مشكلة في الطلب {n}.',
  },
  DISPUTE_RESOLVED: {
    to: 'BOTH',
    title: 'تمت مراجعة المشكلة',
    body: 'أنهت الإدارة مراجعة المشكلة في الطلب {n}.',
  },
};
