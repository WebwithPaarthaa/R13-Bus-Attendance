import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
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

let cachedAdmin = null;
let cachedStudentLoc = null;
let isSubmitting = false;

// ---------------- SAFE REDIRECT ----------------
function safeRedirect(page) {
  if (window.location.pathname.includes(page)) return;
  window.location.replace(page);
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

  if (path.includes("dashboard.html")) {
    let isLoggedIn = localStorage.getItem("isAdminLoggedIn");
    if (isLoggedIn !== "true") safeRedirect("admin.html");
  }

  if (path.includes("admin.html")) {
    let isLoggedIn = localStorage.getItem("isAdminLoggedIn");
    if (isLoggedIn === "true") safeRedirect("dashboard.html");
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

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      await setDoc(doc(db, "admin", "location"), {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        time: new Date().toISOString(),
        active: true
      });

      // update cache immediately
      cachedAdmin = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        active: true
      };

      localStorage.setItem("isAdminLoggedIn", "true");
      window.location.href = "dashboard.html";
    },
    (error) => {
      alert("Location error: " + error.message);
    },
    { enableHighAccuracy: true }
  );
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

      let adminLoc = cachedAdmin;

      if (!adminLoc) {
        let snap = await getDoc(doc(db, "admin", "location"));
        if (!snap.exists() || snap.data().active === false) {
          throw new Error("Admin not active!");
        }
        adminLoc = snap.data();
      }

      let distance = getDistance(
        position.coords.latitude,
        position.coords.longitude,
        adminLoc.lat,
        adminLoc.lon
      );

      if (distance > 30.04) {
        throw new Error("❌ Not near bus!");
      }

      let docRef = doc(db, "attendance", regno);
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

      localStorage.setItem("studentData", JSON.stringify({
        name,
        regno,
        dept,
        stop
      }));

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
  onSnapshot(collection(db, "attendance"), (snapshot) => {
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

// ---------------- LOGOUT ----------------
globalThis.logout = async function () {
  let snap = await getDoc(doc(db, "admin", "location"));

  if (snap.exists()) {
    let data = snap.data();
    await setDoc(doc(db, "admin", "location"), {
      ...data,
      active: false
    });
  }

  localStorage.removeItem("isAdminLoggedIn");
  window.location.href = "index.html";
};

// ---------------- DISTANCE ----------------
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

// ---------------- DOWNLOAD ----------------
globalThis.downloadData = async function () {
  let snapshot = await getDocs(collection(db, "attendance"));

  let csv = "S.no,Name,RegNo,Dept,Stop,Time\n";
  let i = 1;

  snapshot.forEach((doc) => {
    let s = doc.data();
    csv += `${i++},${s.name},${s.regno},${s.dept},${s.stop},${s.time}\n`;
  });

  let blob = new Blob([csv], { type: "text/csv" });
  let url = URL.createObjectURL(blob);

  let a = document.createElement("a");
  a.href = url;
  a.download = "attendance.csv";
  a.click();
};

globalThis.downloadPDF = async function () {
  let snapshot = await getDocs(collection(db, "attendance"));

  const { jsPDF } = window.jspdf;
  let pdf = new jsPDF();

  let rows = [];
  let i = 1;

  snapshot.forEach((doc) => {
    let s = doc.data();
    rows.push([i++, s.name, s.regno, s.dept, s.stop, s.time]);
  });

  pdf.autoTable({
    head: [["S.no", "Name", "RegNo", "Dept", "Stop", "Time"]],
    body: rows
  });

  pdf.save("attendance.pdf");
};

// ---------------- PRINT + MENU ----------------
globalThis.printTable = function () {
  window.print();
};

globalThis.toggleMenu = function () {
  document.getElementById("navLinks").classList.toggle("active");
};
