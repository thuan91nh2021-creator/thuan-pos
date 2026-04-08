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
let currentUser = null;
let allData = [];
let chart = null;

const BANK_CONFIG = { BANK_ID: "Vietcombank", ACCOUNT_NO: "1052274107", ACCOUNT_NAME: "NGUYEN THI NGOC THUAN" };

let menu = JSON.parse(localStorage.getItem('restaurantMenu')) || [
    { id: 1, name: "Phở Đặc Biệt", price: 65000 },
    { id: 2, name: "Cafe Muối", price: 35000 },
    { id: 3, name: "Bánh Mì", price: 30000 },
    { id: 4, name: "Trà Sữa Trân Châu", price: 40000 },
    { id: 5, name: "Gỏi Cuốn", price: 25000 },
    { id: 6, name: "Cháo Sườn", price: 45000 },
    { id: 7, name: "Bún Chả", price: 55000 },
    { id: 8, name: "Sinh Tố Bơ", price: 30000 },
    { id: 9, name: "Cơm Tấm", price: 60000 },
    { id: 10, name: "Nước Mía", price: 20000 },
    { id: 11, name: "Bánh Xèo", price: 50000 },
    { id: 12, name: "Mì Quảng", price: 55000 },
    { id: 13, name: "Sữa Chua Trân Châu", price: 35000 },
    { id: 14, name: "Bánh Canh", price: 45000 },
    { id: 15, name: "Chè Ba Màu", price: 30000 }
];
let tables = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
let tableStartTime = {};
let selectedTable = null;

// GẮN CÁC HÀM VÀO WINDOW ĐỂ HTML GỌI ĐƯỢC
window.chuyenCheDo = (laLogin) => {
    document.getElementById('tieuDeXacThuc').innerText = laLogin ? "Chào mừng Thuận!" : "Đăng ký tài khoản";
    document.getElementById('cumNutDangNhap').style.display = laLogin ? "block" : "none";
    document.getElementById('cumNutDangKy').style.display = laLogin ? "none" : "block";
};

window.xuLyXacThuc = async (loai) => {
    const email = document.getElementById('emailUser').value;
    const pass = document.getElementById('passUser').value;
    try {
        if (loai === 'dang-ky') await createUserWithEmailAndPassword(auth, email, pass);
        else await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert("Lỗi: " + e.message); }
};

window.dangXuat = () => { if(confirm("Bạn muốn thoát?")) signOut(auth); };

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('manHinhXacThuc').style.display = 'none';
        renderMenu(); renderTables();
        const q = query(collection(db, "transactions"), where("userId", "==", user.uid), orderBy("timestamp", "desc"));
        onSnapshot(q, (snapshot) => {
            allData = snapshot.docs.map(doc => ({ cloudId: doc.id, ...doc.data() }));
            window.loadDataByDate();
        });
    } else {
        currentUser = null;
        document.getElementById('manHinhXacThuc').style.display = 'flex';
    }
});

async function luuCloud(reason, money, type) {
    if (!currentUser) return;
    await addDoc(collection(db, "transactions"), {
        userId: currentUser.uid,
        date: document.getElementById('workDate').value,
        reason, money, type, timestamp: Date.now()
    });
}

window.addManualTransaction = (type) => {
    let reason = prompt("Nội dung:");
    let money = parseInt(prompt("Số tiền:"));
    if (reason && !isNaN(money)) luuCloud(reason, money, type);
};

window.addToCart = (id) => {
    if (!selectedTable) return alert("Chọn bàn!");
    if (!tableStartTime[selectedTable]) tableStartTime[selectedTable] = new Date().toLocaleTimeString();
    const item = menu.find(m => m.id === id);
    tables[selectedTable].push({...item, cartId: Date.now()});
    renderCart(); renderTables();
};

window.selectTable = (id) => {
    selectedTable = id;
    document.getElementById('selectedTableTitle').innerText = "Bàn " + id;
    document.getElementById('btnPayCash').disabled = false;
    document.getElementById('btnPayQR').disabled = false;
    renderCart(); renderTables();
};

window.checkout = async (method) => {
    let total = tables[selectedTable].reduce((s, i) => s + i.price, 0);
    let details = tables[selectedTable].map(i => i.name).join(", ");
    await luuCloud(`Bàn ${selectedTable} (${method}): ${details}`, total, 'income');
    tables[selectedTable] = []; tableStartTime[selectedTable] = null;
    document.getElementById('qrArea').style.display = "none";
    renderTables(); renderCart();
};

window.showQR = () => {
    let total = tables[selectedTable].reduce((s, i) => s + i.price, 0);
    document.getElementById('vietQrImg').src = `https://img.vietqr.io/image/${BANK_CONFIG.BANK_ID}-${BANK_CONFIG.ACCOUNT_NO}-compact.png?amount=${total}&addInfo=Ban%20${selectedTable}`;
    document.getElementById('qrArea').style.display = "block";
};

window.confirmQR = () => window.checkout("VietQR");

window.loadDataByDate = () => {
    let date = document.getElementById('workDate').value;
    let filtered = allData.filter(d => d.date === date);
    let inc = 0, exp = 0;
    document.getElementById('historyList').innerHTML = filtered.map(d => {
        if (d.type === 'income') inc += d.money; else exp += d.money;
        return `<li>${d.reason} <b>${d.money.toLocaleString()}đ <button onclick="window.deleteHistory('${d.cloudId}')">🗑️</button></b></li>`;
    }).join('');
    document.getElementById('totalIncomeText').innerText = inc.toLocaleString() + "đ";
    document.getElementById('totalExpenseText').innerText = exp.toLocaleString() + "đ";
    document.getElementById('totalProfitText').innerText = (inc - exp).toLocaleString() + "đ";
    updateCharts(inc, exp);
};

window.deleteHistory = async (id) => { if(confirm("Xóa?")) await deleteDoc(doc(db, "transactions", id)); };

function renderMenu() {
    document.getElementById('menuGrid').innerHTML = menu.map(m => `<div class="menu-item" onclick="window.addToCart(${m.id})">${m.name}<br>${m.price.toLocaleString()}đ</div>`).join('');
}

function renderTables() {
    document.getElementById('tableGrid').innerHTML = Object.keys(tables).map(id => `<div class="table-card ${selectedTable==id?'active':''} ${tables[id].length>0?'occupied':''}" onclick="window.selectTable(${id})">Bàn ${id}</div>`).join('');
}

function renderCart() {
    let total = tables[selectedTable]?.reduce((s, i) => s + i.price, 0) || 0;
    document.getElementById('cartItems').innerHTML = tables[selectedTable]?.map(i => `<li>${i.name} <span>${i.price.toLocaleString()}đ</span></li>`).join('') || "";
    document.getElementById('cartTotal').innerText = total.toLocaleString();
}

function updateCharts(inc, exp) {
    let ctx = document.getElementById("chart").getContext("2d");
    if (chart) chart.destroy();
    chart = new Chart(ctx, { type: 'doughnut', data: { labels: ['Thu', 'Chi'], datasets: [{ data: [inc || 1, exp || 0], backgroundColor: ['#27ae60', '#e74c3c'] }] } });
}

document.getElementById('workDate').valueAsDate = new Date();