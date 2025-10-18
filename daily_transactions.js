// GSheet JSON URLs
const WD_URL = "https://opensheet.elk.sh/1CfAAIdWp3TuamCkSUw5w_Vd3QQnjc7LjF4zo4u4eZv0/WD";
const DP_URL = "https://opensheet.elk.sh/1CfAAIdWp3TuamCkSUw5w_Vd3QQnjc7LjF4zo4u4eZv0/DP";
const B2B_URL = "https://opensheet.elk.sh/1CfAAIdWp3TuamCkSUw5w_Vd3QQnjc7LjF4zo4u4eZv0/B2B";

// Get shopName from URL
const SHOP_NAME = new URLSearchParams(window.location.search).get("shopName") || "";

const loadingSpinner = document.getElementById("loadingSpinner");
const walletFilter = document.getElementById("walletFilter");
const typeFilter = document.getElementById("typeFilter");
const dateFilter = document.getElementById("dateFilter");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const dashboardBars = document.getElementById("dashboardBars");

let allTransactions = [];
let filteredTransactions = [];

// Parse numbers safely
function parseNumber(v){ return v ? parseFloat(String(v).replace(/,/g,""))||0 : 0; }

// Normalize shop name
function normalizeShopName(name){
    return (name || "").trim().replace(/\s+/g," ").toUpperCase();
}

// Normalize shop name
function normalizeShopName(name){
    return (name || "").trim().replace(/\s+/g," ").toUpperCase();
}

// Fetch GSheet tab JSON
async function fetchSheetData(url){
    try {
        const res = await fetch(url);
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.map(r=>({
            "To Wallet Number": r["To Wallet Number"] || "-",
            "Wallet": r["Wallet"] || "-",
            "Reference": r["Reference"] || "-",
            "Amount": parseNumber(r["Amount"]),
            "Date": normalizeDate(r["Date"]),
            "Type": r["Type"] || "-",
            "Shop Name": normalizeShopName(r["Shop Name"]),
            "Leader": r["Leader"] || "-",
            "From Wallet Number": r["From Wallet Number"] || "-"
        }));
    } catch(e){
        console.error(e);
        alert("Error fetching data: " + e.message);
        return [];
    }
}

// Load all transactions
async function loadTransactions(){
    loadingSpinner.style.display = "block";

    const wdData = await fetchSheetData(WD_URL);
    const dpData = await fetchSheetData(DP_URL);
    const b2bData = await fetchSheetData(B2B_URL);

    allTransactions = [...wdData, ...dpData, ...b2bData];

    populateFilters();
    applyFilters();
    loadingSpinner.style.display = "none";
}

// Populate Wallet and Type filters
function populateFilters(){
    const wallets = Array.from(new Set(allTransactions.map(r=>r["Wallet"]))).sort();
    walletFilter.innerHTML = '<option value="All">All</option>';
    wallets.forEach(w=>{
        const opt = document.createElement("option");
        opt.value=w; opt.textContent=w;
        walletFilter.appendChild(opt);
    });

    const types = Array.from(new Set(allTransactions.map(r=>r["Type"]))).sort();
    typeFilter.innerHTML = '<option value="All">All</option>';
    types.forEach(t=>{
        const opt = document.createElement("option");
        opt.value=t; opt.textContent=t;
        typeFilter.appendChild(opt);
    });
}

// Filter transactions
function applyFilters(){
    const selectedDate = dateFilter.value;
    filteredTransactions = allTransactions.filter(r=>{
        const shopMatch = SHOP_NAME ? r["Shop Name"] === normalizeShopName(SHOP_NAME) : true;
        const walletMatch = walletFilter.value==="All" || r["Wallet"]===walletFilter.value;
        const typeMatch = typeFilter.value==="All" || r["Type"]===typeFilter.value;
        const dateMatch = !selectedDate || r["Date"]===selectedDate;
        return shopMatch && walletMatch && typeMatch && dateMatch;
    });
    renderDashboard();
}

// Render aggregated dashboard bars
function renderDashboard(){
    dashboardBars.innerHTML = "";
    if(!filteredTransactions.length){
        dashboardBars.textContent = "No transactions found.";
        return;
    }

    // Aggregate by Wallet
    const walletTotals = {};
    filteredTransactions.forEach(r=>{
        if(!walletTotals[r.Wallet]) walletTotals[r.Wallet] = 0;
        walletTotals[r.Wallet] += r.Amount;
    });

    for(const [wallet, total] of Object.entries(walletTotals)){
        const bar = document.createElement("div");
        bar.className="bar";
        bar.textContent = `${wallet}: ${total.toLocaleString("en-US",{minimumFractionDigits:2})}`;
        dashboardBars.appendChild(bar);
    }
}

// Export CSV of full details
function exportCSV(){
    if(!filteredTransactions.length) return alert("No data to export.");
    const headers = ["To Wallet Number","Wallet","Reference","Amount","Date","Type","Shop Name","Leader","From Wallet Number"];
    const rows = [headers.join(","), ...filteredTransactions.map(r=>headers.map(h=>`"${r[h]}"`).join(","))];
    const blob = new Blob([rows.join("\n")], {type:"text/csv"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Transactions_${SHOP_NAME||"All"}.csv`;
    a.click();
}

// Event listeners
walletFilter.addEventListener("change", applyFilters);
typeFilter.addEventListener("change", applyFilters);
dateFilter.addEventListener("change", applyFilters);
resetBtn.addEventListener("click", ()=>{
    walletFilter.value="All"; typeFilter.value="All"; dateFilter.value="";
    applyFilters();
});
exportBtn.addEventListener("click", exportCSV);

// Initialize
(async function init(){
    document.getElementById("dashboardTitle").textContent = SHOP_NAME
        ? `Daily Transaction Dashboard - ${SHOP_NAME}`
        : "Daily Transaction Dashboard - All Shops";
    await loadTransactions();
})();

