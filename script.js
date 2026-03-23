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
let isChecking = false;



if (window.location.pathname.includes("dashboard.html")) {
  checkAdminSession();
}

async function checkAdminSession() {
  if (isChecking) return;
  isChecking = true;

  let isLoggedIn = localStorage.getItem("isAdminLoggedIn");

  if (isLoggedIn !== "true") {
    window.location.replace("admin.html");
    return;
  }

  let adminRef = doc(db, "admin", "location");
  let adminDoc = await getDoc(adminRef);

  if (!adminDoc.exists()) {
    localStorage.removeItem("isAdminLoggedIn");
    window.location.replace("admin.html");
  }

  isChecking = false;
}


globalThis.adminLogin = async function () {
  let username = document.getElementById("adminUser").value;
  let password = document.getElementById("adminPass").value;

  if (!username || !password) {
    alert("Enter credentials!");
    return;
  }

  let isLoggedIn = localStorage.getItem("isAdminLoggedIn");
  if (isLoggedIn === "true") {
    if (!window.location.pathname.includes("dashboard.html")) {
      window.location.replace("dashboard.html");
    }
    return;
  }

  let adminRef = doc(db, "admin", "location");
  let adminDoc = await getDoc(adminRef);

  if (adminDoc.exists()) {
    let data = adminDoc.data();
    let now = new Date();
    let adminTime = new Date(data.time);

    if (now - adminTime < 2 * 60 * 1000) {
      alert("⚠️ Admin already active on another device!");
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

        let lat = position.coords.latitude;
        let lon = position.coords.longitude;

        await setDoc(doc(db, "admin", "location"), {
          lat,
          lon,
          time: new Date().toISOString()
        });

        console.log("📍 Live location:", lat, lon);
      }

    }, () => {
      alert("Enable location!");
    }, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    });

    alert("✅ Login success!");

    if (!window.location.pathname.includes("dashboard.html")) {
      window.location.replace("dashboard.html");
    }

  } else {
    alert("Invalid login!");
  }
};


if (window.location.pathname.includes("admin.html")) {
  setTimeout(() => {
    let isLoggedIn = localStorage.getItem("isAdminLoggedIn");
    if (isLoggedIn === "true") {
      window.location.replace("dashboard.html");
    }
  }, 300);
}


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

    let adminRef = doc(db, "admin", "location");
    let adminSnap = await getDoc(adminRef);

    if (!adminSnap.exists()) {
      alert("Admin not active!");
      return;
    }

    let q = query(collection(db, "attendance"), where("regno", "==", regno));
    let snapshot = await getDocs(q);

    if (!snapshot.empty) {
      alert("⚠️ Already marked!");
      return;
    }

    let adminLoc = adminSnap.data();

    navigator.geolocation.getCurrentPosition(async (position) => {
      let studentLat = position.coords.latitude;
      let studentLon = position.coords.longitude;

      let distance = getDistance(
        studentLat,
        studentLon,
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

    }, () => {
      alert("Enable location!");
    });
  });
}

let table = document.getElementById("table");

if (table) {
  onSnapshot(collection(db, "attendance"), (snapshot) => {
    table.innerHTML = "";

    let now = new Date();
    let index = 1;

    snapshot.forEach((docData) => {
      let s = docData.data();
      let recordTime = new Date(s.time);

      if (now - recordTime <= 12 * 60 * 60 * 1000) {
        let row = table.insertRow();

        row.insertCell(0).innerText = index++;
        row.insertCell(1).innerText = s.name;
        row.insertCell(2).innerText = s.regno;
        row.insertCell(3).innerText = s.dept;
        row.insertCell(4).innerText = s.stop;
        row.insertCell(5).innerText = recordTime.toLocaleString();
      }
    });
  });
}


globalThis.logout = async function () {
  let confirmLogout = confirm("Logout?");
  if (!confirmLogout) return;

  try {
    await deleteDoc(doc(db, "admin", "location"));
  } catch (err) {
    console.log(err);
  }

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }

  localStorage.removeItem("isAdminLoggedIn");

  window.location.replace("index.html");
};

function getDistance(lat1, lon1, lat2, lon2) {
  let R = 6371;
  let dLat = (lat2 - lat1) * Math.PI / 180;
  let dLon = (lon2 - lon1) * Math.PI / 180;

  let a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


globalThis.downloadData = async function () {
  let querySnapshot = await getDocs(collection(db, "attendance"));

  if (querySnapshot.empty) {
    alert("No data!");
    return;
  }

  let csv = "S.no,Name,RegNo,Dept,Stop,Time\n";
  let index = 1;

  querySnapshot.forEach((doc) => {
    let s = doc.data();
    csv += `${index++},${s.name},${s.regno},${s.dept},${s.stop},${s.time}\n`;
  });

  let blob = new Blob([csv], { type: "text/csv" });
  let url = URL.createObjectURL(blob);

  let a = document.createElement("a");
  a.href = url;
  a.download = "attendance.csv";
  a.click();
};



globalThis.downloadPDF = async function () {
  let querySnapshot = await getDocs(collection(db, "attendance"));

  if (querySnapshot.empty) {
    alert("No data!");
    return;
  }

  const { jsPDF } = window.jspdf;
  let pdf = new jsPDF();

  let rows = [];
  let index = 1;

  querySnapshot.forEach((doc) => {
    let s = doc.data();
    rows.push([index++, s.name, s.regno, s.dept, s.stop, s.time]);
  });

  pdf.autoTable({
    head: [["S.no", "Name", "Reg No", "Dept", "Stop", "Time"]],
    body: rows
  });

  pdf.save("attendance.pdf");
};



globalThis.printTable = function () {
  window.print();
};



globalThis.toggleMenu = function () {
  let menu = document.getElementById("navLinks");
  menu.classList.toggle("active");
};