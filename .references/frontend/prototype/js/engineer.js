/* بوابة المهندس — /engineer/* */
(function () {
  const { esc, ic, num, money, moneyTxt, when, avatar, stars, ui: U, L, A, $, $$, firstName } = TF;
  const P = TF.pages;
  const getR = (c) => { const r = TF.req(c.q.get('r')); return r && r.engineerId === c.me.id ? r : null; };
  const noAccess = () => U.empty('lock', 'لا يمكن عرض هذا الطلب', 'الطلب غير موجود أو غير موجه إليك.', '<a class="btn btn--solid" href="requests.html">العودة إلى الطلبات</a>');
  const cust = (r) => TF.get().customers.find((x) => x.id === r.customerId);
  const revealed = (r) => ['CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETION_PENDING', 'COMPLETED', 'RATED'].includes(r.status);
  const verifBanner = (e) => e.verification === 'PENDING' ? `<div class="note note--warn mb">${ic('hourglass')}<span>حسابك قيد مراجعة الإدارة. أكمل المستندات من <a href="profile.html">ملفك</a>، وستبدأ باستقبال الطلبات بعد التوثيق.</span></div>` : e.verification === 'REJECTED' ? `<div class="note note--bad mb">${ic('circle-x')}<span>لم يوثق حسابك${e.rejectReason ? ': ' + esc(e.rejectReason) : ''}. عدل بياناتك وأعد الإرسال من <a href="profile.html">ملفك</a>.</span></div>` : e.account === 'SUSPENDED' ? `<div class="note note--bad mb">${ic('ban')}<span>حسابك موقوف حاليا. تواصل مع الدعم.</span></div>` : '';
  const net = (n) => Math.round(n * (1 - TF.get().settings.commission / 100));

  /* ---------------------------------------------------------------- لوحتي */
  P['engineer.home'] = {
    title: 'لوحتي',
    render(c) {
      const e = c.me.user, mine = TF.myRequests(), need = mine.filter(TF.needs.engineer);
      const fresh = mine.filter((r) => r.status === 'ENGINEER_SELECTED'), todo = need.filter((r) => r.status !== 'ENGINEER_SELECTED');
      const waiting = mine.filter((r) => ['QUOTE_SENT', 'QUOTE_ACCEPTED', 'COMPLETION_PENDING'].includes(r.status));
      const paid = mine.filter((r) => r.payment && r.payment.paid > 0), month = paid.reduce((a, r) => a + r.payment.paid, 0);
      return `${TF.head('أهلًا ' + firstName(e.name), e.hasShop ? esc(e.shop) : 'مهندس مستقل')}${verifBanner(e)}
      <div class="card row between mb"><div class="row"><span class="chip ${e.availability === 'AVAILABLE' ? 'chip--ok' : e.availability === 'BUSY' ? 'chip--warn' : ''}" style="padding:8px">${ic('power')}</span><div><b>استقبال الطلبات</b><div class="muted sm">${L.AVAIL[e.availability]}</div></div></div><label class="switch"><input type="checkbox" data-change="avail" ${e.availability !== 'OFFLINE' ? 'checked' : ''} ${e.verification !== 'VERIFIED' ? 'disabled' : ''} aria-label="استقبال الطلبات"><span></span></label></div>
      <div class="kpis mb">${TF.stat('طلبات جديدة', fresh.length, 'بانتظار ردك', fresh.length ? 'kpi--accent' : '')}${TF.stat('قيد المتابعة', mine.filter((r) => TF.isOpen(r) && r.status !== 'ENGINEER_SELECTED').length)}${TF.stat('المحصّل', money(net(month)), 'صافي بعد العمولة')}${TF.stat('التقييم', e.reviews ? e.rating.toFixed(1) : '—', `${num(e.reviews)} تقييم`)}</div>
      <div class="stack stack--lg">
        ${fresh.length ? TF.sec('طلبات جديدة بانتظار ردك', `<div class="stack">${fresh.map((r) => TF.reqCard(r, 'engineer')).join('')}</div>`) : ''}
        ${todo.length ? TF.sec('مهام تحتاج إجراء منك', `<div class="stack">${todo.map((r) => TF.reqCard(r, 'engineer')).join('')}</div>`) : ''}
        ${waiting.length ? TF.sec('بانتظار العميل', `<div class="stack">${waiting.map((r) => TF.reqCard(r, 'engineer')).join('')}</div>`) : ''}
        ${!fresh.length && !todo.length && !waiting.length ? U.empty('clipboard-list', 'لا توجد طلبات حاليا', e.availability === 'OFFLINE' ? 'حالتك «غير متاح». فعل استقبال الطلبات ليظهر ملفك للعملاء.' : 'ستصلك هنا الطلبات التي يختارك العملاء لتنفيذها.') : ''}</div>`;
    },
  };
  TF.on('change:avail', (el) => U.done(A.setAvailability(el.checked ? 'AVAILABLE' : 'OFFLINE'), el.checked ? 'أصبحت متاحًا لاستقبال الطلبات' : 'تم إيقاف استقبال الطلبات'));

  /* ------------------------------------------------------------ قائمة الطلبات */
  const GROUPS = [['new', 'جديدة', ['ENGINEER_SELECTED']], ['quote', 'عروض الأسعار', ['ENGINEER_ACCEPTED', 'QUOTE_SENT', 'QUOTE_REJECTED', 'QUOTE_ACCEPTED']], ['work', 'قيد التنفيذ', ['CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETION_PENDING']], ['done', 'المنتهية', ['COMPLETED', 'RATED', 'CANCELLED']]];
  let tab = 'new';
  P['engineer.requests'] = {
    title: 'الطلبات',
    render() {
      const mine = TF.myRequests(), g = GROUPS.find((x) => x[0] === tab), list = mine.filter((r) => g[2].includes(r.status));
      return `${TF.head('الطلبات')}<div class="tabs mb" role="tablist">${GROUPS.map(([k, t, st]) => { const n = mine.filter((r) => st.includes(r.status)).length; return `<button role="tab" aria-selected="${tab === k}" data-act="etab" data-t="${k}">${t} ${n ? `<span class="chip">${n}</span>` : ''}</button>`; }).join('')}</div>
      ${list.length ? `<div class="stack">${list.map((r) => TF.reqCard(r, 'engineer')).join('')}</div>` : U.empty('clipboard-list', 'لا توجد طلبات هنا', 'عندما يتغير وضع أي طلب سينتقل إلى القسم المناسب.')}`;
    },
  };
  TF.on('etab', (el) => { tab = el.dataset.t; TF.refresh(); });

  /* ----------------------------------------------------- نموذج عرض السعر */
  const rowHtml = (i = {}) => `<div class="card card--flat card--tight stack stack--sm qrow"><div class="row"><select class="select" name="type" aria-label="نوع البند" style="max-width:160px">${Object.entries(L.ITEM_TYPES).map(([k, v]) => `<option value="${k}" ${i.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select><input class="input grow" name="desc" placeholder="وصف البند" value="${esc(i.desc || '')}" aria-label="وصف البند"><button type="button" class="iconbtn" data-act="q-del" aria-label="حذف البند">${ic('trash-2')}</button></div><div class="row"><div class="field grow"><label>الكمية</label><input class="input" name="qty" type="number" min="1" step="1" value="${i.qty || 1}" inputmode="numeric"></div><div class="field grow"><label>سعر الوحدة (ج.م)</label><input class="input" name="price" type="number" min="0" step="10" value="${i.price ?? ''}" inputmode="numeric"></div><div style="min-width:84px;text-align:end"><div class="muted xs">الإجمالي</div><b class="num lt">0</b></div></div></div>`;
  const quoteForm = (kind) => `<form data-form="quote" data-kind="${kind}" class="stack" novalidate>
    <div id="qrows" class="stack stack--sm" data-live="quote">${rowHtml({ type: kind === 'MAIN' ? 'LABOR' : 'MATERIAL' })}</div>
    <button type="button" class="btn btn--ghost btn--sm" style="align-self:flex-start" data-act="q-add">${ic('plus')} إضافة بند</button>
    <div class="field"><label for="qdur">مدة التنفيذ المتوقعة</label><select class="select" id="qdur" name="duration"><option value="">اختر المدة</option>${['ساعة واحدة', 'ساعتان', 'نصف يوم', 'يوم عمل واحد', 'يومان', 'أكثر من يومين'].map((d) => `<option>${d}</option>`).join('')}</select></div>
    <div class="field"><label for="qn">ملاحظات للعميل (اختياري)</label><textarea class="textarea" id="qn" name="notes" placeholder="ما الذي يشمله السعر وما الذي لا يشمله؟"></textarea></div>
    <div class="card card--flat row between"><span>الإجمالي (يحسبه النظام)</span><b style="font-size:22px" id="qtotal" class="num">0 ج.م</b></div>
    <div id="qerr" class="err" role="alert"></div>
    <button class="btn btn--primary btn--block" type="submit">${kind === 'MAIN' ? 'إرسال عرض السعر' : 'إرسال العرض الإضافي'}</button></form>`;
  const recalc = (root) => { let t = 0; $$('.qrow', root).forEach((r) => { const q = Number(r.querySelector('[name=qty]').value) || 0, p = Number(r.querySelector('[name=price]').value) || 0; r.querySelector('.lt').textContent = num(q * p); t += q * p; }); const el = $('#qtotal', root); if (el) el.textContent = num(t) + ' ج.م'; };
  TF.on('live:quote', (el) => recalc(el.closest('form')));
  TF.on('q-add', (el) => { const f = el.closest('form'); $('#qrows', f).insertAdjacentHTML('beforeend', rowHtml({ type: 'MATERIAL' })); });
  TF.on('q-del', (el) => { const f = el.closest('form'); if ($$('.qrow', f).length > 1) { el.closest('.qrow').remove(); recalc(f); } });
  TF.on('form:quote', (f) => {
    const items = $$('.qrow', f).map((r) => ({ type: r.querySelector('[name=type]').value, desc: r.querySelector('[name=desc]').value, qty: r.querySelector('[name=qty]').value, price: r.querySelector('[name=price]').value }));
    const bad = items.some((i) => !i.desc.trim() || !(Number(i.qty) > 0) || i.price === '' || Number(i.price) < 0);
    const err = $('#qerr', f); if (bad) { err.textContent = 'أكمل وصف كل بند وكميته وسعر وحدته.'; return; } if (!f.duration.value) { err.textContent = 'اختر مدة التنفيذ المتوقعة.'; return; }
    const kind = f.dataset.kind, rid = f.dataset.rid || new URLSearchParams(location.search).get('r');
    const res = A.sendQuote(rid, { items, duration: f.duration.value, notes: f.notes.value }, kind);
    if (res.ok) { U.close(); U.done(res, kind === 'MAIN' ? 'تم إرسال عرض السعر للعميل' : 'تم إرسال العرض الإضافي'); } else err.textContent = res.msg;
  });

  /* ------------------------------------------------------------ تفاصيل الطلب */
  P['engineer.request'] = {
    title: 'تفاصيل الطلب',
    render(c) {
      const r = getR(c); if (!r) return noAccess();
      const cu = cust(r), sv = L.SERVICES[r.service], pi = TF.payInfo(r), S_ = r.status, pq = TF.pendingQuote(r), show = revealed(r);
      const lastRej = [...r.quotes].reverse().find((q) => q.status === 'REJECTED' && q.kind === 'MAIN');
      let action = '';
      if (S_ === 'ENGINEER_SELECTED') action = `<div class="note">${ic('info')}<span>اختارك العميل لهذا الطلب. اقبله لتجهّز عرض السعر، أو اعتذر وسيرشح مهندس آخر.</span></div><div class="row row--wrap"><button class="btn btn--primary grow" data-act="e-accept" data-id="${r.id}">${ic('check')} قبول الطلب</button><button class="btn btn--danger" data-act="e-reject" data-id="${r.id}">اعتذار</button></div>`;
      if (S_ === 'ENGINEER_ACCEPTED' || S_ === 'QUOTE_REJECTED') action = `${S_ === 'QUOTE_REJECTED' ? `<div class="note note--bad">${ic('circle-x')}<span>رفض العميل العرض السابق${lastRej && lastRej.reason ? ': «' + esc(lastRej.reason) + '»' : ''}. يمكنك إرسال عرض جديد.</span></div>` : ''}<h2>${S_ === 'QUOTE_REJECTED' ? 'عرض سعر جديد' : 'جهز عرض السعر'}</h2>${quoteForm('MAIN')}`;
      if (S_ === 'QUOTE_SENT' && pq) action = `<div class="note note--warn">${ic('hourglass')}<span>عرضك بانتظار قرار العميل.</span></div>${TF.quoteTable(pq)}`;
      if (S_ === 'QUOTE_ACCEPTED') action = `<div class="note note--ok">${ic('circle-check')}<span>وافق العميل على عرضك وهو يختار طريقة الدفع الآن. سيتأكد الحجز بعدها.</span></div>`;
      if (S_ === 'CONFIRMED') action = `<div class="note note--ok">${ic('circle-check')}<span>تم تأكيد الحجز (${L.PAY[r.payment.method]}). العنوان ورقم العميل ظاهران لك الآن.</span></div><button class="btn btn--primary btn--block" data-act="e-go" data-id="${r.id}">${ic('truck')} الانطلاق إلى العميل</button>`;
      if (S_ === 'ON_THE_WAY') action = `<div class="note">${ic('truck')}<span>أنت في الطريق. أبلغ العميل بوصولك عند الوصول.</span></div><button class="btn btn--primary btn--block" data-act="e-arrived" data-id="${r.id}">${ic('flag')} وصلت إلى الموقع</button>`;
      if (S_ === 'ARRIVED') action = `<button class="btn btn--primary btn--block" data-act="e-start" data-id="${r.id}">${ic('play')} بدء التنفيذ</button>`;
      if (S_ === 'IN_PROGRESS') action = `<div class="note">${ic('wrench')}<span>العمل جار. إن ظهرت بنود لم يشملها العرض الأصلي فأرسل عرضًا إضافيا؛ لا يمكن تعديل العرض المعتمد.</span></div>${pq ? `<div class="note note--warn">${ic('hourglass')}<span>عرض إضافي بقيمة ${moneyTxt(pq.total)} بانتظار رد العميل.</span></div>` : ''}<div class="row row--wrap"><button class="btn btn--primary grow" data-act="e-finish" data-id="${r.id}">${ic('check')} تم إنهاء العمل</button><button class="btn btn--ghost" data-act="e-extra" data-id="${r.id}" ${pq ? 'disabled' : ''}>${ic('plus')} عرض سعر إضافي</button></div>`;
      if (S_ === 'COMPLETION_PENDING') action = `<div class="note note--warn">${ic('hourglass')}<span>بانتظار تأكيد العميل لإنجاز العمل.${r.dispute ? ' سجل العميل ملاحظة: «' + esc(r.dispute.text) + '». تواصل معه لمعالجتها.' : ''}</span></div>`;
      if (S_ === 'COMPLETED') action = pi.due > 0 ? (r.payment.method === 'CASH' ? `<div class="note note--warn">${ic('banknote')}<span>أكد العميل الإنجاز. استلم ${moneyTxt(pi.due)} نقدا ثم أكد الاستلام ليسجل الدفع.</span></div><button class="btn btn--primary btn--block" data-act="e-cash" data-id="${r.id}">${ic('banknote')} تأكيد استلام ${moneyTxt(pi.due)}</button>` : `<div class="note note--warn">${ic('hourglass')}<span>بانتظار سداد العميل لباقي المبلغ (${moneyTxt(pi.due)}) إلكترونيا.</span></div>`) : `<div class="note note--ok">${ic('circle-check')}<span>تم الدفع بالكامل. بانتظار تقييم العميل.</span></div>`;
      if (S_ === 'RATED') action = `<div class="note note--ok">${ic('circle-check')}<span>اكتمل الطلب.</span></div><div class="card card--flat"><div class="row between">${stars(r.rating.stars)}<span class="muted xs">${when(r.rating.at)}</span></div>${r.rating.text ? `<p class="sm">${esc(r.rating.text)}</p>` : ''}</div>`;
      if (S_ === 'CANCELLED') action = `<div class="note note--bad">${ic('ban')}<span>تم إلغاء هذا الطلب.</span></div>`;
      const acc = r.quotes.filter((q) => q.status === 'ACCEPTED');
      return `${TF.back('requests.html', 'الطلبات')}
      <div class="ticket ticket--${['IN_PROGRESS', 'ON_THE_WAY', 'ARRIVED'].includes(S_) ? 'accent' : 'brand'}"><div class="ticket__body"><div class="row row--top">${ic(sv.icon, 'i--lg')}<div class="grow"><div class="row between row--wrap"><h1 style="font-size:22px">${esc(r.sub)}</h1>${TF.chip(S_, 'engineer')}</div><div class="muted sm">${sv.name} · رقم الطلب ${r.id}</div></div></div></div><div class="ticket__cut"></div>
      <div class="ticket__body"><dl class="dl"><dt>العميل</dt><dd>${show ? esc(cu.name) : esc(firstName(cu.name))}</dd><dt>المنطقة</dt><dd>${esc(r.area)}</dd>${show ? `<dt>العنوان</dt><dd>${esc(r.address)}</dd><dt>الهاتف</dt><dd>${TF.phone(cu.phone)}</dd>` : ''}<dt>الوصف</dt><dd>${esc(r.desc)}</dd>${r.notes ? `<dt>ملاحظات العميل</dt><dd>${esc(r.notes)}</dd>` : ''}<dt>الموعد المفضل</dt><dd>${TF.whenText(r.when)}</dd>${pi.total ? `<dt>الإجمالي</dt><dd>${money(pi.total)}</dd><dt>الدفع</dt><dd>${r.payment ? L.PAY[r.payment.method] : '—'} · ${L.PAYSTATE[pi.state]}</dd>` : ''}</dl>${!show ? `<div class="note mt">${ic('lock')}<span>العنوان الكامل ورقم العميل يظهران بعد تأكيد الحجز.</span></div>` : ''}</div></div>
      <div class="stack mt">${show ? '' : `<div class="card">${TF.map([{ x: 200, y: 100, me: true }], r.area)}</div>`}${action ? `<div class="card stack">${action}</div>` : ''}
      <div class="card"><div class="card__title">${ic('list-checks')} مراحل الطلب</div>${TF.rail(r, 'engineer')}</div>
      ${acc.length && S_ !== 'QUOTE_SENT' ? `<div class="card"><div class="card__title">${ic('receipt')} بنود السعر المعتمدة</div><div class="stack">${acc.map((q) => TF.quoteTable(q)).join('')}</div></div>` : ''}</div>`;
    },
    after(c) { const f = $('form[data-form=quote]'); if (f) f.dataset.rid = c.q.get('r'); },
  };
  const id = (el) => el.dataset.id;
  TF.on('e-accept', (el) => U.done(A.engineerAccept(id(el)), 'قبلت الطلب — جهز عرض السعر'));
  TF.on('e-reject', async (el) => { const v = await U.confirm({ title: 'الاعتذار عن الطلب؟', body: 'سيخطر العميل ليختار مهندسا آخر.', ok: 'اعتذار', danger: true, extra: '<select class="select mt"><option>لا أستطيع في هذا الموعد</option><option>خارج منطقة عملي</option><option>خارج تخصصي</option><option>سبب آخر</option></select>' }); if (v) U.done(A.engineerReject(id(el), v.val), 'تم الاعتذار عن الطلب', () => (location.href = 'requests.html')); });
  TF.on('e-go', (el) => U.done(A.onTheWay(id(el)), 'تم إبلاغ العميل بانطلاقك'));
  TF.on('e-arrived', (el) => U.done(A.arrived(id(el)), 'تم إبلاغ العميل بوصولك'));
  TF.on('e-start', (el) => U.done(A.startWork(id(el)), 'بدأ التنفيذ'));
  TF.on('e-finish', async (el) => { const v = await U.confirm({ title: 'إنهاء العمل؟', body: 'سيطلب النظام من العميل تأكيد الإنجاز.', ok: 'تم الإنهاء' }); if (v) U.done(A.finishWork(id(el)), 'تم إرسال طلب تأكيد الإنجاز للعميل'); });
  TF.on('e-extra', (el) => { const s = U.sheet(`${U.head('عرض سعر إضافي')}<p class="muted sm">أضف البنود الجديدة فقط. العرض الأصلي يبقى كما هو.</p>${quoteForm('ADDITIONAL')}`, { wide: true, focus: false }); $('form', s).dataset.rid = id(el); });
  TF.on('e-cash', async (el) => { const r = TF.req(id(el)); const v = await U.confirm({ title: 'تأكيد استلام المبلغ؟', body: `أكّد فقط بعد استلام ${moneyTxt(TF.payInfo(r).due)} فعليًا من العميل.`, ok: 'تأكيد الاستلام' }); if (v) U.done(A.confirmCash(id(el)), 'تم تسجيل الدفع'); });

  /* ------------------------------------------------------------------ الأرباح */
  P['engineer.earnings'] = {
    title: 'الأرباح',
    render() {
      const mine = TF.myRequests().filter((r) => r.payment), paid = mine.filter((r) => r.payment.paid > 0), pend = mine.filter((r) => r.status === 'COMPLETED' && TF.payInfo(r).due > 0);
      const gross = paid.reduce((a, r) => a + r.payment.paid, 0), comm = TF.get().settings.commission;
      const pendAmt = pend.reduce((a, r) => a + TF.payInfo(r).due, 0);
      return `${TF.head('الأرباح', 'ملخص المدفوعات المؤكدة على طلباتك.')}
      <div class="kpis mb">${TF.stat('إجمالي المدفوع', money(gross))}${TF.stat('عمولة المنصة ' + comm + '%', money(gross - net(gross)))}${TF.stat('صافي أرباحك', money(net(gross)), '', 'kpi--accent')}${TF.stat('بانتظار تأكيد الاستلام', money(pendAmt), pend.length ? `${pend.length} طلب` : '', pend.length ? 'kpi--warn' : '')}</div>
      ${pend.length ? `<div class="note note--warn mb">${ic('banknote')}<span>لديك مبالغ نقدية لم تؤكد استلامها. أكدها من تفاصيل الطلب لتظهر ضمن أرباحك.</span></div>` : ''}
      ${paid.length ? `<div class="tablewrap"><table class="table"><thead><tr><th>الطلب</th><th>الخدمة</th><th>طريقة الدفع</th><th>المبلغ</th><th>صافي لك</th></tr></thead><tbody>${paid.map((r) => `<tr><td><a href="request.html?r=${r.id}">${r.id}</a></td><td>${esc(r.sub)}</td><td>${L.PAY[r.payment.method]}</td><td class="num">${num(r.payment.paid)} ج.م</td><td class="num"><b>${num(net(r.payment.paid))} ج.م</b></td></tr>`).join('')}</tbody></table></div>` : U.empty('wallet', 'لا توجد مدفوعات بعد', 'ستظهر هنا الطلبات التي تأكد دفعها.')}`;
    },
  };

  P['engineer.notifications'] = TF.notifPage('engineer');

  /* -------------------------------------------------------------------- ملفي */
  P['engineer.profile'] = {
    title: 'ملفي',
    render(c) {
      const e = c.me.user, revs = c.S.reviews.filter((x) => x.eid === e.id);
      const vchip = `<span class="chip chip--${e.verification === 'VERIFIED' ? 'ok' : e.verification === 'PENDING' ? 'warn' : 'bad'}">${L.VERIF[e.verification]}</span>`;
      return `${TF.head('ملفي المهني', 'هكذا يراك العملاء عند ترشيحك.')}${verifBanner(e)}<div class="stack">
      <div class="card"><div class="row">${avatar(e.name, 'avatar--lg')}<div class="grow"><h2>${esc(e.name)}</h2><div class="row row--wrap" style="gap:8px">${vchip}${e.hasShop ? `<span class="chip">${ic('store')} ${esc(e.shop)}</span>` : ''}</div></div><a class="btn btn--ghost btn--sm" href="../customer/engineer.html?e=${e.id}" target="_blank" rel="noopener">${ic('eye')} معاينة</a></div></div>
      <form class="card stack" data-form="eprofile"><h3>البيانات المهنية</h3>
        <div class="field"><label for="bio">نبذة عنك</label><textarea class="textarea" id="bio" name="bio">${esc(e.bio)}</textarea></div>
        <div class="field"><label>التخصصات</label><div class="grid g2 g2--stack">${Object.entries(L.SERVICES).map(([k, v]) => `<label class="choice"><input type="checkbox" name="svc" value="${k}" ${e.services.includes(k) ? 'checked' : ''}>${ic(v.icon)} ${v.name}</label>`).join('')}</div></div>
        <div class="grid g2 g2--stack"><div class="field"><label for="yrs">سنوات الخبرة</label><input class="input" id="yrs" name="years" type="number" min="0" value="${e.years}"></div><div class="field"><label for="rad">نطاق العمل (كم)</label><select class="select" id="rad" name="radius">${[5, 10, 15, 25, 40].map((n) => `<option ${e.radius === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
        <div class="field"><label for="area">منطقتك</label><input class="input" id="area" name="area" value="${esc(e.area)}"></div>
        <label class="row" style="gap:10px"><input type="checkbox" name="hasShop" ${e.hasShop ? 'checked' : ''}> لدي محل تجاري</label>
        <div class="field"><label for="shop">اسم المحل</label><input class="input" id="shop" name="shop" value="${esc(e.shop)}" placeholder="اختياري"><span class="hint">متجر المنتجات وقطع الغيار سيتوفر في مرحلة لاحقة، وحاليا يظهر اسم المحل في ملفك فقط.</span></div>
        <button class="btn btn--solid" type="submit">حفظ التعديلات</button></form>
      <div class="card"><div class="card__title">${ic('shield-check')} التوثيق</div><ul class="list">${e.docs.map((d, i) => `<li>${ic('file-check')}<span class="grow">${d.k}</span>${d.ok ? '<span class="chip chip--ok">مرفوع</span>' : `<button class="btn btn--ghost btn--sm" data-act="upload-doc" data-i="${i}">${ic('upload')} رفع</button>`}</li>`).join('')}</ul>${e.verification === 'REJECTED' ? '<button class="btn btn--solid mt" data-act="resubmit">إعادة الإرسال للمراجعة</button>' : ''}</div>
      <div class="card"><div class="card__title">${ic('star')} تقييماتي</div>${revs.length ? `<ul class="list">${revs.map((v) => `<li class="row--top"><div class="grow"><div class="row between"><b>${esc(v.name)}</b>${stars(v.stars)}</div><p class="muted sm">${esc(v.text) || 'بدون تعليق'}</p></div></li>`).join('')}</ul>` : '<p class="muted">لا توجد تقييمات بعد.</p>'}</div>
      <div class="card row between"><div><b>المظهر</b></div><button class="btn btn--ghost" data-act="theme">${ic('moon')} تبديل المظهر</button></div>
      <button class="btn btn--danger" data-act="logout">${ic('log-out')} تسجيل الخروج</button></div>`;
    },
  };
  TF.on('form:eprofile', (f, ev, c) => {
    const e = c.me.user, svc = $$('input[name=svc]:checked', f).map((x) => x.value);
    if (!svc.length) { U.toast('اختر تخصصا واخدا علي الأفل', 'bad'); return; }
    Object.assign(e, { bio: f.bio.value.trim(), services: svc, years: Number(f.years.value) || 0, radius: Number(f.radius.value), area: f.area.value.trim() || e.area, hasShop: f.hasShop.checked, shop: f.hasShop.checked ? f.shop.value.trim() : '' });
    TF.save(); U.toast('تم حفظ ملفك', 'ok'); TF.refresh();
  });
  TF.on('upload-doc', (el, ev, c) => { c.me.user.docs[Number(el.dataset.i)].ok = true; TF.save(); U.toast('تم رفع المستند وسيراجعه فريق التوثيق', 'ok'); TF.refresh(); });
  TF.on('resubmit', (el, ev, c) => { c.me.user.verification = 'PENDING'; TF.save(); U.toast('أُعيد إرسال حسابك للمراجعة', 'ok'); TF.refresh(); });

  TF.boot();
})();
