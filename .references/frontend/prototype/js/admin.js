/* بوابة المشرف — /admin/* */
(function () {
  const { esc, ic, num, money, moneyTxt, when, avatar, stars, ui: U, L, A, $, $$ } = TF;
  const P = TF.pages;
  const GROUP = { open: ['REQUESTED', 'MATCHING', 'ENGINEER_SELECTED', 'ENGINEER_ACCEPTED', 'QUOTE_SENT', 'QUOTE_REJECTED', 'QUOTE_ACCEPTED'], run: ['CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETION_PENDING'], done: ['COMPLETED', 'RATED'], cancelled: ['CANCELLED'] };
  const GLBL = { open: 'قبل التنفيذ', run: 'قيد التنفيذ', done: 'مكتملة', cancelled: 'ملغاة' };
  const cname = (r) => TF.get().customers.find((c) => c.id === r.customerId).name;
  const ename = (r) => { const e = TF.get().engineers.find((x) => x.id === r.engineerId); return e ? e.name : '—'; };

  /* ----------------------------------------------------------- نظرة عامة */
  P['admin.home'] = {
    title: 'نظرة عامة',
    render(c) {
      const S = c.S, rs = S.requests, pending = S.engineers.filter((e) => e.verification === 'PENDING'), disputes = rs.filter((r) => r.dispute && r.status === 'COMPLETION_PENDING');
      const done = rs.filter((r) => ['COMPLETED', 'RATED'].includes(r.status)), canc = rs.filter((r) => r.status === 'CANCELLED');
      const rate = rs.length ? Math.round((done.length / (done.length + canc.length || 1)) * 100) : 0;
      const vol = rs.reduce((a, r) => a + (r.payment ? r.payment.paid : 0), 0);
      const bySvc = Object.keys(L.SERVICES).map((k) => [L.SERVICES[k].name, rs.filter((r) => r.service === k).length]); const mx = Math.max(1, ...bySvc.map((x) => x[1]));
      return `${TF.head('نظرة عامة', 'حالة السوق في ' + esc(S.settings.city) + '.')}
      <div class="kpis mb">${TF.stat('إجمالي الطلبات', num(rs.length))}${TF.stat('نسبة الإتمام', rate + '%', 'من الطلبات المنتهية')}${TF.stat('مهندسون موثقون', S.engineers.filter((e) => e.verification === 'VERIFIED' && e.account === 'ACTIVE').length, `${pending.length} بانتظار التوثيق`, pending.length ? 'kpi--accent' : '')}${TF.stat('المبالغ المحصلة', money(vol), 'عمولة المنصة ' + S.settings.commission + '%')}</div>
      <div class="grid g2 g2--stack" style="align-items:start">
        <div class="stack"><div class="card"><div class="card__title">${ic('circle-alert')} يحتاج إجراء منك</div>
          ${pending.length || disputes.length ? `<ul class="list">${pending.length ? `<li>${ic('user-check')}<span class="grow">${pending.length} مهندس بانتظار مراجعة التوثيق</span><a class="btn btn--solid btn--sm" href="engineers.html">مراجعة</a></li>` : ''}${disputes.map((r) => `<li>${ic('triangle-alert')}<span class="grow">ملاحظة من العميل على الطلب ${r.id}</span><a class="btn btn--solid btn--sm" href="requests.html?r=${r.id}">عرض</a></li>`).join('')}</ul>` : '<p class="muted">لا توجد بنود معلقة. كل شيء على ما يرام.</p>'}</div>
        <div class="card"><div class="card__title">${ic('chart-column')} الطلبات حسب الخدمة</div><div class="bars">${bySvc.map(([n, v]) => `<div><b>${v}</b><i style="height:${Math.max(6, (v / mx) * 100)}%"></i><span>${n}</span></div>`).join('')}</div></div></div>
        <div class="card"><div class="card__title">${ic('clipboard-list')} آخر الطلبات</div><ul class="list">${rs.slice(0, 6).map((r) => `<li><div class="grow"><a href="requests.html?r=${r.id}"><b>${esc(r.sub)}</b></a><div class="muted xs">${r.id} · ${esc(cname(r))}</div></div>${TF.chip(r.status, 'admin')}</li>`).join('')}</ul><a class="btn btn--quiet mt" href="requests.html">كل الطلبات</a></div></div>`;
    },
  };

  /* ---------------------------------------------------------- المهندسون */
  let etab = 'PENDING';
  const ETABS = [['PENDING', 'بانتظار التوثيق'], ['VERIFIED', 'موثقون'], ['SUSPENDED', 'موقوفون'], ['REJECTED', 'مرفوضون']];
  const inTab = (e, t) => (t === 'SUSPENDED' ? e.account === 'SUSPENDED' : e.account === 'ACTIVE' && e.verification === t);
  P['admin.engineers'] = {
    title: 'المهندسون',
    render(c) {
      const list = c.S.engineers.filter((e) => inTab(e, etab));
      return `${TF.head('المهندسون', 'راجع طلبات التوثيق وأدر حالة الحسابات.')}<div class="tabs mb" role="tablist">${ETABS.map(([k, t]) => { const n = c.S.engineers.filter((e) => inTab(e, k)).length; return `<button role="tab" aria-selected="${etab === k}" data-act="atab" data-t="${k}">${t} <span class="chip">${n}</span></button>`; }).join('')}</div>
      ${list.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>المهندس</th><th>التخصصات</th><th>الخبرة</th><th>المنطقة</th><th>التقييم</th><th>الإجراء</th></tr></thead><tbody>${list.map((e) => `<tr><td><div class="row">${avatar(e.name, 'avatar--sm')}<div><b>${esc(e.name)}</b><div class="muted xs">${e.hasShop ? esc(e.shop) : 'مستقل'}</div></div></div></td><td>${e.services.map((s) => L.SERVICES[s].name).join('، ')}</td><td class="num">${e.years} سنوات</td><td>${esc(e.area)}</td><td>${e.reviews ? `<span class="num">${e.rating.toFixed(1)}</span> (${e.reviews})` : '—'}</td><td><button class="btn btn--ghost btn--sm" data-act="eng-open" data-id="${e.id}">${etab === 'PENDING' ? 'مراجعة' : 'عرض'}</button></td></tr>`).join('')}</tbody></table></div>` : U.empty('users', 'لا يوجد مهندسون في هذا القسم', 'عندما تتغير حالة أي حساب سينتقل إلى القسم المناسب.')}`;
    },
  };
  TF.on('atab', (el) => { etab = el.dataset.t; TF.refresh(); });
  TF.on('eng-open', (el, ev, c) => {
    const e = c.S.engineers.find((x) => x.id === el.dataset.id);
    const acts = e.verification === 'PENDING' ? `<button class="btn btn--ok grow" data-act="ok-eng" data-id="${e.id}" ${e.docs.every((d) => d.ok) ? '' : 'disabled'}>${ic('check')} توثيق الحساب</button><button class="btn btn--danger" data-act="no-eng" data-id="${e.id}">رفض</button>` : e.account === 'ACTIVE' ? `<button class="btn btn--danger" data-act="susp-eng" data-id="${e.id}">${ic('ban')} إيقاف الحساب</button>` : `<button class="btn btn--solid" data-act="react-eng" data-id="${e.id}">إعادة تفعيل الحساب</button>`;
    U.sheet(`${U.head('ملف المهندس')}<div class="row">${avatar(e.name, 'avatar--lg')}<div class="grow"><h3>${esc(e.name)}</h3><div class="row row--wrap" style="gap:6px"><span class="chip chip--${e.verification === 'VERIFIED' ? 'ok' : e.verification === 'PENDING' ? 'warn' : 'bad'}">${L.VERIF[e.verification]}</span><span class="chip ${e.account === 'ACTIVE' ? '' : 'chip--bad'}">${L.ACCOUNT[e.account]}</span></div></div></div>
      <dl class="dl mt"><dt>الهاتف</dt><dd>${TF.phone(e.phone)}</dd><dt>البريد</dt><dd><span class="ltr">${esc(e.email)}</span></dd><dt>التخصصات</dt><dd>${e.services.map((s) => L.SERVICES[s].name).join('، ')}</dd><dt>الخبرة</dt><dd>${e.years} سنوات</dd><dt>المنطقة</dt><dd>${esc(e.area)} (نطاق ${e.radius} كم)</dd>${e.bio ? `<dt>نبذة</dt><dd>${esc(e.bio)}</dd>` : ''}</dl>
      <h4 class="mt">المستندات</h4><ul class="list">${e.docs.map((d) => `<li>${ic('file-check')}<span class="grow">${d.k}</span>${d.ok ? '<span class="chip chip--ok">مرفوع</span>' : '<span class="chip chip--warn">ناقص</span>'}</li>`).join('')}</ul>${e.verification === 'PENDING' && !e.docs.every((d) => d.ok) ? '<div class="note note--warn mt">' + ic('info') + '<span>لا يمكن التوثيق قبل اكتمال المستندات.</span></div>' : ''}
      <div class="row row--wrap mt">${acts}</div>`, { title: e.name });
  });
  const reload = () => { U.close(); TF.refresh(); };
  TF.on('ok-eng', (el) => { const r = A.verify(el.dataset.id, true); U.done(r, 'تم توثيق الحساب', reload); });
  TF.on('no-eng', async (el) => { const v = await U.confirm({ title: 'رفض التوثيق؟', body: 'اذكر السبب ليتمكن المهندس من التصحيح.', ok: 'رفض', danger: true, extra: '<textarea class="textarea mt" placeholder="مثال: صورة الهوية غير واضحة"></textarea>' }); if (v) U.done(A.verify(el.dataset.id, false, v.val), 'تم رفض الطلب', reload); });
  TF.on('susp-eng', async (el) => { const v = await U.confirm({ title: 'إيقاف الحساب؟', body: 'لن يظهر المهندس في الترشيحات ولن يتمكن من الدخول حتى تعيد تفعيله.', ok: 'إيقاف', danger: true }); if (v) U.done(A.setAccount(el.dataset.id, 'SUSPENDED'), 'تم إيقاف الحساب', reload); });
  TF.on('react-eng', (el) => U.done(A.setAccount(el.dataset.id, 'ACTIVE'), 'تمت إعادة التفعيل', reload));

  /* ------------------------------------------------------------- الطلبات */
  let rg = 'all', rs_ = 'all';
  P['admin.requests'] = {
    title: 'الطلبات',
    render(c) {
      const id = c.q.get('r');
      if (id) {
        const r = TF.req(id); if (!r) return U.empty('search', 'الطلب غير موجود', 'تحقق من الرقم وحاول مرة أخرى.', '<a class="btn btn--solid" href="requests.html">كل الطلبات</a>');
        const pi = TF.payInfo(r), sv = L.SERVICES[r.service];
        return `${TF.back('requests.html', 'كل الطلبات')}${r.dispute ? `<div class="note note--bad mb">${ic('triangle-alert')}<span>ملاحظة من العميل: «${esc(r.dispute.text)}» — ${when(r.dispute.at)}</span></div>` : ''}
        <div class="grid g2 g2--stack" style="align-items:start"><div class="ticket"><div class="ticket__body"><div class="row row--top">${ic(sv.icon, 'i--lg')}<div class="grow"><div class="row between row--wrap"><h2>${esc(r.sub)}</h2>${TF.chip(r.status, 'admin')}</div><div class="muted sm">${sv.name} · ${r.id}</div></div></div></div><div class="ticket__cut"></div><div class="ticket__body"><dl class="dl"><dt>العميل</dt><dd>${esc(cname(r))}</dd><dt>المهندس</dt><dd>${esc(ename(r))}</dd><dt>العنوان</dt><dd>${esc(r.address)}</dd><dt>الموعد</dt><dd>${TF.whenText(r.when)}</dd><dt>الوصف</dt><dd>${esc(r.desc)}</dd>${pi.total ? `<dt>الإجمالي</dt><dd>${money(pi.total)}</dd><dt>الدفع</dt><dd>${r.payment ? L.PAY[r.payment.method] : '—'} · ${L.PAYSTATE[pi.state]}</dd>` : ''}</dl></div></div>
        <div class="stack"><div class="card"><div class="card__title">${ic('list-checks')} سجل الطلب</div>${TF.rail(r, 'admin')}</div>${r.quotes.length ? `<div class="card"><div class="card__title">${ic('receipt')} عروض السعر</div><div class="stack">${r.quotes.map((q) => `<div><div class="row between mb"><b>${q.kind === 'ADDITIONAL' ? 'عرض إضافي' : 'العرض الأساسي'}</b><span class="chip ${q.status === 'ACCEPTED' ? 'chip--ok' : q.status === 'REJECTED' ? 'chip--bad' : q.status === 'SENT' ? 'chip--warn' : ''}">${{ ACCEPTED: 'مقبول', REJECTED: 'مرفوض', SENT: 'بانتظار الرد', REPLACED: 'استُبدل بعرض جديد', WITHDRAWN: 'سحب' }[q.status]}</span></div>${TF.quoteTable(q)}</div>`).join('')}</div></div>` : ''}
        ${TF.cancellable(r) ? `<button class="btn btn--danger" data-act="a-cancel" data-id="${r.id}">إلغاء الطلب من الإدارة</button>` : ''}</div></div>`;
      }
      const sel = c.S.requests.filter((r) => (rg === 'all' || GROUP[rg].includes(r.status)) && (rs_ === 'all' || r.service === rs_));
      return `${TF.head('الطلبات', 'كل طلبات المنصة وحالتها الحالية.')}<div class="row row--wrap mb"><div class="tabs grow" role="tablist">${[['all', 'الكل'], ...Object.entries(GLBL)].map(([k, t]) => `<button role="tab" aria-selected="${rg === k}" data-act="rg" data-t="${k}">${t}</button>`).join('')}</div><select class="select" style="max-width:190px" data-change="rsvc" aria-label="الخدمة"><option value="all">كل الخدمات</option>${Object.entries(L.SERVICES).map(([k, v]) => `<option value="${k}" ${rs_ === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></div>
      ${sel.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>الطلب</th><th>الخدمة</th><th>العميل</th><th>المهندس</th><th>الحالة</th><th>القيمة</th></tr></thead><tbody>${sel.map((r) => `<tr><td><a href="requests.html?r=${r.id}"><b>${r.id}</b></a></td><td>${esc(r.sub)}<div class="muted xs">${L.SERVICES[r.service].name}</div></td><td>${esc(cname(r))}</td><td>${esc(ename(r))}</td><td>${TF.chip(r.status, 'admin')}${r.dispute ? ' <span class="chip chip--bad">ملاحظة</span>' : ''}</td><td class="num">${TF.payInfo(r).total ? num(TF.payInfo(r).total) + ' ج.م' : '—'}</td></tr>`).join('')}</tbody></table></div>` : U.empty('search', 'لا توجد طلبات مطابقة', 'غير الفلتر لعرض نتائج أخرى.')}`;
    },
  };
  TF.on('rg', (el) => { rg = el.dataset.t; TF.refresh(); });
  TF.on('change:rsvc', (el) => { rs_ = el.value; TF.refresh(); });
  TF.on('a-cancel', async (el) => { const v = await U.confirm({ title: 'إلغاء الطلب؟', body: 'سيخطر العميل والمهندس بالإلغاء.', ok: 'إلغاء الطلب', danger: true, extra: '<input class="input mt" placeholder="سبب الإلغاء">' }); if (v) U.done(A.adminCancel(el.dataset.id, ($('#sheet input') || {}).value), 'تم إلغاء الطلب'); });

  /* ------------------------------------------------- الترشيح والخدمات */
  const WL = { service: 'ملاءمة التخصص', distance: 'القرب', availability: 'التوفر', rating: 'التقييم', experience: 'الخبرة' };
  let draftW = null, psvc = 'CCTV';
  P['admin.matching'] = {
    title: 'الترشيح والخدمات',
    render(c) {
      const S = c.S, W = draftW || { ...S.settings.weights }, sum = Object.values(W).reduce((a, b) => a + b, 0);
      const probe = { service: psvc, sub: L.SERVICES[psvc].subs[0], lat: 30.0382, lng: 31.2118, rejectedBy: [] }, ranked = TF.match(probe, W);
      return `${TF.head('الترشيح والخدمات', 'تحكم في كيفية ترتيب المهندسين للعميل وفي الخدمات المتاحة.')}
      <div class="grid g2 g2--stack" style="align-items:start"><div class="stack">
      <div class="card stack"><h3>أوزان الترتيب</h3><p class="muted sm">تطبق على المهندسين المؤهلين فقط (موثق، نشط، متاح، ضمن النطاق). لا تظهر الدرجات للعملاء.</p>
        ${Object.entries(WL).map(([k, t]) => `<div class="field"><div class="row between"><label for="w-${k}">${t}</label><b class="num">${W[k]}%</b></div><input type="range" id="w-${k}" min="0" max="60" step="5" value="${W[k]}" data-live="w" name="${k}" style="accent-color:var(--teal);width:100%"></div>`).join('')}
        <div class="row between"><span>المجموع</span><b class="chip ${sum === 100 ? 'chip--ok' : 'chip--bad'}">${sum}%</b></div>${sum !== 100 ? '<div class="err">يجب أن يساوي المجموع 100% قبل الحفظ.</div>' : ''}
        <div class="row"><button class="btn btn--solid grow" data-act="save-w" ${sum !== 100 ? 'disabled' : ''}>حفظ الأوزان</button><button class="btn btn--ghost" data-act="reset-w">الافتراضي</button></div></div>
      <div class="card stack"><h3>الخدمات المتاحة للعملاء</h3>${Object.entries(L.SERVICES).map(([k, v]) => `<label class="row between"><span class="row">${ic(v.icon)} ${v.name}</span><span class="switch"><input type="checkbox" data-change="svc" value="${k}" ${S.settings.services[k] ? 'checked' : ''} aria-label="${v.name}"><span></span></span></label>`).join('')}<div class="hint">إيقاف خدمة يخفيها من صفحات الطلب الجديدة فقط، ولا يؤثر على الطلبات الجارية.</div></div></div>
      <div class="card stack"><h3>معاينة الترتيب</h3><p class="muted sm">كيف يظهر المهندسون لطلب جديد في الدقي بالأوزان أعلاه.</p><div class="field"><label for="ps">الخدمة</label><select class="select" id="ps" data-change="ps">${Object.entries(L.SERVICES).map(([k, v]) => `<option value="${k}" ${psvc === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></div>
        ${ranked.length ? `<ol class="list" style="counter-reset:n">${ranked.map((m, i) => `<li>${`<b class="chip ${i === 0 ? 'chip--live' : ''}">${i + 1}</b>`}${avatar(m.e.name, 'avatar--sm')}<div class="grow"><b>${esc(m.e.name)}</b><div class="muted xs">${m.d.toFixed(1)} كم · ${m.e.rating.toFixed(1)} · ${L.AVAIL[m.e.availability]}</div></div></li>`).join('')}</ol>` : U.empty('users', 'لا يوجد مهندسون مؤهلون', 'لا يوجد مهندس موثق ومتاح لهذه الخدمة ضمن النطاق.')}</div></div>`;
    },
  };
  TF.on('live:w', (el, ev, c) => { draftW = draftW || { ...c.S.settings.weights }; draftW[el.name] = Number(el.value); const id = el.id; TF.refresh(); const n = document.getElementById(id); if (n) n.focus(); });
  TF.on('save-w', () => U.done(A.saveSettings({ weights: { ...draftW } }), 'تم حفظ الأوزان', () => (draftW = null)));
  TF.on('reset-w', () => { draftW = { service: 35, distance: 25, availability: 15, rating: 15, experience: 10 }; TF.refresh(); });
  TF.on('change:svc', (el, ev, c) => { c.S.settings.services[el.value] = el.checked; TF.save(); U.toast(el.checked ? 'تم تفعيل الخدمة' : 'تم إيقاف الخدمة', 'ok'); });
  TF.on('change:ps', (el) => { psvc = el.value; TF.refresh(); });

  /* -------------------------------------------------------------- الماليات */
  P['admin.finance'] = {
    title: 'الماليات',
    render(c) {
      const S = c.S, rs = S.requests.filter((r) => r.payment), paid = rs.reduce((a, r) => a + r.payment.paid, 0), cm = S.settings.commission;
      const pendCash = rs.filter((r) => r.status === 'COMPLETED' && TF.payInfo(r).due > 0);
      return `${TF.head('الماليات', 'المدفوعات المؤكدة وعمولة المنصة.')}
      <div class="kpis mb">${TF.stat('إجمالي المدفوع', money(paid))}${TF.stat('عمولة المنصة', money(Math.round(paid * cm / 100)), cm + '% من قيمة الخدمة', 'kpi--accent')}${TF.stat('مستحق للمهندسين', money(paid - Math.round(paid * cm / 100)))}${TF.stat('نقد بانتظار التأكيد', money(pendCash.reduce((a, r) => a + TF.payInfo(r).due, 0)), `${pendCash.length} طلب`, pendCash.length ? 'kpi--warn' : '')}</div>
      <form class="card row row--wrap mb" data-form="comm"><label for="cm" class="grow"><b>نسبة العمولة</b><div class="muted sm">تخصم من مستحقات المهندس ولا تظهر في فاتورة العميل.</div></label><input class="input" id="cm" name="v" type="number" min="0" max="30" value="${cm}" style="max-width:100px"><button class="btn btn--solid" type="submit">حفظ</button></form>
      <div class="tablewrap"><table class="table"><thead><tr><th>الطلب</th><th>العميل</th><th>المهندس</th><th>الطريقة</th><th>الحالة</th><th>المدفوع</th></tr></thead><tbody>${rs.map((r) => { const p = TF.payInfo(r); return `<tr><td><a href="requests.html?r=${r.id}">${r.id}</a></td><td>${esc(cname(r))}</td><td>${esc(ename(r))}</td><td>${L.PAY[r.payment.method]}</td><td><span class="chip ${p.state === 'PAID' ? 'chip--ok' : 'chip--warn'}">${L.PAYSTATE[p.state]}</span></td><td class="num">${num(p.paid)} / ${num(p.total)} ج.م</td></tr>`; }).join('')}</tbody></table></div>`;
    },
  };
  TF.on('form:comm', (f) => { const v = Number(f.v.value); if (!(v >= 0 && v <= 30)) { U.toast('أدخل نسبة بين 0 و30.', 'bad'); return; } U.done(A.saveSettings({ commission: v }), 'تم حفظ نسبة العمولة'); });

  TF.boot();
})();
