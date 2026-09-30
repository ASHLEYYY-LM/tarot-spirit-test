/* 分享结果图片：把结果页的主要信息画到 canvas 上，导出手机屏幕比例的 PNG。
   只用浏览器原生 canvas，没有任何第三方库，也不联网。
   依赖全局变量：window.CARDS（罗马数字/英文名）、window.I18N（文案）
   用法：
     window.ShareCard.make({ idx: 6, pct: 68, t: <当前语言的文案包> }, done, fail)
   done(dataUrl) 返回一张 data:image/png 图片；fail(err) 只有图片/字体加载失败时才会走。
*/
(function () {
  var SERIF = '"Songti SC","STSong","Noto Serif SC",Georgia,"Times New Roman",serif';
  var SANS = '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Noto Sans SC","Helvetica Neue",Arial,sans-serif';

  var W = 1000;          /* 导出宽度 */
  var MAXH = 3200;       /* 先画在一张很高的画布上，量完真实高度再裁 */
  var PAD = 64;          /* 左右安全边距 */
  var CW = W - PAD * 2;  /* 内容宽度 */

  var COL = {
    bg1: "#0d1934", bg2: "#071026",
    gold: "#ddc899", gold2: "#dab77e", dim: "#9d8862",
    ink: "#f3efe6", inkDim: "#a6b0ca", accent: "#9b8ae0",
    line: "rgba(221,200,153,.22)", panel: "rgba(255,255,255,.045)"
  };

  var SITE_URL = "https://ashleyyy-lm.github.io/tarot-spirit-test/";
  var QR_SRC = "assets/qr-card.png";

  /* ---------- 小工具 ---------- */
  function load(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error("图片加载失败：" + src)); };
      im.src = src;
    });
  }

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function isWide(ch) {
    return /[\u1100-\u11FF\u2E80-\uA4CF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(ch);
  }

  /* 切开中英文混排：汉字一个字一个单位，英文按单词走 */
  function tokenize(s) {
    var out = [], buf = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (isWide(ch)) {
        if (buf) { out.push(buf); buf = ""; }
        out.push(ch);
      } else if (ch === " ") {
        buf += " ";
        out.push(buf); buf = "";
      } else {
        buf += ch;
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  function wrap(ctx, s, maxW) {
    var toks = tokenize(String(s || "")), lines = [], cur = "";
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i], trial = cur + tk;
      if (cur && ctx.measureText(trial).width > maxW) {
        lines.push(cur);
        cur = tk.charAt(0) === " " ? tk.slice(1) : tk;
      } else {
        cur = trial;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }

  /* 居中并且带字距（canvas 的 letterSpacing 在旧浏览器里没有，所以手动排） */
  function tracked(ctx, s, cx, y, sp) {
    var w = 0, i;
    for (i = 0; i < s.length; i++) w += ctx.measureText(s.charAt(i)).width + sp;
    w -= sp;
    var x = cx - w / 2;
    ctx.textAlign = "left";
    for (i = 0; i < s.length; i++) {
      ctx.fillText(s.charAt(i), x, y);
      x += ctx.measureText(s.charAt(i)).width + sp;
    }
  }

  function lines(ctx, s, cx, y, maxW, lh, sp) {
    var ls = wrap(ctx, s, maxW);
    for (var i = 0; i < ls.length; i++) {
      tracked(ctx, ls[i], cx, y + i * lh, sp || 0);
    }
    return y + ls.length * lh;
  }

  /* ---------- 主绘制 ---------- */
  function draw(opt, imgs) {
    var C = window.CARDS;
    var t = opt.t, idx = opt.idx, pct = opt.pct;
    var c = t.c[String(idx)], card = C[idx];
    var pairIdx = C.length - 1 - idx, pc = t.c[String(pairIdx)], pairCard = C[pairIdx];
    var cx = W / 2;

    var cv = document.createElement("canvas");
    cv.width = W; cv.height = MAXH;
    var ctx = cv.getContext("2d");

    /* 背景 */
    var g = ctx.createLinearGradient(0, 0, 0, MAXH);
    g.addColorStop(0, COL.bg1); g.addColorStop(1, COL.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, MAXH);
    var rg = ctx.createRadialGradient(cx, 420, 0, cx, 420, 900);
    rg.addColorStop(0, "rgba(155,138,224,.14)"); rg.addColorStop(1, "rgba(155,138,224,0)");
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, 1500);

    ctx.textBaseline = "alphabetic";
    var y = 0;

    /* 顶部站点名 */
    y = 132;
    ctx.fillStyle = COL.dim; ctx.font = "26px " + SERIF;
    tracked(ctx, t.ui.title, cx, y, 12);
    y += 34;

    /* 牌图 */
    var cardW = 330, cardH = null;
    if (imgs.card) {
      cardH = cardW * imgs.card.naturalHeight / imgs.card.naturalWidth;
      y += 26;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
      ctx.fillStyle = COL.bg2;
      rrect(ctx, cx - cardW / 2, y, cardW, cardH, 16); ctx.fill();
      ctx.restore();
      ctx.save();
      rrect(ctx, cx - cardW / 2, y, cardW, cardH, 16); ctx.clip();
      ctx.drawImage(imgs.card, cx - cardW / 2, y, cardW, cardH);
      ctx.restore();
      ctx.strokeStyle = COL.line; ctx.lineWidth = 1.5;
      rrect(ctx, cx - cardW / 2, y, cardW, cardH, 16); ctx.stroke();
      y += cardH;
    } else {
      y += 60;
    }

    /* 你的牌灵是 + 罗马数字 + 牌名 */
    y += 58;
    ctx.fillStyle = COL.dim; ctx.font = "24px " + SERIF;
    tracked(ctx, t.ui.resultLead, cx, y, 8);
    y += 44;
    ctx.fillStyle = COL.gold; ctx.font = "26px " + SERIF;
    tracked(ctx, card.r, cx, y, 10);
    y += 62;
    ctx.fillStyle = COL.gold; ctx.font = "64px " + SERIF;
    tracked(ctx, c.name, cx, y, 6);
    y += 46;
    /* 英文版牌名和英文名一样（The Lovers / The Lovers），重复那行就不画 */
    if (card.en.toLowerCase() !== String(c.name).toLowerCase()) {
      ctx.fillStyle = COL.inkDim; ctx.font = "23px " + SANS;
      tracked(ctx, card.en.toUpperCase(), cx, y, 4);
    }
    y += 44;
    ctx.fillStyle = COL.accent; ctx.font = "25px " + SANS;
    tracked(ctx, c.kw, cx, y, 2);
    y += 56;

    /* 契合度条 */
    var mw = 460, mx = cx - mw / 2, my = y;
    ctx.fillStyle = COL.inkDim; ctx.font = "24px " + SANS;
    ctx.textAlign = "right"; ctx.fillText(t.ui.score, mx - 18, my + 8);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,.09)";
    rrect(ctx, mx, my, mw, 10, 5); ctx.fill();
    if (pct > 0) {
      var fg = ctx.createLinearGradient(mx, 0, mx + mw, 0);
      fg.addColorStop(0, COL.accent); fg.addColorStop(1, COL.gold);
      ctx.save(); rrect(ctx, mx, my, mw, 10, 5); ctx.clip();
      ctx.fillStyle = fg; ctx.fillRect(mx, my, mw * pct / 100, 10);
      ctx.restore();
    }
    ctx.fillStyle = COL.gold; ctx.font = "28px " + SERIF;
    ctx.fillText(pct + "%", mx + mw + 18, my + 10);
    y = my + 56;

    /* 分隔线 */
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(120, y); ctx.lineTo(W - 120, y); ctx.stroke();
    y += 62;

    /* 正文：牌义 + 你这个人的样子 */
    ctx.fillStyle = COL.ink; ctx.font = "29px " + SANS;
    var body = c.trait + (t.ui.mergeSep == null ? " " : t.ui.mergeSep) + c.you;
    y = lines(ctx, body, cx, y, CW - 40, 54, 0.5);

    /* 牌灵的提醒 */
    y += 26;
    ctx.fillStyle = COL.dim; ctx.font = "22px " + SERIF;
    tracked(ctx, t.ui.lblAdv, cx, y, 6);
    y += 44;
    ctx.fillStyle = COL.gold2; ctx.font = "29px " + SERIF;
    y = lines(ctx, c.adv, cx, y, CW - 40, 50, 0.5);

    /* 容易被谁吸引（紧凑版） */
    y += 44;
    var panelH = null, thumbW = 96, thumbH = null;
    if (imgs.thumb) thumbH = thumbW * imgs.thumb.naturalHeight / imgs.thumb.naturalWidth;
    else thumbH = thumbW * 1.7;
    ctx.font = "25px " + SANS;
    var whyLines = wrap(ctx, c.pairWhy, CW - 60 - thumbW - 28);
    panelH = Math.max(thumbH, 60 + whyLines.length * 42) + 56;

    ctx.fillStyle = COL.panel;
    rrect(ctx, PAD, y, CW, panelH, 18); ctx.fill();
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1.2;
    rrect(ctx, PAD, y, CW, panelH, 18); ctx.stroke();

    var py = y + 24;
    ctx.fillStyle = COL.dim; ctx.font = "22px " + SERIF;
    ctx.textAlign = "left"; ctx.fillText(t.ui.attractLead, PAD + 26, py + 22);
    ctx.textBaseline = "alphabetic";
    py += 52;

    var tx = PAD + 26, ty = py;
    if (imgs.thumb) {
      ctx.save(); rrect(ctx, tx, ty, thumbW, thumbH, 10); ctx.clip();
      ctx.drawImage(imgs.thumb, tx, ty, thumbW, thumbH); ctx.restore();
      ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
      rrect(ctx, tx, ty, thumbW, thumbH, 10); ctx.stroke();
    }
    var textX = tx + thumbW + 26, colW = CW - 52 - thumbW - 26;
    ctx.textAlign = "left";
    ctx.fillStyle = COL.gold; ctx.font = "30px " + SERIF;
    ctx.fillText(pairCard.r + "  " + pc.name, textX, ty + 30);
    ctx.fillStyle = COL.inkDim; ctx.font = "25px " + SANS;
    for (var i = 0; i < whyLines.length; i++) ctx.fillText(whyLines[i], textX, ty + 72 + i * 42);

    y += panelH + 52;

    /* 底部：免责说明 + 二维码 */
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(120, y); ctx.lineTo(W - 120, y); ctx.stroke();
    y += 46;

    var qrSize = 190, qrX = W - PAD - qrSize, qrY = y;
    ctx.fillStyle = "#ffffff";
    rrect(ctx, qrX, qrY, qrSize, qrSize, 14); ctx.fill();
    if (imgs.qr) {
      ctx.save(); rrect(ctx, qrX + 10, qrY + 10, qrSize - 20, qrSize - 20, 8); ctx.clip();
      ctx.drawImage(imgs.qr, qrX + 10, qrY + 10, qrSize - 20, qrSize - 20); ctx.restore();
    }
    ctx.fillStyle = COL.inkDim; ctx.font = "22px " + SANS;
    tracked(ctx, t.ui.qrHint || "", qrX + qrSize / 2, qrY + qrSize + 38, 1);

    ctx.textAlign = "left";
    ctx.fillStyle = COL.inkDim; ctx.font = "26px " + SANS;
    var left = wrap(ctx, t.ui.disclaimer, W - PAD * 2 - qrSize - 40);
    for (var j = 0; j < left.length; j++) ctx.fillText(left[j], PAD, qrY + 44 + j * 40);

    y = Math.max(qrY + qrSize + 62, qrY + left.length * 40 + 40) + 34;

    /* 裁到真实高度，再补一圈外框 */
    var out = document.createElement("canvas");
    out.width = W; out.height = Math.round(y);
    var octx = out.getContext("2d");
    octx.drawImage(cv, 0, 0, W, y, 0, 0, W, y);
    octx.strokeStyle = COL.line; octx.lineWidth = 1.5;
    rrect(octx, 26, 26, W - 52, y - 52, 16); octx.stroke();

    /* 导出成 JPEG：同样的画面 PNG 要 2MB，JPEG 只要几百 KB，微信里发得动。
       二维码是大色块、对比度高，0.93 的质量不影响识别（已实测可扫）。 */
    return out.toDataURL("image/jpeg", 0.93);
  }

  window.ShareCard = {
    SITE_URL: SITE_URL,
    QR_SRC: QR_SRC,
    EXT: "jpg",
    MIME: "image/jpeg",
    /* opt: { idx, pct, t }  t 为当前语言的文案包（I18N[lang]） */
    make: function (opt, done, fail) {
      var filepath = function (n) { return "assets/cards/" + (n < 10 ? "0" + n : n) + ".jpg"; };
      var thumbpath = function (n) { return "assets/cards/thumb/" + (n < 10 ? "0" + n : n) + ".jpg"; };
      Promise.all([
        load(filepath(opt.idx)).catch(function () { return null; }),
        load(thumbpath(window.CARDS.length - 1 - opt.idx)).catch(function () { return null; }),
        load(QR_SRC).catch(function () { return null; })
      ]).then(function (arr) {
        try {
          done(draw(opt, { card: arr[0], thumb: arr[1], qr: arr[2] }));
        } catch (e) { if (fail) fail(e); }
      }, function (e) { if (fail) fail(e); });
    }
  };
})();
