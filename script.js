// --- 1. KẾT NỐI GOOGLE FIREBASE CLOUD ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = { 
  apiKey: "AIzaSyCHBL7bVqQ__OSejzV_71343uqikoMW_Z4", 
  authDomain: "thuan-pos-system.firebaseapp.com", 
  projectId: "thuan-pos-system", 
  storageBucket: "thuan-pos-system.firebasestorage.app", 
  messagingSenderId: "325650195955", 
  appId: "1:325650195955:web:14d2c60ced242b575b5e86" 
};

// Khởi tạo Firebase và Database
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const transactionsCol = collection(db, "transactions");

// --- 2. CẤU HÌNH NGÂN HÀNG ---
const BANK_CONFIG = { 
    BANK_ID: "Vietcombank", 
    ACCOUNT_NO: "1052274107", 
    ACCOUNT_NAME: "NGUYEN THI NGOC THUAN" 
};

// --- 3. KHỞI TẠO BIẾN ---
let menu = JSON.parse(localStorage.getItem('restaurantMenu')) || [
    { id: 1, name: "Phở Đặc Biệt", price: 65000 },
    { id: 2, name: "Cơm Tấm Sườn", price: 45000 },
    { id: 3, name: "Cafe Muối", price: 35000 },
    { id: 4, name: "Trà Sữa Trân Châu", price: 40000 },
    { id: 5, name: "Bánh Mì Thịt Nướng", price: 30000 },
    { id: 6, name: "Gỏi Cuốn Tôm Thịt", price: 25000 },
    { id: 7, name: "Bún Chả Hà Nội", price: 55000 },
    { id: 8, name: "Mì Quảng", price: 50000 },
    { id: 9, name: "Sinh Tố Bơ", price: 30000 },
    { id: 10, name: "Chè Ba Màu", price: 20000 },  
    { id: 11, name: "Nước Mía", price: 15000 },
    { id: 12, name: "Bánh Xèo", price: 40000 },
    { id: 13, name: "Hủ Tiếu Nam Vang", price: 45000 },
    { id: 14, name: "Cà Phê Sữa Đá", price: 30000 },
    { id: 15, name: "Bánh Canh Cua", price: 55000 },
    { id: 16, name: "Trà Đào Cam Sả", price: 35000 },
    { id: 17, name: "Bún Bò Huế", price: 60000 },
    { id: 18, name: "Sữa Chua Nếp Cẩm", price: 25000 },
    { id: 19, name: "Cơm Gà Hải Nam", price: 50000 },
    { id: 20, name: "Mì Xào Giòn", price: 45000 },
    { id: 21, name: "Bánh Tráng Trộn", price: 20000 },
    { id: 22, name: "Cháo Sườn", price: 30000 },
    { id: 23, name: "Nước Ép Cần Tây", price: 25000 },
    { id: 24, name: "Bún Thịt Nướng", price: 45000 },
    { id: 25, name: "Trà Sữa Trân Châu Đường Đen", price: 40000 }
];

let tables = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
let tableStartTime = {};
let selectedTable = null;
let allData = []; // Dữ liệu sẽ đồng bộ từ Cloud về đây
let chart, trendChart;

document.getElementById('workDate').valueAsDate = new Date();

// --- 4. ĐỒNG BỘ DỮ LIỆU TỪ CLOUD (REAL-TIME) ---
// Mỗi khi Cloud có thay đổi, hàm này tự chạy để cập nhật báo cáo
onSnapshot(query(transactionsCol, orderBy("timestamp", "desc")), (snapshot) => {
    allData = snapshot.docs.map(doc => ({ cloudId: doc.id, ...doc.data() }));
    loadDataByDate();
});

// --- 5. QUẢN LÝ GIAO DỊCH (THU/CHI) ---
async function saveTransaction(reason, money, type) {
    let date = document.getElementById('workDate').value;
    const docData = {
        date: date,
        reason: reason,
        money: money,
        type: type,
        timestamp: Date.now()
    };
    
    try {
        await addDoc(transactionsCol, docData);
        console.log("Đã đồng bộ lên mây thành công!");
    } catch (e) {
        alert("Lỗi lưu Cloud: " + e.message);
    }
}

async function deleteHistory(cloudId) {
    if(confirm("Xóa giao dịch này vĩnh viễn trên Cloud?")) {
        try {
            await deleteDoc(doc(db, "transactions", cloudId));
        } catch (e) {
            alert("Lỗi xóa: " + e.message);
        }
    }
}

// Hàm nhập thu chi ngoài danh mục
window.addManualTransaction = function(type) {
    let reason = prompt(type === 'income' ? "Nội dung thu khác:" : "Nội dung chi (Vd: Nhập hàng):");
    let money = parseInt(prompt("Số tiền (VNĐ):"));
    if (reason && !isNaN(money)) {
        let now = new Date();
        let time = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        saveTransaction(`[${time}][Ngoài] ${reason}`, money, type);
    }
};

// --- 6. QUẢN LÝ BÁN HÀNG TẠI BÀN ---
window.updateMenu = function() {
    let name = document.getElementById('newMenuName').value;
    let price = parseInt(document.getElementById('newMenuPrice').value);
    if (!name || !price) return alert("Nhập đủ tên và giá!");
    menu.push({ id: Date.now(), name, price });
    localStorage.setItem('restaurantMenu', JSON.stringify(menu));
    renderMenu();
};

function renderMenu() {
    document.getElementById('menuGrid').innerHTML = menu.map(item => `
        <div class="menu-item" onclick="addToCart(${item.id})">${item.name}<br><b>${item.price.toLocaleString()}đ</b></div>
    `).join('');
}

window.addToCart = function(prodId) {
    if (!selectedTable) return alert("Hãy chọn bàn!");
    if (tables[selectedTable].length === 0) {
        tableStartTime[selectedTable] = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
    const item = menu.find(p => p.id === prodId);
    tables[selectedTable].push({...item, cartId: Date.now()});
    renderCart(); renderTables(); selectTable(selectedTable);
};

window.removeFromCart = function(cartId) {
    tables[selectedTable] = tables[selectedTable].filter(i => i.cartId !== cartId);
    if (tables[selectedTable].length === 0) tableStartTime[selectedTable] = null;
    renderCart(); renderTables(); selectTable(selectedTable);
};

function renderCart() {
    if (selectedTable === null) return;
    let total = 0;
    document.getElementById('cartItems').innerHTML = tables[selectedTable].map(i => {
        total += i.price;
        return `<li><span>${i.name}</span> <span>${i.price.toLocaleString()}đ <button onclick="removeFromCart(${i.cartId})" style="color:red; border:none; background:none; cursor:pointer;">✖</button></span></li>`;
    }).join('');
    document.getElementById('cartTotal').innerText = total.toLocaleString();
}

// --- 7. THANH TOÁN ---
window.showQR = function() {
    if (!selectedTable || tables[selectedTable].length === 0) return;
    let total = tables[selectedTable].reduce((s, i) => s + i.price, 0);
    let desc = `Ban%20${selectedTable}%20thanh%20toan`.replace(/\s/g, '%20');
    let qrUrl = `https://img.vietqr.io/image/${BANK_CONFIG.BANK_ID}-${BANK_CONFIG.ACCOUNT_NO}-compact.png?amount=${total}&addInfo=${desc}&accountName=${BANK_CONFIG.ACCOUNT_NAME}`;
    document.getElementById('vietQrImg').src = qrUrl;
    document.getElementById('qrArea').style.display = "block";
};

window.confirmQR = function() { checkout("VietQR"); };
window.checkout = function(method) {
    let total = tables[selectedTable].reduce((s, i) => s + i.price, 0);
    let details = tables[selectedTable].map(i => i.name).join(", ");
    let end = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    saveTransaction(`[${tableStartTime[selectedTable]}-${end}] Bàn ${selectedTable} (${method}): ${details}`, total, 'income');
    
    tables[selectedTable] = []; tableStartTime[selectedTable] = null; selectedTable = null;
    document.getElementById('qrArea').style.display = "none";
    document.getElementById('btnPayCash').disabled = true;
    document.getElementById('btnPayQR').disabled = true;
    renderTables(); renderCart();
};

// --- 8. BÁO CÁO & BIỂU ĐỒ ---
window.loadDataByDate = function() {
    let date = document.getElementById('workDate').value;
    let dayData = allData.filter(i => i.date === date);
    let inc = 0, exp = 0;
    
    let html = dayData.map(i => {
        if (i.type === 'income') inc += i.money; else exp += i.money;
        return `<li>
            <span style="font-size:12px; width:70%">${i.reason}</span> 
            <b>${i.type=='income'?'+':'-'}${i.money.toLocaleString()}đ 
            <button onclick="deleteHistory('${i.cloudId}')" style="border:none; background:none; cursor:pointer;">🗑️</button></b>
        </li>`;
    }).join(''); // Không cần reverse vì Firestore query đã orderBy desc
    
    document.getElementById('totalIncomeText').innerText = inc.toLocaleString() + "đ";
    document.getElementById('totalExpenseText').innerText = exp.toLocaleString() + "đ";
    document.getElementById('totalProfitText').innerText = (inc - exp).toLocaleString() + "đ";
    document.getElementById('historyList').innerHTML = html || "<li>Trống.</li>";
    updateCharts(inc, exp);
};

function updateCharts(inc, exp) {
    let ctx1 = document.getElementById("chart");
    if (chart) chart.destroy();
    chart = new Chart(ctx1, {
        type: 'doughnut',
        data: { labels: ['Thu', 'Chi'], datasets: [{ data: [inc || 0.1, exp || 0.1], backgroundColor: ['#27ae60', '#e74c3c'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

window.selectTable = function(id) {
    selectedTable = id;
    document.getElementById('selectedTableTitle').innerText = "Bàn " + id + (tableStartTime[id] ? " ("+tableStartTime[id]+")" : "");
    document.getElementById('btnPayCash').disabled = false;
    document.getElementById('btnPayQR').disabled = false;
    renderTables(); renderCart();
};

function renderTables() {
    document.getElementById('tableGrid').innerHTML = Object.keys(tables).map(id => `
        <div class="table-card ${selectedTable == id ? 'active' : ''} ${tables[id].length > 0 ? 'occupied' : ''}" 
             onclick="selectTable(${id})">Bàn ${id} ${tableStartTime[id] ? '<br><small>'+tableStartTime[id]+'</small>' : ''}</div>
    `).join('');
}

window.exportToExcel = function() {
    let date = document.getElementById('workDate').value;
    let dayData = allData.filter(i => i.date === date);
    let csv = "\uFEFFNgày,Nội dung,Tiền,Loại\n" + dayData.map(i => `${i.date},${i.reason.replace(/,/g, '-')},${i.money},${i.type}`).join("\n");
    let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Bao_cao_${date}.csv`;
    link.click();
};

// Khởi chạy
renderMenu(); renderTables();