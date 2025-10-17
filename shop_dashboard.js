const SHEET_ID = "1lukJC1vKSq02Nus23svZ21_pp-86fz0mU1EARjalCBI";
const SHEETS = {
  DEPOSIT: `https://opensheet.elk.sh/${SHEET_ID}/TOTAL%20DEPOSIT`,
  WITHDRAWAL: `https://opensheet.elk.sh/${SHEET_ID}/TOTAL%20WITHDRAWAL`,
  STLM: `https://opensheet.elk.sh/${SHEET_ID}/STLM%2FTOPUP`,
  COMM: `https://opensheet.elk.sh/${SHEET_ID}/COMM`,
  SHOP_BALANCE: `https://opensheet.elk.sh/${SHEET_ID}/SHOPS%20BALANCE`
};

const shopName = new URLSearchParams(window.location.search).get("shopName");
document.getElementById("shopTitle").textContent = shopName || "Shop Dashboard";

const tbody = document.getElementById("transactionTableBody");
const totalsRow = document.getElementById("totalsRow");
const loadingSpinner = document.getElementById("loadingSpinner");

function parseNumber(v) {
  if (!v) return 0;
  const s = String(v).replace(/,/g, "").replace(/\((.*)\)/, "-$1");
  return parseFloat(s) || 0;
}

function formatNumber(v) {
  return v !== undefined ? v.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-";
}

function normalizeShopName(name) {
  return (name || "").trim().replace(/\s+/g, " ").toUpperCase();
}

async function fetchSheet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadData() {
  if (!shopName) { alert("❌ No shopName found in URL"); return; }
  loadingSpinner.style.display = "block";

  try {
    const [depositData, withdrawalData, stlmData, commData, shopBalanceData] = await Promise.all([
      fetchSheet(SHEETS.DEPOSIT),
      fetchSheet(SHEETS.WITHDRAWAL),
      fetchSheet(SHEETS.STLM),
      fetchSheet(SHEETS.COMM),
      fetchSheet(SHEETS.SHOP_BALANCE)
    ]);

    const shopRow = shopBalanceData.find(r => normalizeShopName(r.SHOP) === normalizeShopName(shopName));
    const bringForwardBalance = parseNumber(shopRow ? rTrim(shopRow[" BRING FORWARD BALANCE "]) : 0);
    const secDeposit = parseNumber(shopRow ? shopRow["SECURITY DEPOSIT"] : 0);
    const teamLeader = shopRow ? shopRow["TEAM LEADER"] : "-";

    document.getElementById("infoShopName").textContent = shopName;
    document.getElementById("infoBFBalance").textContent = formatNumber(bringForwardBalance);
    document.getElementById("infoSecDeposit").textContent = formatNumber(secDeposit);
    document.getElementById("infoTeamLeader").textContent = teamLeader;

    const shopCommRow = commData.find(r => normalizeShopName(r.SHOP) === normalizeShopName(shopName));
    const dpCommRate = parseFloat(shopCommRow?.["DP COMM"] || 0);
    const wdCommRate = parseFloat(shopCommRow?.["WD COMM"] || 0);
    const addCommRate = parseFloat(shopCommRow?.["ADD COMM"] || 0);

    const dates = new Set([
      ...depositData.filter(r=>normalizeShopName(r.SHOP)===normalizeShopName(shopName)).map(r => r.DATE),
      ...withdrawalData.filter(r=>normalizeShopName(r.SHOP)===normalizeShopName(shopName)).map(r => r.DATE),
      ...stlmData.filter(r=>normalizeShopName(r.SHOP)===normalizeShopName(shopName)).map(r => r.DATE)
    ]);
    const sortedDates = Array.from(dates).filter(Boolean).sort((a,b) => new Date(a) - new Date(b));

    let runningBalance = bringForwardBalance;
    const totals = { depTotal:0, wdTotal:0, inAmt:0, outAmt:0, settlement:0,
      specialPay:0, adjustment:0, secDep:0, dpComm:0, wdComm:0, addComm:0 };

    tbody.innerHTML = "";

    // Add Bring Forward Balance row first
    if (bringForwardBalance) {
      const bfbRow = document.createElement("tr");
      bfbRow.innerHTML = `
        <td>B/F Balance</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>${formatNumber(secDeposit)}</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>0.00</td>
        <td>${formatNumber(runningBalance)}</td>
      `;
      tbody.appendChild(bfbRow);
    }

    for (const date of sortedDates) {
      const depTotalRow = depositData.filter(r=>normalizeShopName(r.SHOP)===normalizeShopName(shopName) && r.DATE===date)
        .reduce((sum,r)=>sum+parseNumber(r.AMOUNT),0);
      const wdTotalRow = withdrawalData.filter(r=>normalizeShopName(r.SHOP)===normalizeShopName(shopName) && r.DATE===date)
        .reduce((sum,r)=>sum+parseNumber(r.AMOUNT),0);
      const stlmForDate = stlmData.filter(r=>normalizeShopName(r.SHOP)===normalizeShopName(shopName) && r.DATE===date);

      const modeSum = mode => stlmForDate.filter(r=>r.MODE?.trim().toUpperCase()===mode).reduce((s,r)=>s+parseNumber(r.AMOUNT),0);
      const inAmtRow = modeSum("IN"), outAmtRow = modeSum("OUT"),
            settlementRow = modeSum("SETTLEMENT"), specialPayRow = modeSum("SPECIAL PAYMENT"),
            adjustmentRow = modeSum("ADJUSTMENT"), secDepRow = modeSum("SECURITY DEPOSIT");

      const dpCommRow = depTotalRow*dpCommRate/100;
      const wdCommRow = wdTotalRow*wdCommRate/100;
      const addCommRow = depTotalRow*addCommRate/100;

      runningBalance += depTotalRow - wdTotalRow + inAmtRow - outAmtRow - settlementRow - specialPayRow
                        + adjustmentRow - secDepRow - dpCommRow - wdCommRow - addCommRow;

      totals.depTotal += depTotalRow; totals.wdTotal += wdTotalRow;
      totals.inAmt += inAmtRow; totals.outAmt += outAmtRow; totals.settlement += settlementRow;
      totals.specialPay += specialPayRow; totals.adjustment += adjustmentRow; totals.secDep += secDepRow;
      totals.dpComm += dpCommRow; totals.wdComm += wdCommRow; totals.addComm += addCommRow;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${date}</td>
        <td>${formatNumber(depTotalRow)}</td>
        <td>${formatNumber(wdTotalRow)}</td>
        <td>${formatNumber(inAmtRow)}</td>
        <td>${formatNumber(outAmtRow)}</td>
        <td>${formatNumber(settlementRow)}</td>
        <td>${formatNumber(specialPayRow)}</td>
        <td>${formatNumber(adjustmentRow)}</td>
        <td>${formatNumber(secDepRow)}</td>
        <td>${formatNumber(dpCommRow)}</td>
        <td>${formatNumber(wdCommRow)}</td>
        <td>${formatNumber(addCommRow)}</td>
        <td>${formatNumber(runningBalance)}</td>
      `;
      tbody.appendChild(tr);
    }

    const rows = tbody.querySelectorAll("tr");
    if (rows.length) rows[rows.length-1].classList.add("latest");

    totalsRow.innerHTML = `<td>TOTAL</td>
      <td>${formatNumber(totals.depTotal)}</td>
      <td>${formatNumber(totals.wdTotal)}</td>
      <td>${formatNumber(totals.inAmt)}</td>
      <td>${formatNumber(totals.outAmt)}</td>
      <td>${formatNumber(totals.settlement)}</td>
      <td>${formatNumber(totals.specialPay)}</td>
      <td>${formatNumber(totals.adjustment)}</td>
      <td>${formatNumber(totals.secDep)}</td>
      <td>${formatNumber(totals.dpComm)}</td>
      <td>${formatNumber(totals.wdComm)}</td>
      <td>${formatNumber(totals.addComm)}</td>
      <td>${formatNumber(runningBalance)}</td>
    `;

    document.getElementById("viewDailyBtn").addEventListener("click", ()=>{
      window.open(`daily_transactions.html?shopName=${encodeURIComponent(shopName)}`,"_blank");
    });

  } catch(err){
    console.error(err);
    alert("⚠️ Error loading data: "+err.message);
  }

  loadingSpinner.style.display = "none";
}

function rTrim(v){ return String(v||"").trim(); }

loadData();
