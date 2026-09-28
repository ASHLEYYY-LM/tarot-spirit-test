# 测测你的牌灵 · tarot-spirit-test

零构建的纯静态测试站点。22 张大阿尔卡纳、27 道情境题，支持简体中文 / English / 粵語，结果编码进链接可分享。

- 仓库：https://github.com/ASHLEYYY-LM/tarot-spirit-test
- 上线后地址：https://ashleyyy-lm.github.io/tarot-spirit-test/

牌义依据：向日葵《塔罗葵花宝典》「一、大牌牌意」。

---

## 目录结构

```
index.html          单页入口，按顺序加载下面几个脚本
style.css           所有配色写在 :root，改主题只动这里
app.js              状态机：intro → quiz → result，以及计分与渲染
share.js            结果的编码 / 解码 / 系统分享 / 剪贴板
data/questions.js   27 题，只有题号、类别、选项的牌号权重，不含任何文字
data/cards.js       22 张牌的罗马数字、英文名，以及图片加载失败时用的 SVG 符号
assets/cards/00-21.jpg    韦特牌面（400px，约 106 KB/张）
assets/cards/thumb/       同上的 120px 缩略图，用于「看看全部 22 张牌」网格
assets/hero-card.png      首页那张可点击的封面牌
og-image.jpg        分享到微信/WhatsApp 时的预览图（1200×630）
i18n/zh-CN.js       简体中文：界面 + 27 题 + 22 张牌结果文案
i18n/en.js          英文
i18n/yue.js         粵語（繁体 + 书面粤语）
```

题目逻辑和三语文案是完全分开的。加题、改一句粤语、换配色都不用碰 `app.js`。

## 部署到 GitHub Pages（三步）

1. 在 GitHub 新建仓库 **tarot-spirit-test**，选 **Public**，不要勾 README 和 .gitignore。
2. 把本目录里的全部文件上传到仓库根目录（保留 `data/`、`i18n/` 两个子目录结构，网页端拖拽上传或 `git push` 都行）。
3. 仓库页面 → **Settings → Pages → Source** 选 `Deploy from a branch`，分支 `main`、目录 `/ (root)`，Save。

等一两分钟，刷新 https://ashleyyy-lm.github.io/tarot-spirit-test/ 就能看到。

命令行版本：

```bash
git init
git add .
git commit -m "first release"
git branch -M main
git remote add origin https://github.com/ASHLEYYY-LM/tarot-spirit-test.git
git push -u origin main
```

## 分享是怎么工作的

答完 27 题后，结果被编码进 URL 的 hash：

```
https://ashleyyy-lm.github.io/tarot-spirit-test/#c=17&s=34&l=yue&a=ABCCBA...
```

`c` 牌号、`s` 总分、`l` 语言、`a` 27 个答案。hash 不会发给服务器，所以 GitHub Pages 不会 404，也不需要数据库。别人点开链接，前端解码后直接渲染结果页。

只存字母和数字，中文不进 URL，链接短且不会乱码。

## 计分规则

每题 3 个选项，每个选项暗中给两张牌加权：主牌 +2、副牌 +1。27 题加总后得到 22 张牌各自的分数。

判定不直接比原始分，而是比 `得分 ÷ 理论上限^0.75`。原因是各牌作为主牌的次数是 3 到 7 次不等，理论上限相差到 22:8，直接比原始分的话愚人会被抽中接近一半（实测 48%），其他十几张牌几乎抽不到。加了这层平衡之后，随机作答时 22 张牌各占 3.1%–5.8%，基本均匀。指数 0.75 是实测出来的最优点，改 `app.js` 里的 `BALANCE` 就能调。

并列时取牌号小的，保证同一串答案永远得出同一张牌。结果页同时显示第 2、3、4 高的牌作为「它们也跟你有感应」。

**契合度**也用同一把尺子，但分母是统一的常量，不能各算各的：

```
契合度 = (得分 ÷ 理论上限^0.75) ÷ (上限最高的那张牌的上限^0.25) × 100
```

为什么不能写成更直观的 `得分 ÷ 理论上限`：主牌是按 0.75 次方那个指标排出来的，而 `得分 ÷ 上限` 是另一个指标，两者顺序并不一致。实测随机作答有 **18.4%** 的概率出现「副牌 88% 而主牌 68%」这种自相矛盾的画面。换成分母统一的写法之后，百分比的大小顺序与排名完全一致，**主牌必然是全场最高**，副牌严格递减。

实测分布（随机作答 3 万次）：主牌中位 59%（区间 39%–88%），第 2/3/4 高分中位 53% / 47% / 44%。想整体调高或调低，改 `app.js` 里 `fitDenominator()` 的分母即可。

22 张牌都能被抽中。

## 改内容

- **改题干或选项**：改三个 `i18n/*.js` 里 `q` 的对应字段。三个语言的 `q.1` 要一一对应，题号不能变。
- **改牌的解读**：改 `i18n/*.js` 里 `c` 的 `kw / trait / you / adv`。
- **改选项指向哪张牌**：改 `data/questions.js` 的 `m`（主牌 +2）和 `s`（副牌 +1），牌号 0–21 对应愚人→世界。
- **改配色**：改 `style.css` 顶部 `:root` 的变量。`--gold` 是主色，`--bg` 是底色。
- **加语言**：复制一个 `i18n/*.js` 改语言名，在 `index.html` 里加一行 `<script src>`，再把它加进 `app.js` 顶部的 `LANGS` 数组。

## 牌面图片与授权

牌面用的是 1909 年 Rider-Waite-Smith（韦特）塔罗原版扫描图，绘者 Pamela Colman Smith（1878–1951），1910 年首次出版。文件命名 `00.jpg` = 愚人，依次到 `21.jpg` = 世界，与 `data/cards.js` 的数组下标一一对应。

**版权状态：公有领域。** 原始作品在 1931 年前于美国出版，依 PD-1923 进入美国公有领域；绘者 1951 年去世，依 life+70 于 2021 年进入来源国公有领域。Wikimedia Commons 对应文件标注为 Creative Commons Public Domain Mark 1.0（CC-PD-Mark），无已知版权限制，页面上也没有商标声明。

来源：Wikimedia Commons，`Category:Rider-Waite tarot deck`，文件名 `RWS_Tarot_00_Fool.jpg` 起的 22 张大牌。

**一处需要知道的风险**：少数保护期超过作者卒后 70 年、且不采用「较短期限规则」的国家，这张图可能仍在版权期内——墨西哥（100 年）、牙买加（95 年）、哥伦比亚（80 年）、危地马拉与萨摩亚（75 年）。在美国、中国、英国、欧盟等主流地区属于公有领域。若要在上述少数地区作商业使用，请自行核实。

图片已从 500px 重压到 400px、质量 82（约 106 KB/张），缩略图 120px（约 12 KB/张）。想换更高清或其它画风的版本，把图片按同样的文件名放回 `assets/cards/` 和 `assets/cards/thumb/` 即可，代码不用改。`data/cards.js` 里的 SVG 符号只在图片加载失败时兜底显示。

## 三处可选配置

- **首页那张牌**：`assets/hero-card.png` 是从参考稿里裁出来的封面牌（自带金边与圆角、四角透明），换图直接覆盖这个文件即可。想改回用某张具体的韦特牌，把 `index.html` 里 `hero-img` 的 `src` 换成 `assets/cards/17.jpg` 这类路径。首页没有「开始测试」按钮，点这张牌就是开始。
- **分享缩略图**：根目录的 `og-image.jpg`（1200×630）。纯静态页做不到按结果动态换图，所有结果共用这一张。生成脚本在 `tarot/_work/make_og.py`（改文案后重跑即可）。
- **访问统计**：见下一节。
- **自定义域名**：根目录放 `CNAME` 文件写域名，Pages 设置里填上同一个域名，再去域名服务商加一条 CNAME 记录指向 `ashleyyy-lm.github.io`。

## 访问统计（GoatCounter，可选）

静态页本身没有任何统计能力。想看到「多少人做了这个测试」，用 GoatCounter（免费、无 cookie、不收集个人信息）：

1. 到 https://www.goatcounter.com 用邮箱注册，**Site code** 自己起一个（例如 `tarot-spirit`，就是访问地址 `https://tarot-spirit.goatcounter.com` 里那段）
2. 打开 `index.html`，找到这一行：

   ```js
   window.TRACK_SITE = "MYCODE";
   ```

   把 `MYCODE` 换成你的 site code。不填也不会报错，只是没有统计。
3. 推上去，进 GoatCounter 后台就能看到数据了（第一次访问后约 10 秒出现）

会记录这些事件，各自独立可查：

| 事件名 | 含义 |
| --- | --- |
| （页面访问） | 由 GoatCounter 自动统计，含来源网站、国家/地区、浏览器 |
| `start` | 点了首页那张牌，进入答题 |
| `finish` | **做完全部 27 题**（这个才是「有多少人做了测试」） |
| `card-00` … `card-21` | 结果是哪张牌，用来看看 22 张牌的分布是否均匀 |
| `shared-open` | 打开别人分享的结果链接（计入页面访问，但**不计入 `finish`**） |
| `share-copy` / `share-native` | 点了复制链接 / 用了系统分享 |
| `retest` | 点了重测 |

两个提醒：

- 埋点全部写在 `app.js` 的 `track()` 里，GoatCounter 脚本被广告拦截器挡住、或没网时，`track()` 会静默跳过，不影响答题。
- 想排除自己的访问：用浏览器的隐私窗口打开，或在 GoatCounter 后台把自动记录的自己访问删掉。

> GitHub 仓库 Insights → Traffic 里的数字是**仓库页面**的浏览量和 git 克隆次数，跟 Pages 站点的访客数是两回事，别拿它当统计。

## 已知限制

- 链接里带着完整答案，只适合娱乐性测试，不要放隐私相关的问题。
- 没有服务端，统计只能是「次数」，拿不到用户身份，也做不了防刷。

## 本地预览

直接双击 `index.html` 就能打开（脚本都是普通 `<script src>`，不需要服务器）。要模拟线上环境的话：

```bash
python -m http.server 8000
# 打开 http://localhost:8000
```
