import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAQE3YS9XzLDRPiJT3elk9uQPeWJgi7Gqg",
  authDomain: "r13-busattendance-76f86.firebaseapp.com",
  projectId: "r13-busattendance-76f86",
  storageBucket: "r13-busattendance-76f86.firebasestorage.app",
  messagingSenderId: "449329724909",
  appId: "1:449329724909:web:aaaf40d103bc9959b33be4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let watchId = null;
let sessionChecked = false;

/* ---------------- SAFE INIT ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  // DASHBOARD
  if (path.includes("dashboard.html")) {
    safeCheckAdmin();
  }

  // ADMIN PAGE
  if (path.includes("admin.html")) {
    setTimeout(() => {
      let isLoggedIn = localStorage.getItem("isAdminLoggedIn");
      if (isLoggedIn === "true") {
        window.location.replace("dashboard.html");
      }
    }, 500);
  }
});

/* ---------------- FIXED SESSION CHECK ---------------- */

async function safeCheckAdmin() {
  if (sessionChecked) return;
  sessionChecked = true;

  let isLoggedIn = localStorage.getItem("isAdminLoggedIn");

  if (isLoggedIn !== "true") {
    window.location.replace("admin.html");
    return;
  }

  try {
    let adminRef = doc(db, "admin", "location");
    let adminDoc = await getDoc(adminRef);

    if (!adminDoc.exists()) {
      localStorage.removeItem("isAdminLoggedIn");
      window.location.replace("admin.html");
    }

  } catch (err) {
    console.log("Firebase delay ignored");
  }
}

/* ---------------- ADMIN LOGIN ---------------- */

globalThis.adminLogin = async function () {
  let username = document.getElementById("adminUser").value;
  let password = document.getElementById("adminPass").value;

  if (!username || !password) {
    alert("Enter credentials!");
    return;
  }

  let isLoggedIn = localStorage.getItem("isAdminLoggedIn");
  if (isLoggedIn === "true") {
    window.location.replace("dashboard.html");
    return;
  }

  let adminRef = doc(db, "admin", "location");
  let adminDoc = await getDoc(adminRef);

  if (adminDoc.exists()) {
    let data = adminDoc.data();
    let now = new Date();
    let adminTime = new Date(data.time);

    if (now - adminTime < 2 * 60 * 1000) {
      alert("⚠️ Admin already active!");
      return;
    }
  }

  if (username === "paarthhaaa" && password === "010407") {

    localStorage.setItem("isAdminLoggedIn", "true");

    let lastUpdateTime = 0;

    watchId = navigator.geolocation.watchPosition(async (position) => {
      let now = Date.now();

      if (now - lastUpdateTime > 5000) {
        lastUpdateTime = now;

        await setDoc(doc(db, "admin", "location"), {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          time: new Date().toISOString()
        });
      }

    });

    alert("✅ Login success!");
    window.location.replace("dashboard.html");

  } else {
    alert("Invalid login!");
  }
};

/* ---------------- STUDENT FORM ---------------- */

let form = document.getElementById("studentForm");

if (form) {
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    let name = document.getElementById("name").value.trim();
    let regno = document.getElementById("regno").value.trim();
    let dept = document.getElementById("dept").value.trim();
    let stop = document.getElementById("stop").value.trim();

    if (!name || !regno || !dept || !stop) {
      alert("Fill all fields!");
      return;
    }

    let adminSnap = await getDoc(doc(db, "admin", "location"));

    if (!adminSnap.exists()) {
      alert("Admin not active!");
      return;
    }

    let existing = await getDocs(
      query(collection(db, "attendance"), where("regno", "==", regno))
    );

    if (!existing.empty) {
      alert("⚠️ Already marked!");
      return;
    }

    let adminLoc = adminSnap.data();

    navigator.geolocation.getCurrentPosition(async (position) => {
      let distance = getDistance(
        position.coords.latitude,
        position.coords.longitude,
        adminLoc.lat,
        adminLoc.lon
      );

      if (distance > 2.04) {
        alert("❌ Not near bus!");
        return;
      }

      await addDoc(collection(db, "attendance"), {
        name,
        regno,
        dept,
        stop,
        time: new Date().toISOString()
      });

      alert("✅ Attendance marked!");
      form.reset();
      window.location.replace("index.html");
    });
  });
}

/* ---------------- TABLE ---------------- */

let table = document.getElementById("table");

if (table) {
  onSnapshot(collection(db, "attendance"), (snapshot) => {
    table.innerHTML = "";
    let index = 1;

    snapshot.forEach((docData) => {
      let s = docData.data();
      let row = table.insertRow();

      row.insertCell(0).innerText = index++;
      row.insertCell(1).innerText = s.name;
      row.insertCell(2).innerText = s.regno;
      row.insertCell(3).innerText = s.dept;
      row.insertCell(4).innerText = s.stop;
      row.insertCell(5).innerText = new Date(s.time).toLocaleString();
    });
  });
}

/* ---------------- LOGOUT ---------------- */

globalThis.logout = async function () {
  await deleteDoc(doc(db, "admin", "location"));

  if (watchId) navigator.geolocation.clearWatch(watchId);

  localStorage.removeItem("isAdminLoggedIn");
  window.location.replace("index.html");
};

/* ---------------- DISTANCE ---------------- */

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