/* İngilizce Kütüphanem - ana uygulama (çevrim dışı, localStorage ile kalıcı). */
(function () {
  'use strict';
  var L = window.Logic;

  /* ---------- yardımcılar ---------- */
  function h(tag, props) {
    var e = document.createElement(tag);
    if (props) {
      for (var k in props) {
        var v = props[k];
        if (v === false || v == null) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(e, x); }); return; }
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  var $view = document.getElementById('view');
  var $bar = document.getElementById('bar');
  var $nav = document.getElementById('nav');
  var $toast = document.getElementById('toast');
  var toastTimer = null;
  function toast(msg) {
    $toast.textContent = msg; $toast.className = 'on';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $toast.className = ''; }, 1800);
  }
  function mount(node) { $view.innerHTML = ''; $view.appendChild(node); }

  /* ---------- kalıcı depo ---------- */
  var KEY = 'ek.v1';
  function defaults() {
    return { fav: {}, status: {}, list: {}, notes: {}, recent: [], quiz: { taken: 0, correct: 0, total: 0, wrong: {} }, set: { theme: 'auto', fs: 17 } };
  }
  function loadState() {
    try {
      var j = JSON.parse(localStorage.getItem(KEY) || 'null');
      var d = defaults();
      if (j) for (var k in d) if (j[k] != null) d[k] = j[k];
      return d;
    } catch (e) { return defaults(); }
  }
  var S = loadState();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
  function applySettings() {
    var r = document.documentElement;
    if (S.set.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.set.theme);
    r.style.fontSize = (S.set.fs || 17) + 'px';
  }
  applySettings();

  /* ---------- veri ---------- */
  var CAT = null, catById = {}, parentOf = {}, SEARCH = null, DAILY = null, topicCache = {};
  function getJSON(p) {
    return fetch(p).then(function (r) { if (!r.ok) throw new Error(p + ' (' + r.status + ')'); return r.json(); });
  }
  function loadCatalog() {
    return getJSON('data/catalog.json').then(function (c) {
      CAT = c;
      (function walk(list, parent) {
        list.forEach(function (cat) { catById[cat.id] = cat; parentOf[cat.id] = parent; walk(cat.children || [], cat.id); });
      })(c.categories, null);
    });
  }
  function getTopic(id) {
    if (topicCache[id]) return Promise.resolve(topicCache[id]);
    return getJSON('data/topics/' + id + '.json').then(function (t) { topicCache[id] = t; return t; });
  }
  function getSearch() {
    if (SEARCH) return Promise.resolve(SEARCH);
    return getJSON('data/search.json').then(function (j) { SEARCH = L.prepare(j.items); return SEARCH; });
  }
  function catPath(id) {
    var out = [];
    while (id) { out.unshift(catById[id] ? catById[id].tr : id); id = parentOf[id]; }
    return out.join(' › ');
  }
  function topicIds() { return Object.keys(CAT.topics); }
  function meta(id) { return CAT.topics[id]; }

  /* ---------- sesli okuma (cihaz TTS'i varsa) ---------- */
  function ttsOk() { try { return !!(window.Android && window.Android.ttsReady && window.Android.ttsReady()); } catch (e) { return false; } }
  function spk(text) {
    if (!ttsOk()) return null;
    return h('button', { class: 'spk', 'aria-label': 'Dinle', onclick: function (ev) { ev.preventDefault(); ev.stopPropagation(); try { window.Android.speak(text, false); } catch (e) { toast('Sesli okuma çalışmadı'); } } }, '🔊');
  }

  /* ---------- üst çubuk / alt menü ---------- */
  function setBar(title, back) {
    $bar.innerHTML = '';
    if (back) $bar.appendChild(h('button', { class: 'ib', 'aria-label': 'Geri', onclick: function () { if (history.length > 1) history.back(); else location.hash = '#/'; } }, '←'));
    $bar.appendChild(h('h1', { text: title }));
    $bar.appendChild(h('button', { class: 'ib', 'aria-label': 'Ara', onclick: function () { location.hash = '#/search'; } }, '🔍'));
    $bar.appendChild(h('button', { class: 'ib', 'aria-label': 'Ayarlar', onclick: function () { location.hash = '#/settings'; } }, '⚙'));
  }
  var NAV = [['home', '🏠', 'Ana'], ['index', '📚', 'Fihrist'], ['search', '🔍', 'Ara'], ['fav', '⭐', 'Favori'], ['progress', '📈', 'İlerleme']];
  function setNav(active) {
    $nav.innerHTML = '';
    NAV.forEach(function (n) {
      $nav.appendChild(h('a', { href: n[0] === 'home' ? '#/' : '#/' + n[0], class: n[0] === active ? 'on' : '' }, h('span', { text: n[1] }), n[2]));
    });
  }

  /* ---------- ortak bileşenler ---------- */
  var STI = { todo: '○', doing: '◐', done: '✓' };
  var STL = { todo: 'Çalışılacak', doing: 'Çalışılıyor', done: 'Tamamlandı' };
  function topicRow(id, extra) {
    var m = meta(id); if (!m) return null;
    var st = S.status[id];
    return h('a', { class: 'item', href: '#/topic/' + id },
      h('div', { class: 't' },
        h('span', { class: 'st', text: st ? STI[st] : '' }), m.tr, ' ',
        h('span', { class: 'badge', text: m.level }), S.fav[id] ? ' ⭐' : ''),
      h('div', { class: 'p', text: m.en + ' · ' + catPath(m.cat) }),
      m.short ? h('div', { class: 's', text: m.short }) : null,
      extra || null);
  }
  function listOf(ids, emptyMsg) {
    var box = h('div');
    var rows = ids.map(function (id) { return topicRow(id); }).filter(Boolean);
    if (!rows.length) box.appendChild(h('p', { class: 'muted pad', text: emptyMsg }));
    else rows.forEach(function (r) { box.appendChild(r); });
    return box;
  }
  function exRow(en, tr, note) {
    return h('div', { class: 'ex' },
      h('div', { class: 'en' }, en, ' ', spk(en)),
      tr ? h('div', { class: 'tr', text: tr }) : null,
      note ? h('div', { class: 'note', text: note }) : null);
  }

  /* ---------- ANA SAYFA ---------- */
  function viewHome() {
    setBar('İngilizce Kütüphanem', false); setNav('home');
    var ids = topicIds();
    var planned = 0;
    (function cnt(list) { list.forEach(function (c) { planned += (c.planned || []).length; cnt(c.children || []); }); })(CAT.categories);
    var wrap = h('div');
    var inp = h('input', { type: 'search', placeholder: 'Ara: gelecek zaman, have to, afiyet olsun…', 'aria-label': 'Ara' });
    var go = function () { var q = inp.value.trim(); location.hash = q ? '#/search/' + encodeURIComponent(q) : '#/search'; };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    wrap.appendChild(h('div', { class: 'search' }, inp, h('button', { class: 'btn pri', onclick: go }, 'Ara')));

    var last = S.recent[0];
    if (last && meta(last)) {
      wrap.appendChild(h('a', { class: 'item', href: '#/topic/' + last }, h('div', { class: 'p', text: 'Kaldığın yerden devam et' }), h('div', { class: 't', text: meta(last).tr + ' — ' + meta(last).en })));
    }
    var dailyBox = h('div');
    wrap.appendChild(dailyBox);
    getDaily().then(function (d) {
      if (!d || !d.length) return;
      var it = d[L.dayNumber() % d.length];
      dailyBox.appendChild(h('a', { class: 'item', href: '#/daily' }, h('div', { class: 'p', text: 'Bugünün ifadesi' }), h('div', { class: 't' }, it.en), h('div', { class: 's', text: it.tr })));
    }).catch(function () { });

    var tiles = [
      ['#/index', '📚', 'Konu Fihristi', ids.length + ' konu hazır'],
      ['#/search', '🔍', 'Akıllı Arama', 'Türkçe / İngilizce'],
      ['#/fav', '⭐', 'Favorilerim', Object.keys(S.fav).length + ' konu'],
      ['#/recent', '🕘', 'Son İncelediklerim', S.recent.length + ' konu'],
      ['#/notes', '📝', 'Öğrenme Notlarım', Object.keys(S.notes).filter(function (k) { return S.notes[k]; }).length + ' not'],
      ['#/list', '📌', 'Çalışma Listem', Object.keys(S.list).length + ' konu'],
      ['#/daily', '💬', 'Günlük İngilizce', 'Her gün bir ifade'],
      ['#/quiz', '🎯', 'Kendimi Test Et', 'Karışık sorular'],
      ['#/progress', '📈', 'Öğrenme İlerlemem', Object.keys(S.status).filter(function (k) { return S.status[k] === 'done'; }).length + ' tamamlandı']
    ];
    var g = h('div', { class: 'grid' });
    tiles.forEach(function (t) { g.appendChild(h('a', { class: 'tile', href: t[0] }, h('div', { class: 'ic', text: t[1] }), h('b', { text: t[2] }), h('div', { class: 'sub', text: t[3] }))); });
    wrap.appendChild(g);
    wrap.appendChild(h('p', { class: 'muted small', text: 'İçerik durumu: ' + ids.length + ' konu tam içerikle hazır. Fihristte ayrıca ' + planned + ' başlık "hazırlanacak" olarak işaretli; bunların içeriği henüz yazılmadı.' }));
    mount(wrap);
  }
  function getDaily() {
    if (DAILY) return Promise.resolve(DAILY);
    return getJSON('data/daily.json').then(function (j) { DAILY = j.items; return DAILY; });
  }

  /* ---------- FİHRİST ---------- */
  var openCats = {};
  function catNode(cat) {
    var count = 0;
    (function c(x) { count += (x.topics || []).length; (x.children || []).forEach(c); })(cat);
    var d = h('details', { class: 'cat' });
    if (openCats[cat.id]) d.setAttribute('open', '');
    d.addEventListener('toggle', function () { openCats[cat.id] = d.open; });
    d.appendChild(h('summary', { text: (cat.icon ? cat.icon + ' ' : '') + cat.tr + (count ? '  (' + count + ')' : '') }));
    var inner = h('div', { class: 'in' });
    (cat.topics || []).forEach(function (id) { inner.appendChild(topicRow(id)); });
    (cat.children || []).forEach(function (ch) { inner.appendChild(catNode(ch)); });
    if ((cat.planned || []).length) {
      var pd = h('details', { class: 'cat' });
      pd.appendChild(h('summary', { text: 'Hazırlanacak konular (' + cat.planned.length + ') — henüz yazılmadı' }));
      var pin = h('div', { class: 'in' });
      cat.planned.forEach(function (p) { pin.appendChild(h('div', { class: 'planned', text: '◌ ' + p })); });
      pd.appendChild(pin); inner.appendChild(pd);
    }
    d.appendChild(inner);
    return d;
  }
  function viewIndex() {
    setBar('Konu Fihristi', true); setNav('index');
    var w = h('div');
    w.appendChild(h('p', { class: 'muted small', text: 'Kategorileri aç/kapat; bir konuya dokununca doğrudan açılır. "Hazırlanacak" başlıklar planlanmıştır ama içeriği henüz yoktur.' }));
    CAT.categories.forEach(function (c) { w.appendChild(catNode(c)); });
    mount(w);
  }

  /* ---------- ARAMA ---------- */
  function viewSearch(q) {
    setBar('Akıllı Arama', true); setNav('search');
    var w = h('div');
    var inp = h('input', { type: 'search', placeholder: 'Konu, kalıp, Türkçe anlam veya cümle yaz', 'aria-label': 'Ara', value: q || '' });
    var out = h('div');
    var timer = null;
    function run() {
      var v = inp.value.trim();
      try { history.replaceState(null, '', v ? '#/search/' + encodeURIComponent(v) : '#/search'); } catch (e) { }
      out.innerHTML = '';
      if (!v) {
        out.appendChild(h('p', { class: 'muted small', text: 'Örnek aramalar:' }));
        var chips = h('div', { class: 'row' });
        ['gelecek zaman', 'have to', 'zorunda olmak', 'afiyet olsun', 'Could you help me?', 'for since farkı', 'should', 'bir şey önermek'].forEach(function (s) {
          chips.appendChild(h('button', { class: 'chip', onclick: function () { inp.value = s; run(); } }, s));
        });
        out.appendChild(chips); return;
      }
      out.appendChild(h('p', { class: 'muted small', text: 'Aranıyor…' }));
      getSearch().then(function (items) {
        if (inp.value.trim() !== v) return;
        var res = L.search(items, v, 40);
        out.innerHTML = '';
        if (!res.length) { out.appendChild(h('p', { class: 'muted pad', text: 'Sonuç bulunamadı. Başka bir yazımla ya da Türkçe/İngilizce karşılığıyla dene.' })); return; }
        out.appendChild(h('p', { class: 'muted small', text: res.length + ' sonuç' }));
        res.forEach(function (r) {
          var it = r.it, st = S.status[it.id];
          var hit = r.hit >= 0 ? (it.ph[r.hit] || '').replace(' | ', ' — ') : null;
          out.appendChild(h('a', { class: 'item', href: '#/topic/' + it.id },
            h('div', { class: 't' }, h('span', { class: 'st', text: st ? STI[st] : '' }), it.tr, ' ', h('span', { class: 'badge', text: it.level })),
            h('div', { class: 'p', text: it.en + ' · ' + catPath(it.cat) }),
            h('div', { class: 's', text: it.short || '' }),
            hit ? h('div', { class: 'hit', text: '“' + hit + '”' }) : null));
        });
      }).catch(function (e) { out.innerHTML = ''; out.appendChild(h('p', { class: 'muted pad', text: 'Arama dizini açılamadı: ' + e.message })); });
    }
    inp.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 150); });
    w.appendChild(h('div', { class: 'search' }, inp));
    w.appendChild(out);
    mount(w);
    run();
    if (!q) setTimeout(function () { inp.focus(); }, 50);
  }

  /* ---------- KONU DETAYI ---------- */
  function sec(id, title, content, open) {
    var d = h('details', { class: 'sec', id: 'sec-' + id });
    if (open) d.setAttribute('open', '');
    d.appendChild(h('summary', { text: title }));
    d.appendChild(h('div', { class: 'in' }, content));
    return d;
  }
  function exerciseCard(q, idx, onResult) {
    var card = h('div', { class: 'q' });
    card.appendChild(h('div', { class: 'qt', text: (idx != null ? (idx + 1) + '. ' : '') + q.q }));
    var done = false;
    function feedback(ok) {
      var parts = [ok ? 'Doğru ✓' : 'Yanlış ✗'];
      if (!ok && q.t !== 'choice') parts.push('Doğru cevap: ' + q.a.join(' / '));
      if (!ok && q.t === 'choice') parts.push('Doğru cevap: ' + q.o[q.a]);
      var f = h('div', { class: 'fb ' + (ok ? 'ok' : 'no') }, parts.join(' · '), q.e ? h('div', { class: 'small', text: q.e }) : null);
      card.appendChild(f);
      done = true;
      if (onResult) onResult(ok);
    }
    if (q.t === 'choice') {
      var btns = [];
      q.o.forEach(function (o, i) {
        var b = h('button', { class: 'opt', text: o, onclick: function () {
          if (done) return;
          btns.forEach(function (x, j) { if (j === q.a) x.classList.add('ok'); });
          if (i !== q.a) b.classList.add('no');
          feedback(i === q.a);
        } });
        btns.push(b); card.appendChild(b);
      });
    } else {
      var inp = h('input', { type: 'text', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false', placeholder: q.t === 'tr' ? 'İngilizce karşılığını yaz' : 'Cevabını yaz' });
      var check = function () {
        if (done) return;
        if (!inp.value.trim()) { toast('Önce bir cevap yaz'); return; }
        inp.disabled = true; btn.disabled = true;
        feedback(L.checkAnswer(inp.value, q.a));
      };
      var btn = h('button', { class: 'btn pri', onclick: check }, 'Kontrol et');
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
      card.appendChild(inp);
      card.appendChild(h('div', { class: 'row', style: 'margin-top:.4rem' }, btn));
    }
    return card;
  }
  function viewTopic(id) {
    return getTopic(id).then(function (t) {
      setBar(t.tr, true); setNav('index');
      S.recent = [id].concat(S.recent.filter(function (x) { return x !== id; })).slice(0, 25); save();
      var w = h('div');
      w.appendChild(h('h2', { text: t.tr }));
      w.appendChild(h('div', { class: 'muted' }, t.en, ' ', h('span', { class: 'badge', text: t.level })));
      w.appendChild(h('div', { class: 'muted small', text: catPath(t.cat) }));

      /* eylem düğmeleri */
      var favB = h('button', { class: 'btn sm' + (S.fav[id] ? ' on' : ''), onclick: function () {
        if (S.fav[id]) delete S.fav[id]; else S.fav[id] = 1; save();
        favB.className = 'btn sm' + (S.fav[id] ? ' on' : ''); favB.textContent = S.fav[id] ? '⭐ Favoride' : '☆ Favori'; toast(S.fav[id] ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı');
      } }, S.fav[id] ? '⭐ Favoride' : '☆ Favori');
      var listB = h('button', { class: 'btn sm' + (S.list[id] ? ' on' : ''), onclick: function () {
        if (S.list[id]) delete S.list[id]; else S.list[id] = 1; save();
        listB.className = 'btn sm' + (S.list[id] ? ' on' : ''); listB.textContent = S.list[id] ? '📌 Listede' : '📌 Çalışma listesine ekle'; toast(S.list[id] ? 'Çalışma listesine eklendi' : 'Listeden çıkarıldı');
      } }, S.list[id] ? '📌 Listede' : '📌 Çalışma listesine ekle');
      w.appendChild(h('div', { class: 'row', style: 'margin:.5rem 0' }, favB, listB));
      var stRow = h('div', { class: 'row', style: 'margin-bottom:.4rem' });
      function drawSt() {
        stRow.innerHTML = '';
        ['todo', 'doing', 'done'].forEach(function (k) {
          stRow.appendChild(h('button', { class: 'btn sm' + (S.status[id] === k ? ' on' : ''), onclick: function () {
            if (S.status[id] === k) delete S.status[id]; else S.status[id] = k; save(); drawSt();
          } }, STI[k] + ' ' + STL[k]));
        });
      }
      drawSt(); w.appendChild(stRow);

      var secs = [];
      var chips = h('div', { class: 'chips' });
      function addSec(sid, title, content, open) {
        if (!content) return;
        var d = sec(sid, title, content, open); secs.push(d);
        chips.appendChild(h('button', { class: 'chip', onclick: function () { d.setAttribute('open', ''); d.scrollIntoView({ block: 'start' }); } }, title));
      }
      var body = h('div');

      if (t.why) addSec('why', 'Neden öğrenmeliyim?', h('p', { text: t.why }), true);
      if (t.explain && t.explain.length) addSec('explain', 'Anlatım', t.explain.map(function (p) { return h('p', { text: p }); }), true);
      if (t.formulas && t.formulas.length) {
        addSec('formulas', 'Yapı ve formül', t.formulas.map(function (f) {
          return h('div', { class: 'formula' }, h('b', { text: f[0] }), h('code', { text: f[1] }));
        }), false);
      }
      if (t.uses && t.uses.length) {
        addSec('uses', 'Ne zaman kullanılır?', t.uses.map(function (u) {
          return h('div', null, h('h3', { text: u.h }), u.t ? h('p', { text: u.t }) : null, (u.ex || []).map(function (e) { return exRow(e[0], e[1], e[2]); }));
        }), false);
      }
      if (t.forms && t.forms.length) {
        addSec('forms', 'Olumlu · Olumsuz · Soru', t.forms.map(function (f) {
          return h('div', null, h('h3', { text: f.h }), (f.ex || []).map(function (e) { return exRow(e[0], e[1], e[2]); }));
        }), false);
      }
      if (t.words && t.words.length) {
        addSec('words', 'Sık kullanılan sözcükler', h('ul', null, t.words.map(function (x) { return h('li', { text: x }); })), false);
      }
      if (t.phrases && t.phrases.length) {
        addSec('phrases', 'Kalıplar ve ifadeler', t.phrases.map(function (p) {
          return h('div', { class: 'ph' },
            h('div', { class: 'en' }, p.en, ' ', spk(p.en), p.reg ? h('span', { class: 'badge', text: p.reg }) : null),
            h('div', { text: p.tr }),
            p.use ? h('div', { class: 'small muted', text: 'Ne zaman: ' + p.use }) : null,
            p.ex ? exRow(p.ex[0], p.ex[1]) : null,
            p.note ? h('div', { class: 'small', text: '⚠ ' + p.note }) : null);
        }), true);
      }
      if (t.dialogs && t.dialogs.length) {
        addSec('dialogs', 'Gerçek yaşam diyalogları', t.dialogs.map(function (d) {
          var box = h('div', { class: 'dlg' });
          var tg = h('button', { class: 'btn sm', onclick: function () { box.classList.toggle('hide'); tg.textContent = box.classList.contains('hide') ? 'Türkçeyi göster' : 'Türkçeyi gizle'; } }, 'Türkçeyi gizle');
          box.appendChild(h('div', { class: 'row' }, h('h3', { text: d.h, style: 'margin:.2rem 0' }), tg));
          d.l.forEach(function (ln) {
            box.appendChild(h('div', { class: 'l' }, h('span', { class: 'who', text: ln[0] + ': ' }), ln[1], ' ', spk(ln[1]), h('div', { class: 'tr', text: ln[2] })));
          });
          return box;
        }), false);
      }
      if (t.compare && t.compare.length) {
        addSec('compare', 'Benzer konularla karşılaştırma', t.compare.map(function (c) {
          var m = meta(c[0]);
          return h('div', { class: 'card' }, h('p', { style: 'margin:0 0 .3rem', text: c[1] }), m ? h('a', { href: '#/topic/' + c[0], text: '→ ' + m.tr + ' (' + m.en + ')' }) : null);
        }), false);
      }
      if (t.mistakes && t.mistakes.length) {
        addSec('mistakes', 'Sık yapılan hatalar', t.mistakes.map(function (m) {
          return h('div', { class: 'card' },
            h('div', { class: 'wrong', text: '✗ ' + m[0] }),
            h('div', { class: 'right', text: '✓ ' + m[1] }),
            h('div', { class: 'small', text: m[2] }));
        }), false);
      }
      if (t.ex && t.ex.length) {
        var okCount = 0, ansCount = 0;
        var score = h('p', { class: 'muted small', text: 'Soru sayısı: ' + t.ex.length });
        var exBox = h('div', null, score);
        t.ex.forEach(function (q, i) {
          exBox.appendChild(exerciseCard(q, i, function (ok) {
            ansCount++; if (ok) okCount++;
            score.textContent = 'Doğru: ' + okCount + ' / ' + ansCount + ' (toplam ' + t.ex.length + ' soru)';
          }));
        });
        var key = h('details', { class: 'sec' }, h('summary', { text: 'Cevap anahtarı' }),
          h('div', { class: 'in' }, t.ex.map(function (q, i) {
            var ans = q.t === 'choice' ? q.o[q.a] : q.a.join(' / ');
            return h('p', null, h('b', { text: (i + 1) + '. ' + ans }), q.e ? h('span', { class: 'small muted', text: ' — ' + q.e }) : null);
          })));
        exBox.appendChild(key);
        addSec('ex', 'Alıştırmalar', exBox, false);
      }
      if (t.advice) addSec('advice', 'Öğretmen tavsiyesi', h('div', { class: 'advice', text: t.advice }), false);

      /* notlar */
      var ta = h('textarea', { placeholder: 'Bu konuyla ilgili kendi notların…' });
      ta.value = S.notes[id] || '';
      var saved = h('div', { class: 'small muted' });
      var nt = null;
      ta.addEventListener('input', function () {
        clearTimeout(nt);
        nt = setTimeout(function () { if (ta.value.trim()) S.notes[id] = ta.value; else delete S.notes[id]; save(); saved.textContent = 'Kaydedildi'; }, 400);
      });
      addSec('notes', 'Notlarım', h('div', null, ta, saved), !!S.notes[id]);

      /* ilgili konular */
      if (t.related && t.related.length) {
        var rel = t.related.map(function (r) { return topicRow(r); }).filter(Boolean);
        if (rel.length) addSec('related', 'İlgili konular', rel, false);
      }

      var tgl = h('button', { class: 'btn sm', onclick: function () {
        var anyClosed = secs.some(function (d) { return !d.open; });
        secs.forEach(function (d) { if (anyClosed) d.setAttribute('open', ''); else d.removeAttribute('open'); });
        tgl.textContent = anyClosed ? 'Tümünü kapat' : 'Tümünü aç';
      } }, 'Tümünü aç');
      w.appendChild(h('div', { class: 'row' }, tgl));
      w.appendChild(chips);
      secs.forEach(function (d) { body.appendChild(d); });
      w.appendChild(body);
      mount(w);
    });
  }

  /* ---------- LİSTE GÖRÜNÜMLERİ ---------- */
  function viewFav() { setBar('Favorilerim', true); setNav('fav'); mount(listOf(Object.keys(S.fav), 'Henüz favori konu yok. Bir konunun içinde ☆ düğmesine dokun.')); }
  function viewRecent() { setBar('Son İncelediklerim', true); setNav('home'); mount(listOf(S.recent, 'Henüz hiç konu açmadın.')); }
  function viewList() { setBar('Çalışma Listem', true); setNav('home'); mount(listOf(Object.keys(S.list), 'Çalışma listen boş. Bir konunun içinde 📌 düğmesine dokun.')); }
  function viewNotes() {
    setBar('Öğrenme Notlarım', true); setNav('home');
    var ids = Object.keys(S.notes).filter(function (k) { return S.notes[k] && meta(k); });
    var w = h('div');
    if (!ids.length) w.appendChild(h('p', { class: 'muted pad', text: 'Henüz not yok. Bir konunun altındaki "Notlarım" bölümüne yazabilirsin.' }));
    ids.forEach(function (id) {
      var n = S.notes[id];
      w.appendChild(topicRow(id, h('div', { class: 'hit', text: n.length > 140 ? n.slice(0, 140) + '…' : n })));
    });
    mount(w);
  }

  /* ---------- GÜNLÜK İNGİLİZCE ---------- */
  function viewDaily() {
    setBar('Günlük İngilizce', true); setNav('home');
    return getDaily().then(function (d) {
      var idx = L.dayNumber() % d.length;
      var box = h('div');
      function draw() {
        box.innerHTML = '';
        var it = d[idx];
        box.appendChild(h('div', { class: 'card' },
          h('div', { class: 'p muted small', text: idx === L.dayNumber() % d.length ? 'Bugünün ifadesi' : 'Başka bir ifade' }),
          h('h2', null, it.en, ' ', spk(it.en)),
          h('div', { text: it.tr }),
          it.use ? h('p', { class: 'small muted', text: 'Ne zaman: ' + it.use }) : null,
          it.ex ? exRow(it.ex[0], it.ex[1]) : null,
          it.note ? h('p', { class: 'small', text: '⚠ ' + it.note }) : null,
          it.topic && meta(it.topic) ? h('a', { href: '#/topic/' + it.topic, text: '→ ' + meta(it.topic).tr }) : null));
        box.appendChild(h('div', { class: 'row' },
          h('button', { class: 'btn pri', onclick: function () { idx = (idx + 1) % d.length; draw(); } }, 'Sıradaki ifade'),
          h('button', { class: 'btn', onclick: function () { idx = Math.floor(Math.random() * d.length); draw(); } }, 'Rastgele')));
      }
      draw(); mount(box);
    });
  }

  /* ---------- KENDİMİ TEST ET ---------- */
  function viewQuiz() {
    setBar('Kendimi Test Et', true); setNav('home');
    var w = h('div');
    var q = S.quiz;
    w.appendChild(h('p', { class: 'muted', text: 'Hazır konulardaki alıştırmalardan karışık 10 soru seçilir. Yanlış yaptığın konular ilerleme ekranında tekrar listesine girer.' }));
    if (q.taken) w.appendChild(h('p', { class: 'small muted', text: 'Şimdiye kadar ' + q.taken + ' test, genel başarı: %' + (q.total ? Math.round(100 * q.correct / q.total) : 0) }));
    w.appendChild(h('button', { class: 'btn pri', onclick: function () { runQuiz(); } }, 'Testi başlat'));
    mount(w);
  }
  function runQuiz() {
    var ids = L.shuffle(topicIds()).slice(0, 6);
    mount(h('p', { class: 'muted pad', text: 'Sorular hazırlanıyor…' }));
    Promise.all(ids.map(getTopic)).then(function (ts) {
      var pool = [];
      ts.forEach(function (t) { (t.ex || []).forEach(function (e) { pool.push({ q: e, id: t.id }); }); });
      var qs = L.shuffle(pool).slice(0, 10);
      if (!qs.length) { mount(h('p', { class: 'muted pad', text: 'Soru bulunamadı.' })); return; }
      var i = 0, correct = 0, wrongIds = {};
      function next() {
        if (i >= qs.length) { finish(); return; }
        var item = qs[i];
        var box = h('div');
        box.appendChild(h('p', { class: 'muted small', text: 'Soru ' + (i + 1) + ' / ' + qs.length + ' · Konu: ' + (meta(item.id) ? meta(item.id).tr : item.id) }));
        var nb = h('button', { class: 'btn pri', style: 'display:none;margin-top:.5rem', onclick: function () { i++; next(); } }, i + 1 >= qs.length ? 'Sonucu gör' : 'Sonraki soru');
        box.appendChild(exerciseCard(item.q, null, function (ok) {
          if (ok) correct++; else wrongIds[item.id] = (wrongIds[item.id] || 0) + 1;
          nb.style.display = 'inline-block';
        }));
        box.appendChild(nb);
        mount(box);
      }
      function finish() {
        S.quiz.taken++; S.quiz.correct += correct; S.quiz.total += qs.length;
        Object.keys(wrongIds).forEach(function (k) { S.quiz.wrong[k] = (S.quiz.wrong[k] || 0) + wrongIds[k]; });
        save();
        var w = h('div');
        w.appendChild(h('h2', { text: 'Sonuç: ' + correct + ' / ' + qs.length }));
        var wr = Object.keys(wrongIds);
        if (wr.length) { w.appendChild(h('p', { text: 'Tekrar etmen gereken konular:' })); wr.forEach(function (k) { var r = topicRow(k); if (r) w.appendChild(r); }); }
        else w.appendChild(h('p', { text: 'Hepsi doğru, tebrikler!' }));
        w.appendChild(h('button', { class: 'btn pri', onclick: runQuiz }, 'Yeni test'));
        mount(w);
      }
      next();
    }).catch(function (e) { mount(h('p', { class: 'muted pad', text: 'Test hazırlanamadı: ' + e.message })); });
  }

  /* ---------- İLERLEME ---------- */
  function viewProgress() {
    setBar('Öğrenme İlerlemem', true); setNav('progress');
    var ids = topicIds(), total = ids.length;
    var by = { todo: [], doing: [], done: [] };
    ids.forEach(function (id) { if (S.status[id] && by[S.status[id]]) by[S.status[id]].push(id); });
    var pct = total ? Math.round(100 * by.done.length / total) : 0;
    var w = h('div');
    w.appendChild(h('div', { class: 'card' },
      h('b', { text: 'Tamamlanan: ' + by.done.length + ' / ' + total + ' konu (%' + pct + ')' }),
      h('div', { class: 'bar', style: 'margin:.4rem 0' }, h('i', { style: 'width:' + pct + '%' })),
      h('div', { class: 'small muted', text: 'Çalışılıyor: ' + by.doing.length + ' · Çalışılacak: ' + by.todo.length + ' · Durum atanmamış: ' + (total - by.done.length - by.doing.length - by.todo.length) })));
    var qz = S.quiz;
    w.appendChild(h('div', { class: 'card' }, h('b', { text: 'Testler' }), h('div', { class: 'small muted', text: qz.taken ? qz.taken + ' test · ' + qz.correct + '/' + qz.total + ' doğru (%' + Math.round(100 * qz.correct / Math.max(1, qz.total)) + ')' : 'Henüz test çözmedin.' })));
    var wrong = Object.keys(qz.wrong).filter(meta).sort(function (a, b) { return qz.wrong[b] - qz.wrong[a]; }).slice(0, 8);
    if (wrong.length) { w.appendChild(h('h3', { text: 'Tekrar etmen gereken konular' })); wrong.forEach(function (k) { w.appendChild(topicRow(k, h('div', { class: 'small muted', text: 'Testte ' + qz.wrong[k] + ' yanlış' }))); }); }
    [['doing', 'Çalışılıyor'], ['todo', 'Çalışılacak'], ['done', 'Tamamlandı']].forEach(function (p) {
      if (by[p[0]].length) { w.appendChild(h('h3', { text: p[1] + ' (' + by[p[0]].length + ')' })); by[p[0]].forEach(function (k) { w.appendChild(topicRow(k)); }); }
    });
    mount(w);
  }

  /* ---------- AYARLAR ---------- */
  function viewSettings() {
    setBar('Ayarlar', true); setNav('home');
    var w = h('div');
    w.appendChild(h('h3', { text: 'Tema' }));
    var tr = h('div', { class: 'row' });
    [['auto', 'Otomatik'], ['light', 'Açık'], ['dark', 'Koyu']].forEach(function (t) {
      tr.appendChild(h('button', { class: 'btn' + (S.set.theme === t[0] ? ' on' : ''), onclick: function () { S.set.theme = t[0]; save(); applySettings(); viewSettings(); } }, t[1]));
    });
    w.appendChild(tr);
    w.appendChild(h('h3', { text: 'Yazı boyutu (' + S.set.fs + ')' }));
    w.appendChild(h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: function () { S.set.fs = Math.max(14, S.set.fs - 1); save(); applySettings(); viewSettings(); } }, 'A−'),
      h('button', { class: 'btn', onclick: function () { S.set.fs = Math.min(24, S.set.fs + 1); save(); applySettings(); viewSettings(); } }, 'A+')));
    w.appendChild(h('h3', { text: 'Sesli okuma' }));
    w.appendChild(h('p', { class: 'small muted', text: ttsOk() ? 'Cihazın metin okuma motoru hazır; İngilizce cümlelerin yanında 🔊 düğmesi görünür.' : 'Bu cihazda İngilizce (ABD) metin okuma motoru hazır değil veya bulunamadı; bu yüzden 🔊 düğmeleri gösterilmiyor. Telefon ayarlarından Google metin okuma motorunu ve İngilizce ses verisini yükleyebilirsin.' }));
    w.appendChild(h('h3', { text: 'Veriler' }));
    var rb = h('button', { class: 'btn', onclick: function () {
      if (!rb.dataset.sure) { rb.dataset.sure = '1'; rb.textContent = 'Emin misin? Tekrar dokun'; return; }
      var set = S.set; S = defaults(); S.set = set; save(); toast('İlerleme ve notlar sıfırlandı'); viewSettings();
    } }, 'İlerleme, favori ve notları sıfırla');
    w.appendChild(rb);
    w.appendChild(h('p', { class: 'small muted', text: 'Tüm veriler yalnızca bu cihazda saklanır; uygulama internet izni istemez.' }));
    mount(w);
  }

  /* ---------- yönlendirici ---------- */
  function route() {
    var hash = location.hash || '#/';
    var parts = hash.replace(/^#\/?/, '').split('/');
    var name = parts[0] || 'home';
    var arg = decodeURIComponent(parts.slice(1).join('/') || '');
    var p;
    try {
      switch (name) {
        case 'home': p = viewHome(); break;
        case 'index': p = viewIndex(); break;
        case 'search': p = viewSearch(arg); break;
        case 'topic': p = viewTopic(arg); break;
        case 'fav': p = viewFav(); break;
        case 'recent': p = viewRecent(); break;
        case 'list': p = viewList(); break;
        case 'notes': p = viewNotes(); break;
        case 'daily': p = viewDaily(); break;
        case 'quiz': p = viewQuiz(); break;
        case 'progress': p = viewProgress(); break;
        case 'settings': p = viewSettings(); break;
        default: p = viewHome();
      }
    } catch (e) { fail(e); return; }
    Promise.resolve(p).then(function () { if (name !== 'search') window.scrollTo(0, 0); }).catch(fail);
  }
  function fail(e) {
    setBar('Hata', true);
    mount(h('div', { class: 'card' }, h('b', { text: 'Bu ekran açılamadı' }), h('p', { class: 'small', text: String(e && e.message || e) }), h('a', { href: '#/', text: 'Ana sayfaya dön' })));
  }
  window.addEventListener('hashchange', route);
  loadCatalog().then(route).catch(fail);
})();
