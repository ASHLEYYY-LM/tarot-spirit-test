(function () {
  var Q = window.QUESTIONS, C = window.CARDS, I = window.I18N;
  var LANGS = ["zh-CN", "en", "yue"];
  var KEYS = ["A", "B", "C"];

  var state = {
    lang: "zh-CN",
    screen: "intro",
    idx: 0,
    answers: [],
    scores: null,
    main: 0,
    alts: [],
    browsing: null
  };

  var $ = function (id) { return document.getElementById(id); };
  var T = function () { return I[state.lang] || I["zh-CN"]; };

  /* ---------- 访问统计 ----------
     只在 index.html 里填了 goatcounter 站点名时才生效；没填或脚本被拦截都静默跳过。
     页面访问量由 count.js 自动上报，下面这些是自定义事件：
       start        点了首页那张牌
       finish       做完 27 题（= 完成测试的人数）
       card-XX      结果是哪张牌（配合 finish 可以看出 22 张牌的分布）
       shared-open  打开别人分享的结果链接
       share-copy   点了「复制链接」 / share-native 用了系统分享
       retest       重测
  */
  function track(path, title) {
    try {
      if (!window.goatcounter || typeof window.goatcounter.count !== "function") return;
      window.goatcounter.count({ path: path, title: title || path, event: true });
    } catch (e) {}
  }

  /* ---------- 计分 ---------- */
  function tally(answers) {
    var s = new Array(C.length).fill(0);
    answers.forEach(function (a, i) {
      var o = Q[i].o[KEYS.indexOf(a)];
      if (!o) return;
      s[o.m] += 2;
      s[o.s] += 1;
    });
    return s;
  }

  /* 每张牌的理论最高分：作为主牌的次数×2 + 作为副牌的次数×1 */
  function ceiling(cardIdx) {
    var m = 0;
    Q.forEach(function (q) {
      q.o.forEach(function (o) {
        if (o.m === cardIdx) m += 2;
        if (o.s === cardIdx) m += 1;
      });
    });
    return m || 1;
  }

  /* 各牌作为主牌的次数是 3 到 7 次，理论上限差到 22:8
     直接比原始分的话愚人会被抽中接近一半，所以按 得分/上限^0.75 排序做平衡
     0.75 是实测最均匀的点：随机作答时 22 张牌各占 3.1%–5.8%
     同分取牌号小的，保证同一串答案永远得出同一张牌 */
  var BALANCE = 0.75;

  function rank(scores) {
    return scores
      .map(function (v, i) { return { i: i, v: v, r: v / Math.pow(ceiling(i), BALANCE) }; })
      .sort(function (a, b) { return b.r - a.r || a.i - b.i; });
  }

  function compute(answers) {
    var scores = tally(answers);
    var order = rank(scores);
    state.scores = scores;
    state.main = order[0].i;
    state.alts = order.slice(1, 4);
  }

  /* 契合度：主牌是按 得分÷上限^0.75 排出来的，所以百分比必须共用同一个分母，
     否则会出现「副牌 88% 而主牌 68%」这种自相矛盾的显示（实测随机作答有 18% 的概率撞上）。
     分母取 22 张牌里最大的 ceil^(1-BALANCE)，含义是「理论上限最高的那张牌全部命中 = 100%」。
     这样百分比的大小顺序与排名完全一致，主牌必然是全场最高。
     实测分布：主牌中位 59%（39%~88%），第 2/3/4 高分中位 53%/47%/44%。 */
  var FIT_DEN = 0;
  function fitDenominator() {
    if (!FIT_DEN) {
      for (var i = 0; i < C.length; i++) {
        FIT_DEN = Math.max(FIT_DEN, Math.pow(ceiling(i), 1 - BALANCE));
      }
    }
    return FIT_DEN || 1;
  }

  function fitPct(scores, cardIdx) {
    var v = scores[cardIdx] / Math.pow(ceiling(cardIdx), BALANCE) / fitDenominator() * 100;
    return Math.max(1, Math.min(100, Math.round(v)));
  }

  /* ---------- 界面文案 ---------- */
  function applyUI() {
    var u = T().ui;
    document.documentElement.lang = state.lang;
    document.title = u.title;
    $("brand").textContent = u.title;
    $("ui-title").textContent = u.title;
    $("ui-disclaimer").textContent = u.disclaimer;
    /* 首页的牌本身就是按钮，文字是提示语，不能写进按钮（会覆盖掉牌面图） */
    $("ui-start").textContent = u.start;
    $("btn-start").setAttribute("aria-label", u.start);
    $("btn-back").textContent = u.back;
    $("btn-share").textContent = u.share;
    $("btn-copy").textContent = u.copyLink;
    $("btn-retest").textContent = u.retest;
    $("btn-all").textContent = u.allCards;
    $("ui-result-note").textContent = u.resultNote;

    var box = $("langs");
    box.innerHTML = "";
    LANGS.forEach(function (lg) {
      var b = document.createElement("button");
      b.className = "lang-btn" + (lg === state.lang ? " on" : "");
      b.textContent = I[lg].meta.name;
      b.onclick = function () { setLang(lg); };
      box.appendChild(b);
    });

    if (state.screen === "quiz") renderQuiz();
    if (state.screen === "result") renderResult();
    if (state.screen === "result" && !$("all-cards").hidden) renderAll();
  }

  function setLang(lg) {
    state.lang = lg;
    try { localStorage.setItem("tarot_lang", lg); } catch (e) {}
    if (state.screen === "result" && state.scores) {
      var url = window.Share.url(state.browsing === null ? state.main : state.browsing,
        state.scores[state.main], lg, state.answers);
      history.replaceState(null, "", url);
    }
    applyUI();
  }

  function show(name) {
    state.screen = name;
    ["intro", "quiz", "result"].forEach(function (n) {
      $("screen-" + n).hidden = (n !== name);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- 答题 ---------- */
  function startQuiz() {
    state.idx = 0;
    state.answers = [];
    state.browsing = null;
    track("start", "开始测试");
    show("quiz");
    renderQuiz();
  }

  function renderQuiz() {
    var q = Q[state.idx], t = T().q[String(q.id)], u = T().ui;
    $("ui-progress").textContent = u.progress.replace("{n}", state.idx + 1);
    $("ui-chip").textContent = q.c === "V" ? u.chipV : q.c === "R1" ? u.chipR1 : u.chipR2;
    $("progress-bar").style.width = ((state.idx + 1) / Q.length * 100) + "%";
    $("q-text").textContent = t.t;
    $("btn-back").style.visibility = state.idx === 0 ? "hidden" : "visible";

    var box = $("q-options");
    box.innerHTML = "";
    KEYS.forEach(function (k, i) {
      var b = document.createElement("button");
      b.className = "opt";
      b.innerHTML = '<span class="key">' + k + '</span><span></span>';
      b.lastChild.textContent = t[k.toLowerCase()];
      b.onclick = function () { choose(k); };
      box.appendChild(b);
    });
  }

  function choose(k) {
    state.answers[state.idx] = k;
    if (state.idx < Q.length - 1) {
      state.idx++;
      renderQuiz();
    } else {
      finish();
    }
  }

  function back() {
    if (state.idx > 0) { state.idx--; renderQuiz(); }
  }

  function finish() {
    compute(state.answers);
    var sc = state.scores[state.main];
    history.replaceState(null, "", window.Share.url(state.main, sc, state.lang, state.answers));
    track("finish", "完成测试 · " + state.lang);
    track("card-" + pad(state.main), C[state.main].r + " " + C[state.main].en);
    show("result");
    renderResult();
  }

  /* ---------- 结果 ---------- */
  /* 牌面用真实韦特图，加载失败时回退到自绘 SVG 符号 */
  var pad = function (n) { return n < 10 ? "0" + n : String(n); };

  function cardArt(cardIdx, cls) {
    return '<svg class="' + (cls || "card-art") + '" viewBox="0 0 100 120" aria-hidden="true">' + C[cardIdx].svg + "</svg>";
  }

  function cardImg(cardIdx) {
    return '<img class="card-img" data-i="' + cardIdx + '" src="assets/cards/' + pad(cardIdx) +
           '.jpg" alt="' + T().c[String(cardIdx)].name + '">';
  }

  function svgNode(cardIdx) {
    var d = document.createElement("div");
    d.innerHTML = cardArt(cardIdx);
    return d.firstChild;
  }

  function bindFallback(scope) {
    var imgs = scope.querySelectorAll("img.card-img");
    Array.prototype.forEach.call(imgs, function (img) {
      img.onerror = function () {
        var i = parseInt(img.getAttribute("data-i"), 10);
        if (img.parentNode) img.parentNode.replaceChild(svgNode(i), img);
      };
    });
  }

  function readingHTML(cardIdx, isMain) {
    var t = T(), c = t.c[String(cardIdx)], card = C[cardIdx];
    var pct = fitPct(state.scores, cardIdx);
    var html = "";

    if (!isMain) {
      html += '<div class="browsing"><button class="btn btn-ghost" id="btn-back-mine">' + t.ui.backToMine + "</button></div>";
    }

    html += '<div class="rcard">';
    html += '<p class="rcard-lead">' + (isMain ? t.ui.resultLead : t.ui.browsingLead) + "</p>";
    html += '<div class="card-figure">' + cardImg(cardIdx) + "</div>";
    html += '<div class="card-roman">' + card.r + "</div>";
    html += '<h2 class="card-name">' + c.name + "</h2>";
    html += '<div class="card-en">' + card.en + "</div>";
    html += '<div class="card-kw">' + c.kw + "</div>";

    if (isMain) {
      html += '<div class="match"><span class="match-label">' + t.ui.score + '</span>' +
              '<span class="match-track"><span class="match-bar" data-pct="' + pct + '"></span></span>' +
              '<span class="match-num">' + pct + "%</span></div>";
    }

    /* 牌义两段合并成一段叙述，中间不挂小标题 */
    var sep = t.ui.mergeSep == null ? " " : t.ui.mergeSep;
    html += '<div class="body-text">';
    html += "<p>" + c.trait + sep + c.you + "</p>";
    html += '<p class="adv"><span class="lbl">' + t.ui.lblAdv + "</span>" + c.adv + "</p>";
    html += "</div>";

    if (isMain && state.alts.length) {
      html += '<div class="alts"><p class="alts-lead">' + t.ui.altLead + "</p>";
      state.alts.forEach(function (a) {
        var ac = t.c[String(a.i)];
        var ap = fitPct(state.scores, a.i);
        html += '<div class="alt">' +
                  '<span class="alt-roman">' + C[a.i].r + "</span>" +
                  '<span class="alt-body">' +
                    '<span class="alt-head"><span class="alt-name">' + ac.name + "</span>" +
                    '<span class="alt-kw">' + ac.kw + "</span></span>" +
                    '<span class="alt-meter">' +
                      '<span class="alt-track"><span class="alt-bar" data-pct="' + ap + '"></span></span>' +
                      '<span class="alt-num">' + ap + "%</span>" +
                    "</span>" +
                  "</span>" +
                "</div>";
      });
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function renderResult() {
    var idx = state.browsing === null ? state.main : state.browsing;
    var box = $("result-box");
    box.innerHTML = readingHTML(idx, state.browsing === null);
    bindFallback(box);

    /* 条宽按各自 data-pct 填充，与旁边显示的数字用同一口径（得分 ÷ 该牌理论最高分） */
    var bar = $("result-box").querySelector(".match-bar");
    if (bar) requestAnimationFrame(function () { bar.style.width = (bar.getAttribute("data-pct") || 0) + "%"; });

    var bars = $("result-box").querySelectorAll(".alt-bar");
    requestAnimationFrame(function () {
      Array.prototype.forEach.call(bars, function (b) {
        b.style.width = (b.getAttribute("data-pct") || 0) + "%";
      });
    });

    var bm = $("btn-back-mine");
    if (bm) bm.onclick = function () { state.browsing = null; renderResult(); renderAll(); };

    var allBtn = $("btn-all");
    allBtn.textContent = $("all-cards").hidden ? T().ui.allCards : T().ui.allCardsOpen;
  }

  function renderAll() {
    var t = T(), box = $("all-cards");
    box.innerHTML = "";
    var current = state.browsing === null ? state.main : state.browsing;
    C.forEach(function (card) {
      var b = document.createElement("button");
      b.className = "all-item" + (card.n === current ? " on" : "");
      b.innerHTML = '<img class="thumb-img" src="assets/cards/thumb/' + pad(card.n) +
                    '.jpg" loading="lazy" alt="' + t.c[String(card.n)].name + '">' +
                    '<span class="r">' + card.r + '</span><span class="n">' + t.c[String(card.n)].name + '</span>';
      b.onclick = function () {
        state.browsing = card.n;
        renderResult();
        renderAll();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
      box.appendChild(b);
    });
  }

  /* ---------- 分享 / 重测 ---------- */
  function currentUrl() {
    var idx = state.browsing === null ? state.main : state.browsing;
    return window.Share.url(idx, state.scores[state.main], state.lang, state.answers);
  }

  function doShare() {
    var t = T(), name = t.c[String(state.main)].name;
    track("share-native", "系统分享");
    window.Share.share(t.ui.title, t.ui.shareText.replace("{card}", name), currentUrl(), null);
  }

  function doCopy() {
    var btn = $("btn-copy"), old = btn.textContent;
    track("share-copy", "复制链接");
    window.Share.copy(currentUrl(), function () {
      btn.textContent = T().ui.copied;
      setTimeout(function () { btn.textContent = old; }, 1800);
    });
  }

  function retest() {
    history.replaceState(null, "", location.pathname);
    state.answers = [];
    state.browsing = null;
    track("retest", "重测");
    show("intro");
  }

  /* ---------- 打开链接直接看结果 ---------- */
  function boot() {
    try {
      var saved = localStorage.getItem("tarot_lang");
      if (saved && I[saved]) state.lang = saved;
    } catch (e) {}

    var incoming = window.Share.decode(location.hash);
    if (incoming) {
      state.lang = I[incoming.lang] ? incoming.lang : state.lang;
      state.answers = incoming.answers;
      compute(state.answers);
      applyUI();
      show("result");
      renderResult();
      track("shared-open", "打开他人分享的结果");
    } else {
      applyUI();
      show("intro");
    }
  }

  $("btn-start").onclick = startQuiz;
  $("btn-back").onclick = back;
  $("btn-share").onclick = doShare;
  $("btn-copy").onclick = doCopy;
  $("btn-retest").onclick = retest;
  $("btn-all").onclick = function () {
    var box = $("all-cards");
    box.hidden = !box.hidden;
    if (!box.hidden) renderAll();
    renderResult();
  };

  boot();
})();
