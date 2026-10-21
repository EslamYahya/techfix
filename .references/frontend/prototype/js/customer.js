/* بوابة العميل — /customer/* */
(function () {
  const { esc, ic, num, money, moneyTxt, when, avatar, stars, ui: U, L, A, $, $$, firstName } = TF;
  const P = TF.pages;
  const noAccess = () => U.empty('lock', 'لا يمكن عرض هذا الطلب', 'الطلب غير موجود أو غير مرتبط بحسابك.', '<a class="btn btn--solid" href="requests.html">العودة إلى طلباتي</a>');
  const getR = (c) => { const r = TF.req(c.q.get('r')); return r && r.customerId === c.me.id ? r : null; };
  const svcTiles = (enabled, href, pressed) => `<div class="svc-pick">${Object.entries(L.SERVICES).filter(([k]) => enabled[k]).map(([k, v]) => `<a class="svc-tile" href="${href(k)}" ${pressed === k ? 'aria-pressed="true"' : ''}>${ic(v.icon)}<b>${v.name}</b><span class="muted xs">${v.blurb}</span></a>`).join('')}</div>`;

  /* ---------------------------------------------------------------- الرئيسية */
  P['customer.home'] = {
    title: 'الرئيسية',
    render(c) {
      const reqs = TF.myRequests(), need = reqs.filter(TF.needs.customer), rest = reqs.filter((r) => TF.isOpen(r) && !need.includes(r));
      const loc = c.me.user.addresses[0];
      return `<div class="pagehead"><div><h1>أهلا ${esc(firstName(c.me.user.name))}</h1><p class="row" style="gap:6px">${ic('map-pin')} ${loc ? esc(loc.area) : 'القاهرة الكبرى'}</p></div></div>
      <div class="stack stack--lg">
        <section class="stack" style="gap:10px"><h2>محتاج فني في إيه؟</h2>${svcTiles(c.S.settings.services, (k) => 'new-request.html?svc=' + k)}</section>
        ${need.length ? TF.sec('بانتظار قرارك', `<div class="stack">${need.map((r) => TF.reqCard(r, 'customer')).join('')}</div>`) : ''}
        ${rest.length ? TF.sec('طلباتي الحالية', `<div class="stack">${rest.map((r) => TF.reqCard(r, 'customer')).join('')}</div>`, '<a class="btn btn--quiet" href="requests.html">كل الطلبات</a>') : ''}
        ${!need.length && !rest.length ? U.empty('clipboard-list', 'لا توجد طلبات حالية', 'اختر الخدمة التي تحتاجها وسنرشح لك المهندسين الأنسب.', '<a class="btn btn--primary" href="new-request.html">اطلب خدمة</a>') : ''}
      </div>`;
    },
  };

  /* ------------------------------------------------------------- طلب جديد */
  let dErr = {};
  const D = () => { const S = TF.get(); if (!S.draft) S.draft = { step: 1, service: '', sub: '', desc: '', address: '', area: '', notes: '', date: TF.dayISO(1), slot: 'MORNING', lat: 0, lng: 0 }; return S.draft; };
  P['customer.new-request'] = {
    title: 'طلب خدمة',
    render(c) {
      const d = D(); const svc = c.q.get('svc'); if (svc && L.SERVICES[svc] && d.service !== svc && !d._seen) { d.service = svc; d.sub = ''; d.step = 1; } d._seen = 1;
      const steps = ['الخدمة', 'المشكلة', 'الموقع والموعد', 'المراجعة'];
      const bar = `<div class="steps" aria-label="خطوات الطلب">${steps.map((s, i) => `<div class="${i + 1 < d.step ? 'done' : i + 1 === d.step ? 'now' : ''}"><span>${s}</span></div>`).join('')}</div>`;
      const err = (k) => dErr[k] ? `<div class="err" role="alert">${dErr[k]}</div>` : '';
      let body = '';
      if (d.step === 1) {
        body = `<h2>ما الخدمة التي تحتاجها؟</h2><div class="svc-pick mt">${Object.entries(L.SERVICES).filter(([k]) => c.S.settings.services[k]).map(([k, v]) => `<button class="svc-tile" data-act="pick-svc" data-k="${k}" aria-pressed="${d.service === k}">${ic(v.icon)}<b>${v.name}</b></button>`).join('')}</div>
        ${d.service ? `<h3 class="mt-lg">ما نوع العمل؟</h3><div class="sub-list mt">${L.SERVICES[d.service].subs.map((s) => `<button data-act="pick-sub" data-s="${esc(s)}" aria-pressed="${d.sub === s}">${esc(s)}</button>`).join('')}</div>` : ''}<div class="mt">${err('step1')}</div>`;
      } else if (d.step === 2) {
        body = `<h2>اشرح ما تحتاجه</h2><p class="muted sm">كلما كان الوصف أدق، كان عرض السعر أقرب للواقع.</p>
        <div class="field mt"><label for="desc">وصف الطلب</label><textarea class="textarea" id="desc" data-live="draft" name="desc" placeholder="مثال: أحتاج تركيب أربع كاميرات خارجية لمحل في الدور الثاني، وأريد مشاهدتها من الهاتف.">${esc(d.desc)}</textarea>${err('desc')}</div>
        <div class="field mt"><label>صور للمكان أو العطل (اختياري)</label><button type="button" class="btn btn--ghost" data-act="add-photo">${ic('camera')} إضافة صور</button><span class="hint">الصور تساعد المهندس على تقدير العمل بدقة.</span></div>`;
      } else if (d.step === 3) {
        const saved = c.me.user.addresses;
        body = `<h2>أين ننفذ الخدمة؟</h2>
        ${saved.length ? `<div class="row row--wrap mt">${saved.map((a) => `<button class="btn btn--ghost btn--sm" data-act="use-addr" data-id="${a.id}">${ic('house')} ${esc(a.label)} — ${esc(a.area)}</button>`).join('')}</div>` : ''}
        <div class="field mt"><label for="address">العنوان</label><div class="input-wrap">${ic('map-pin')}<input class="input input--icon" id="address" name="address" data-live="draft" value="${esc(d.address)}" placeholder="الشارع، الحي"></div>${err('address')}</div>
        <div class="row row--wrap mt"><button class="btn btn--ghost btn--sm" data-act="locate">${ic('navigation')} استخدام موقعي الحالي</button></div>
        <div class="mt">${TF.map(d.lat ? [{ x: 200, y: 100, me: true }] : [], d.lat ? 'تم تحديد الموقع' : 'حدد موقعك على الخريطة')}</div>
        <div class="field mt"><label for="notes">ملاحظات للوصول (اختياري)</label><input class="input" id="notes" name="notes" data-live="draft" value="${esc(d.notes)}" placeholder="رقم الدور، علامة مميزة، أو أي تنبيه"></div>
        <h3 class="mt-lg">الموعد المفضل</h3><p class="muted sm">الموعد مبدئي حتى يوافق المهندس.</p>
        <div class="grid g3 mt" role="radiogroup" aria-label="اليوم">${[0, 1, 2].map((o) => `<label class="choice"><input type="radio" name="date" value="${TF.dayISO(o)}" data-change="draft" ${d.date === TF.dayISO(o) ? 'checked' : ''}>${TF.dayLabel(TF.dayISO(o))}</label>`).join('')}</div>
        <div class="grid g3 mt" role="radiogroup" aria-label="الفترة">${Object.entries(L.SLOTS).map(([k, v]) => `<label class="choice"><input type="radio" name="slot" value="${k}" data-change="draft" ${d.slot === k ? 'checked' : ''}>${v}</label>`).join('')}</div>`;
      } else {
        const sv = L.SERVICES[d.service];
        body = `<h2>راجع طلبك</h2><div class="ticket mt"><div class="ticket__body"><div class="row">${ic(sv.icon, 'i--lg')}<div><h3>${esc(d.sub)}</h3><span class="muted sm">${sv.name}</span></div></div><div class="ticket__cut" style="margin:14px -4px"></div><dl class="dl"><dt>الوصف</dt><dd>${esc(d.desc)}</dd><dt>العنوان</dt><dd>${esc(d.address)}</dd>${d.notes ? `<dt>ملاحظات</dt><dd>${esc(d.notes)}</dd>` : ''}<dt>الموعد المفضل</dt><dd>${TF.whenText({ date: d.date, slot: d.slot })}</dd></dl></div></div>
        <div class="note mt">${ic('info')}<span>بعد الإرسال سنرشح لك المهندسين الأنسب لتختار أحدهم. لن يطلب منك أي دفع الآن؛ ستراجع عرض السعر أولًا.</span></div>`;
      }
      const back = d.step > 1 ? `<button class="btn btn--ghost" data-act="wiz-back">${ic('arrow-right', 'flip')} رجوع</button>` : `<a class="btn btn--ghost" href="home.html">إلغاء</a>`;
      const next = d.step < 4 ? `<button class="btn btn--primary grow" data-act="wiz-next">متابعة</button>` : `<button class="btn btn--primary grow" data-act="wiz-send">${ic('search')} ابحث عن مهندسين</button>`;
      return `${TF.head('طلب خدمة جديد')}${bar}<div class="card">${body}</div><div class="actionbar">${back}${next}</div>`;
    },
  };
  TF.on('pick-svc', (el) => { const d = D(); if (d.service !== el.dataset.k) { d.service = el.dataset.k; d.sub = ''; } dErr = {}; TF.save(); TF.refresh(); });
  TF.on('pick-sub', (el) => { D().sub = el.dataset.s; dErr = {}; TF.save(); TF.refresh(); });
  TF.on('live:draft', (el) => { D()[el.name] = el.value; TF.save(); });
  TF.on('change:draft', (el) => { D()[el.name] = el.value; TF.save(); });
  TF.on('add-photo', () => U.toast('رفع الصور متاح في النسخة الفعلية.'));
  TF.on('locate', () => { const d = D(); d.lat = 30.0382; d.lng = 31.2118; if (!d.address) { d.address = 'شارع التحرير، الدقي'; d.area = 'الدقي'; } TF.save(); U.toast('تم تحديد موقعك الحالي', 'ok'); TF.refresh(); });
  TF.on('use-addr', (el, e, c) => { const a = c.me.user.addresses.find((x) => x.id === el.dataset.id), d = D(); Object.assign(d, { address: a.text, area: a.area, lat: a.lat, lng: a.lng }); TF.save(); TF.refresh(); });
  TF.on('wiz-back', () => { D().step--; dErr = {}; TF.save(); TF.refresh(); window.scrollTo(0, 0); });
  TF.on('wiz-next', () => {
    const d = D(); dErr = {};
    if (d.step === 1 && (!d.service || !d.sub)) dErr.step1 = 'اختر الخدمة ونوع العمل للمتابعة.';
    if (d.step === 2 && d.desc.trim().length < 10) dErr.desc = 'اكتب وصفا لا يقل عن 10 أحرف ليفهم المهندس المطلوب.';
    if (d.step === 3 && !d.address.trim()) dErr.address = 'أدخل عنوان تنفيذ الخدمة.';
    if (Object.keys(dErr).length) { TF.refresh(); return; }
    d.step++; TF.save(); TF.refresh(); window.scrollTo(0, 0);
  });
  TF.on('wiz-send', () => { const d = D(); const r = A.createRequest({ ...d, when: { date: d.date, slot: d.slot } }); if (r.ok) location.href = 'matching.html?r=' + r.id; else U.toast(r.msg, 'bad'); });

  /* ---------------------------------------------------------- ترشيح المهندسين */
  const hidden = new Set();
  P['customer.matching'] = {
    title: 'اختيار المهندس',
    render(c) {
      const r = getR(c); if (!r) return noAccess();
      if (r.status !== 'MATCHING') return { redirect: 'request.html?r=' + r.id };
      const list = TF.match(r).map((m, i) => ({ ...m, first: i === 0 }));
      const shown = list.filter((m) => !hidden.has(m.e.id));
      return `${TF.back('request.html?r=' + r.id, 'تفاصيل الطلب')}${TF.head('اختر المهندس المناسب', `رشحنا لك مهندسين لطلب «${esc(r.sub)}» بحسب القرب والتخصص والتقييم والتوفر.`)}
      <div class="card card--flat mb row row--wrap" style="gap:16px"><span class="row" style="gap:6px">${ic(L.SERVICES[r.service].icon)} ${L.SERVICES[r.service].name}</span><span class="row" style="gap:6px">${ic('map-pin')} ${esc(r.area)}</span><span class="row" style="gap:6px">${ic('calendar')} ${TF.whenText(r.when)}</span></div>
      ${shown.length ? `<div class="stack">${shown.map((m) => TF.engCard(m, `<a class="btn btn--ghost btn--sm" href="engineer.html?e=${m.e.id}&r=${r.id}">${ic('user')} عرض الملف</a><button class="btn btn--quiet btn--sm" data-act="hide-eng" data-id="${m.e.id}">ليس مناسبا</button><span class="grow"></span><button class="btn btn--primary" data-act="choose-eng" data-id="${m.e.id}">اختيار هذا المهندس</button>`)).join('')}</div>
      <p class="muted sm mt">سيصل طلبك إلى المهندس الذي تختاره وحده. لن تدفع شيئا قبل أن يرسل عرض سعر وتوافق عليه.</p>` :
        U.empty('search', list.length ? 'استبعدت كل المهندسين المقترحين' : 'لا يوجد مهندسون متاحون الآن', list.length ? 'يمكنك إعادة عرض القائمة.' : 'لا يوجد مهندس متاح لهذه الخدمة في منطقتك حاليا. جرب موعدا آخر أو أعد المحاولة لاحقا.', list.length ? '<button class="btn btn--solid" data-act="show-all">إعادة عرض القائمة</button>' : `<a class="btn btn--solid" href="request.html?r=${r.id}">العودة للطلب</a>`)}`;
    },
  };
  TF.on('hide-eng', (el) => { hidden.add(el.dataset.id); TF.refresh(); });
  TF.on('show-all', () => { hidden.clear(); TF.refresh(); });
  TF.on('choose-eng', async (el, e, c) => {
    const r = getR(c), eng = c.S.engineers.find((x) => x.id === el.dataset.id);
    const v = await U.confirm({ title: `إرسال الطلب إلى ${eng.name}؟`, body: 'سيصل طلبك إلى هذا المهندس وحده ليقبله أو يعتذر عنه. عند القبول سيرسل لك عرض سعر مفصلا، ولا يطلب منك أي دفع قبل موافقتك عليه.', ok: 'إرسال الطلب' });
    if (v) U.done(A.chooseEngineer(r.id, eng.id), 'تم إرسال طلبك إلى ' + eng.name, () => (location.href = 'request.html?r=' + r.id));
  });

  /* --------------------------------------------------------- ملف المهندس (للعميل) */
  P['customer.engineer'] = {
    title: 'ملف المهندس',
    render(c) {
      const e = c.S.engineers.find((x) => x.id === c.q.get('e')); if (!e || e.verification !== 'VERIFIED') return U.empty('user-x', 'الملف غير متاح', 'هذا المهندس غير موجود أو غير موثّق.', '<a class="btn btn--solid" href="home.html">الرئيسية</a>');
      const rid = c.q.get('r'), r = rid && getR(c), canPick = r && r.status === 'MATCHING' && TF.match(r).some((m) => m.e.id === e.id);
      const revs = c.S.reviews.filter((x) => x.eid === e.id);
      return `${TF.back(r ? 'matching.html?r=' + r.id : 'home.html', r ? 'قائمة المهندسين' : 'الرئيسية')}
      <div class="ticket ticket--brand"><div class="ticket__body"><div class="row row--top">${avatar(e.name, 'avatar--lg')}<div class="grow"><h1>${esc(e.name)} ${TF.verifiedBadge}</h1><div class="row row--wrap" style="gap:10px">${stars(e.rating)}<b>${e.rating.toFixed(1)}</b><span class="muted">(${num(e.reviews)} تقييم)</span></div><div class="row row--wrap mt0" style="gap:6px"><span class="chip chip--ok">مهندس موثّق</span><span class="chip ${e.availability === 'AVAILABLE' ? 'chip--ok' : 'chip--warn'}">${L.AVAIL[e.availability]}</span>${e.hasShop ? `<span class="chip">${ic('store')} ${esc(e.shop)}</span>` : ''}</div></div></div>
        <div class="ticket__cut" style="margin:16px -4px"></div>
        <div class="grid g3"><div><div class="muted xs">طلبات منفذة</div><b class="num" style="font-size:20px">${num(e.jobs)}</b></div><div><div class="muted xs">سنوات الخبرة</div><b class="num" style="font-size:20px">${e.years}</b></div><div><div class="muted xs">منطقة العمل</div><b style="font-size:17px">${esc(e.area)}</b></div></div></div></div>
      <div class="stack mt"><div class="card"><div class="card__title">${ic('wrench')} التخصصات</div><div class="row row--wrap" style="gap:8px">${e.services.map((s) => `<span class="chip chip--brand">${L.SERVICES[s].name}</span>`).join('')}</div>${e.bio ? `<p class="mt muted">${esc(e.bio)}</p>` : ''}</div>
      <div class="card"><div class="card__title">${ic('star')} آراء العملاء</div>${revs.length ? `<ul class="list">${revs.map((v) => `<li class="row--top"><div class="grow"><div class="row between"><b>${esc(v.name)}</b>${stars(v.stars)}</div><p class="muted sm">${esc(v.text) || 'بدون تعليق'}</p><span class="muted xs">${when(v.t)}</span></div></li>`).join('')}</ul>` : '<p class="muted">لا توجد تقييمات بعد.</p>'}</div></div>
      ${canPick ? `<div class="actionbar"><button class="btn btn--primary grow" data-act="choose-eng" data-id="${e.id}">اختيار هذا المهندس</button></div>` : ''}`;
    },
  };

  /* -------------------------------------------------------------- قائمة الطلبات */
  let tab = 'open';
  P['customer.requests'] = {
    title: 'طلباتي',
    render(c) {
      const all = TF.myRequests(), open = all.filter(TF.isOpen), past = all.filter((r) => !TF.isOpen(r)), list = tab === 'open' ? open : past;
      return `${TF.head('طلباتي', '', '<a class="btn btn--primary" href="new-request.html">' + ic('plus') + ' طلب جديد</a>')}
      <div class="tabs mb" role="tablist"><button role="tab" aria-selected="${tab === 'open'}" data-act="tab" data-t="open">الحالية <span class="chip">${open.length}</span></button><button role="tab" aria-selected="${tab === 'past'}" data-act="tab" data-t="past">السابقة <span class="chip">${past.length}</span></button></div>
      ${list.length ? `<div class="stack">${list.map((r) => TF.reqCard(r, 'customer')).join('')}</div>` : U.empty('clipboard-list', tab === 'open' ? 'لا توجد طلبات حالية' : 'لا توجد طلبات سابقة', 'طلباتك المنتهية والملغاة تظهر هنا مع تاريخها وتقييمك.', tab === 'open' ? '<a class="btn btn--primary" href="new-request.html">اطلب خدمة</a>' : '')}`;
    },
  };
  TF.on('tab', (el) => { tab = el.dataset.t; TF.refresh(); });

  /* ------------------------------------------------------------- تفاصيل الطلب */
  let rate = 0;
  P['customer.request'] = {
    title: 'تفاصيل الطلب',
    render(c) {
      const r = getR(c); if (!r) return noAccess();
      const e = c.S.engineers.find((x) => x.id === r.engineerId), pi = TF.payInfo(r), pq = TF.pendingQuote(r), sv = L.SERVICES[r.service];
      const eCard = e ? `<div class="card"><div class="row">${avatar(e.name)}<div class="grow"><b>${esc(e.name)} ${TF.verifiedBadge}</b><div class="row sm muted" style="gap:8px">${stars(e.rating)} ${e.rating.toFixed(1)}</div></div><a class="btn btn--ghost btn--sm" href="engineer.html?e=${e.id}">الملف</a>${['CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETION_PENDING', 'COMPLETED'].includes(r.status) ? `<a class="btn btn--solid btn--sm" href="tel:${e.phone.replace(/\s/g, '')}">${ic('phone-call')} اتصال</a>` : ''}</div></div>` : '';
      let action = '';
      const S_ = r.status;
      if (S_ === 'MATCHING') action = `<div class="note note--warn">${ic('hourglass')}<span>${r.events.some((x) => x.text.includes('اعتذر')) ? 'اعتذر المهندس السابق عن الطلب. ' : ''}اختر مهندسا من القائمة لإرسال طلبك إليه.</span></div><a class="btn btn--primary btn--block" href="matching.html?r=${r.id}">${ic('users')} اختيار المهندس</a>`;
      if (S_ === 'ENGINEER_SELECTED') action = `<div class="note note--warn">${ic('hourglass')}<span>أُرسل طلبك إلى ${esc(e.name)} وبانتظار رده. سنخبرك فور القبول.</span></div><button class="btn btn--ghost btn--block" data-act="change-eng" data-id="${r.id}">اختيار مهندس آخر</button>`;
      if (S_ === 'ENGINEER_ACCEPTED') action = `<div class="note">${ic('file-text')}<span>قبل ${esc(e.name)} طلبك ويجهّز الآن عرض السعر. سيصلك إشعار عند وصوله.</span></div>`;
      if (S_ === 'QUOTE_SENT' && pq) action = `<h2>عرض السعر من ${esc(e.name)}</h2>${TF.quoteTable(pq)}<dl class="dl"><dt>مدة التنفيذ</dt><dd>${esc(pq.duration)}</dd>${pq.notes ? `<dt>ملاحظات المهندس</dt><dd>${esc(pq.notes)}</dd>` : ''}</dl><div class="note">${ic('info')}<span>الموافقة على العرض تعني اعتماد هذا السعر. لا يُعدَّل بعد الموافقة؛ وإن احتاج العمل بنودا إضافية فسيرسل المهندس عرضا إضافيا تقرره أنت.</span></div><div class="row row--wrap"><button class="btn btn--primary grow" data-act="accept-quote" data-id="${r.id}">${ic('check')} موافقة على العرض</button><button class="btn btn--danger" data-act="reject-quote" data-id="${r.id}">رفض العرض</button></div>`;
      if (S_ === 'QUOTE_REJECTED') action = `<div class="note note--bad">${ic('circle-x')}<span>رفضت عرض السعر. يمكن للمهندس إرسال عرض جديد، أو يمكنك اختيار مهندس آخر.</span></div><div class="row row--wrap"><button class="btn btn--solid grow" data-act="change-eng" data-id="${r.id}">اختيار مهندس آخر</button></div>`;
      if (S_ === 'QUOTE_ACCEPTED') action = `<h2>اختر طريقة الدفع</h2><div class="card card--flat row between"><span>إجمالي الطلب</span><b style="font-size:20px">${money(pi.total)}</b></div>
        <div class="grid g2 g2--stack"><div class="card"><div class="card__title">${ic('banknote')} نقدًا عند الانتهاء</div><p class="muted sm">تدفع للمهندس بعد إنجاز العمل وتأكيدك له. يتأكد حجزك فورًا.</p><button class="btn btn--primary btn--block mt" data-act="pay-cash" data-id="${r.id}">تأكيد الحجز والدفع نقدا</button></div>
        <div class="card"><div class="card__title">${ic('credit-card')} دفع إلكتروني الآن</div><p class="muted sm">تدفع عبر بوابة آمنة، ويتأكد الحجز بعد تحقق المنصة من الدفع.</p><button class="btn btn--solid btn--block mt" data-act="pay-online" data-id="${r.id}">ادفع ${moneyTxt(pi.total)}</button></div></div>`;
      if (['CONFIRMED', 'ON_THE_WAY', 'ARRIVED'].includes(S_)) {
        const lines = { CONFIRMED: 'تم تأكيد حجزك. سيتواصل معك المهندس ويبلغك قبل انطلاقه.', ON_THE_WAY: `${esc(e.name)} في طريقه إليك — الوصول المتوقع خلال نحو ${Math.round(TF.km(r.lat, r.lng, e.lat, e.lng) * 3 + 8)} دقيقة.`, ARRIVED: `وصل ${esc(e.name)} إلى موقعك وسيبدأ العمل.` };
        action = `<div class="note ${S_ === 'CONFIRMED' ? 'note--ok' : ''}">${ic(S_ === 'CONFIRMED' ? 'circle-check' : 'truck')}<span>${lines[S_]}</span></div>`;
      }
      if (S_ === 'IN_PROGRESS') action = `<div class="note">${ic('wrench')}<span>العمل جار الآن.</span></div>` + (pq ? `<div class="card card--flat stack"><h3>عرض سعر إضافي</h3><p class="muted sm">يرى المهندس أن العمل يحتاج بنودا إضافية. العرض الأصلي لم يتغير.</p>${TF.quoteTable(pq)}${pq.notes ? `<p class="sm">${esc(pq.notes)}</p>` : ''}<div class="row row--wrap"><button class="btn btn--primary grow" data-act="accept-quote" data-id="${r.id}">موافقة على الإضافة</button><button class="btn btn--danger" data-act="reject-quote" data-id="${r.id}">رفض الإضافة</button></div></div>` : '');
      if (S_ === 'COMPLETION_PENDING') action = `<div class="note note--warn">${ic('circle-alert')}<span>أنهى ${esc(e.name)} العمل. تأكد من النتيجة ثم أكد الإنجاز.${r.dispute ? ' تم تسجيل ملاحظتك وستراجعها الإدارة.' : ''}</span></div><div class="row row--wrap"><button class="btn btn--primary grow" data-act="confirm-done" data-id="${r.id}">${ic('check')} تأكيد إنجاز العمل</button>${r.dispute ? '' : `<button class="btn btn--ghost" data-act="report" data-id="${r.id}">لدي ملاحظة على التنفيذ</button>`}</div>`;
      if (S_ === 'COMPLETED') {
        if (pi.due > 0 && r.payment && r.payment.method === 'ONLINE') action = `<div class="note note--warn">${ic('wallet')}<span>تبقى ${moneyTxt(pi.due)} من البنود الإضافية. سددها إلكترونيا لتتمكن من التقييم.</span></div><button class="btn btn--primary btn--block" data-act="pay-online" data-id="${r.id}">سدد ${moneyTxt(pi.due)}</button>`;
        else if (pi.due > 0) action = `<div class="note note--warn">${ic('banknote')}<span>ادفع ${moneyTxt(pi.due)} نقدا للمهندس. بعد أن يؤكد استلام المبلغ يمكنك تقييم الخدمة.</span></div>`;
        else action = `<h2>كيف كانت تجربتك مع ${esc(e.name)}؟</h2><div class="row" role="radiogroup" aria-label="التقييم" style="gap:4px">${[1, 2, 3, 4, 5].map((n) => `<button class="iconbtn" data-act="star" data-n="${n}" role="radio" aria-checked="${rate === n}" aria-label="${n} من 5" style="width:48px;height:48px"><span class="stars" style="font-size:30px"><svg class="i ${rate >= n ? '' : 'off'}"><use href="#i-star"/></svg></span></button>`).join('')}</div><div class="field"><label for="rtext">اكتب رأيك (اختياري)</label><textarea class="textarea" id="rtext" placeholder="ما الذي أعجبك؟ وما الذي يمكن تحسينه؟"></textarea></div><button class="btn btn--primary btn--block" data-act="submit-rating" data-id="${r.id}">إرسال التقييم</button>`;
      }
      if (S_ === 'RATED') action = `<div class="note note--ok">${ic('circle-check')}<span>شكرًا لتقييمك. تم إغلاق الطلب.</span></div><div class="card card--flat"><div class="row between">${stars(r.rating.stars)}<span class="muted xs">${when(r.rating.at)}</span></div>${r.rating.text ? `<p class="sm">${esc(r.rating.text)}</p>` : ''}</div><a class="btn btn--ghost btn--block" href="invoice.html?r=${r.id}">${ic('receipt')} عرض الفاتورة</a>`;
      if (S_ === 'CANCELLED') action = `<div class="note note--bad">${ic('ban')}<span>تم إلغاء هذا الطلب${r.cancelReason ? ': ' + esc(r.cancelReason) : ''}.</span></div><a class="btn btn--solid btn--block" href="new-request.html?svc=${r.service}">طلب خدمة جديدة</a>`;
      const accepted = r.quotes.filter((q) => q.status === 'ACCEPTED');
      return `${TF.back('requests.html', 'طلباتي')}
      <div class="ticket ticket--${['IN_PROGRESS', 'ON_THE_WAY', 'ARRIVED'].includes(S_) ? 'accent' : 'brand'}"><div class="ticket__body"><div class="row row--top">${ic(sv.icon, 'i--lg')}<div class="grow"><div class="row between row--wrap"><h1 style="font-size:22px">${esc(r.sub)}</h1>${TF.chip(S_, 'customer')}</div><div class="muted sm">${sv.name} · رقم الطلب ${r.id}</div></div></div></div><div class="ticket__cut"></div>
        <div class="ticket__body"><dl class="dl"><dt>الوصف</dt><dd>${esc(r.desc)}</dd><dt>العنوان</dt><dd>${esc(r.address)}</dd><dt>الموعد المفضل</dt><dd>${TF.whenText(r.when)}</dd>${pi.total ? `<dt>الإجمالي</dt><dd>${money(pi.total)}</dd><dt>الدفع</dt><dd>${r.payment ? L.PAY[r.payment.method] : '—'} · ${L.PAYSTATE[pi.state]}</dd>` : ''}</dl></div></div>
      <div class="stack mt">${eCard}${action ? `<div class="card stack">${action}</div>` : ''}
      <div class="card"><div class="card__title">${ic('list-checks')} مراحل الطلب</div>${TF.rail(r, 'customer')}</div>
      ${accepted.length && !['QUOTE_SENT'].includes(S_) ? `<div class="card"><div class="card__title">${ic('receipt')} بنود السعر المعتمدة</div><div class="stack">${accepted.map((q) => TF.quoteTable(q)).join('')}</div></div>` : ''}
      ${TF.cancellable(r) ? `<button class="btn btn--quiet" style="color:var(--bad);align-self:flex-start" data-act="cancel-req" data-id="${r.id}">إلغاء الطلب</button>` : ''}</div>`;
    },
  };
  const rid = (el) => el.dataset.id;
  TF.on('change-eng', async (el) => { const v = await U.confirm({ title: 'اختيار مهندس آخر؟', body: 'سنسحب طلبك من المهندس الحالي ونعرض عليك مهندسين آخرين مناسبين.', ok: 'نعم، اختيار آخر' }); if (v) U.done(A.changeEngineer(rid(el)), '', () => (location.href = 'matching.html?r=' + rid(el))); });
  TF.on('accept-quote', async (el) => { const r = TF.req(rid(el)), q = TF.pendingQuote(r); const v = await U.confirm({ title: 'الموافقة على السعر؟', body: `إجمالي ${moneyTxt(q.total)}. لن يتغير هذا السعر بعد الموافقة.`, ok: 'موافقة' }); if (v) U.done(A.acceptQuote(rid(el)), 'تمت الموافقة على العرض'); });
  TF.on('reject-quote', async (el) => { const v = await U.confirm({ title: 'رفض العرض؟', body: 'اذكر السبب ليتمكن المهندس من تعديل العرض (اختياري).', ok: 'رفض العرض', danger: true, extra: '<textarea class="textarea mt" placeholder="مثال: السعر أعلى من المتوقع"></textarea>' }); if (v) U.done(A.rejectQuote(rid(el), v.val), 'تم رفض العرض'); });
  TF.on('pay-cash', async (el) => { const v = await U.confirm({ title: 'تأكيد الحجز نقدا؟', body: 'سيتأكد حجزك فورا ويصبح عنوانك ورقمك ظاهرين للمهندس. تدفع المبلغ بعد انتهاء العمل.', ok: 'تأكيد الحجز' }); if (v) U.done(A.payCash(rid(el)), 'تم تأكيد الحجز'); });
  TF.on('pay-online', (el) => TF.openGateway(rid(el)));
  TF.on('confirm-done', async (el) => { const v = await U.confirm({ title: 'تأكيد إنجاز العمل؟', body: 'بتأكيدك يعتبر العمل منتهيًا وننتقل إلى السداد والتقييم.', ok: 'تأكيد الإنجاز' }); if (v) U.done(A.confirmCompletion(rid(el)), 'تم تأكيد الإنجاز'); });
  TF.on('report', async (el) => { const v = await U.confirm({ title: 'ما الملاحظة على التنفيذ؟', body: 'ستصل ملاحظتك إلى المهندس والإدارة، ولن يغلق الطلب قبل معالجتها.', ok: 'إرسال الملاحظة', extra: '<textarea class="textarea mt" placeholder="اشرح المشكلة بإيجاز"></textarea>' }); if (v) U.done(A.reportProblem(rid(el), v.val), 'تم إرسال ملاحظتك'); });
  TF.on('cancel-req', async (el) => { const v = await U.confirm({ title: 'إلغاء الطلب؟', body: 'سيغلق الطلب ويخطر المهندس إن كان قد اختير.', ok: 'إلغاء الطلب', cancel: 'تراجع', danger: true, extra: '<select class="select mt"><option>تغيرت خطتي</option><option>وجدت مهندسا آخر</option><option>السعر غير مناسب</option><option>سبب آخر</option></select>' }); if (v) U.done(A.cancel(rid(el), v.val), 'تم إلغاء الطلب'); });
  TF.on('star', (el) => { rate = Number(el.dataset.n); const t = $('#rtext') && $('#rtext').value; TF.refresh(); if (t) $('#rtext').value = t; });
  TF.on('submit-rating', (el) => { const r = A.rate(rid(el), rate, ($('#rtext') || {}).value); if (rate < 1) { U.toast('اختر عدد النجوم أولًا.', 'bad'); return; } U.done(r, 'شكرا لتقييمك', () => (rate = 0)); });

  /* ------------------------------------------------------------------ الفاتورة */
  P['customer.invoice'] = {
    title: 'الفاتورة',
    render(c) {
      const r = getR(c); if (!r || !['COMPLETED', 'RATED'].includes(r.status)) return noAccess();
      const e = c.S.engineers.find((x) => x.id === r.engineerId), pi = TF.payInfo(r);
      return `${TF.back('request.html?r=' + r.id, 'تفاصيل الطلب')}<div class="ticket"><div class="ticket__body"><div class="row between row--top"><div class="brandmark"><img src="../assets/brand/logo-app.png" alt=""><span>Tech<b>Fix</b></span></div><div style="text-align:end"><h2>فاتورة خدمة</h2><span class="muted sm">رقم الطلب ${r.id}</span></div></div></div><div class="ticket__cut"></div>
      <div class="ticket__body stack"><dl class="dl"><dt>العميل</dt><dd>${esc(c.me.user.name)}</dd><dt>المهندس</dt><dd>${esc(e.name)}</dd><dt>الخدمة</dt><dd>${esc(r.sub)}</dd><dt>العنوان</dt><dd>${esc(r.address)}</dd><dt>التاريخ</dt><dd>${TF.shortDate.format(r.payment.paidAt || r.createdAt)}</dd></dl>
      ${r.quotes.filter((q) => q.status === 'ACCEPTED').map((q) => TF.quoteTable(q)).join('')}
      <div class="card card--flat"><div class="row between"><span>الإجمالي</span><b style="font-size:20px">${money(pi.total)}</b></div><div class="row between sm muted"><span>طريقة الدفع</span><span>${L.PAY[r.payment.method]}</span></div><div class="row between sm muted"><span>حالة الدفع</span><span>${L.PAYSTATE[pi.state]}</span></div></div></div></div>
      <div class="actionbar no-print"><button class="btn btn--solid grow" data-act="print">${ic('printer')} طباعة أو حفظ PDF</button></div>`;
    },
  };
  TF.on('print', () => window.print());

  /* ------------------------------------------------------------- الإشعارات والحساب */
  P['customer.notifications'] = TF.notifPage('customer');
  P['customer.profile'] = {
    title: 'حسابي',
    render(c) {
      const u = c.me.user;
      return `${TF.head('حسابي')}<div class="stack">
      <form class="card stack" data-form="cprofile"><div class="row">${avatar(u.name, 'avatar--lg')}<div><h2>${esc(u.name)}</h2><span class="muted sm">${ROLE_TXT}</span></div></div>
        <div class="field"><label for="pn">الاسم</label><input class="input" id="pn" name="name" value="${esc(u.name)}" required></div>
        <div class="field"><label for="pp">رقم الهاتف</label><input class="input" id="pp" name="phone" value="${esc(u.phone)}" dir="ltr" style="text-align:end" required></div>
        <div class="field"><label>البريد الإلكتروني</label><input class="input" value="${esc(u.email)}" dir="ltr" style="text-align:end" disabled></div>
        <button class="btn btn--solid" type="submit">حفظ التعديلات</button></form>
      <div class="card"><div class="card__title">${ic('map-pin')} عناويني</div>${u.addresses.length ? `<ul class="list">${u.addresses.map((a) => `<li>${ic('house')}<div class="grow"><b>${esc(a.label)}</b><div class="muted sm">${esc(a.text)}</div></div><button class="iconbtn" data-act="del-addr" data-id="${a.id}" aria-label="حذف العنوان">${ic('trash-2')}</button></li>`).join('')}</ul>` : '<p class="muted sm">لم تحفظ عنوانا بعد. يمكنك حفظ عنوان عند إنشاء طلب.</p>'}
        <form class="row row--wrap mt" data-form="addr"><input class="input grow" name="text" placeholder="عنوان جديد، مثال: شارع الهرم، الجيزة" required style="min-width:200px"><button class="btn btn--ghost" type="submit">${ic('plus')} إضافة</button></form></div>
      <div class="card row between"><div><b>المظهر</b><div class="muted sm">فاتح أو داكن</div></div><button class="btn btn--ghost" data-act="theme">${ic('moon')} تبديل المظهر</button></div>
      <button class="btn btn--danger" data-act="logout">${ic('log-out')} تسجيل الخروج</button></div>`;
    },
  };
  const ROLE_TXT = 'حساب عميل';
  TF.on('form:cprofile', (f, e, c) => { const u = c.me.user; u.name = f.name.value.trim() || u.name; u.phone = f.phone.value.trim() || u.phone; TF.save(); U.toast('تم حفظ التعديلات', 'ok'); TF.refresh(); });
  TF.on('form:addr', (f, e, c) => { const t = f.text.value.trim(); if (!t) return; c.me.user.addresses.push({ id: 'a' + Date.now(), label: 'عنوان', text: t, area: t.split('،').pop().trim(), lat: 30.0382, lng: 31.2118 }); TF.save(); TF.refresh(); });
  TF.on('del-addr', (el, e, c) => { c.me.user.addresses = c.me.user.addresses.filter((a) => a.id !== el.dataset.id); TF.save(); TF.refresh(); });

  TF.boot();
})();
