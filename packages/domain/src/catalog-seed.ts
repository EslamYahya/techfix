/** Launch catalog (docs: the four launch categories). Pure data, shared by the DB seed and the dev/in-memory store. */
export interface CatalogSeedCategory {
  slug: string;
  name: string;
  description: string;
  services: { slug: string; name: string }[];
}

export const CATALOG_SEED: readonly CatalogSeedCategory[] = [
  {
    slug: 'satellite',
    name: 'الأقمار الصناعية',
    description: 'تركيب الأطباق وضبط الإشارة وصيانة الكابلات',
    services: [
      { slug: 'satellite-install', name: 'تركيب وتوجيه طبق' },
      { slug: 'satellite-signal', name: 'ضبط إشارة الاستقبال' },
      { slug: 'satellite-cables', name: 'صيانة كابلات وجهاز استقبال' },
      { slug: 'satellite-receiver', name: 'تغيير جهاز الاستقبال' },
    ],
  },
  {
    slug: 'cctv',
    name: 'كاميرات المراقبة',
    description: 'تركيب وصيانة الكاميرات وأجهزة التسجيل',
    services: [
      { slug: 'cctv-install', name: 'تركيب كاميرات جديدة' },
      { slug: 'cctv-repair', name: 'صيانة وإصلاح' },
      { slug: 'cctv-remote', name: 'إعداد جهاز التسجيل والمشاهدة عن بُعد' },
      { slug: 'cctv-relocate', name: 'نقل وإعادة تركيب' },
    ],
  },
  {
    slug: 'intercom',
    name: 'الإنتركم',
    description: 'أنظمة صوتية ومرئية وتمديداتها',
    services: [
      { slug: 'intercom-video', name: 'تركيب نظام مرئي' },
      { slug: 'intercom-audio', name: 'تركيب نظام صوتي' },
      { slug: 'intercom-wiring', name: 'مد تمديدات وصيانة' },
    ],
  },
  {
    slug: 'network',
    name: 'الشبكات',
    description: 'راوترات ونقاط وصول ومد كابلات',
    services: [
      { slug: 'network-router', name: 'تركيب راوتر أو نقطة وصول' },
      { slug: 'network-cabling', name: 'مد شبكة كابلات' },
      { slug: 'network-coverage', name: 'تحسين تغطية الإنترنت' },
      { slug: 'network-switch', name: 'تركيب موزّع شبكة' },
    ],
  },
];
