import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { getAuth, signInWithEmailAndPassword } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

let cachedAdmin = null;
let cachedStudentLoc = null;
let isSubmitting = false;
let busWatchId = null;

const today = new Date().toISOString().split("T")[0];

let adminSessionId = localStorage.getItem("adminSessionId");
if (!adminSessionId) {
  adminSessionId = Date.now().toString();
  localStorage.setItem("adminSessionId", adminSessionId);
}

function safeRedirect(page) {
  if (window.location.pathname.includes(page)) return;
  window.location.replace(page);
}

/* ================= TOGGLE ================= */
globalThis.toggleMenu = function () {
  let sidebar = document.getElementById("navLinks");
  let overlay = document.querySelector(".overlay");

  sidebar.classList.toggle("active");
  overlay.classList.toggle("active");
};

/* ================= BUS TRACKING ================= */
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

/* ================= LOAD ================= */
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

  if (path.includes("dashboard.html")) {
    if (localStorage.getItem("isAdminLoggedIn") !== "true") {
      safeRedirect("admin.html");
      return;
    }
    startBusTracking();
  }

  if (path.includes("admin.html")) {
    if (localStorage.getItem("isAdminLoggedIn") === "true") {
      safeRedirect("dashboard.html");
    }
  }

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

/* ================= ADMIN LOGIN ================= */
const auth = getAuth();

globalThis.adminLogin = async function () {
  let email = document.getElementById("adminUser").value;
  let password = document.getElementById("adminPass").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    localStorage.setItem("isAdminLoggedIn", "true");
    window.location.href = "dashboard.html";
  } catch (err) {
    alert("Login failed!");
  }
};

/* ================= STUDENT FORM ================= */
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
        throw new Error("❌ Admin not active!");
      }

      let adminLoc = snap.data();

      let distance = getDistance(
        position.coords.latitude,
        position.coords.longitude,
        adminLoc.lat,
        adminLoc.lon
      );

      if (distance > 2.0) {
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

/* ================= TABLE ================= */
let table = document.getElementById("tableBody");

if (table) {
  onSnapshot(collection(db, "attendance", today, "students"), (snapshot) => {
    table.innerHTML = "";
    let index = 1;
let docs = [];

snapshot.forEach(docData => {
  docs.push(docData.data());
});

// 🔥 SORT BY ENTRY TIME (EARLIEST FIRST)
docs.sort((a, b) => new Date(a.time) - new Date(b.time));

docs.forEach((s) => {
  let dateObj = new Date(s.time);

  let date = dateObj.toLocaleDateString();
  let time = dateObj.toLocaleTimeString();

  let row = `<tr>
    <td>${index++}</td>
    <td>${s.name}</td>
    <td>${s.regno}</td>
    <td>${s.dept}</td>
    <td>${s.stop}</td>
    <td>${date}</td>
    <td>${time}</td>
  </tr>`;

  table.innerHTML += row;
});
  });
}

/* ================= LOGOUT (FINAL FIXED) ================= */
globalThis.logout = async function () {
  let sidebar = document.getElementById("navLinks");
  let overlay = document.querySelector(".overlay");

  if (sidebar) sidebar.classList.remove("active");
  if (overlay) overlay.classList.remove("active");

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

/* ================= DISTANCE ================= */
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


window.downloadData = function () {
  var table = document.querySelector("table");
  var rows = table.querySelectorAll("tr");

  let csv = [];

  rows.forEach(row => {
    let cols = row.querySelectorAll("td, th");
    let rowData = [];

    cols.forEach(col => {
      rowData.push('"' + col.innerText + '"');
    });

    csv.push(rowData.join(","));
  });

  let blob = new Blob([csv.join("\n")], { type: "text/csv" });
  let url = window.URL.createObjectURL(blob);

  let a = document.createElement("a");
  a.href = url;
  a.download = "attendance.csv";
  a.click();
};

window.downloadPDF = function () {
  const { jsPDF } = window.jspdf;
  let doc = new jsPDF();

  doc.text(" R13 bus Attendance Report -"+ today ,14, 10);

  doc.autoTable({
    html: "table",
    startY: 20
  });

  doc.save("attendance.pdf");
};

window.printTable = function () {
  var content = document.querySelector(".table-container").innerHTML;
  var win = window.open("", "", "width=900,height=650");

  win.document.write("<html><head><title>Print</title></head><body>");
  win.document.write(content);
  win.document.write("</body></html>");

  win.document.close();
  win.print();
};