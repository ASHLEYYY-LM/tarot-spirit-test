/* 结果编解码：只存字母和数字，中文一律不进 URL
   链接形如  https://xxx.github.io/repo/#c=17&s=34&l=yue&a=ABCCBA...
   hash 不会发给服务器，GitHub Pages 不会 404，也不需要任何数据库
*/
(function () {
  var S = {};

  S.encode = function (card, score, lang, answers) {
    return "#c=" + card + "&s=" + score + "&l=" + encodeURIComponent(lang) + "&a=" + answers.join("");
  };

  S.decode = function (hash) {
    var h = (hash || "").replace(/^#/, "");
    if (!h) return null;
    var out = {};
    h.split("&").forEach(function (kv) {
      var i = kv.indexOf("=");
      if (i < 0) return;
      out[kv.slice(0, i)] = kv.slice(i + 1);
    });
    if (out.c === undefined || out.a === undefined) return null;
    var card = parseInt(out.c, 10);
    var answers = out.a.split("");
    if (isNaN(card) || card < 0 || card > 21) return null;
    if (answers.length !== window.QUESTIONS.length) return null;
    if (!/^[ABC]+$/.test(out.a)) return null;
    return {
      card: card,
      score: parseInt(out.s, 10) || 0,
      lang: out.l || "zh-CN",
      answers: answers
    };
  };

  S.url = function (card, score, lang, answers) {
    return location.origin + location.pathname + S.encode(card, score, lang, answers);
  };

  /* 优先用系统分享面板，没有就退回剪贴板 */
  S.share = function (title, text, url, onCopied) {
    if (navigator.share) {
      navigator.share({ title: title, text: text, url: url }).catch(function () {
        S.copy(url, onCopied);
      });
      return;
    }
    S.copy(url, onCopied);
  };

  S.copy = function (text, done) {
    var fallback = function () {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      if (done) done();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        if (done) done();
      }, fallback);
    } else {
      fallback();
    }
  };

  window.Share = S;
})();
