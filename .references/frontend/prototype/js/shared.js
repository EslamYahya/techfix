/* مكوّنات مشتركة بين البوابات الثلاث + إقلاع الصفحة */
(function () {
  const { esc, ic, num, money, moneyTxt, when, avatar, stars, ui: U, L } = TF;
  TF.pages = {};
  TF.boot = () => {
    const b = document.body, key = (b.dataset.app || 'public') + '.' + b.dataset.page;
    const def = TF.pages[key]; if (!def) { document.body.textContent = 'صفحة غير معرّفة: ' + key; return; }
    TF.page({ app: b.dataset.app || null, page: b.dataset.page, ...def });
  };
  TF.head = (title, sub = '', actions = '') => `<div class="pagehead"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="row row--wrap">${actions}</div>` : ''}</div>`;
  TF.back = (href, text) => `<a class="btn btn--quiet mb" href="${href}">${ic('arrow-right', 'flip')} ${esc(text)}</a>`;
  TF.sec = (title, body, extra = '') => `<section class="stack" style="gap:10px"><div class="row between"><h2>${esc(title)}</h2>${extra}</div>${body}</section>`;
  TF.stat = (label, value, note = '', cls = '') => `<div class="kpi ${cls}"><div class="kpi__label">${esc(label)}</div><div class="kpi__value">${value}</div>${note ? `<div class="kpi__note">${note}</div>` : ''}</div>`;
  TF.phone = (p) => `<a class="ltr" href="tel:${String(p).replace(/\s/g, '')}">${esc(p)}</a>`;
  TF.verifiedBadge = `<span class="verified" title="مهندس موثق" aria-label="مهندس موثق">${ic('badge-check')}</span>`;

  // خريطة توضيحية (SVG) — في المشروع الفعلي تُستبدل بخريطة حقيقية
  TF.map = (pins = [], tag = '') => `<div class="map" role="img" aria-label="خريطة توضيحية للموقع"><svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice"><path d="M0 120 C100 90 180 150 400 80" stroke="var(--line-strong)" stroke-width="10" fill="none" opacity=".6"/><path d="M120 0 C140 70 110 140 150 200" stroke="var(--line-strong)" stroke-width="7" fill="none" opacity=".6"/><path d="M0 40 L400 150" stroke="var(--line)" stroke-width="4" fill="none"/>${pins.map((p) => `<g transform="translate(${p.x} ${p.y})"><circle r="${p.me ? 14 : 10}" fill="${p.me ? 'var(--accent)' : 'var(--teal)'}" opacity=".25"/><circle r="${p.me ? 7 : 5}" fill="${p.me ? 'var(--accent)' : 'var(--brand)'}" stroke="#fff" stroke-width="2"/></g>`).join('')}</svg>${tag ? `<span class="map__tag">${ic('map-pin')} ${esc(tag)}</span>` : ''}</div>`;

  /* ------------------------------------------------- مركز الإشعارات (مشترك) */
  TF.notifPage = (role) => ({
    title: 'الإشعارات',
    render() {
      const list = TF.notifs();
      return TF.head('الإشعارات', 'كل ما يخصّ طلباتك في مكان واحد.', list.some((n) => !n.read) ? '<button class="btn btn--ghost btn--sm" data-act="read-all">تحديد الكل كمقروء</button>' : '') +
        (list.length ? `<div class="card card--tight"><ul class="list">${list.map((n) => `<li><span class="chip ${n.read ? '' : 'chip--brand'}" style="padding:8px">${ic('bell')}</span><a class="grow" href="${n.link}" style="color:inherit"><div class="${n.read ? '' : 'bold'}">${esc(n.text)}</div><div class="muted xs">${when(n.t)}</div></a>${n.read ? '' : '<span class="chip chip--live" aria-label="غير مقروء"></span>'}</li>`).join('')}</ul></div>` : U.empty('bell', 'لا توجد إشعارات', 'ستصلك هنا تحديثات الطلبات فور حدوثها.'));
    },
  });
  TF.on('read-all', () => { TF.markRead(); TF.refresh(); });

  /* ---------------------------------------------- بوابة الدفع (محاكاة) */
  // المتصفح يعود من البوابة لكن التأكيد الحقيقي يصل من الخادم فقط (webhook).
  TF.openGateway = (rid) => {
    const r = TF.A.beginOnline(rid); if (!r.ok) { U.toast(r.msg, 'bad'); return; }
    const a = r.attempt;
    const s = U.sheet(`${U.head('الدفع الإلكتروني الآمن')}
      <div class="note">${ic('info')}<span>هذه شاشة محاكاة لبوابة الدفع. لا تدخل بيانات بطاقة حقيقية، وبيانات البطاقة لا تمر عبر TechFix في المشروع الفعلي.</span></div>
      <div class="card card--flat mt"><div class="row between"><span>المبلغ المطلوب</span><b style="font-size:20px">${money(a.amount)}</b></div><div class="muted xs mt0">رقم العملية <span class="ltr">${a.ref}</span></div></div>
      <div class="stack mt"><label class="choice"><input type="radio" name="gm" checked> ${ic('credit-card')} بطاقة بنكية</label><label class="choice"><input type="radio" name="gm"> ${ic('smartphone')} محفظة إلكترونية</label></div>
      <div id="gw-actions" class="row mt" style="flex-wrap:wrap"><button class="btn btn--primary grow" data-gw="ok">${ic('lock')} ادفع ${moneyTxt(a.amount)}</button><button class="btn btn--ghost" data-gw="no">محاكاة فشل الدفع</button></div>`, { title: 'الدفع', focus: false });
    s.addEventListener('click', (e) => {
      const b = e.target.closest('[data-gw]'); if (!b) return; const ok = b.dataset.gw === 'ok';
      $('#gw-actions', s).innerHTML = `<div class="empty grow" aria-busy="true" style="padding:18px">${ic('refresh-cw')}<b>${ok ? 'عدنا إلى TechFix — جار التحقق من الدفع…' : 'جارٍ إنهاء العملية…'}</b><span class="muted sm">لا تغلق الصفحة. التأكيد يأتي من بوابة الدفع وليس من هذه الشاشة.</span></div>`;
      setTimeout(() => { const res = TF.A.gatewayWebhook(rid, ok); U.close(); if (res.ok && res.paid) U.toast('تم الدفع بنجاح', 'ok'); else U.toast('تعذر إتمام الدفع. لم يخصم أي مبلغ — جرب مرة أخرى أو اختر الدفع نقدا.', 'bad'); TF.refresh(); }, 1300);
    });
    function $(q, r) { return r.querySelector(q); }
  };

  /* -------------------------------------------- بطاقة مهندس / ملف مهندس */
  TF.engCard = (m, actions) => {
    const e = m.e;
    return `<article class="card"><div class="row row--top">${avatar(e.name, 'avatar--lg')}<div class="grow"><div class="row between row--wrap"><h3>${esc(e.name)} ${e.verification === 'VERIFIED' ? TF.verifiedBadge : ''}</h3>${m.first ? '<span class="chip chip--live">الأنسب لطلبك</span>' : ''}</div>
      <div class="row row--wrap sm muted" style="gap:10px">${stars(e.rating)}<b style="color:var(--ink)">${e.rating.toFixed(1)}</b><span>(${num(e.reviews)} تقييم)</span><span>· ${num(e.jobs)} طلب منفذ</span></div>
      <div class="row row--wrap sm mt0" style="gap:6px">${e.services.map((s) => `<span class="chip chip--brand">${L.SERVICES[s].name}</span>`).join('')}${e.hasShop ? `<span class="chip">${ic('store')} صاحب محل</span>` : ''}</div></div></div>
      <div class="row row--wrap sm mt" style="gap:16px"><span class="row" style="gap:6px">${ic('map-pin')} على بعد ${m.d.toFixed(1)} كم</span><span class="row" style="gap:6px">${ic('clock')} يصل خلال نحو ${m.eta} دقيقة</span><span class="chip ${e.availability === 'AVAILABLE' ? 'chip--ok' : 'chip--warn'}">${L.AVAIL[e.availability]}</span></div>
      ${m.reasons && m.reasons.length ? `<div class="row row--wrap mt0" style="gap:6px">${m.reasons.map((x) => `<span class="chip">${ic('check')} ${x}</span>`).join('')}</div>` : ''}
      ${actions ? `<div class="row row--wrap mt">${actions}</div>` : ''}</article>`;
  };
})();
