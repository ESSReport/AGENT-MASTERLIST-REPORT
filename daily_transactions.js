// ------------------------------
// GSheet JSON URLs
// ------------------------------
const WD_URL = "https://opensheet.elk.sh/1CfAAIdWp3TuamCkSUw5w_Vd3QQnjc7LjF4zo4u4eZv0/WD";
const DP_URL = "https://opensheet.elk.sh/1CfAAIdWp3TuamCkSUw5w_Vd3QQnjc7LjF4zo4u4eZv0/DP";
const B2B_URL = "https://opensheet.elk.sh/1CfAAIdWp3TuamCkSUw5w_Vd3QQnjc7LjF4zo4u4eZv0/B2B";

// Backup_Index JSON URL
const BACKUP_INDEX_URL = "https://opensheet.elk.sh/<BACKUP_INDEX_SHEET_ID>/Backup_Index";

// ------------------------------
// Get shopName from URL
// ------------------------------
const SHOP_NAME = new URLSearchParams(window.location.search).get("shopName") || "";

// ------------------------------
// DOM Elements
// ------------------------------
const loadingSpinner = document.getElementById("loadingSpinner");
const walletFilter = document.getElementById("walletFilter");
const typeFilter = document.getElementById("typeFilter");
const dateFilter = document.getElementById("dateFilter");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const dashboardBars = document.getElementById("dashboardBars");

// ------------------------------
// Data Arrays
// ------------------------------
let allTransactions = [];
let filteredTransactions = [];
let backupSheets = [];

// ------------------------------
// Utilities
// ------------------------------
function parseNumber(v){ return v ? parseFloat(String(v).replace(/,/g,""))||0 : 0; }

function normalizeDate(dateStr){
    if(!dateStr) return "";
    const d = new Date(dateStr);
    if(isNaN(d)) return "";
    return d.toISOString().split("T")[0];
}

function normalizeShopName(name){
    return (name || "").trim().replace(/\s+/g," ").toUpperCase();
}

// ------------------------------
// Fetch GSheet JSON
// ------------------------------
async function fetchSheetData(url){
    try {
        const res = await fetch(url);
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.map(r => ({
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

// ------------------------------
// Load main GSheet data
// ------------------------------
async function loadMainData(){
    const wdData = await fetchSheetData(WD_URL);
    const dpData = await fetchSheetData(DP_URL);
    const b2bData = await fetchSheetData(B2B_URL);
    allTransactions = [...wdData, ...dpData, ...b2bData];
}

// ------------------------------
// Load Backup_Index
// ------------------------------
async function loadBackupIndex(){
    const indexData = await fetchSheetData(BACKUP_INDEX_URL);
    backupSheets = indexData.map(r => ({
        date: r["Date"],
        url: r["URL"]
    }));
}

// ------------------------------
// Load backup data for selected date
// ------------------------------
async function loadBackupDataByDate(selectedDate){
    const backup = backupSheets.find(b => b.date === selectedDate);
    if(backup){
        const backupData = await fetchSheetData(backup.url);
        allTransactions = backupData; // override main data
    } else {
        alert("No backup available for this date. Showing main data.");
        await loadMainData();
    }
}

// ------------------------------
// Apply filters
// ------------------------------
async function applyFilters(){
    loadingSpinner.style.display = "block";
    const selectedDate = dateFilter.value;

    if(!selectedDate){
        // default: load main GSheet
        await loadMainData();
    } else {
        // try loading backup for selected date
        await loadBackupDataByDate(selectedDate);
    }

    // Apply wallet/type filters
    filteredTransactions = allTransactions.filter(r=>{
        const shopMatch = SHOP_NAME ? r["Shop Name"] === normalizeShopName(SHOP_NAME) : true;
        const walletMatch = walletFilter.value==="All" || r["Wallet"]===walletFilter.value;
        const typeMatch = typeFilter.value==="All" || r["Type"]===typeFilter.value;
        return shopMatch && walletMatch && typeMatch;
    });

    renderDashboard();
    loadingSpinner.style.display = "none";
}

// ------------------------------
// Populate Wallet and Type filters
// ------------------------------
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

// ------------------------------
// Render dashboard bars
// ------------------------------
function renderDashboard(){
    dashboardBars.innerHTML = "";
    if(!filteredTransactions.length){
        dashboardBars.textContent = "No transactions found.";
        return;
    }

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

// ------------------------------
// Export CSV
// ------------------------------
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

// ------------------------------
// Event listeners
// ------------------------------
walletFilter.addEventListener("change", applyFilters);
typeFilter.addEventListener("change", applyFilters);
dateFilter.addEventListener("change", applyFilters);
resetBtn.addEventListener("click", ()=>{
    walletFilter.value="All"; typeFilter.value="All"; dateFilter.value="";
    applyFilters();
});
exportBtn.addEventListener("click", exportCSV);

// ------------------------------
// Initialize dashboard
// ------------------------------
(async function init(){
    document.getElementById("dashboardTitle").textContent = SHOP_NAME
        ? `Daily Transaction Dashboard - ${SHOP_NAME}`
        : "Daily Transaction Dashboard - All Shops";

    loadingSpinner.style.display = "block";
    await loadBackupIndex();  // Load Backup_Index first
    await loadMainData();     // Default: main GSheet
    populateFilters();
    applyFilters();
    loadingSpinner.style.display = "none";
})();
