import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = { 
  apiKey: "AIzaSyCHBL7bVqQ__OSejzV_71343uqikoMW_Z4", 
  authDomain: "thuan-pos-system.firebaseapp.com", 
  projectId: "thuan-pos-system", 
  storageBucket: "thuan-pos-system.firebasestorage.app", 
  messagingSenderId: "325650195955", 
  appId: "1:325650195955:web:14d2c60ced242b575b5e86" 
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let nguoiDungHienTai = null;
let allData = []; 
let chart, trendChart;

const BANK_CONFIG = { BANK_ID: "Vietcombank", ACCOUNT_NO: "1052274107", ACCOUNT_NAME: "NGUYEN THI NGOC THUAN" };

let menu = JSON.parse(localStorage.getItem('restaurantMenu')) || [
    { id: 1, name: "Phở Đặc Biệt", price: 65000 },
    { id: 2, name: "Cơm Tấm Sườn", price: 45000 },
    { id: 3, name: "Cafe Muối", price: 35000 },
    { id: 4, name: "Trà Sữa Trân Châu", price: 40000 },
    { id: 5, name: "Bánh Mì Thịt Nướng", price: 30000 },
    { id: 6, name: "Cháo Gà", price: 40000 },
    { id: 7, name: "Sinh Tố Bơ", price: 45000 },
    { id: 8, name: "Mì Quảng", price: 55000 },
    { id: 9, name: "Bún Bò Huế", price: 60000 },
    { id: 10, name: "Nước Mía", price: 20000 },
    { id: 11, name: "Bánh Xèo", price: 50000 },
    { id: 12, name: "Gỏi Cuốn", price: 30000 },
    { id: 13, name: "Bánh Canh Cua", price: 55000 },
    { id: 14, name: "Chè Ba Màu", price: 25000 },
    { id: 15, name: "Bún Thịt Nướng", price: 45000 },
];

let tables = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
let tableStartTime = {}; // Lưu giờ mở bàn
let selectedTable = null;

document.getElementById('workDate').valueAsDate = new Date();

// --- 1. XÁC THỰC ---
window.chuyenCheDo = (laDangNhap) => {
    document.getElementById('tieuDeXacThuc').innerText = laDangNhap ? "Đăng nhập" : "Đăng ký tài khoản";
    document.getElementById('cumNutDangNhap').style.display = laDangNhap ? "block" : "none";
    document.getElementById('cumNutDangKy').style.display = laDangNhap ? "none" : "block";
};

window.xuLyXacThuc = async (loai) => {
    const email = document.getElementById('emailUser').value;
    const pass = document.getElementById('passUser').value;
    try {
        if (loai === 'dang-ky') await createUserWithEmailAndPassword(auth, email, pass);
        else await signInWithEmailAndPassword(auth, email, pass);
    } catch (l) { alert("Lỗi: " + l.message); }
};

window.dangXuat = () => { if(confirm("Bạn muốn đăng xuất?")) signOut(auth); };

onAuthStateChanged(auth, (user) => {
    if (user) {
        nguoiDungHienTai = user;
        document.getElementById('manHinhXacThuc').style.display = 'none';
        renderMenu(); renderTables();
        const q = query(collection(db, "transactions"), where("userId", "==", user.uid), orderBy("timestamp", "desc"));
        onSnapshot(q, (snapshot) => {
            allData = snapshot.docs.map(doc => ({ cloudId: doc.id, ...doc.data() }));
            window.loadDataByDate(); // Cập nhật báo cáo & tài chính tức thì
            updateTrendChart();
        });
    } else {
        nguoiDungHienTai = null;
        document.getElementById('manHinhXacThuc').style.display = 'flex';
    }
});

// --- 2. LƯU CLOUD (Dùng chung cho cả Bán hàng & Thu/Chi ngoài) ---
async function luuGiaoDichCloud(noiDung, soTien, loai) {
    if (!nguoiDungHienTai) return;
    await addDoc(collection(db, "transactions"), {
        userId: nguoiDungHienTai.uid,
        date: document.getElementById('workDate').value,
        reason: noiDung,
        money: soTien,
        type: loai,
        timestamp: Date.now()
    });
}

window.deleteHistory = async (cloudId) => {
    if(confirm("Xóa giao dịch này?")) await deleteDoc(doc(db, "transactions", cloudId));
};

// --- 3. THU / CHI NGOÀI (Cập nhật ngay vào doanh thu/chi phí) ---
window.addManualTransaction = function(type) {
    let reason = prompt(type === 'income' ? "Nội dung thu ngoài:" : "Nội dung chi ngoài:");
    let money = parseInt(prompt("Số tiền (VNĐ):"));
    if (reason && !isNaN(money)) {
        let thoiGian = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        // Tự động gắn nhãn [Ngoài] để dễ quản lý
        luuGiaoDichCloud(`[${thoiGian}][Ngoài] ${reason}`, money, type);
    }
};

// --- 4. QUẢN LÝ BÀN & GIỎ HÀNG ---
window.addToCart = function(prodId) {
    if (!selectedTable) return alert("Hãy chọn bàn!");
    if (tables[selectedTable].length === 0) {
        // Ghi lại giờ bắt đầu đặt hàng
        tableStartTime[selectedTable] = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
    const item = menu.find(p => p.id === prodId);
    tables[selectedTable].push({...item, cartId: Date.now()});
    renderCart(); renderTables(); window.selectTable(selectedTable);
};

window.removeFromCart = function(cartId) {
    tables[selectedTable] = tables[selectedTable].filter(i => i.cartId !== cartId);
    if (tables[selectedTable].length === 0) tableStartTime[selectedTable] = null;
    renderCart(); renderTables(); window.selectTable(selectedTable);
};

// --- 5. THANH TOÁN (Lưu thời gian Đặt hàng -> Thanh toán) ---
window.checkout = function(method) {
    if(!selectedTable || tables[selectedTable].length === 0) return;
    
    let total = tables[selectedTable].reduce((s, i) => s + i.price, 0);
    let details = tables[selectedTable].map(i => i.name).join(", ");
    
    // Lấy giờ hiện tại làm giờ thanh toán
    let gioThanhToan = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    let gioDatHang = tableStartTime[selectedTable];
    
    // Ghi nội dung nhật ký chi tiết: [Giờ đặt - Giờ trả]
    let noiDungLuu = `[${gioDatHang} - ${gioThanhToan}] Bàn ${selectedTable} (${method}): ${details}`;
    
    luuGiaoDichCloud(noiDungLuu, total, 'income');
    
    // Xóa bàn
    tables[selectedTable] = []; tableStartTime[selectedTable] = null; selectedTable = null;
    document.getElementById('qrArea').style.display = "none";
    document.getElementById('selectedTableTitle').innerText = "Chọn bàn...";
    renderTables(); renderCart();
};

// --- 6. HIỂN THỊ & BÁO CÁO (Tự động cập nhật 3 chỉ số tài chính) ---
window.loadDataByDate = function() {
    let date = document.getElementById('workDate').value;
    let filtered = allData.filter(i => i.date === date);
    let totalInc = 0, totalExp = 0;
    
    let html = filtered.map(i => {
        if (i.type === 'income') totalInc += i.money; 
        else totalExp += i.money;
        
        return `<li>
            <span>${i.reason}</span>
            <b>${i.type=='income'?'+':'-'}${i.money.toLocaleString()}đ 
            <button onclick="deleteHistory('${i.cloudId}')" style="border:none;background:none;cursor:pointer;">🗑️</button></b>
        </li>`;
    }).join('');
    
    // Cập nhật 3 ô thống kê trên cùng
    document.getElementById('totalIncomeText').innerText = totalInc.toLocaleString() + "đ";
    document.getElementById('totalExpenseText').innerText = totalExp.toLocaleString() + "đ";
    document.getElementById('totalProfitText').innerText = (totalInc - totalExp).toLocaleString() + "đ";
    
    document.getElementById('historyList').innerHTML = html || "<li>Trống.</li>";
    updateCharts(totalInc, totalExp);
};

// --- 7. CÁC HÀM HỖ TRỢ GIAO DIỆN ---
function renderMenu() {
    document.getElementById('menuGrid').innerHTML = menu.map(item => `
        <div class="menu-item" onclick="addToCart(${item.id})">${item.name}<br><b>${item.price.toLocaleString()}đ</b></div>
    `).join('');
}

function renderTables() {
    document.getElementById('tableGrid').innerHTML = Object.keys(tables).map(id => `
        <div class="table-card ${selectedTable == id ? 'active' : ''} ${tables[id].length > 0 ? 'occupied' : ''}" 
             onclick="selectTable(${id})">Bàn ${id} ${tableStartTime[id] ? '<br><small>'+tableStartTime[id]+'</small>' : ''}</div>
    `).join('');
}

function renderCart() {
    if (selectedTable === null) return;
    let total = tables[selectedTable].reduce((s, i) => s + i.price, 0);
    document.getElementById('cartItems').innerHTML = tables[selectedTable].map(i => `
        <li><span>${i.name}</span> <span>${i.price.toLocaleString()}đ <button onclick="removeFromCart(${i.cartId})" style="color:red;border:none;background:none;cursor:pointer;">✖</button></span></li>
    `).join('');
    document.getElementById('cartTotal').innerText = total.toLocaleString();
}

window.selectTable = function(id) {
    selectedTable = id;
    document.getElementById('selectedTableTitle').innerText = "Bàn " + id + (tableStartTime[id] ? " (Bắt đầu: "+tableStartTime[id]+")" : "");
    document.getElementById('btnPayCash').disabled = false;
    document.getElementById('btnPayQR').disabled = false;
    renderTables(); renderCart();
};

window.showQR = function() {
    let total = tables[selectedTable].reduce((s, i) => s + i.price, 0);
    let desc = `Ban ${selectedTable} thanh toan`.replace(/\s/g, '%20');
    document.getElementById('vietQrImg').src = `https://img.vietqr.io/image/${BANK_CONFIG.BANK_ID}-${BANK_CONFIG.ACCOUNT_NO}-compact.png?amount=${total}&addInfo=${desc}&accountName=${BANK_CONFIG.ACCOUNT_NAME}`;
    document.getElementById('qrArea').style.display = "block";
};

window.confirmQR = () => window.checkout("VietQR");

function updateCharts(inc, exp) {
    const ctx = document.getElementById("chart").getContext("2d");
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Thu', 'Chi'], datasets: [{ data: [inc || 0.1, exp || 0], backgroundColor: ['#27ae60', '#e74c3c'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function updateTrendChart() {
    const ctxTrend = document.getElementById("trendChart")?.getContext("2d");
    if (!ctxTrend) return;
    let last7Days = [];
    for (let i = 6; i >= 0; i--) {
        let d = new Date(); d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().split('T')[0]);
    }
    let dailyRevenue = last7Days.map(day => allData.filter(item => item.date === day && item.type === 'income').reduce((sum, item) => sum + item.money, 0));
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: last7Days.map(d => d.split('-').reverse().slice(0,2).join('/')),
            datasets: [{ label: 'Doanh thu', data: dailyRevenue, borderColor: '#2980b9', tension: 0.3, fill: true, backgroundColor: 'rgba(41,128, 185, 0.1)' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

window.exportToExcel = function() {
    let date = document.getElementById('workDate').value;
    let csv = "\uFEFFNgày,Nội dung,Tiền,Loại\n" + allData.filter(i => i.date === date).map(i => `${i.date},${i.reason.replace(/,/g, '-')},${i.money},${i.type}`).join("\n");
    let link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Bao_cao_${date}.csv`;
    link.click();
};

window.updateMenu = function() {
    let name = document.getElementById('newMenuName').value;
    let price = parseInt(document.getElementById('newMenuPrice').value);
    if (!name || !price) return alert("Nhập đủ tên và giá!");
    menu.push({ id: Date.now(), name, price });
    localStorage.setItem('restaurantMenu', JSON.stringify(menu));
    renderMenu();
};