// 各专业薪资对比：拉 /api/salary 渲染两组表格
// 2026-08-24：数据源从职友集"可从事岗位"口径改为高校就业报告/麦可思（应届本科毕业半年后月收入）
(function () {
  var MARINE = ["海洋科学", "海洋技术", "船舶与海洋工程", "航海技术", "轮机工程", "海洋渔业科学与技术"];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function rowHtml(name, d) {
    var note = d && d.note ? '<tr class="row-note"><td colspan="3">' + esc(d.note) + '</td></tr>' : "";
    return (
      "<tr>" +
      '<td><a href="' + esc(d.url || "#") + '" target="_blank" rel="noopener" title="点此看数据来源">' + esc(name) + "</a></td>" +
      '<td class="salary">' + esc(d.main_range || "—") + "</td>" +
      '<td class="salary">' + esc(d.fresh_grad || "—") + "</td>" +
      "</tr>" +
      note
    );
  }

  function tableHtml(names) {
    return (
      "<table>" +
      "<thead><tr><th>专业</th><th>主薪资区间（应届）</th><th>应届起薪</th></tr></thead>" +
      "<tbody>" + names.map(function (n) { return rowHtml(n, window.__salaryData[n] || {}); }).join("") + "</tbody>" +
      "</table>"
    );
  }

  fetch("/api/salary")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      window.__salaryData = data;
      var marine = MARINE.filter(function (n) { return data[n]; });
      var other = Object.keys(data).filter(function (n) { return MARINE.indexOf(n) < 0 && n.charAt(0) !== "_"; });
      document.getElementById("marineTable").innerHTML = tableHtml(marine);
      document.getElementById("otherTable").innerHTML = tableHtml(other);
    })
    .catch(function (e) {
      document.getElementById("marineTable").innerHTML = '<p style="padding:16px;color:rgba(234,242,250,0.6)">数据加载失败</p>';
    });
})();
