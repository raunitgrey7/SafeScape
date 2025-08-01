let map;
let selectedLatLng = null;

// Danger zones
const dangerZones = [
  { lat: 28.6448, lng: 77.2167, type: "Harassment", desc: "Dark alley with past incidents" },
  { lat: 19.076, lng: 72.8777, type: "Broken Road", desc: "Potholes and no lighting" }
];

function initMap() {
  map = L.map('map').setView([20.5937, 78.9629], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Try to get user location
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;

      L.circleMarker([latitude, longitude], {
        radius: 7,
        color: "#2e7d32",
        fillColor: "#4caf50",
        fillOpacity: 0.9
      })
      .addTo(map)
      .bindPopup("📍 You are here")
      .openPopup();

      map.setView([latitude, longitude], 14);
    }, () => {
      console.warn("📡 Location access denied");
    });
  }

  // Add default and saved markers
  dangerZones.forEach(zone => addMarker(zone.lat, zone.lng, zone.type, zone.desc, zone.timestamp));
  const saved = JSON.parse(localStorage.getItem('safescapeReports') || '[]');
  saved.forEach(report => addMarker(report.lat, report.lng, report.type, report.desc, report.timestamp));
}


function addMarker(lat, lng, type, desc, timestamp) {
  const dateStr = timestamp ? new Date(timestamp).toLocaleString() : 'Unknown time';
  const popupContent = `<b>${type}</b><br>${desc || 'No description'}<br><small>🕒 ${dateStr}</small>`;
  const marker = L.marker([lat, lng], { customType: type });
  marker.bindPopup(popupContent);
  marker.addTo(map);
}

function openModal() {
  document.getElementById('reportModal').classList.remove('hidden');

  // Allow user to click on map to pick location
  map.once('click', function (e) {
  selectedLatLng = e.latlng;

  // Save the temp marker globally so we can remove it later
  window.tempMarker = L.circleMarker(selectedLatLng, {
    radius: 6,
    color: "#ff4da6",
    fillColor: "#ff4da6",
    fillOpacity: 0.9
  }).addTo(map);

  alert("✅ Location selected. You can now submit.");
});

}


function closeModal() {
  const modal = document.getElementById('reportModal');
  modal.classList.add('hidden'); // Hides modal fully

  document.getElementById('dangerType').value = "Harassment";
  document.getElementById('dangerDesc').value = "";

  if (window.tempMarker) {
    map.removeLayer(window.tempMarker);
    window.tempMarker = null;
  }

  selectedLatLng = null;
}



function submitReport() {
  if (!selectedLatLng) {
    alert("❗Please click on the map to select a location first.");
    return;
  }

  const type = document.getElementById('dangerType').value;
  const desc = document.getElementById('dangerDesc').value;
  const timestamp = new Date().toISOString();

  addMarker(selectedLatLng.lat, selectedLatLng.lng, type, desc, timestamp);
  saveToLocal(type, desc, selectedLatLng.lat, selectedLatLng.lng, timestamp);
  closeModal();
}


function saveToLocal(type, desc, lat, lng, timestamp) {
  const existing = JSON.parse(localStorage.getItem('safescapeReports') || '[]');
  existing.push({ type, desc, lat, lng, timestamp });
  localStorage.setItem('safescapeReports', JSON.stringify(existing));
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();

  // Bind buttons ONCE
  document.getElementById('reportBtn').addEventListener('click', openModal);
  document.getElementById('closeModal').addEventListener('click', () => {
    console.log("❌ Cancel clicked");
    closeModal();
  });
  document.getElementById('submitReport').addEventListener('click', submitReport);

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log("✅ Service Worker Registered"))
      .catch(err => console.error("⚠️ SW registration failed:", err));
  }
});

document.getElementById('filterType').addEventListener('change', function () {
  const selected = this.value;
  map.eachLayer(layer => {
    if (layer instanceof L.Marker && layer.options.customType) {
      const visible = selected === "All" || layer.options.customType === selected;
      if (visible) {
        map.addLayer(layer);
      } else {
        map.removeLayer(layer);
      }
    }
  });
});
