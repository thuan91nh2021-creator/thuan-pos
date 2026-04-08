const BANK_CONFIG = {
    BANK_ID: "vietcombank",           
    ACCOUNT_NO: "1052274107", 
    ACCOUNT_NAME: "NGUYEN THI NGOC THUAN"
};

let menu = JSON.parse(localStorage.getItem('restaurantMenu')) || [
    { id: 1, name: "Phở Đặc Biệt", price: 65000 },
    { id: 2, name: "Cafe Muối", price: 35000},
    { id: 3, name: "Bánh Mì Thịt Nướng", price: 40000 },
    { id: 4, name: "Trà Sữa Trân Châu", price: 45000 },
    { id: 5, name: "Gỏi Cuốn", price: 30000 },
    { id: 6, name: "Cháo Sườn", price: 50000 },
    { id: 7, name: "Bún Chả", price: 55000 },
    { id: 8, name: "Sinh Tố Bơ", price: 40000 },
    { id: 9, name: "Cơm Tấm Sườn Bì Chả", price: 60000 },
    { id: 10, name: "Bánh Xèo", price: 45000 },
    { id: 11, name: "Mì Quảng", price: 55000 },
    { id: 12, name: "Sữa Chua Trân Châu", price: 35000 },
    { id: 13, name: "Bánh Canh Cua", price: 60000 },
    { id: 14, name: "Chè Ba Màu", price: 30000 },
    { id: 15, name: "Bún Bò Huế", price: 65000 },
    { id: 16, name: "Nước Mía", price: 25000 },
    { id: 17, name: "Bánh Tráng Trộn", price: 30000 },
    { id: 18, name: "Cà Phê Sữa Đá", price: 30000 },
    { id: 19, name: "Bún Riêu", price: 55000 },
    { id: 20, name: "Trà Đào Cam Sả", price: 40000 }

];

let tables = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
let tableStartTime = {};
let selectedTable = null;
let chart, trendChart;
let allData = JSON.parse(localStorage.getItem('restaurantProData')) || [];

document.getElementById('workDate').valueAsDate = new Date();

// --- THU CHI NGOÀI ---
function addManualTransaction(type) {
    let reason = prompt(type === 'income' ? "Nội dung thu khác:" : "Nội dung chi ngoài (Vd: Nhập hàng):");
    let money = parseInt(prompt("Số tiền (VNĐ):"));
    if (reason && !isNaN(money)) {
        let now = new Date();
        let time = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        saveTransaction(`[${time}][Ngoài] ${reason}`, money, type);
    }
}

// --- QUẢN LÝ MENU ---
function updateMenu() {
    let name = document.getElementById('newMenuName').value;
    let price = parseInt(document.getElementById('newMenuPrice').value);
    if (!name || !price) return alert("Nhập đủ tên và giá!");
    menu.push({ id: Date.now(), name, price });
    localStorage.setItem('restaurantMenu', JSON.stringify(menu));
    document.getElementById('newMenuName').value = "";
    document.getElementById('newMenuPrice').value = "";
    renderMenu();
}

function renderMenu() {
    document.getElementById('menuGrid').innerHTML = menu.map(item => `
        <div class="menu-item" onclick="addToCart(${item.id})">${item.name}<br><b>${item.price.toLocaleString()}đ</b></div>
    `).join('');
}

// --- GIỎ HÀNG & XÓA MÓN ---
function addToCart(prodId) {
    if (!selectedTable) return alert("Hãy chọn bàn!");
    if (tables[selectedTable].length === 0) {
        let now = new Date();
        tableStartTime[selectedTable] = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    }
    const item = menu.find(p => p.id === prodId);
    tables[selectedTable].push({...item, cartId: Date.now()});
    renderCart(); renderTables(); selectTable(selectedTable);
}

function removeFromCart(cartId) {
    tables[selectedTable] = tables[selectedTable].filter(i => i.cartId !== cartId);
    if (tables[selectedTable].length === 0) tableStartTime[selectedTable] = null;
    renderCart(); renderTables(); selectTable(selectedTable);
}

function renderCart() {
    if (!selectedTable) return;
    let total = 0;
    document.getElementById('cartItems').innerHTML = tables[selectedTable].map(i => {
        total += i.price;
        return `<li><span>${i.name}</span> <span>${i.price.toLocaleString()}đ <button onclick="removeFromCart(${i.cartId})" style="color:red; border:none; background:none; cursor:pointer;">✖</button></span></li>`;
    }).join('');
    document.getElementById('cartTotal').innerText = total.toLocaleString();
}

// --- THANH TOÁN ---
function showQR() {
    if (!selectedTable || tables[selectedTable].length === 0) return;
    let total = tables[selectedTable].reduce((s, i) => s + i.price, 0);
    let desc = `Ban%20${selectedTable}%20thanh%20toan`.replace(/\s/g, '%20');
    let qrUrl = `https://img.vietqr.io/image/${BANK_CONFIG.BANK_ID}-${BANK_CONFIG.ACCOUNT_NO}-compact.png?amount=${total}&addInfo=${desc}&accountName=${BANK_CONFIG.ACCOUNT_NAME}`;
    document.getElementById('vietQrImg').src = qrUrl;
    document.getElementById('qrArea').style.display = "block";
}

function confirmQR() { checkout("VietQR"); }

function checkout(method) {
    let total = tables[selectedTable].reduce((s, i) => s + i.price, 0);
    let details = tables[selectedTable].map(i => i.name).join(", ");
    let end = new Date().getHours().toString().padStart(2, '0') + ":" + new Date().getMinutes().toString().padStart(2, '0');
    saveTransaction(`[${tableStartTime[selectedTable]}-${end}] Bàn ${selectedTable} (${method}): ${details}`, total, 'income');
    tables[selectedTable] = []; tableStartTime[selectedTable] = null; selectedTable = null;
    document.getElementById('qrArea').style.display = "none";
    document.getElementById('btnPayCash').disabled = true;
    document.getElementById('btnPayQR').disabled = true;
    renderTables(); renderCart();
}

function saveTransaction(reason, money, type) {
    let date = document.getElementById('workDate').value;
    allData.push({ id: Date.now(), date, reason, money, type });
    localStorage.setItem('restaurantProData', JSON.stringify(allData));
    loadDataByDate();
}

function deleteHistory(id) {
    if(confirm("Xóa giao dịch này?")) {
        allData = allData.filter(i => i.id !== id);
        localStorage.setItem('restaurantProData', JSON.stringify(allData));
        loadDataByDate();
    }
}

// --- BÁO CÁO & BIỂU ĐỒ ---
function loadDataByDate() {
    let date = document.getElementById('workDate').value;
    let dayData = allData.filter(i => i.date === date);
    let inc = 0, exp = 0;
    let html = dayData.map(i => {
        if (i.type === 'income') inc += i.money; else exp += i.money;
        return `<li><span style="font-size:12px; width:70%">${i.reason}</span> <b>${i.type=='income'?'+':'-'}${i.money.toLocaleString()}đ <button onclick="deleteHistory(${i.id})" style="border:none; background:none; cursor:pointer;">🗑️</button></b></li>`;
    }).reverse().join('');
    
    document.getElementById('totalIncomeText').innerText = inc.toLocaleString() + "đ";
    document.getElementById('totalExpenseText').innerText = exp.toLocaleString() + "đ";
    document.getElementById('totalProfitText').innerText = (inc - exp).toLocaleString() + "đ";
    document.getElementById('historyList').innerHTML = html || "<li>Trống.</li>";
    updateCharts(inc, exp);
}

function updateCharts(inc, exp) {
    let ctx1 = document.getElementById("chart");
    if (chart) chart.destroy();
    chart = new Chart(ctx1, {
        type: 'doughnut',
        data: { labels: ['Thu', 'Chi'], datasets: [{ data: [inc || 0.1, exp || 0.1], backgroundColor: ['#27ae60', '#e74c3c'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const labels = []; const data = [];
    for (let i = 6; i >= 0; i--) {
        let d = new Date(); d.setDate(d.getDate() - i);
        let dStr = d.toISOString().split('T')[0];
        labels.push(d.getDate() + "/" + (d.getMonth() + 1));
        data.push(allData.filter(x => x.date === dStr && x.type === 'income').reduce((s, x) => s + x.money, 0));
    }
    let ctx2 = document.getElementById("trendChart");
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctx2, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Doanh thu', data: data, borderColor: '#3498db', fill: true, backgroundColor: 'rgba(52, 152, 219, 0.1)', tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function selectTable(id) {
    selectedTable = id;
    document.getElementById('selectedTableTitle').innerText = "Bàn " + id + (tableStartTime[id] ? " ("+tableStartTime[id]+")" : "");
    document.getElementById('btnPayCash').disabled = false;
    document.getElementById('btnPayQR').disabled = false;
    renderTables(); renderCart();
}

function renderTables() {
    document.getElementById('tableGrid').innerHTML = Object.keys(tables).map(id => `
        <div class="table-card ${selectedTable == id ? 'active' : ''} ${tables[id].length > 0 ? 'occupied' : ''}" 
             onclick="selectTable(${id})">Bàn ${id} ${tableStartTime[id] ? '<br><small>'+tableStartTime[id]+'</small>' : ''}</div>
    `).join('');
}

function exportToExcel() {
    let date = document.getElementById('workDate').value;
    let dayData = allData.filter(i => i.date === date);
    let csv = "\uFEFFNgày,Nội dung,Tiền,Loại\n" + dayData.map(i => `${i.date},${i.reason.replace(/,/g, '-')},${i.money},${i.type}`).join("\n");
    let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Bao_cao_${date}.csv`;
    link.click();
}

renderMenu(); renderTables(); loadDataByDate();