// 海纳 · 摸清你的路（galgame 式对话测试 + 路径匹配）
(function () {
  "use strict";
  var dialog = document.getElementById("quizDialog");
  var options = document.getElementById("quizOptions");
  var restart = document.getElementById("quizRestart");

  // ===== 测试题（18 题：基本情况 3 + 兴趣 6 + 价值观 4 + 工作方式 3 + 取舍 2）=====
  var LIKE = [ { v: 2, t: "很享受" }, { v: 1, t: "一般" }, { v: 0, t: "不感冒" } ];
  var QUESTIONS = [
    // 基本情况 3
    { key: "major", q: "先说说，你读的哪个方向？", opts: [
      { v: "海洋科学", t: "海洋科学（物理/化学/生物/地质）" },
      { v: "海洋技术", t: "海洋技术（遥感/测绘/声学）" },
      { v: "船舶", t: "船舶与海洋工程" },
      { v: "航海轮机", t: "航海技术 / 轮机工程" },
      { v: "水声", t: "水声工程" },
      { v: "其他", t: "其他方向" },
    ]},
    { key: "stage", q: "现在到哪个阶段了？", opts: [
      { v: "本科在读", t: "本科在读" },
      { v: "本科毕业", t: "本科毕业" },
      { v: "硕士", t: "硕士（在读或毕业）" },
      { v: "博士", t: "博士" },
    ]},
    { key: "skill", q: "手头最拿得出手的技能是啥？", opts: [
      { v: "python", t: "Python / 数据处理" },
      { v: "gis", t: "遥感 / GIS" },
      { v: "sim", t: "数值模拟（FVCOM / MIKE）" },
      { v: "sound", t: "声学 / 电子" },
      { v: "none", t: "基本没有，只会本专业" },
    ]},
    // 兴趣 6（霍兰德 6 型，3 级打分）
    { key: "int_R", q: "动手修东西、装设备、做出实物，你享受吗？", opts: LIKE },
    { key: "int_I", q: "钻进一个问题，查资料非搞懂为什么不可，你享受吗？", opts: LIKE },
    { key: "int_A", q: "创作、设计、表达自己的想法，你享受吗？", opts: LIKE },
    { key: "int_S", q: "帮别人解决麻烦、教别人上手，你享受吗？", opts: LIKE },
    { key: "int_E", q: "带队、说服人、推动一件事做成，你享受吗？", opts: LIKE },
    { key: "int_C", q: "按流程做事、整理归档、抠细节，你享受吗？", opts: LIKE },
    // 价值观 4（二选一）
    { key: "val_1", q: "两份工作，你更想要哪种？", opts: [
      { v: "stable", t: "稳定平淡，旱涝保收" },
      { v: "risk", t: "有风险，但可能大赚" },
    ]},
    { key: "val_2", q: "高薪但不喜欢，和喜欢但钱一般，选哪个？", opts: [
      { v: "income", t: "高薪，不喜欢也能忍" },
      { v: "interest", t: "喜欢，钱一般也认" },
    ]},
    { key: "val_3", q: "学得到东西但压力大，和轻松但学不到，选哪个？", opts: [
      { v: "growth", t: "学得到，压力大也值" },
      { v: "easy", t: "轻松，学不到就学不到" },
    ]},
    { key: "val_4", q: "自由但不确定，和规矩但确定，选哪个？", opts: [
      { v: "free", t: "自由，不确定也行" },
      { v: "stable", t: "规矩，确定才安心" },
    ]},
    // 工作方式 3
    { key: "work_1", q: "更喜欢独立干，还是团队一起干？", opts: [
      { v: "solo", t: "独立干" },
      { v: "team", t: "团队一起" },
    ]},
    { key: "work_2", q: "更喜欢动手做，还是动脑想？", opts: [
      { v: "hands", t: "动手做" },
      { v: "brain", t: "动脑想" },
    ]},
    { key: "work_3", q: "喜欢变化，还是稳定？", opts: [
      { v: "change", t: "变化，新鲜感" },
      { v: "stable", t: "稳定，别折腾" },
    ]},
    // 取舍 2
    { key: "want", q: "想留在海洋，还是转出去？", opts: [
      { v: "stay", t: "留在海洋（对口）" },
      { v: "out", t: "转出去" },
      { v: "any", t: "都行，看哪条路好" },
    ]},
    { key: "accept", q: "最后，你能接受什么？", opts: [
      { v: "code", t: "能接受写代码" },
      { v: "sea", t: "能接受出海" },
      { v: "exam", t: "能接受考编/考公" },
      { v: "study", t: "能接受继续读（考研/读博）" },
    ]},
  ];

  // ===== 6 条路径（含详尽分析数据）=====
  var PATHS = {
    data: { id: "data", name: "数据 / AI", tag: "■ 理科能转",
      need: "机器学习、SQL、pandas",
      job: "气象数据处理 / 海洋数据工程师 / 算法工程师",
      salary: "12–25K（天序智能招聘原文）",
      case: "海洋科学出身，靠 Python 转数据岗的人不少，海洋数据本就是本行。",
      salaryRange: "12–25K，气象海洋算法岗平均 22978 元/月（猎聘薪资页）",
      threshold: "Python 必需，熟悉 NetCDF/xarray，再加机器学习",
      competition: "岗位量中等偏上，硕士更吃香，本科要拿项目说话",
      firstStep: "练熟 pandas + 熟悉 xarray，再上一个机器学习入门课（约 1 个月）",
      whoWalked: "海洋科学转数据的人不少——你天天打交道的 netCDF 格点，就是数据岗的日常" },
    gis: { id: "gis", name: "遥感 / GIS", tag: "■ 理科能转",
      need: "ArcGIS / QGIS、遥感图像处理",
      job: "GIS 开发 / 遥感解译 / 测绘",
      salary: "测绘应届 9.2K（职友集）",
      case: "海洋技术的遥感方向最顺，补点 WebGIS 就能转开发。",
      salaryRange: "测绘应届 9.2K，GIS 开发岗更高",
      threshold: "ArcGIS/QGIS 至少一个，加遥感图像处理，会 Python 加分",
      competition: "岗位稳定，测绘/地理信息单位持续招，竞争不激烈",
      firstStep: "装免费的 QGIS 上手，再学遥感数字图像处理",
      whoWalked: "海洋技术遥感方向最顺，补 WebGIS 就能转开发" },
    ic: { id: "ic", name: "电子 / 半导体", tag: "▲ 工科能转",
      need: "数字电路、芯片设计工具、C/C++",
      job: "华为、小米、紫光展锐、迈瑞、歌尔",
      salary: "转电子（哈工程水声硕士去向）",
      case: "水声工程硕士对口转电子/半导体的真实去向，信号处理背景高度匹配。",
      salaryRange: "硕士更值钱，华为/小米/紫光展锐等大厂",
      threshold: "数字电路、芯片设计工具，信号处理背景是先天优势",
      competition: "门槛高、竞争激烈，但水声信号处理背景有稀缺性",
      firstStep: "补数字电路基础，刷一个芯片设计入门课",
      whoWalked: "哈工程水声硕士对口转电子/半导体，信号处理背景高度匹配" },
    env: { id: "env", name: "环境 / 环评", tag: "■ 理科能转",
      need: "环评导则、水处理、环境法规",
      job: "环评机构 / 环保咨询",
      salary: "环评工程师 12.8K（职友集）",
      case: "不想写代码的理科生，考环境影响评价工程师是一条稳路。",
      salaryRange: "环评工程师 12.8K（职友集）",
      threshold: "考环境影响评价工程师证（本科满 6 年，环保相关满 5 年）",
      competition: "稳定，但考证有年限门槛，前期先积累经验",
      firstStep: "了解环评报考条件，先找环评机构实习/助理岗攒经验",
      whoWalked: "不想写代码的理科生，考环评证是一条稳路" },
    sim: { id: "sim", name: "数值模拟", tag: "● 留在海洋",
      need: "FVCOM / MIKE / Delft3D",
      job: "海洋数值模拟工程师",
      salary: "本科年 12 万+（招聘原文）",
      case: "海洋人最容易直接对口的技能，基本不用补。",
      salaryRange: "本科年 12 万+，硕士更高",
      threshold: "FVCOM/MIKE/Delft3D 至少会一个",
      competition: "对口岗位不多但很稳，懂的人少、竞争小",
      firstStep: "挑一个模型（FVCOM 或 MIKE）跑通官方教程",
      whoWalked: "海洋人最对口、基本不用补技能的方向" },
    sea: { id: "sea", name: "出海 / 科考", tag: "● 留在海洋",
      need: "船员证 / 海上经历",
      job: "科考船技术岗 / 远洋船员",
      salary: "年薪制",
      case: "科考船要一整支海上技术队伍，本科直接能走。",
      salaryRange: "年薪制，随资历涨",
      threshold: "海船船员适任证，能长期在船",
      competition: "缺人但辛苦、留不住人——是机会也是代价",
      firstStep: "了解海船船员适任证报考，投科考船技术岗",
      whoWalked: "科考船要一整支海上技术队伍，本科直接能走" },
  };

  // ===== 匹配打分规则（18 题全维度）=====
  function score(pathId, a) {
    var s = 0;
    var major = a.major, skill = a.skill, want = a.want, accept = a.accept;

    // 基本情况：技能 / 专业 / 倾向 / 接受
    if (pathId === "data") {
      if (skill === "python") s += 3;
      if (major === "海洋科学" || major === "海洋技术") s += 1;
      if (want === "out" || want === "any") s += 1;
      if (accept === "code") s += 1;
    }
    if (pathId === "gis") {
      if (skill === "gis") s += 3;
      if (major === "海洋技术") s += 2;
      if (skill === "python") s += 2;
    }
    if (pathId === "ic") {
      if (skill === "sound") s += 3;
      if (major === "水声" || major === "船舶") s += 2;
      if (want === "out") s += 1;
    }
    if (pathId === "env") {
      if (skill === "none") s += 2;
      if (accept === "exam") s += 2;
      if (major === "海洋科学") s += 1;
    }
    if (pathId === "sim") {
      if (skill === "sim") s += 3;
      if (major === "海洋科学" || major === "船舶") s += 1;
      if (want === "stay" || want === "any") s += 1;
    }
    if (pathId === "sea") {
      if (accept === "sea") s += 3;
      if (major === "航海轮机") s += 2;
      if (want === "stay") s += 1;
    }

    // 兴趣 6 型（霍兰德，2/1/0 分）
    var intR = a.int_R || 0, intI = a.int_I || 0, intA = a.int_A || 0;
    var intS = a.int_S || 0, intE = a.int_E || 0, intC = a.int_C || 0;
    if (pathId === "sim") s += intI * 2 + intR;      // 研究型/现实型 → 数值模拟
    if (pathId === "data") s += intI + intE;          // 研究型/企业型 → 数据
    if (pathId === "sea") s += intR * 2 + intS;       // 现实型/社会型 → 出海
    if (pathId === "ic") s += intE * 2;               // 企业型 → 半导体闯
    if (pathId === "env") s += intC * 2 + intS;       // 常规型/社会型 → 环评
    if (pathId === "gis") s += intA + intI;           // 艺术型/研究型 → 遥感可视化

    // 价值观 4 题
    if (a.val_1 === "stable") { if (pathId === "env") s += 2; if (pathId === "sim") s += 1; }
    if (a.val_1 === "risk") { if (pathId === "ic") s += 2; if (pathId === "data") s += 1; }
    if (a.val_2 === "income") { if (pathId === "ic") s += 2; if (pathId === "data") s += 2; }
    if (a.val_2 === "interest") { if (pathId === "sim") s += 1; if (pathId === "sea") s += 1; }
    if (a.val_3 === "growth") { if (pathId === "data") s += 2; if (pathId === "sim") s += 1; }
    if (a.val_3 === "easy") { if (pathId === "env") s += 1; if (pathId === "sea") s += 1; }
    if (a.val_4 === "free") { if (pathId === "sea") s += 2; if (pathId === "data") s += 1; }
    if (a.val_4 === "stable") { if (pathId === "env") s += 1; if (pathId === "sim") s += 1; }

    // 工作方式 3 题
    if (a.work_1 === "solo") { if (pathId === "data") s += 1; if (pathId === "sim") s += 1; }
    if (a.work_1 === "team") { if (pathId === "sea") s += 1; if (pathId === "ic") s += 1; }
    if (a.work_2 === "hands") { if (pathId === "sea") s += 1; if (pathId === "sim") s += 1; }
    if (a.work_2 === "brain") { if (pathId === "data") s += 1; if (pathId === "gis") s += 1; }
    if (a.work_3 === "change") { if (pathId === "ic") s += 1; if (pathId === "data") s += 1; }
    if (a.work_3 === "stable") { if (pathId === "env") s += 1; if (pathId === "sim") s += 1; }

    return s;
  }

  // ===== 对话流程 =====
  var answers = {};
  var qIndex = 0;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function addGuide(text) {
    var div = document.createElement("div");
    div.className = "quiz-msg quiz-msg-guide";
    div.innerHTML = text;
    dialog.appendChild(div);
    dialog.scrollTop = dialog.scrollHeight;
  }

  function addUser(text) {
    var div = document.createElement("div");
    div.className = "quiz-msg quiz-msg-user";
    div.textContent = text;
    dialog.appendChild(div);
    dialog.scrollTop = dialog.scrollHeight;
  }

  function showOptions(list, onPick) {
    options.innerHTML = "";
    list.forEach(function (o) {
      var b = document.createElement("button");
      b.className = "quiz-opt";
      b.textContent = o.t;
      b.addEventListener("click", function () {
        onPick(o.v, o.t);
      });
      options.appendChild(b);
    });
  }

  function nextQuestion() {
    if (qIndex >= QUESTIONS.length) {
      showResult();
      return;
    }
    var q = QUESTIONS[qIndex];
    addGuide(q.q);
    showOptions(q.opts, function (v, t) {
      answers[q.key] = v;
      addUser(t);
      qIndex++;
      setTimeout(nextQuestion, 450);
    });
  }

  function buildPortrait(a) {
    // 兴趣 6 型画像
    var types = [
      { name: "研究型·爱钻研", s: a.int_I || 0 },
      { name: "现实型·爱动手", s: a.int_R || 0 },
      { name: "企业型·爱推动", s: a.int_E || 0 },
      { name: "社会型·爱助人", s: a.int_S || 0 },
      { name: "艺术型·爱创作", s: a.int_A || 0 },
      { name: "常规型·爱规范", s: a.int_C || 0 },
    ].sort(function (x, y) { return y.s - x.s; });
    var interest = types[0].name + "为主" + (types[1].s > 0 ? "，辅一点" + types[1].name : "");

    var values = [];
    if (a.val_1 === "risk") values.push("敢闯");
    if (a.val_1 === "stable") values.push("求稳");
    if (a.val_2 === "income") values.push("看重收入");
    if (a.val_2 === "interest") values.push("看重喜欢");
    if (a.val_3 === "growth") values.push("看重成长");
    if (a.val_3 === "easy") values.push("看重轻松");
    if (a.val_4 === "free") values.push("看重自由");
    if (a.val_4 === "stable") values.push("看重确定");

    var skillName = { python: "会 Python 数据处理", gis: "会遥感 GIS", sim: "会数值模拟", sound: "会声学电子", none: "暂无额外技能" }[a.skill] || "暂无额外技能";

    return { interest: interest, values: values, skillName: skillName };
  }

  function showResult() {
    // 答完：答案存 localStorage，跳独立结果页
    try {
      localStorage.setItem("haina_quiz_answers", JSON.stringify(answers));
    } catch (e) {}
    location.href = "/quiz/result";
  }

  document.getElementById("restartBtn").addEventListener("click", function () {
    answers = {};
    qIndex = 0;
    dialog.innerHTML = "";
    restart.style.display = "none";
    addGuide("好，再来一次。");
    setTimeout(nextQuestion, 400);
  });

  // 开场
  addGuide("你好，我是海纳的引路人。几分钟，帮你摸清你该往哪走。");
  setTimeout(nextQuestion, 600);
})();
