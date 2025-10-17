/* dashboard.js - defensive, mobile-safe CSV export, re-attached handlers */

const SHEET_ID = "1lukJC1vKSq02Nus23svZ21_pp-86fz0mU1EARjalCBI";
const OPENSHEET_URL = `https://opensheet.elk.sh/${SHEET_ID}/SHOPS%20BALANCE`;

const HEADERS = [
  "SHOP NAME",
  "TEAM LEADER",
  "SECURITY DEPOSIT",
  "BRING FORWARD BALANCE",
  "TOTAL DEPOSIT",
  "TOTAL WITHDAWAL",
  "INTERNAL TRANSFER IN",
  "INTERNAL TRANSAFER OUT",
  "SETTLEMENT",
  "SPECIAL PAYMENT",
  "ADJUSTMENT",
  "DP COMM",
  "WD COMM",
  "ADD COMM",
  "RUNNING BALANCE",
];

const cleanKey = (k) => String(k || "").replace(/\s+/g, " ").trim().toUpperCase();
const parseNumber = (v) => {
  if (v === null || typeof v === "undefined" || v === "") return 0;
  const s = String(v).replace(/[,\s]/g, "").replace(/\((.*)\)/, "-$1");
  const n = Number(s);
  return isFinite(n) ? n : 0;
};
const normalize = (row) => {
  const out = {};
  for (const k in row) out[cleanKey(k)] = String(row[k] || "").trim();
  return out;
};

let rawData = [];
let filteredData = [];
let cachedData = [];
let currentPage = 1;
const rowsPerPage = 20;

/* ---------- FETCH ---------- */
async function fetchShopBalance() {
  const res = await fetch(OPENSHEET_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.map(normalize);
}

/* ---------- LOAD / INIT ---------- */
async function loadDashboard() {
  try {
    const data = await fetchShopBalance();
    rawData = data;
    buildTeamLeaderDropdown(data);

    // Auto-filter if URL contains teamLeader param
    const urlParams = new URLSearchParams(window.location.search);
    const teamLeaderParam = urlParams.get("teamLeader");

    if (teamLeaderParam) {
      const lf = document.getElementById("leaderFilter");
      if (lf) {
        lf.value = teamLeaderParam.toUpperCase();
        lf.style.display = "none"; // hide dropdown only
      }
      const linkDiv = document.getElementById("teamDashboardLink");
      if (linkDiv) linkDiv.style.display = "none";
    }

    buildSummary(data);

    if (teamLeaderParam) filterData();
  } catch (err) {
    console.error("Failed to load dashboard:", err);
    const container = document.body || document.documentElement;
    if (container) {
      const el = document.createElement("div");
      el.style.color = "red";
      el.style.padding = "20px";
      el.textContent = "Failed to load data. Check network or sheet URL.";
      container.prepend(el);
    }
  }
}

/* ---------- BUILDERS ---------- */
function buildTeamLeaderDropdown(data) {
  const dropdown = document.getElementById("leaderFilter");
  if (!dropdown) return;
  dropdown.innerHTML = '<option value="ALL">All Team Leaders</option>';
  const leaders = [...new Set(
    data.map(r => (r["TEAM LEADER"] || "").trim().toUpperCase())
  )].filter(name => name && name !== "#N/A" && name !== "N/A");
  leaders.sort().forEach(l => {
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = l;
    dropdown.appendChild(opt);
  });
}

function buildSummary(data) {
  const summary = {};
  data.forEach(r => {
    const shop = (r["SHOP"] || r["SHOP NAME"] || "").trim();
    if (!shop) return;

    const leader = (r["TEAM LEADER"] || "").trim().toUpperCase();

    if (!summary[shop]) {
      summary[shop] = {
        "SHOP NAME": shop,
        "TEAM LEADER": leader,
        "SECURITY DEPOSIT": 0,
        "BRING FORWARD BALANCE": 0,
        "TOTAL DEPOSIT": 0,
        "TOTAL WITHDAWAL": 0,
        "INTERNAL TRANSFER IN": 0,
        "INTERNAL TRANSAFER OUT": 0,
        "SETTLEMENT": 0,
        "SPECIAL PAYMENT": 0,
        "ADJUSTMENT": 0,
        "DP COMM": 0,
        "WD COMM": 0,
        "ADD COMM": 0,
        "RUNNING BALANCE": 0,
      };
    }

    summary[shop]["SECURITY DEPOSIT"] += parseNumber(r["SECURITY DEPOSIT"]);
    summary[shop]["BRING FORWARD BALANCE"] += parseNumber(r["BRING FORWARD BALANCE"]);
    summary[shop]["TOTAL DEPOSIT"] += parseNumber(r["TOTAL DEPOSIT"]);
    summary[shop]["TOTAL WITHDAWAL"] += parseNumber(r["TOTAL WITHDAWAL"]);
    summary[shop]["INTERNAL TRANSFER IN"] += parseNumber(r["INTERNAL TRANSFER IN"]);
    summary[shop]["INTERNAL TRANSAFER OUT"] += parseNumber(r["INTERNAL TRANSAFER OUT"]);
    summary[shop]["SETTLEMENT"] += parseNumber(r["SETTLEMENT"]);
    summary[shop]["SPECIAL PAYMENT"] += parseNumber(r["SPECIAL PAYMENT"]);
    summary[shop]["ADJUSTMENT"] += parseNumber(r["ADJUSTMENT"]);
    summary[shop]["DP COMM"] += parseNumber(r["DP COMM"]);
    summary[shop]["WD COMM"] += parseNumber(r["WD COMM"]);
    summary[shop]["ADD COMM"] += parseNumber(r["ADD COMM"]);

    const rb =
      summary[shop]["BRING FORWARD BALANCE"] +
      summary[shop]["TOTAL DEPOSIT"] -
      summary[shop]["TOTAL WITHDAWAL"] +
      summary[shop]["INTERNAL TRANSFER IN"] -
      summary[shop]["INTERNAL TRANSAFER OUT"] -
      summary[shop]["SETTLEMENT"] -
      summary[shop]["SPECIAL PAYMENT"] +
      summary[shop]["ADJUSTMENT"] -
      summary[shop]["DP COMM"] -
      summary[shop]["WD COMM"] -
      summary[shop]["ADD COMM"];

    summary[shop]["RUNNING BALANCE"] = rb;
  });

  cachedData = Object.values(summary);
  filteredData = cachedData.slice(); // clone
  currentPage = 1;
  renderTable();
}

/* ---------- RENDER ---------- */
function renderTable() {
  const tableHead = document.getElementById("tableHeader");
  const tableBody = document.getElementById("tableBody");
  if (!tableHead || !tableBody) return;

  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  HEADERS.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    if (h === "SHOP NAME" || h === "TEAM LEADER") th.classList.add("left");
    tableHead.appendChild(th);
  });

  // Ensure currentPage is within bounds
  const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * rowsPerPage;
  const pageData = filteredData.slice(start, start + rowsPerPage);

  pageData.forEach(r => {
    const tr = document.createElement("tr");
    HEADERS.forEach(h => {
      const td = document.createElement("td");
      if (h === "SHOP NAME") {
        const a = document.createElement("a");
        a.textContent = r[h] || "";
        a.href = `shop_dashboard.html?shopName=${encodeURIComponent(r[h] || "")}`;
        a.target = "_blank";
        a.className = "shop-link";
        td.appendChild(a);
        td.classList.add("left");
      } else if (h === "TEAM LEADER") {
        td.textContent = r[h] || "";
        td.classList.add("left");
      } else {
        const val = Number(r[h]) || 0;
        td.textContent = val.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });

  updatePagination();
  renderTotals();
  updateTeamDashboardLink();
}

function updatePagination() {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
  const pageInfo = document.getElementById("pageInfo");
  if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

/* ---------- Totals ---------- */
function renderTotals() {
  const totalsDiv = document.getElementById("totalsRow");
  if (!totalsDiv) return;
  totalsDiv.innerHTML = "";

  HEADERS.forEach(h => {
    if (["SHOP NAME", "TEAM LEADER"].includes(h)) return;
    const total = filteredData.reduce((a, b) => a + (parseNumber(b[h]) || 0), 0);
    const card = document.createElement("div");
    card.className = "total-card";
    card.innerHTML = `<div>${h}</div>
                      <div>${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>`;
    totalsDiv.appendChild(card);
  });
}

/* ---------- Team Leader Link ---------- */
function updateTeamDashboardLink() {
  const leaderEl = document.getElementById("leaderFilter");
  const linkDiv = document.getElementById("teamDashboardLink");
  if (!linkDiv) return;
  const leader = leaderEl ? leaderEl.value : "ALL";

  if (leader && leader !== "ALL") {
    const url = `${window.location.origin}${window.location.pathname}?teamLeader=${encodeURIComponent(leader)}`;
    linkDiv.innerHTML = `
      <a href="${url}" target="_blank" style="color:#0077cc; font-weight:bold; text-decoration:underline;">
        Open ${leader} Dashboard in New Tab
      </a>
    `;
  } else {
    linkDiv.innerHTML = "";
  }
}

/* ---------- FILTER / EVENTS ---------- */
function filterData() {
  const leaderEl = document.getElementById("leaderFilter");
  const searchEl = document.getElementById("searchInput");
  const leader = leaderEl ? leaderEl.value : "ALL";
  const search = searchEl ? String(searchEl.value || "").trim().toUpperCase() : "";

  filteredData = cachedData.filter(r => {
    const matchLeader = leader === "ALL" || (r["TEAM LEADER"] || "").toUpperCase() === leader;
    const matchSearch = (r["SHOP NAME"] || "").toUpperCase().includes(search);
    return matchLeader && matchSearch;
  });

  currentPage = 1;
  renderTable();
}

function attachEventHandlers() {
  const leaderFilter = document.getElementById("leaderFilter");
  const searchInput = document.getElementById("searchInput");
  const prevPage = document.getElementById("prevPage");
  const nextPage = document.getElementById("nextPage");
  const resetBtn = document.getElementById("resetBtn");
  const exportBtn = document.getElementById("exportBtn");

  if (leaderFilter) leaderFilter.addEventListener("change", filterData);
  if (searchInput) searchInput.addEventListener("input", filterData);
  if (prevPage) prevPage.addEventListener("click", () => { if (currentPage>1) { currentPage--; renderTable(); } });
  if (nextPage) nextPage.addEventListener("click", () => { currentPage++; renderTable(); });
  if (resetBtn) resetBtn.addEventListener("click", () => {
    if (leaderFilter) leaderFilter.value = "ALL";
    if (searchInput) searchInput.value = "";
    filteredData = cachedData.slice();
    currentPage = 1;
    renderTable();
  });

  if (exportBtn) exportBtn.addEventListener("click", exportCSV);
}

/* ---------- UNIVERSAL CSV EXPORT ---------- */
function csvEscape(value) {
  // wrap value in quotes and escape existing quotes
  if (value === null || typeof value === "undefined") value = "";
  return `"${String(value).replace(/"/g, '""')}"`;
}

function exportCSV() {
  try {
    // build CSV
    let csv = HEADERS.join(",") + "\n";
    filteredData.forEach(r => {
      const row = HEADERS.map(h => {
        // prefer original string value if present, else numeric
        const v = (r[h] !== undefined && r[h] !== null && r[h] !== "") ? r[h] : 0;
        return csvEscape(v);
      }).join(",");
      csv += row + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    const link = document.createElement("a");
    link.href = url;
    link.download = "shops_balance.csv";
    link.style.display = "none";
    document.body.appendChild(link);

    if (isIOS) {
      // iOS: open in new tab (user must Save/Share)
      window.open(url, "_blank");
      // show unobtrusive message instead of alert if desired:
      showTemporaryMessage("📱 On iPhone/iPad: tap Share → 'Save to Files' to save the CSV.", 7000);
    } else {
      // desktop & Android: trigger download
      link.click();
    }

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Export failed:", err);
    showTemporaryMessage("Export failed. Check console for details.", 5000);
  }
}

/* ---------- small helper message ---------- */
function showTemporaryMessage(text, ms = 4000) {
  const existing = document.getElementById("tempMessageDiv");
  if (existing) existing.remove();

  const d = document.createElement("div");
  d.id = "tempMessageDiv";
  d.textContent = text;
  d.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:18px;background:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.12);color:#0077cc;font-weight:600;z-index:9999;";
  document.body.appendChild(d);
  setTimeout(() => d.remove(), ms);
}

/* ---------- INIT ---------- */
function init() {
  attachEventHandlers();
  // load data after handlers attached so UI reacts properly
  loadDashboard();
}

document.addEventListener("DOMContentLoaded", init);
