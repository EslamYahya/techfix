/* الموقع العام + الدخول والتسجيل + خريطة الصفحات */
(function () {
  const { esc, ic, ui: U, L, A, $, $$ } = TF;
  const P = TF.pages;
  const SV = Object.entries(L.SERVICES);
  const brand = (cls = '') => `<a class="brandmark ${cls}" href="${TF.root}index.html"><img src="${TF.root}assets/brand/logo-app.png" alt=""><span>Tech<b>Fix</b></span></a>`;
  const pubNav = (cur) => {
    const m = TF.me();
    return `<header class="pubnav"><div class="wrap nav__in">${brand()}<nav class="nav__links" aria-label="التنقل"><a href="${TF.root}index.html#services" ${cur === 'home' ? '' : ''}>الخدمات</a><a href="${TF.root}index.html#how">كيف تعمل المنصة</a><a href="${TF.root}index.html#engineers">للمهندسين</a><a href="${TF.root}guide.html" ${cur === 'guide' ? 'aria-current="page"' : ''}>خريطة الصفحات</a></nav>
    <div class="nav__end"><button class="iconbtn" data-act="theme" aria-label="تبديل المظهر">${ic('moon')}</button>${m ? `<a class="btn btn--solid btn--sm" href="${TF.home(m.role)}">${m.role === 'admin' ? 'لوحة الإدارة' : 'حسابي'}</a>` : `<a class="btn btn--ghost btn--sm" href="${TF.root}login.html">تسجيل الدخول</a><a class="btn btn--primary btn--sm" href="${TF.root}register.html">إنشاء حساب</a>`}</div></div></header>`;
  };
  const footer = () => `<footer class="footer"><div class="wrap"><div class="footer__grid"><div>${brand()}<p class="mt0" style="color:var(--side-ink);max-width:28em">منصة تربط العملاء بمهندسين وفنيين موثقين لتركيب وصيانة الأنظمة التقنية. نبدأ في ${esc(TF.get().settings.city)}.</p></div>
    <div><h4>الخدمات</h4><ul>${SV.map(([k, v]) => `<li><a href="${TF.root}customer/new-request.html?svc=${k}">${v.name}</a></li>`).join('')}</ul></div>
    <div><h4>للعملاء</h4><ul><li><a href="${TF.root}customer/new-request.html">اطلب خدمة</a></li><li><a href="${TF.root}customer/requests.html">طلباتي</a></li><li><a href="${TF.root}login.html">تسجيل الدخول</a></li></ul></div>
    <div><h4>للمهندسين</h4><ul><li><a href="${TF.root}register.html?type=engineer">انضم كمهندس</a></li><li><a href="${TF.root}engineer/home.html">لوحة المهندس</a></li></ul></div></div><p class="mt-lg xs" style="color:var(--side-ink)">© TechFix — نموذج تجريبي للواجهة.</p></div></footer>`;

  /* ------------------------------------------------------------ الرئيسية */
  P['public.home'] = {
    title: '',
    render() {
      return `${pubNav('home')}
      <section class="hero"><div class="wrap hero__in"><div><h1>فني موثق لكل جهاز تقني في بيتك أو محلك</h1><p class="lead">اطلب خدمة تركيب أو صيانة، اختر المهندس الأنسب من ترشيحاتنا، واعرف السعر بالتفصيل قبل أن يبدأ أي عمل.</p>
        <div class="composer"><h3 style="margin-bottom:10px">ما الخدمة التي تحتاجها؟</h3><div class="svc-pick">${SV.map(([k, v]) => `<a class="svc-tile" href="${TF.root}customer/new-request.html?svc=${k}">${ic(v.icon)}<b>${v.name}</b></a>`).join('')}</div></div></div>
        <div class="stack" aria-hidden="false"><div class="ticket ticket--accent" style="color:var(--ink)"><div class="ticket__body"><div class="row between"><b>عرض سعر — تركيب كاميرات</b><span class="chip chip--ok">موثق</span></div><table class="table items mt0" style="font-size:14px"><tbody><tr><td>أجر التركيب والإعداد</td><td class="num">700</td></tr><tr><td>كابلات ومصدر طاقة</td><td class="num">1,000</td></tr><tr><td>تمديد وتثبيت</td><td class="num">500</td></tr></tbody></table></div><div class="ticket__cut"></div><div class="ticket__body row between"><span class="muted">الإجمالي قبل أن تبدأ</span><b style="font-size:22px">2,200 ج.م</b></div></div></div></div></section>
      <section class="section"><div class="wrap"><div class="pillars"><div><h3>${ic('badge-check')} مهندسون موثقون</h3><p class="muted">تراجع الإدارة بيانات كل مهندس قبل أن يستقبل أي طلب، وتقييمات العملاء السابقين ظاهرة في ملفه.</p></div><div><h3>${ic('receipt')} سعر واضح قبل التنفيذ</h3><p class="muted">المهندس يرسل عرضا مفصلًا بالأجر والخامات. لا يبدأ العمل قبل موافقتك.</p></div><div><h3>${ic('map-pin')} الأقرب والأنسب لك</h3><p class="muted">نرتب المهندسين حسب التخصص والقرب والتوفر والتقييم، وتختار بنفسك.</p></div></div></div></section>
      <section class="section section--alt" id="services"><div class="wrap"><div class="section__head"><h2>خدماتنا</h2><p>أربعة تخصصات نغطيها حاليًا.</p></div><div class="grid auto">${SV.map(([k, v]) => `<a class="svc-card" href="${TF.root}customer/new-request.html?svc=${k}">${ic(v.icon)}<h3>${v.name}</h3><ul>${v.subs.map((s) => `<li>${s}</li>`).join('')}</ul></a>`).join('')}</div></div></section>
      <section class="section" id="how"><div class="wrap"><div class="section__head"><h2>كيف تعمل المنصة</h2></div><div class="hrail" data-n=""><div data-n="1">اطلب الخدمة<br><span class="muted xs">اختر الخدمة وصف احتياجك وموقعك</span></div><div data-n="2">اختر مهندسك<br><span class="muted xs">من ترشيحات مرتبة حسب الأنسب لك</span></div><div data-n="3">راجع عرض السعر<br><span class="muted xs">بنود مفصلة، توافق عليها أو ترفضها</span></div><div data-n="4">نفذ وادفع<br><span class="muted xs">نقدا بعد الانتهاء أو إلكترونيا</span></div><div data-n="5">قيم التجربة<br><span class="muted xs">لتساعد غيرك على الاختيار</span></div></div></div></section>
      <section class="section section--alt" id="engineers"><div class="wrap row row--wrap between" style="gap:20px"><div style="max-width:560px"><h2>أنت مهندس أو فني؟</h2><p class="muted mt0">احصل على عملاء جدد من منطقتك، وملف مهني بتقييماتك، وأدوات لإدارة الطلبات وعروض الأسعار. إن كان لديك محل فسنضيف متجرا لمنتجاتك في مرحلة قادمة.</p></div><a class="btn btn--primary" href="${TF.root}register.html?type=engineer">انضم كمهندس</a></div></section>${footer()}`;
    },
  };

  /* -------------------------------------------------------------- الدخول */
  const safeNext = (n, role) => (n && new RegExp('^' + role + '/[a-z-]+\\.html').test(n) ? TF.root + n : TF.home(role));
  P['public.login'] = {
    title: 'تسجيل الدخول',
    render(c) {
      const m = TF.me(); if (m && !c.q.get('next')) { /* تابع بصفحة الدخول للتجربة */ }
      return `<div class="authwrap"><aside class="authside"><div>${brand('')}</div><div><h2>أهلًا بعودتك</h2><p style="color:#BCD6DC;max-width:24em" class="mt0">تابع طلباتك، أو استقبل طلبات جديدة وأرسل عروض الأسعار.</p></div><span class="xs" style="color:var(--side-ink)">نبدأ في ${esc(TF.get().settings.city)}</span></aside>
      <main class="authmain"><div class="row end" style="width:100%"><button class="iconbtn" data-act="theme" aria-label="تبديل المظهر">${ic('moon')}</button></div><div class="authbox stack stack--lg"><div><h1>تسجيل الدخول</h1><p class="muted">ادخل بالبريد الإلكتروني وكلمة المرور.</p></div>
        <form class="stack" data-form="login" novalidate><div class="field"><label for="em">البريد الإلكتروني</label><div class="input-wrap">${ic('mail')}<input class="input input--icon" id="em" name="email" type="email" autocomplete="username" dir="ltr" style="text-align:end"></div></div>
          <div class="field"><label for="pw">كلمة المرور</label><div class="input-wrap">${ic('lock')}<input class="input input--icon" id="pw" name="password" type="password" autocomplete="current-password" dir="ltr" style="text-align:end"></div></div>
          <div id="lerr" class="err" role="alert"></div><button class="btn btn--primary btn--block" type="submit">دخول</button></form>
        <p class="sm muted">ليس لديك حساب؟ <a href="register.html">أنشئ حسابًا</a></p>
        <div class="card card--flat stack stack--sm"><b>حسابات تجريبية</b><span class="hint">كلمة المرور لكل الحسابات: <span class="ltr">demo1234</span></span><div class="row row--wrap"><button class="btn btn--ghost btn--sm" data-act="fill" data-e="tarek@demo.techfix">${ic('user')} عميل</button><button class="btn btn--ghost btn--sm" data-act="fill" data-e="ahmed@demo.techfix">${ic('wrench')} مهندس</button><button class="btn btn--ghost btn--sm" data-act="fill" data-e="admin@demo.techfix">${ic('shield-check')} مشرف</button></div></div></div></main></div>`;
    },
  };
  TF.on('fill', (el) => { $('#em').value = el.dataset.e; $('#pw').value = 'demo1234'; });
  TF.on('form:login', (f, e, c) => {
    const r = TF.login(f.email.value, f.password.value); if (!r.ok) { $('#lerr').textContent = r.msg; return; }
    location.href = safeNext(c.q.get('next'), r.role);
  });

  /* -------------------------------------------------------------- التسجيل */
  let rtype = 'customer';
  P['public.register'] = {
    title: 'إنشاء حساب',
    render(c) {
      if (c.q.get('type') === 'engineer' && !P._regInit) { rtype = 'engineer'; P._regInit = 1; }
      const e = rtype === 'engineer';
      return `<div class="authwrap"><aside class="authside"><div>${brand()}</div><div><h2>${e ? 'ابنِ سمعتك واستقبل طلبات جديدة' : 'اطلب الفني الأنسب بثقة'}</h2><p style="color:#BCD6DC;max-width:24em" class="mt0">${e ? 'بعد التسجيل تراجع الإدارة بياناتك وتوثق حسابك لتبدأ باستقبال الطلبات.' : 'سجل بياناتك الأساسية فقط. نحدد الموقع عند إنشاء الطلب.'}</p></div><span></span></aside>
      <main class="authmain"><div class="row end" style="width:100%"><button class="iconbtn" data-act="theme" aria-label="تبديل المظهر">${ic('moon')}</button></div><div class="authbox stack"><div><h1>إنشاء حساب</h1><p class="muted">لديك حساب؟ <a href="login.html">سجل الدخول</a></p></div>
      <div class="typepick" role="radiogroup" aria-label="نوع الحساب"><button type="button" class="svc-tile" data-act="rtype" data-t="customer" aria-pressed="${!e}">${ic('user')}<b>عميل</b><span class="muted xs">أطلب خدمة</span></button><button type="button" class="svc-tile" data-act="rtype" data-t="engineer" aria-pressed="${e}">${ic('wrench')}<b>مهندس</b><span class="muted xs">أقدم خدمة</span></button></div>
      <form class="stack" data-form="register" novalidate><div class="field"><label for="rn">الاسم الكامل</label><input class="input" id="rn" name="name" autocomplete="name"></div>
        <div class="grid g2 g2--stack"><div class="field"><label for="rp">رقم الهاتف</label><input class="input" id="rp" name="phone" type="tel" inputmode="tel" dir="ltr" style="text-align:end" placeholder="01x xxxx xxxx"></div><div class="field"><label for="re">البريد الإلكتروني</label><input class="input" id="re" name="email" type="email" dir="ltr" style="text-align:end"></div></div>
        <div class="field"><label for="rw">كلمة المرور</label><input class="input" id="rw" name="password" type="password" autocomplete="new-password" dir="ltr" style="text-align:end"><span class="hint">8 أحرف على الأقل.</span></div>
        ${e ? `<div class="field"><label>التخصصات</label><div class="grid g2 g2--stack">${SV.map(([k, v]) => `<label class="choice"><input type="checkbox" name="svc" value="${k}">${ic(v.icon)} ${v.name}</label>`).join('')}</div></div><div class="grid g2 g2--stack"><div class="field"><label for="ry">سنوات الخبرة</label><input class="input" id="ry" name="years" type="number" min="0" value="1"></div><div class="field"><label for="ra">منطقتك</label><input class="input" id="ra" name="area" placeholder="مثال: الدقي"></div></div><label class="row" style="gap:10px"><input type="checkbox" name="hasShop"> لدي محل تجاري</label>` : ''}
        <div id="rerr" class="err" role="alert"></div><button class="btn btn--primary btn--block" type="submit">إنشاء الحساب</button></form></div></main></div>`;
    },
  };
  TF.on('rtype', (el) => { rtype = el.dataset.t; TF.refresh(); });
  TF.on('form:register', (f) => {
    const err = (m) => ($('#rerr').textContent = m);
    if (!f.name.value.trim()) return err('أدخل اسمك الكامل.'); if (!f.phone.value.trim()) return err('أدخل رقم الهاتف.');
    if (!/^\S+@\S+\.\S+$/.test(f.email.value.trim())) return err('أدخل بريدا إلكترونيا صحيحا.'); if (f.password.value.length < 8) return err('كلمة المرور يجب ألا تقل عن 8 أحرف.');
    const d = { role: rtype, name: f.name.value, phone: f.phone.value, email: f.email.value, password: f.password.value };
    if (rtype === 'engineer') Object.assign(d, { services: $$('input[name=svc]:checked', f).map((x) => x.value), years: f.years.value, area: f.area.value, hasShop: f.hasShop.checked });
    const r = A.register(d); if (!r.ok) return err(r.msg);
    location.href = TF.home(r.role) .replace('home.html', r.role === 'engineer' ? 'profile.html' : 'home.html');
  });

  /* ------------------------------------------------------ خريطة الصفحات */
  const PAGES = [
    ['index.html', 'الصفحة الرئيسية', 'عام', '/'], ['login.html', 'تسجيل الدخول', 'عام', '/login'], ['register.html', 'إنشاء حساب', 'عام', '/register'],
    ['customer/home.html', 'الرئيسية', 'عميل', '/customer'], ['customer/new-request.html', 'طلب خدمة جديد (4 خطوات)', 'عميل', '/customer/requests/new'], ['customer/matching.html?r=R-1063', 'اختيار المهندس', 'عميل', '/customer/requests/:id/engineers'], ['customer/engineer.html?e=e1', 'ملف المهندس', 'عميل', '/customer/engineers/:id'], ['customer/requests.html', 'طلباتي', 'عميل', '/customer/requests'], ['customer/request.html?r=R-1061', 'تفاصيل الطلب ومراحله', 'عميل', '/customer/requests/:id'], ['customer/invoice.html?r=R-1048', 'الفاتورة', 'عميل', '/customer/requests/:id/invoice'], ['customer/notifications.html', 'الإشعارات', 'عميل', '/customer/notifications'], ['customer/profile.html', 'حسابي', 'عميل', '/customer/profile'],
    ['engineer/home.html', 'لوحتي', 'مهندس', '/engineer'], ['engineer/requests.html', 'الطلبات', 'مهندس', '/engineer/requests'], ['engineer/request.html?r=R-1063', 'تفاصيل الطلب وعرض السعر', 'مهندس', '/engineer/requests/:id'], ['engineer/earnings.html', 'الأرباح', 'مهندس', '/engineer/earnings'], ['engineer/notifications.html', 'الإشعارات', 'مهندس', '/engineer/notifications'], ['engineer/profile.html', 'ملفي المهني والتوثيق', 'مهندس', '/engineer/profile'],
    ['admin/home.html', 'نظرة عامة', 'مشرف', '/admin'], ['admin/engineers.html', 'المهندسون والتوثيق', 'مشرف', '/admin/engineers'], ['admin/requests.html', 'الطلبات', 'مشرف', '/admin/requests'], ['admin/requests.html?r=R-1061', 'تفاصيل طلب', 'مشرف', '/admin/requests/:id'], ['admin/matching.html', 'الترشيح والخدمات', 'مشرف', '/admin/matching'], ['admin/finance.html', 'الماليات', 'مشرف', '/admin/finance'],
  ];
  const FLOW = [['العميل', 'ينشئ الطلب', 'REQUESTED'], ['النظام', 'يرشح المهندسين', 'MATCHING'], ['العميل', 'يختار مهندسا واحدا', 'ENGINEER_SELECTED'], ['المهندس', 'يقبل (أو يعتذر فيعود الطلب للترشيح)', 'ENGINEER_ACCEPTED'], ['المهندس', 'يرسل عرض سعر واحدا', 'QUOTE_SENT'], ['العميل', 'يرفض فيعدل المهندس أو يختار العميل غيره', 'QUOTE_REJECTED'], ['العميل', 'يوافق على العرض', 'QUOTE_ACCEPTED'], ['العميل / البوابة', 'نقدًا فورا، أو إلكترونيا بعد تأكيد البوابة', 'CONFIRMED'], ['المهندس', 'ينطلق', 'ON_THE_WAY'], ['المهندس', 'يصل', 'ARRIVED'], ['المهندس', 'يبدأ التنفيذ (وقد يرسل عرضا إضافيا)', 'IN_PROGRESS'], ['المهندس', 'ينهي العمل', 'COMPLETION_PENDING'], ['العميل', 'يؤكد الإنجاز، ويؤكد المهندس استلام النقد', 'COMPLETED'], ['العميل', 'يقيم', 'RATED']];
  P['public.guide'] = {
    title: 'خريطة الصفحات',
    render() {
      const roles = ['عام', 'عميل', 'مهندس', 'مشرف'];
      return `${pubNav('guide')}<main class="wrap section stack stack--lg"><div><h1>خريطة الصفحات والمنطق</h1><p class="muted">مرجع للمطورين: كل صفحة في النموذج، ومسارها في المشروع الفعلي، ومراحل الطلب بين الاسم الداخلي والنص الذي يراه المستخدم. هذه الصفحة وحدها تعرض الأسماء الداخلية؛ واجهة المنتج لا تعرضها أبدا.</p></div>
      ${roles.map((r) => `<section class="stack" style="gap:10px"><h2>${r === 'عام' ? 'الموقع العام' : 'بوابة ' + r}</h2><div class="tablewrap"><table class="table"><thead><tr><th>الصفحة</th><th>ملف النموذج</th><th>المسار في المشروع الفعلي</th></tr></thead><tbody>${PAGES.filter((p) => p[2] === r).map((p) => `<tr><td><a href="${p[0]}">${p[1]}</a></td><td><span class="ltr">${p[0].split('?')[0]}</span></td><td><span class="ltr">${p[3]}</span></td></tr>`).join('')}</tbody></table></div></section>`).join('')}
      <section class="stack" style="gap:10px"><h2>دورة الطلب</h2><p class="muted">الحالة الداخلية (يحتفظ بها الخادم فقط) والنص الذي يظهر لكل دور.</p><div class="tablewrap"><table class="table"><thead><tr><th>من يتصرف</th><th>الحدث</th><th>الحالة الداخلية</th><th>ما يراه العميل</th><th>ما يراه المهندس</th></tr></thead><tbody>${FLOW.map(([who, what, st]) => `<tr><td>${who}</td><td>${what}</td><td><span class="ltr">${st}</span></td><td>${L.STATUS[st][0]}</td><td>${L.STATUS[st][1]}</td></tr>`).join('')}<tr><td>العميل</td><td>يلغي قبل بدء الطريق</td><td><span class="ltr">CANCELLED</span></td><td>ملغي</td><td>ملغي</td></tr></tbody></table></div></section>
      <section class="card stack"><h3>قواعد لا تُكسر</h3><ul class="muted" style="margin:0;padding-inline-start:20px;line-height:2"><li>الطلب وعرض السعر والعمل والدفع كيانات منفصلة؛ حالة الدفع مستقلة عن حالة العمل.</li><li>مهندس واحد لكل طلب، وعرض سعر واحد لكل محاولة. العرض المعتمد لا يعدل، والإضافات تأتي في عرض إضافي.</li><li>الدفع النقدي يؤكده المهندس بعد الإنجاز. الدفع الإلكتروني لا يعتمد إلا بإشعار البوابة، وليس بعودة المتصفح.</li><li>العنوان الكامل ورقم العميل لا يظهران للمهندس قبل تأكيد الحجز.</li><li>الصلاحية = الدور + ملكية الطلب + الحالة الحالية، ويتحقق منها الخادم في كل إجراء.</li><li>أوزان الترشيح تضبط من الإدارة ولا تعرض للعملاء كأرقام.</li><li>لا يظهر أي اسم برمجي أو رمز داخلي في واجهة المنتج؛ كل حالة تمر عبر قاموس النصوص.</li></ul></section></main>${footer()}`;
    },
  };

  TF.boot();
})();
