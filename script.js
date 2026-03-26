import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBjZke6LDz-TosBALMtT3bZLOj0uEhc3y0",
  authDomain: "r13-busattendance-b9ceb.firebaseapp.com",
  projectId: "r13-busattendance-b9ceb",
  storageBucket: "r13-busattendance-b9ceb.firebasestorage.app",
  messagingSenderId: "603027262034",
  appId: "1:603027262034:web:75c19f4498942fff2f2d8b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------- GLOBAL ----------------
let cachedAdmin = null;
let cachedStudentLoc = null;
let isSubmitting = false;
let busWatchId = null;

// ✅ DATE BASED
const today = new Date().toISOString().split("T")[0];

// 🔐 Unique admin session
let adminSessionId = localStorage.getItem("adminSessionId");
if (!adminSessionId) {
  adminSessionId = Date.now().toString();
  localStorage.setItem("adminSessionId", adminSessionId);
}

// ---------------- SAFE REDIRECT ----------------
function safeRedirect(page) {
  if (window.location.pathname.includes(page)) return;
  window.location.replace(page);
}

// ---------------- TOGGLE MENU ----------------
// FIX: was never defined — onclick="toggleMenu()" in HTML was failing silently
globalThis.toggleMenu = function () {
  let nav = document.getElementById("navLinks");
  if (nav) nav.classList.toggle("active");
};

// ---------------- START BUS TRACKING ----------------
function startBusTracking() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported on this device!");
    return;
  }

  busWatchId = navigator.geolocation.watchPosition(
    async (position) => {
      let lat = position.coords.latitude;
      let lon = position.coords.longitude;

      try {
        await setDoc(doc(db, "admin", "location"), {
          lat,
          lon,
          time: new Date().toISOString(),
          active: true,
          sessionId: adminSessionId
        });

        await setDoc(doc(db, "liveBus", "location"), {
          lat,
          lon,
          time: new Date().toISOString()
        });

        cachedAdmin = { lat, lon, active: true };

        let el = document.getElementById("busLocation");
        if (el) {
          el.innerText = `🚌 Live: ${lat.toFixed(5)}, ${lon.toFixed(5)} — ${new Date().toLocaleTimeString()}`;
        }
      } catch (err) {
        console.error("Firestore write error:", err.message);
      }
    },
    (error) => {
      console.error("Location error:", error.message);
      alert("Location error: " + error.message);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}

// ---------------- ON LOAD ----------------
document.addEventListener("DOMContentLoaded", async () => {
  const path = window.location.pathname;

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => (cachedStudentLoc = pos),
      () => {},
      { maximumAge: 10000 }
    );
  }

  try {
    let snap = await getDoc(doc(db, "admin", "location"));
    if (snap.exists()) cachedAdmin = snap.data();
  } catch {}

  // ---------------- DASHBOARD PAGE ----------------
  if (path.includes("dashboard.html")) {
    if (localStorage.getItem("isAdminLoggedIn") !== "true") {
      safeRedirect("admin.html");
      return;
    }
    startBusTracking();
  }

  // ---------------- ADMIN LOGIN PAGE ----------------
  if (path.includes("admin.html")) {
    if (localStorage.getItem("isAdminLoggedIn") === "true") {
      safeRedirect("dashboard.html");
    }
  }

  // restore saved student data
  let saved = localStorage.getItem("studentData");
  if (saved) {
    let data = JSON.parse(saved);
    if (document.getElementById("name")) {
      document.getElementById("name").value = data.name || "";
      document.getElementById("regno").value = data.regno || "";
      document.getElementById("dept").value = data.dept || "";
      document.getElementById("stop").value = data.stop || "";
    }
  }
});

// ---------------- ADMIN LOGIN ----------------
globalThis.adminLogin = async function () {
  let username = document.getElementById("adminUser").value;
  let password = document.getElementById("adminPass").value;

  if (!username || !password) {
    alert("Wrong Entry");
    return;
  }

  if (username !== "paarthhaaa" || password !== "010407") {
    alert("❌ Invalid login!");
    return;
  }

  let snap = await getDoc(doc(db, "admin", "location"));

  if (snap.exists()) {
    let data = snap.data();
    let lastSeen = new Date(data.time).getTime();
    let isRecent = (Date.now() - lastSeen) < 5 * 60 * 1000;

    if (data.active === true && data.sessionId !== adminSessionId && isRecent) {
      alert("⚠️ Another admin is already active!");
      return;
    }
  }

  localStorage.setItem("isAdminLoggedIn", "true");
  window.location.href = "dashboard.html";
};

// ---------------- STUDENT FORM ----------------
let form = document.getElementById("studentForm");

if (form) {
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (isSubmitting) return;
    isSubmitting = true;

    let btn = form.querySelector("button");
    btn.disabled = true;
    btn.innerText = "Marking...";

    let name = document.getElementById("name").value.trim();
    let regno = document.getElementById("regno").value.trim().toUpperCase();
    let dept = document.getElementById("dept").value.trim();
    let stop = document.getElementById("stop").value.trim();

    try {
      let position = cachedStudentLoc;

      if (!position) {
        position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
      }

      let snap = await getDoc(doc(db, "admin", "location"));
      if (!snap.exists() || snap.data().active === false) {
        throw new Error("❌ Admin not active! Bus tracking is off.");
      }

      let adminLoc = snap.data();

      let lastSeen = new Date(adminLoc.time).getTime();
      let isRecent = (Date.now() - lastSeen) < 5 * 60 * 1000;
      if (!isRecent) {
        throw new Error("❌ Bus location is outdated. Admin may have disconnected.");
      }

      cachedAdmin = adminLoc;

      let distance = getDistance(
        position.coords.latitude,
        position.coords.longitude,
        adminLoc.lat,
        adminLoc.lon
      );

      if (distance > 2.00) {
        throw new Error("❌ Not near bus!");
      }

      let docRef = doc(db, "attendance", today, "students", regno);
      let existing = await getDoc(docRef);

      if (existing.exists()) {
        throw new Error("⚠️ Already marked!");
      }

      await setDoc(docRef, {
        name,
        regno,
        dept,
        stop,
        time: new Date().toISOString()
      });

      localStorage.setItem("studentData", JSON.stringify({ name, regno, dept, stop }));

      alert("✅ Attendance marked!");
      form.reset();

    } catch (err) {
      alert(err.message);
    }

    isSubmitting = false;
    btn.disabled = false;
    btn.innerText = "Mark Attendance";
  });
}

// ---------------- TABLE ----------------
let table = document.getElementById("tableBody");

if (table) {
  onSnapshot(collection(db, "attendance", today, "students"), (snapshot) => {
    table.innerHTML = "";
    let index = 1;

    snapshot.forEach((docData) => {
      let s = docData.data();
      let row = `<tr>
        <td>${index++}</td>
        <td>${s.name}</td>
        <td>${s.regno}</td>
        <td>${s.dept}</td>
        <td>${s.stop}</td>
        <td>${new Date(s.time).toLocaleString()}</td>
      </tr>`;
      table.innerHTML += row;
    });
  });
}

// ---------------- LIVE BUS LISTENER ----------------
onSnapshot(doc(db, "liveBus", "location"), (snap) => {
  if (snap.exists()) {
    let data = snap.data();
    let el = document.getElementById("busLocation");
    if (el) {
      el.innerText = `🚌 Live: ${data.lat.toFixed(5)}, ${data.lon.toFixed(5)} — ${new Date(data.time).toLocaleTimeString()}`;
    }
  }
});

// ---------------- LOGOUT ----------------
globalThis.logout = async function () {
  if (busWatchId !== null) {
    navigator.geolocation.clearWatch(busWatchId);
    busWatchId = null;
  }

  let snap = await getDoc(doc(db, "admin", "location"));

  if (snap.exists()) {
    let data = snap.data();
    if (data.sessionId === adminSessionId) {
      await setDoc(doc(db, "admin", "location"), {
        ...data,
        active: false
      });
    }
  }

  localStorage.removeItem("isAdminLoggedIn");
  window.location.href = "index.html";
};

// ---------------- DOWNLOAD CSV ----------------
// FIX: function was missing entirely
globalThis.downloadData = function () {
  let rows = document.querySelectorAll("#tableBody tr");
  if (rows.length === 0) {
    alert("No attendance data to download!");
    return;
  }

  let csv = "S.No,Name,Register Number,Department,Boarding Stop,Time\n";

  rows.forEach((row) => {
    let cols = row.querySelectorAll("td");
    let line = Array.from(cols).map(td => `"${td.innerText}"`).join(",");
    csv += line + "\n";
  });

  let blob = new Blob([csv], { type: "text/csv" });
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = `attendance_${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ---------------- DOWNLOAD PDF ----------------
// FIX: function was missing entirely
globalThis.downloadPDF = function () {
  let rows = document.querySelectorAll("#tableBody tr");
  if (rows.length === 0) {
    alert("No attendance data to download!");
    return;
  }

  const { jsPDF } = window.jspdf;
  let pdf = new jsPDF();

  pdf.setFontSize(14);
  pdf.text("R13 Bus Attendance - " + today, 14, 15);

  let tableData = [];
  rows.forEach((row) => {
    let cols = row.querySelectorAll("td");
    tableData.push(Array.from(cols).map(td => td.innerText));
  });

  pdf.autoTable({
    head: [["S.No", "Name", "Register No", "Department", "Boarding Stop", "Time"]],
    body: tableData,
    startY: 25,
    styles: { fontSize: 9 }
  });

  pdf.save(`attendance_${today}.pdf`);
};

// ---------------- PRINT ----------------
// FIX: function was missing entirely
globalThis.printTable = function () {
  let tableHTML = document.querySelector(".list").innerHTML;
  let win = window.open("", "_blank");
  win.document.write(`
    <html>
      <head>
        <title>R13 Attendance - ${today}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 13px; }
          th { background: #0F172A; color: white; }
        </style>
      </head>
      <body>${tableHTML}</body>
    </html>
  `);
  win.document.close();
  win.print();
};

// ---------------- DISTANCE (Haversine) ----------------
function getDistance(lat1, lon1, lat2, lon2) {
  let R = 6371;
  let dLat = (lat2 - lat1) * Math.PI / 180;
  let dLon = (lon2 - lon1) * Math.PI / 180;

  let a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
