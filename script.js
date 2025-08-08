// SafeScape Pro Application
document.addEventListener('DOMContentLoaded', function () {
    // Hide loading screen after everything loads
    setTimeout(() => {
        document.getElementById('loadingScreen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
        }, 500);
    }, 1500);

    // Initialize map with correct theme
    const initialTheme = localStorage.getItem('theme') || 'light';
    if (initialTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Initialize map with a more reliable view
    const map = L.map('map', {
        zoomControl: false,
        preferCanvas: true,
        // Add these options for better mobile experience
        tap: false,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true
    }).setView([20.5937, 78.9629], 5); // Start with wider view of India

    // Tile layers with theme support
    const lightTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        // Add these options for better mobile performance
        detectRetina: true,
        maxZoom: 19,
        minZoom: 2
    });

    const darkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        detectRetina: true,
        maxZoom: 19,
        minZoom: 2
    });

    // Set initial tile layer
    if (initialTheme === 'dark') {
        darkTiles.addTo(map);
    } else {
        lightTiles.addTo(map);
    }

    // Initialize GeoSearch provider
    const searchProvider = new GeoSearch.OpenStreetMapProvider();

    // App State
    let userLocation = null;
    let selectedLatLng = null;
    let tempMarker = null;
    let allMarkers = [];
    let currentTheme = initialTheme;
    let currentRoute = null;
    let routingControl = null;
    let searchTimeout = null;

    // Danger zones data
    const dangerZones = [
        { lat: 28.6448, lng: 77.2167, type: "Harassment", desc: "Multiple reports of verbal harassment in this area at night", severity: "High", timestamp: "2023-06-15T18:30:00" },
        { lat: 19.076, lng: 72.8777, type: "Broken Road", desc: "Large potholes and no street lighting", severity: "Medium", timestamp: "2023-06-10T09:15:00" },
        { lat: 12.9716, lng: 77.5946, type: "Dark Area", desc: "No street lights for 200m stretch", severity: "Medium", timestamp: "2023-06-05T20:45:00" },
        { lat: 13.0827, lng: 80.2707, type: "Unsafe Crowd", desc: "Aggressive street vendors and pickpockets reported", severity: "High", timestamp: "2023-05-28T16:20:00" },
        { lat: 22.5726, lng: 88.3639, type: "Harassment", desc: "Eve-teasing common near metro station exit", severity: "Critical", timestamp: "2023-05-20T19:00:00" }
    ];

    // Police stations and hospitals (simulated data)
    const policeStations = [
        { lat: 28.6358, lng: 77.2245, name: "Central Police Station" },
        { lat: 19.072, lng: 72.882, name: "Local Police Outpost" },
        { lat: 12.975, lng: 77.603, name: "Traffic Police HQ" }
    ];

    const hospitals = [
        { lat: 28.632, lng: 77.219, name: "City General Hospital" },
        { lat: 19.078, lng: 72.885, name: "Emergency Care Center" }
    ];

    // Initialize markers and features
    function initializeMapFeatures() {
        // Clear existing markers if any
        allMarkers.forEach(marker => map.removeLayer(marker));
        allMarkers = [];

        // Add default danger zones
        dangerZones.forEach(zone => {
            addMarker(zone.lat, zone.lng, zone.type, zone.desc, zone.severity, zone.timestamp);
        });

        // Add saved reports from local storage
        const savedReports = JSON.parse(localStorage.getItem('safescapeReports') || '[]');
        savedReports.forEach(report => {
            addMarker(report.lat, report.lng, report.type, report.desc, report.severity, report.timestamp);
        });

        // Add police stations and hospitals
        policeStations.forEach(station => {
            L.marker([station.lat, station.lng], {
                icon: L.divIcon({
                    className: 'police-marker',
                    html: '<i class="fas fa-shield-alt"></i>',
                    iconSize: [30, 30]
                })
            }).addTo(map).bindPopup(`<b>${station.name}</b><br>Police Station`);
        });

        hospitals.forEach(hospital => {
            L.marker([hospital.lat, hospital.lng], {
                icon: L.divIcon({
                    className: 'hospital-marker',
                    html: '<i class="fas fa-hospital"></i>',
                    iconSize: [30, 30]
                })
            }).addTo(map).bindPopup(`<b>${hospital.name}</b><br>Hospital`);
        });

        updateRecentReportsList();
        updateStats();
    }

    // Add marker to map
    function addMarker(lat, lng, type, desc, severity, timestamp) {
        const iconHtml = {
            'Harassment': '🚨',
            'Dark Area': '🌑',
            'Broken Road': '⚠️',
            'Unsafe Crowd': '🧟'
        }[type] || '📍';

        const marker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: `<div class="marker-emoji">${iconHtml}</div>`,
                iconSize: [30, 30],
                popupAnchor: [0, -15]
            }),
            customType: type,
            severity: severity,
            timestamp: timestamp || new Date().toISOString()
        });

        const dateStr = new Date(marker.options.timestamp).toLocaleString();
        const popupContent = `
            <div class="marker-popup">
                <h3>${type}</h3>
                <p><strong>Severity:</strong> ${severity || 'Unknown'}</p>
                <p>${desc || 'No description provided'}</p>
                <small><i class="fas fa-clock"></i> ${dateStr}</small>
            </div>
        `;

        marker.bindPopup(popupContent);
        marker.addTo(map);
        allMarkers.push(marker);

        return marker;
    }

    // Locate user with improved reliability
    function locateUser() {
        if (!map) {
            console.error("Map not initialized yet");
            return;
        }

        showLoading("Finding your location...");

        if ("geolocation" in navigator) {
            const geoOptions = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };

                    console.log("User location found:", userLocation);

                    // Remove previous user marker if exists
                    if (window.userMarker) {
                        map.removeLayer(window.userMarker);
                    }

                    // Create new user marker with pulse effect
                    window.userMarker = L.marker(userLocation, {
                        icon: L.divIcon({
                            className: 'user-location-marker',
                            html: '<div class="pulse-dot"></div><div class="user-location-icon">📍</div>',
                            iconSize: [30, 30],
                            popupAnchor: [0, -15]
                        }),
                        zIndexOffset: 1000
                    }).addTo(map)
                        .bindPopup("You are here")
                        .openPopup();

                    // Fly to user location with smooth animation
                    map.flyTo(userLocation, 15, {
                        duration: 1,
                        easeLinearity: 0.25
                    });

                    // Update UI
                    document.getElementById('startPoint').value = "Current Location";
                    updateNearbyReports();
                    hideLoading();
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    hideLoading();

                    let errorMsg = "Location access denied";
                    if (error.code === error.TIMEOUT) {
                        errorMsg = "Location request timed out";
                    } else if (error.code === error.POSITION_UNAVAILABLE) {
                        errorMsg = "Location unavailable";
                    }

                    showToast(`${errorMsg}. Using default view.`, "error");

                    // Set a reasonable default view
                    map.setView([20.5937, 78.9629], 5);
                },
                geoOptions
            );
        } else {
            hideLoading();
            showToast("Geolocation not supported by your browser", "error");
            map.setView([20.5937, 78.9629], 5);
        }
    }

    // [Rest of your existing functions remain the same...]
    // Search for locations, updateNearbyReports, filterMarkersByType, etc.
    // All other functions can remain exactly as they were in your original file

    // Initialize all features with improved error handling
    function initializeApp() {
        try {
            initializeMapFeatures();

            // Set up event listeners
            document.getElementById('themeToggle').addEventListener('click', toggleTheme);
            document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
            document.getElementById('reportBtn').addEventListener('click', openReportModal);
            document.getElementById('closeModal').addEventListener('click', closeReportModal);
            document.getElementById('cancelReport').addEventListener('click', closeReportModal);
            document.getElementById('submitReport').addEventListener('click', submitNewReport);
            document.getElementById('distanceFilter').addEventListener('change', updateNearbyReports);
            document.getElementById('calculateRoute').addEventListener('click', calculateSafeRoute);
            document.getElementById('startNavigation').addEventListener('click', startNavigation);
            document.getElementById('closeRouteOptions').addEventListener('click', () => {
                document.getElementById('routeOptions').classList.add('hidden');
            });
            document.getElementById('emergencySOS').addEventListener('click', emergencySOS);
            document.getElementById('findPolice').addEventListener('click', findNearestPolice);
            document.getElementById('findHospital').addEventListener('click', findNearestHospital);

            // Search input handlers
            document.getElementById('startPoint').addEventListener('input', (e) => {
                if (e.target.value !== "Current Location") {
                    searchLocations(e.target.value, document.getElementById('startResults'));
                }
            });

            document.getElementById('endPoint').addEventListener('input', (e) => {
                searchLocations(e.target.value, document.getElementById('endResults'));
            });

            // Close search results when clicking elsewhere
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-container')) {
                    document.getElementById('startResults').style.display = 'none';
                    document.getElementById('endResults').style.display = 'none';
                }
            });

            // Try to locate user - now with a small delay to ensure map is fully initialized
            setTimeout(() => {
                locateUser();
            }, 500);

        } catch (error) {
            console.error("Initialization error:", error);
            showToast("App initialization failed. Please refresh.", "error");
        }
    }

    // Start the app
    initializeApp();
});