if (window.location.pathname.includes("dashboard.html")) {
  let isLoggedIn = localStorage.getItem("isAdminLoggedIn");

  if (!isLoggedIn) {
    alert("🚫 Please login first!");
    window.location.href = "admin.html";
  }
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


  const firebaseConfig = {
    apiKey: "AIzaSyAQE3YS9XzLDRPiJT3elk9uQPeWJgi7Gqg",
    authDomain: "r13-busattendance-76f86.firebaseapp.com",
    projectId: "r13-busattendance-76f86",
    storageBucket: "r13-busattendance-76f86.firebasestorage.app",
    messagingSenderId: "449329724909",
    appId: "1:449329724909:web:aaaf40d103bc9959b33be4"
  };



const app = initializeApp(firebaseConfig);
const db = getFirestore(app);



window.adminLogin = async function () {
  let username = document.getElementById("adminUser").value;
  let password = document.getElementById("adminPass").value;

  if (username === "paarthhaaa" && password === "010407") {

    navigator.geolocation.getCurrentPosition(async (position) => {
      let lat = position.coords.latitude;
      let lon = position.coords.longitude;

      
      await setDoc(doc(db, "admin", "location"), {
        lat: lat,
        lon: lon,
        time: new Date().toISOString()
      });

      localStorage.setItem("isAdminLoggedIn", "true");

      alert("✅ Admin Login Success & Location Shared!");
      window.location.href = "dashboard.html";

    }, () => {
      alert("❌ Enable location!");
    });

  } else {
    alert("❌ Invalid credentials");
  }
};



let form = document.getElementById("studentForm");

if (form) {
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    let name = document.getElementById("name").value;
    let regno = document.getElementById("regno").value;
    let dept = document.getElementById("dept").value;
    let stop = document.getElementById("stop").value;

    
    let docRef = doc(db, "admin", "location");
    let docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      alert("❌ Admin not logged in!");
      return;
    }

    let adminLocation = docSnap.data();

    navigator.geolocation.getCurrentPosition(async (position) => {
      let studentLat = position.coords.latitude;
      let studentLon = position.coords.longitude;

      let distance = getDistance(
        studentLat,
        studentLon,
        adminLocation.lat,
        adminLocation.lon
      );

      if (distance > 0.2) {
        alert("❌ You are not near the bus!");
        return;
      }

      
      await addDoc(collection(db, "attendance"), {
        name,
        regno,
        dept,
        stop,
        time: new Date().toISOString()
      });

      alert("✅ Attendance Marked!");
      form.reset();
      window.location.href = "index.html";

    }, () => {
      alert("❌ Enable location!");
    });
  });
}



let table = document.getElementById("table");

import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

if (table) {
  onSnapshot(collection(db, "attendance"), (snapshot) => {
    table.innerHTML = ""; // clear table

    let now = new Date();

    snapshot.forEach((docData) => {
      let s = docData.data();
      let recordTime = new Date(s.time);

      if (now - recordTime <= 12 * 60 * 60 * 1000) {
        let row = table.insertRow();
        row.insertCell(0).innerText = s.name;
        row.insertCell(1).innerText = s.regno;
        row.insertCell(2).innerText = s.dept;
        row.insertCell(3).innerText = s.stop;
        row.insertCell(4).innerText = recordTime.toLocaleString();
      }
    });
  });
}



window.logout = function () {
  let confirmLogout = confirm("Logout?");
  if (confirmLogout) {
    localStorage.removeItem("isAdminLoggedIn");
    window.location.replace("index.html"); 
  }
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



window.toggleMenu = function () {
  let menu = document.getElementById("navLinks");
  menu.classList.toggle("active");
};




window.downloadData = async function () {
  let querySnapshot = await getDocs(collection(db, "attendance"));

  if (querySnapshot.empty) {
    alert("No data!");
    return;
  }

  let csv = "Name,RegisterNumber,Department,Stop,Time\n";

  querySnapshot.forEach((doc) => {
    let s = doc.data();
    csv += `${s.name},${s.regno},${s.dept},${s.stop},${s.time}\n`;
  });

  let blob = new Blob([csv], { type: "text/csv" });
  let url = URL.createObjectURL(blob);

  let a = document.createElement("a");
  a.href = url;
  a.download = "attendance.csv";
  a.click();
};

window.downloadPDF = async function () {
  let querySnapshot = await getDocs(collection(db, "attendance"));

  if (querySnapshot.empty) {
    alert("No data!");
    return;
  }

  const { jsPDF } = window.jspdf;
  let docPDF = new jsPDF();

  let rows = [];

  querySnapshot.forEach((doc) => {
    let s = doc.data();
    rows.push([s.name, s.regno, s.dept, s.stop, s.time]);
  });

  docPDF.autoTable({
    head: [["Name", "Reg No", "Dept", "Stop", "Time"]],
    body: rows
  });

  docPDF.save("attendance.pdf");
};

window.printTable = function () {
  window.print();
};