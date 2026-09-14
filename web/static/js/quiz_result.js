// ===== 海纳「摸清你的路」结果页 =====
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

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
      whoWalked: "海洋科学转数据的人不少。你天天打交道的 netCDF 格点，就是数据岗的日常" },
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
      competition: "缺人但辛苦、留不住人。是机会也是代价",
      firstStep: "了解海船船员适任证报考，投科考船技术岗",
      whoWalked: "科考船要一整支海上技术队伍，本科直接能走" },
  };

  // ===== 匹配打分规则（18 题全维度）=====
  function score(pathId, a) {
    var s = 0;
    var major = a.major, skill = a.skill, want = a.want, accept = a.accept;

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

    var intR = a.int_R || 0, intI = a.int_I || 0, intA = a.int_A || 0;
    var intS = a.int_S || 0, intE = a.int_E || 0, intC = a.int_C || 0;
    if (pathId === "sim") s += intI * 2 + intR;
    if (pathId === "data") s += intI + intE;
    if (pathId === "sea") s += intR * 2 + intS;
    if (pathId === "ic") s += intE * 2;
    if (pathId === "env") s += intC * 2 + intS;
    if (pathId === "gis") s += intA + intI;

    if (a.val_1 === "stable") { if (pathId === "env") s += 2; if (pathId === "sim") s += 1; }
    if (a.val_1 === "risk") { if (pathId === "ic") s += 2; if (pathId === "data") s += 1; }
    if (a.val_2 === "income") { if (pathId === "ic") s += 2; if (pathId === "data") s += 2; }
    if (a.val_2 === "interest") { if (pathId === "sim") s += 1; if (pathId === "sea") s += 1; }
    if (a.val_3 === "growth") { if (pathId === "data") s += 2; if (pathId === "sim") s += 1; }
    if (a.val_3 === "easy") { if (pathId === "env") s += 1; if (pathId === "sea") s += 1; }
    if (a.val_4 === "free") { if (pathId === "sea") s += 2; if (pathId === "data") s += 1; }
    if (a.val_4 === "stable") { if (pathId === "env") s += 1; if (pathId === "sim") s += 1; }

    if (a.work_1 === "solo") { if (pathId === "data") s += 1; if (pathId === "sim") s += 1; }
    if (a.work_1 === "team") { if (pathId === "sea") s += 1; if (pathId === "ic") s += 1; }
    if (a.work_2 === "hands") { if (pathId === "sea") s += 1; if (pathId === "sim") s += 1; }
    if (a.work_2 === "brain") { if (pathId === "data") s += 1; if (pathId === "gis") s += 1; }
    if (a.work_3 === "change") { if (pathId === "ic") s += 1; if (pathId === "data") s += 1; }
    if (a.work_3 === "stable") { if (pathId === "env") s += 1; if (pathId === "sim") s += 1; }

    return s;
  }

  // ===== 6 型职业倾向特征库 =====
  var TYPE_PROFILE = {
    I: { name: "研究型", q: "钻进一个问题，非搞懂为什么不可", s: null,
      desc: "研究型的人更在意「想通一个为什么」，没那么在意「把事做完」。他们对分析、推理、拆解问题有天然的好奇，能长时间独立专注，排斥重复的流程化操作。数据分析、算法、科研、数值模拟，都吃这套。" },
    R: { name: "现实型", q: "动手修东西、装设备、做出实物", s: null,
      desc: "现实型的人享受亲手把东西做出来、看着成果落地。他们对工具、设备、具体操作有亲近感，喜欢「从无到有」的实操过程，不耐于纯抽象的纸上谈兵。出海、工程实操、设备调试，都适合这性子。" },
    A: { name: "艺术型", q: "创作、设计、表达自己的想法", s: null,
      desc: "艺术型的人享受把脑子里的想法变成能被看见、被表达的东西。他们重视创意、审美和自由度，不喜欢被严格规则框住。设计、内容、可视化表达，都能安放这种倾向。" },
    S: { name: "社会型", q: "帮别人解决麻烦、教别人上手", s: null,
      desc: "社会型的人享受帮助别人、看着别人因为自己变好。他们共情力强、善于沟通，很在意工作有没有「对人的意义」。教育、服务、咨询，都在这条线上。" },
    E: { name: "企业型", q: "带队、说服人、推动一件事做成", s: null,
      desc: "企业型的人享受影响和推动，喜欢把资源组织起来干成事。他们有冲劲、想做出看得见的影响，不耐于长期埋头钻研。管理、商务、产业界闯荡，都是这类人的主场。" },
    C: { name: "常规型", q: "按流程做事、整理归档、抠细节", s: null,
      desc: "常规型的人享受把事做得井井有条、滴水不漏。他们重视稳定、精确、可预期，擅长在复杂系统里建立可靠。财务、运营、合规、行政，都合这性子。" },
  };
  function likeWord(v) { return v === 2 ? "很享受" : (v === 1 ? "一般" : "不感冒"); }

  // ===== 价值观解读 =====
  var VALUE_TALK = {
    risk: "你选了「有风险但可能大赚」，说明你能接受不确定性、愿意为更高的上限冒险。这类人最受不了「一眼望到头」的工作",
    stable: "你选了「稳定平淡、旱涝保收」，说明安全感在你排序里很靠前。这类人更适合规则清晰、可预期的岗位",
    income: "你选了「高薪、不喜欢也能忍」，说明收入在你这里权重很高。这是转出去闯高薪赛道最实在的驱动力",
    interest: "你选了「喜欢、钱一般也认」，说明你更在意做的事本身顺不顺心。这让你更适合留在兴趣对口的领域",
    growth: "你选了「学得到、压力大也值」，说明你愿意用当下的辛苦换未来的增值。这是技术型路线（越干越值钱）最需要的品质",
    easy: "你选了「轻松、学不到就学不到」，说明你不愿意被工作掏空。适合压力可控、节奏稳定的岗位",
    free: "你选了「自由、不确定也行」，说明你受不了被管得太死。适合约束少、有自主空间的岗位",
    det: "你选了「规矩、确定才安心」，说明可预期对你比什么都重要。适合流程清晰、规则明确的环境",
  };
  function valueList(a) {
    var v = [];
    if (a.val_1 === "risk") v.push("risk");
    if (a.val_1 === "stable") v.push("stable");
    if (a.val_2 === "income") v.push("income");
    if (a.val_2 === "interest") v.push("interest");
    if (a.val_3 === "growth") v.push("growth");
    if (a.val_3 === "easy") v.push("easy");
    if (a.val_4 === "free") v.push("free");
    if (a.val_4 === "stable") v.push("det");
    return v;
  }

  // ===== 技能解读 =====
  var SKILL_TALK = {
    python: "你手上有 Python 数据处理。这是跨进数据岗、遥感岗最硬的敲门砖，也是你目前最值钱的本钱。",
    gis: "你手上有遥感/GIS。这本身就是一条能直接就业的技能线，不用绕路。",
    sim: "你手上有数值模拟。这是海洋专业里最对口的技能，几乎不用补就能用。",
    sound: "你手上有声学/电子。工科转电子/半导体有先天优势，信号处理背景在市场上很稀缺。",
    none: "你暂时没有额外的技能本钱。所以你更适合走「不拼技术、拼对口和稳定」的路，别硬闯技术岗。",
  };

  // ===== 匹配理由（每条路径根据答案动态生成）=====
  function matchReasons(a, id) {
    var r = [];
    var major = a.major;
    var intI = a.int_I || 0, intR = a.int_R || 0, intE = a.int_E || 0, intC = a.int_C || 0, intS = a.int_S || 0;
    if (id === "data") {
      if (a.skill === "python") r.push("你会 Python，而数据岗的第一硬要求就是 Python。这条你已经满足了，不用从头学");
      if (intI >= 2) r.push("你的研究型兴趣（享受钻研、想通为什么）正是数据分析的核心。数据岗真正干的是「从数据里想明白一件事」，搬数据只是开头");
      if (a.val_3 === "growth") r.push("你看重成长，而数据/AI 是典型的越干越值钱的技术路");
      if (major === "海洋科学" || major === "海洋技术") r.push("你本科学「" + major + "」，天天打交道的 netCDF 格点数据，本来就是数据岗的日常。转过去几乎不用补领域知识");
    }
    if (id === "sim") {
      if (a.skill === "sim") r.push("你会数值模拟。这条路你其实已经会了，只是没把它当成职业");
      if (intI >= 2) r.push("数值模拟是典型的研究型工作：建模、调参、验证假设，正好对上你爱钻研的性子");
      if (a.val_1 === "stable" || a.val_4 === "stable") r.push("你看重稳定，而数值模拟是对口又稳定的方向。懂的人少、竞争小");
    }
    if (id === "ic") {
      if (a.skill === "sound") r.push("你会声学/电子。这是转电子/半导体最稀缺的背景，信号处理能力市场上很抢手");
      if (major === "水声" || major === "船舶") r.push("你读「" + major + "」，水声/船海背景对口芯片、声学、传感这些硬件方向，是有天然接口的");
      if (intE >= 2) r.push("你的企业型兴趣（爱推动、想做出影响）适合产业界。半导体是典型的「拼产出、拼影响」的赛道");
    }
    if (id === "env") {
      if (a.skill === "none") r.push("你没有额外技术本钱，环评这条路不拼代码、拼对口知识和考证，正好绕开你的短板");
      if (a.accept === "exam") r.push("你能接受考编/考公，环评工程师证就是这条路的入场券，考下来就是稳定饭票");
      if (intC >= 2 || a.val_4 === "stable") r.push("你偏好规范、确定，环评是典型的规则型工作：按导则走、按流程审，可预期");
    }
    if (id === "sea") {
      if (a.accept === "sea") r.push("你能接受出海，这是这条路最大的门槛。很多人就是卡在这一条上，你已经过了");
      if (major === "航海轮机") r.push("你读「" + major + "」，本来就是为海上准备的，对口到不用解释");
      if (intR >= 2) r.push("你的现实型兴趣（爱动手、爱实操）正对科考船的活儿。甲板、设备、仪器，全是手上功夫");
    }
    if (id === "gis") {
      if (a.skill === "gis") r.push("你会遥感/GIS。这条路的技能你直接就有，是最顺手的转法");
      if (major === "海洋技术") r.push("你读「海洋技术」，遥感/测绘本来就是你的专业课，转过去是顺水推舟");
      if (a.skill === "python") r.push("你有 Python 底子，GIS 开发（ArcPy/WebGIS）对你来说是降维");
    }
    return r;
  }

  // ===== 画像段落（详尽）=====
  function buildPortraitHtml(a) {
    var types = [
      { key: "I", s: a.int_I || 0 }, { key: "R", s: a.int_R || 0 }, { key: "A", s: a.int_A || 0 },
      { key: "S", s: a.int_S || 0 }, { key: "E", s: a.int_E || 0 }, { key: "C", s: a.int_C || 0 },
    ].sort(function (x, y) { return y.s - x.s; });
    var main = TYPE_PROFILE[types[0].key];
    var sub = TYPE_PROFILE[types[1].key];
    var diff = types[0].s - types[5].s;
    var p = [];

    p.push('<p>你的职业倾向：<b>' + main.name + '为主' + (types[1].s > 0 ? '，辅一点' + sub.name : '') + '</b>。依据是你兴趣题上的真实选择。你在「' + main.q + '」选了「' + likeWord(types[0].s) + '」，在「' + sub.q + '」选了「' + likeWord(types[1].s) + '」。两题一对照，倾向就出来了。</p>');

    p.push('<p>' + main.desc + '</p>');

    if (types[1].s > 0) {
      p.push('<p>辅码「' + sub.name + '」不是主角，但给你加了一层底色：' + sub.desc + '</p>');
    }

    var vals = valueList(a);
    if (vals.length) {
      p.push('<p>价值取向上，' + vals.map(function (k) { return VALUE_TALK[k]; }).join('；') + '。</p>');
    }

    p.push('<p>' + SKILL_TALK[a.skill] + '</p>');

    if (diff >= 2) {
      p.push('<p>你的兴趣分化度较高（最高分与最低分相差 ' + diff + ' 分），倾向比较明确，不是「什么都行」。这对选路是好事，能少纠结。</p>');
    } else if (diff === 1) {
      p.push('<p>你的兴趣分化度中等（最高分与最低分相差 1 分），倾向存在但不算强烈，建议之后用真实经历再确认一次。</p>');
    } else {
      p.push('<p>你的兴趣比较分散（各类型得分接近），这不代表没方向，只说明你还没用足够多的真实经历去分辨偏好。建议先低成本试两三条路。</p>');
    }

    return p.join("");
  }

  // ===== 雷达图（RIASEC 六型）=====
  function drawRadar(a) {
    var data = [
      { label: "动手", val: a.int_R || 0 },
      { label: "钻研", val: a.int_I || 0 },
      { label: "创作", val: a.int_A || 0 },
      { label: "助人", val: a.int_S || 0 },
      { label: "推动", val: a.int_E || 0 },
      { label: "规范", val: a.int_C || 0 },
    ];
    var cx = 150, cy = 150, R = 104;
    var out = [];
    // 参考网格（满分 2 层）
    [1, 2].forEach(function (lvl) {
      var rr = R * lvl / 2;
      var gp = data.map(function (d, i) {
        var ang = -Math.PI / 2 + i * Math.PI / 3;
        return (cx + rr * Math.cos(ang)).toFixed(1) + "," + (cy + rr * Math.sin(ang)).toFixed(1);
      }).join(" ");
      out.push('<polygon points="' + gp + '" class="radar-grid" />');
    });
    // 轴线
    data.forEach(function (d, i) {
      var ang = -Math.PI / 2 + i * Math.PI / 3;
      out.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + R * Math.cos(ang)).toFixed(1) + '" y2="' + (cy + R * Math.sin(ang)).toFixed(1) + '" class="radar-axis" />');
    });
    // 数据多边形
    var dp = data.map(function (d, i) {
      var ang = -Math.PI / 2 + i * Math.PI / 3;
      var rr = (d.val / 2) * R;
      return (cx + rr * Math.cos(ang)).toFixed(1) + "," + (cy + rr * Math.sin(ang)).toFixed(1);
    }).join(" ");
    out.push('<polygon points="' + dp + '" class="radar-data" />');
    // 顶点
    data.forEach(function (d, i) {
      var ang = -Math.PI / 2 + i * Math.PI / 3;
      var rr = (d.val / 2) * R;
      out.push('<circle cx="' + (cx + rr * Math.cos(ang)).toFixed(1) + '" cy="' + (cy + rr * Math.sin(ang)).toFixed(1) + '" r="3.4" class="radar-dot" />');
    });
    // 标签（只放类型名，外圈，数值不挤）
    data.forEach(function (d, i) {
      var ang = -Math.PI / 2 + i * Math.PI / 3;
      var lx = cx + (R + 30) * Math.cos(ang);
      var ly = cy + (R + 30) * Math.sin(ang);
      out.push('<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" class="radar-label" text-anchor="middle" dominant-baseline="middle">' + d.label + '</text>');
    });
    return '<svg viewBox="0 0 300 300" class="radar-svg">' + out.join("") + '</svg>';
  }

  // ===== 渲染报告 =====
  // ===== 主推/备选/短板 段落生成 =====
  function buildTopHtml(a, top) {
    var p = [];
    p.push('<p>先说<b>为什么是「' + top.name + '」</b>。不是拍脑袋，是你下面这几条，正好是这条路要的：</p>');
    var rs = matchReasons(a, top.id);
    if (rs.length) {
      p.push('<p>' + rs.map(function (r, i) { return (i + 1) + '. ' + r; }).join('<br>') + '</p>');
    }
    p.push('<p>这条路真实长什么样：<b>' + top.salaryRange + '</b>。门槛是「' + top.threshold + '」。' + top.competition + '。' + top.whoWalked + '。</p>');
    return p.join("");
  }

  function buildAltHtml(a, alt) {
    var p = [];
    p.push('<p>「' + alt.name + '」排第二，是它跟你的匹配少了一两点，不是它差：</p>');
    var rs = matchReasons(a, alt.id);
    p.push('<p>' + (rs.length ? rs.join('；') : '它跟你画像的重合度一般。') + '</p>');
    p.push('<p>差在哪：它的门槛是「' + alt.threshold + '」，你得多补一步。行情参考：' + alt.salaryRange + '。它更适合作为「主推走不通时的退路」。</p>');
    return p.join("");
  }

  function buildGapHtml(a, top) {
    var p = [];
    p.push('<p>要走「' + top.name + '」，你现在缺的是：<b>' + top.need + '</b>。</p>');
    p.push('<p>为什么这一项会卡你：' + top.threshold + '。别的都可以慢慢补，这一项是入场券，得先拿下。</p>');
    p.push('<p>第一步建议：<b>' + top.firstStep + '</b>。先动手，比反复纠结有用。</p>');
    return p.join("");
  }

  function render(a) {
    var scored = Object.keys(PATHS).map(function (id) {
      return { p: PATHS[id], s: score(id, a) };
    });
    scored.sort(function (x, y) { return y.s - x.s; });
    var top = scored[0].p;
    var alt = scored[1].p;

    var el = function (id) { return document.getElementById(id); };

    // 结论横幅
    el("resTop").textContent = top.name;
    el("resAlt").textContent = alt.name;

    // 雷达图
    el("radarBox").innerHTML = drawRadar(a);
    el("radarCaption").textContent = "兴趣六型（霍兰德 RIASEC，满分 2）";

    // 画像段落
    el("portraitText").innerHTML = buildPortraitHtml(a);

    // 主推 / 备选 / 短板 段落
    el("topName").textContent = top.name;
    el("topTag").textContent = top.tag;
    el("topText").innerHTML = buildTopHtml(a, top);
    el("altName").textContent = alt.name;
    el("altTag").textContent = alt.tag;
    el("altText").innerHTML = buildAltHtml(a, alt);
    el("gapText").innerHTML = buildGapHtml(a, top);
  }

  // ===== 入口 =====
  var raw = null;
  try { raw = localStorage.getItem("haina_quiz_answers"); } catch (e) {}
  if (!raw) {
    // 没有答案，回到测试页
    location.replace("/quiz");
    return;
  }
  var answers;
  try { answers = JSON.parse(raw); } catch (e) { location.replace("/quiz"); return; }

  render(answers);

  document.getElementById("retestBtn").addEventListener("click", function () {
    try { localStorage.removeItem("haina_quiz_answers"); } catch (e) {}
    location.href = "/quiz";
  });
})();
