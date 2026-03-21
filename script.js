
if (window.location.pathname.includes("dashboard.html")) {
  let isLoggedIn = localStorage.getItem("isAdminLoggedIn");

  if (isLoggedIn !== "true") {
    alert("🚫 Access Denied! Login first");
    window.location.href = "admin.html";
  }
}


let form = document.getElementById("studentForm");

if (form) {
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    let name = document.getElementById("name");
    let regno = document.getElementById("regno");
    let dept = document.getElementById("dept");
    let stop = document.getElementById("stop");

    if (!name || !regno || !dept || !stop) return;

    let data = JSON.parse(localStorage.getItem("attendance")) || [];


    let alreadyExists = data.some(s => s.regno === regno.value);
    if (alreadyExists) {
      alert("⚠️ Attendance already marked!");
      return;
    }

   
    alert("Trying to get location...");
    alert("📍 Checking your location...");

    navigator.geolocation.getCurrentPosition(
      function (position) {
        let studentLat = position.coords.latitude;
        let studentLon = position.coords.longitude;

        let adminLocation = JSON.parse(localStorage.getItem("adminLocation"));

        if (!adminLocation || !adminLocation.lat) {
  alert("❌ Admin must login first to set location!");
  return;
}

        if (!adminLocation) {
          alert("❌ Admin location not set!");
          return;
        }

        let distance = getDistance(
          studentLat,
          studentLon,
          adminLocation.lat,
          adminLocation.lon
        );

     
        if (distance > 0.2) {
          alert("❌ You are not near the bus location!");
          return;
        }

 
        let student = {
          name: name.value,
          regno: regno.value,
          dept: dept.value,
          stop: stop.value,
          time: new Date().toLocaleString()
        };

        data.push(student);
        localStorage.setItem("attendance", JSON.stringify(data));

        alert("✅ Attendance Marked Successfully!");
        form.reset();

        window.location.href = "index.html";
      },
      function () {
        alert("❌ Please enable location access!");
      }
    );
  });
}


function logout() {
  let confirmLogout = confirm("Are you sure you want to logout?");
  if (confirmLogout) {
    localStorage.removeItem("attendance");
    localStorage.removeItem("isAdminLoggedIn");
    localStorage.removeItem("adminLocation");
    window.location.href = "index.html";
  }
}

let table = document.getElementById("table");

if (table) {
  let data = JSON.parse(localStorage.getItem("attendance")) || [];

  if (data.length === 0) {
    table.innerHTML = "<tr><td colspan='5'>No attendance yet</td></tr>";
  } else {
    data.forEach(student => {
      let row = table.insertRow();

      row.insertCell(0).innerText = student.name;
      row.insertCell(1).innerText = student.regno;
      row.insertCell(2).innerText = student.dept;
      row.insertCell(3).innerText = student.stop;
      row.insertCell(4).innerText = student.time;
    });
  }
}


function downloadData() {
  let data = JSON.parse(localStorage.getItem("attendance")) || [];

  if (data.length === 0) {
    alert("No data to download!");
    return;
  }

  let csv = "Name,RegisterNumber,Department,BoardingStop,Date-Time\n";

  data.forEach(student => {
    csv += `${student.name},${student.regno},${student.dept},${student.stop},${student.time}\n`;
  });

  let blob = new Blob([csv], { type: "text/csv" });
  let url = URL.createObjectURL(blob);

  let a = document.createElement("a");
  a.href = url;
  a.download = "attendance.csv";
  a.click();
}

function downloadPDF() {
  let data = JSON.parse(localStorage.getItem("attendance")) || [];

  if (data.length === 0) {
    alert("No data to download!");
    return;
  }

  const { jsPDF } = window.jspdf;
  let doc = new jsPDF();

  doc.setFontSize(20);
  doc.text("R13 Bus Attendance List", 14, 15);

  let date = new Date().toLocaleDateString();
  doc.setFontSize(10);
  doc.text("Date: " + date, 14, 22);

  let columns = ["Name", "Reg No", "Dept", "Stop", "Date-Time"];
  let rows = data.map(s => [
    s.name,
    s.regno,
    s.dept,
    s.stop,
    s.time
  ]);

  doc.autoTable({
    head: [columns],
    body: rows,
    startY: 28
  });

  doc.save("attendance.pdf");
}


function printTable() {
  window.print();
}


function getDistance(lat1, lon1, lat2, lon2) {
  let R = 6371;
  let dLat = (lat2 - lat1) * Math.PI / 180;
  let dLon = (lon2 - lon1) * Math.PI / 180;

  let a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}