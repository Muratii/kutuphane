/* Saf mantık fonksiyonları (DOM'a bağımlı değil; Node ile test edilebilir). */
(function (root) {
  'use strict';

  /* Türkçe karakterleri ve yazım farklarını katlayan normalleştirme. */
  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/İ/g, 'i').replace(/I/g, 'ı')
      .toLowerCase()
      .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[’'`´]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Kısa sorgularda (<=3 harf) tam kelime eşleşmesi, uzunlarda içerme. */
  function has(hay, q) {
    if (!q) return false;
    if (q.length <= 3) return (' ' + hay + ' ').indexOf(' ' + q + ' ') >= 0;
    return hay.indexOf(q) >= 0;
  }

  var STOP = { ve: 1, ile: 1, bir: 1, the: 1, an: 1, de: 1, da: 1, mi: 1, mu: 1, bu: 1, su: 1, ne: 1 };

  function prepare(items) {
    return items.map(function (it) {
      var o = {};
      for (var k in it) o[k] = it[k];
      o.ntr = norm(it.tr); o.nen = norm(it.en);
      o.nt = o.ntr + ' ' + o.nen;
      o.nterms = (it.terms || []).map(norm);
      o.nph = (it.ph || []).map(norm);
      o.ntx = norm(it.tx || '');
      return o;
    });
  }

  function score(it, q, toks) {
    var sc = 0, hit = -1, i, t;
    if (it.ntr === q || it.nen === q) sc += 80; else if (has(it.nt, q)) sc += 45;
    for (i = 0; i < it.nterms.length; i++) { if (it.nterms[i] === q) { sc += 50; break; } }
    if (sc < 50) { for (i = 0; i < it.nterms.length; i++) { if (has(it.nterms[i], q)) { sc += 30; break; } } }
    for (i = 0; i < it.nph.length; i++) { if (has(it.nph[i], q)) { sc += 14; hit = i; break; } }
    if (has(it.ntx, q)) sc += 5;
    var all = true, tsc = 0, bestPh = -1, bestN = 0;
    for (var j = 0; j < toks.length; j++) {
      t = toks[j];
      var m = 0;
      if (has(it.nt, t)) m = 10;
      else if (it.nterms.some(function (x) { return has(x, t); })) m = 7;
      else if (it.nph.some(function (x) { return has(x, t); })) m = 4;
      else if (has(it.ntx, t)) m = 2;
      if (!m) all = false;
      tsc += m;
    }
    if (toks.length > 1) {
      sc += all ? tsc : tsc * 0.3;
      if (hit < 0) {
        for (i = 0; i < it.nph.length; i++) {
          var n = 0;
          for (j = 0; j < toks.length; j++) if (has(it.nph[i], toks[j])) n++;
          if (n > bestN) { bestN = n; bestPh = i; }
        }
        if (bestN >= 2) hit = bestPh;
      }
    }
    return { sc: sc, hit: hit };
  }

  function search(items, query, limit) {
    var q = norm(query);
    if (!q) return [];
    var toks = q.split(' ').filter(function (t) { return t.length >= 2 && !STOP[t]; });
    if (!toks.length) toks = [q];
    var res = [];
    for (var i = 0; i < items.length; i++) {
      var r = score(items[i], q, toks);
      if (r.sc >= 3) res.push({ it: items[i], sc: r.sc, hit: r.hit });
    }
    res.sort(function (a, b) { return (b.sc - a.sc) || a.it.tr.localeCompare(b.it.tr); });
    return res.slice(0, limit || 40);
  }

  /* Alıştırma cevabı karşılaştırma: büyük/küçük harf, noktalama ve boşluk farkı önemsiz. */
  function normAns(s) {
    return String(s == null ? '' : s).trim().toLowerCase()
      .replace(/[’`´]/g, "'")
      .replace(/[.!?,;:]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function checkAnswer(input, answers) {
    var a = normAns(input);
    if (!a) return false;
    for (var i = 0; i < answers.length; i++) if (normAns(answers[i]) === a) return true;
    return false;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function dayNumber(d) {
    d = d || new Date();
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  }

  var api = { norm: norm, has: has, prepare: prepare, search: search, normAns: normAns, checkAnswer: checkAnswer, shuffle: shuffle, dayNumber: dayNumber };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : this);
