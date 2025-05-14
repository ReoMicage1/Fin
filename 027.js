let map;
let objectManager;
let userLocation;
let culturalHeritagePlacemarks = [];
let allPlacemarks = [];
let currentLanguage = 'ru';
let currentPlace = null;
let currentPhotos = [];
let currentPhotoIndex = 0;
let russiaBounds = [[41.185, 19.638], [81.858, 180.0]];
let savedPlaces = JSON.parse(localStorage.getItem('savedPlaces')) || [];
let landPolygons = [];
let currentRoute = null;
let isMusicPlaying = false;
const music = document.getElementById('bgMusic');
const musicIcon = document.getElementById('musicIcon');
let currentCity = '';
let currentCountry = '';
let friends = [
    {id: 1, name: 'Мария Петрова', avatar: 'MP', online: true},
    {id: 2, name: 'Алексей Смирнов', avatar: 'АС', online: false},
    {id: 3, name: 'Елена Козлова', avatar: 'ЕК', online: true}
];
let customMarkers = [];
let mapType = 'map';
let trafficLayer = null;
let isOfflineMode = false;
let userHistory = [];
let collaborators = [];
let isCreatingMarker = false;
let pendingMarkerCoords = null;
let isWalkModeActive = false;
let walkModeStartPoint = null;
let walkModeCurrentPosition = null;
let walkModeDirection = 0;
let walkModeBlueStreets = [];
let clusterer;
let preloaderTimeout;
let tooltipTimeout;
let nearbyFilter = 'all';
let currentEvents = [];
let drawingTools;
let measurementTools;
let multiRoute;
let realtimeTraffic = false;
let darkMode = false;
let arSession = null;

ymaps.ready(init);

function init() {
    showPreloader();
    createMap();
    setupControls();
    setupFilters();
    generateInitialData();
    setupSearch();
    setupRatingWidgets();
    loadLandPolygons();
    updateWeatherInfo();
    setupMusic();
    loadUserHistory();
    loadCollaborators();
    setupRightClick();
    setupWalkMode();
    setupDrawingTools();
    setupMeasurementTools();
    setupEventCalendar();
    setupRealtimeTraffic();
    setupDarkMode();
    hidePreloader();
}

function showPreloader() {
    document.getElementById('preloader').style.display = 'flex';
    preloaderTimeout = setTimeout(hidePreloader, 3000);
}

function hidePreloader() {
    clearTimeout(preloaderTimeout);
    document.getElementById('preloader').style.display = 'none';
}

function createMap() {
    map = new ymaps.Map('map', {
        center: [55.7558, 37.6173],
        zoom: 5,
        controls: ['zoomControl']
    });
    
    clusterer = new ymaps.Clusterer({
        preset: 'islands#invertedVioletClusterIcons',
        clusterDisableClickZoom: true,
        clusterOpenBalloonOnClick: true,
        clusterBalloonContentLayout: 'cluster#balloonCarousel',
        clusterBalloonItemContentLayout: 'my#clustererItemLayout',
        clusterBalloonPanelMaxMapArea: 0,
        clusterBalloonContentLayoutWidth: 300,
        clusterBalloonContentLayoutHeight: 200,
        clusterBalloonPagerSize: 5,
        clusterBalloonPagerVisible: true,
        groupByCoordinates: false,
        gridSize: 64,
        hasBalloon: true,
        hasHint: true,
        margin: 10,
        maxZoom: 23,
        minClusterSize: 2,
        showInAlphabeticalOrder: true,
        useMapMargin: true,
        zoomMargin: 50
    });
    
    objectManager = new ymaps.ObjectManager({
        clusterize: true,
        gridSize: 64,
        clusterIconLayout: 'default#pieChart',
        clusterDisableClickZoom: true
    });
    
    map.geoObjects.add(clusterer);
    map.geoObjects.add(objectManager);
    
    objectManager.objects.events.add('click', function(e) {
        const objectId = e.get('objectId');
        const object = objectManager.objects.getById(objectId);
        currentPlace = object;
        openPlaceModal(object);
        updateWeatherInfo(object.geometry.coordinates);
        showMarkerWeatherInfo(object);
    });
    
    objectManager.clusters.events.add('click', function(e) {
        const cluster = e.get('target');
        map.setCenter(cluster.geometry.getCoordinates(), map.getZoom() + 2);
    });
    
    map.events.add('boundschange', function() {
        const zoom = map.getZoom();
        if (zoom < 10) {
            objectManager.setFilter(showOnlyImportantMarkers);
        } else {
            objectManager.setFilter(null);
        }
    });
}

function showOnlyImportantMarkers(obj) {
    return obj.properties.isHeritage || obj.properties.popularity > 80;
}

function setupRightClick() {
    map.events.add('click', function(e) {
        if (e.get('button') === 'right') {
            const coords = e.get('coords');
            if (isCreatingMarker) {
                pendingMarkerCoords = coords;
                document.getElementById('createMarkerModal').style.display = 'flex';
            } else {
                showMarkerContextMenu(coords);
            }
        }
    });
}

function showMarkerContextMenu(coords) {
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.display = 'block';
    
    document.getElementById('contextCreateMarker').onclick = function() {
        isCreatingMarker = true;
        pendingMarkerCoords = coords;
        document.getElementById('createMarkerModal').style.display = 'flex';
        contextMenu.style.display = 'none';
    };
    
    document.getElementById('contextMeasureDistance').onclick = function() {
        startDistanceMeasurement(coords);
        contextMenu.style.display = 'none';
    };
    
    document.getElementById('contextAddRoutePoint').onclick = function() {
        addRoutePoint(coords);
        contextMenu.style.display = 'none';
    };
    
    document.addEventListener('click', function hideContextMenu() {
        contextMenu.style.display = 'none';
        document.removeEventListener('click', hideContextMenu);
    });
}

function setupDrawingTools() {
    drawingTools = new ymaps.panel.DrawingTools({
        scaleLine: false,
        scaleLineLength: 100,
        scaleLineWidth: 2,
        scaleLineColor: '#000',
        scaleLineTextColor: '#000',
        scaleLineFontFamily: 'Arial',
        scaleLineFontSize: 12,
        scaleLineFontWeight: 'normal',
        scaleLineTextOffset: 10,
        scaleLineTextShadow: false,
        scaleLineTextShadowColor: '#fff',
        scaleLineTextShadowOffsetX: 0,
        scaleLineTextShadowOffsetY: 0,
        scaleLineTextShadowBlur: 0
    });
    
    map.controls.add(drawingTools, {
        float: 'none',
        position: {top: 10, right: 10}
    });
    
    drawingTools.events.add(['drawingstart', 'drawingstop', 'drawingcomplete'], function(e) {
        if (e.get('type') === 'drawingcomplete') {
            const geoObject = e.get('geoObject');
            map.geoObjects.add(geoObject);
        }
    });
}

function setupMeasurementTools() {
    measurementTools = new ymaps.panel.MeasurementTools({
        scaleLine: false,
        scaleLineLength: 100,
        scaleLineWidth: 2,
        scaleLineColor: '#000',
        scaleLineTextColor: '#000',
        scaleLineFontFamily: 'Arial',
        scaleLineFontSize: 12,
        scaleLineFontWeight: 'normal',
        scaleLineTextOffset: 10,
        scaleLineTextShadow: false,
        scaleLineTextShadowColor: '#fff',
        scaleLineTextShadowOffsetX: 0,
        scaleLineTextShadowOffsetY: 0,
        scaleLineTextShadowBlur: 0
    });
    
    map.controls.add(measurementTools, {
        float: 'none',
        position: {top: 60, right: 10}
    });
}

function startDistanceMeasurement(coords) {
    measurementTools.startMeasuring('distance', coords);
}

function setupEventCalendar() {
    $('#eventCalendar').datepicker({
        onSelect: function(dateText) {
            filterEventsByDate(dateText);
        }
    });
}

function filterEventsByDate(date) {
    const selectedDate = new Date(date);
    const filteredEvents = [];
    
    allPlacemarks.forEach(placemark => {
        placemark.properties.events.forEach(event => {
            const eventDate = new Date(event.date);
            if (eventDate.toDateString() === selectedDate.toDateString()) {
                filteredEvents.push({
                    place: placemark,
                    event: event
                });
            }
        });
    });
    
    currentEvents = filteredEvents;
    updateEventsList();
}

function updateEventsList() {
    const eventsList = document.getElementById('eventsCalendarList');
    eventsList.innerHTML = '';
    
    if (currentEvents.length === 0) {
        eventsList.innerHTML = '<p>Нет событий на выбранную дату</p>';
        return;
    }
    
    currentEvents.forEach(item => {
        const eventElement = document.createElement('div');
        eventElement.className = 'search-result-item';
        eventElement.innerHTML = `
            <div><strong>${item.event.title}</strong></div>
            <div>${item.place.properties.name}</div>
            <div class="search-result-category">${item.event.date}</div>
        `;
        eventElement.addEventListener('click', function() {
            map.setCenter(item.place.geometry.coordinates, 15);
            openPlaceModal(item.place);
        });
        eventsList.appendChild(eventElement);
    });
}

function setupRealtimeTraffic() {
    trafficLayer = new ymaps.TrafficLayer({
        providerKey: 'traffic#actual',
        infoLayerShown: true
    });
    
    if (realtimeTraffic) {
        map.layers.add(trafficLayer);
    }
}

function toggleRealtimeTraffic() {
    realtimeTraffic = !realtimeTraffic;
    if (realtimeTraffic) {
        map.layers.add(trafficLayer);
        showNotification('Пробки в реальном времени включены');
    } else {
        map.layers.remove(trafficLayer);
        showNotification('Пробки в реальном времени выключены');
    }
}

function setupDarkMode() {
    darkMode = localStorage.getItem('darkMode') === 'true';
    applyDarkMode();
}

function toggleDarkMode() {
    darkMode = !darkMode;
    localStorage.setItem('darkMode', darkMode);
    applyDarkMode();
    showNotification(darkMode ? 'Темная тема включена' : 'Темная тема выключена');
}

function applyDarkMode() {
    if (darkMode) {
        document.body.classList.add('dark-mode');
        map.setType('yandex#dark');
    } else {
        document.body.classList.remove('dark-mode');
        map.setType('yandex#map');
    }
}

function showWhatsNearby() {
    if (!userLocation) {
        alert('Для поиска мест поблизости необходимо определить ваше местоположение');
        return;
    }
    
    document.getElementById('whatsNearbyModal').style.display = 'flex';
}

function filterNearbyPlaces(type) {
    nearbyFilter = type;
    const nearbyPlaces = findNearbyPlaces(userLocation, 1, 20);
    const filteredPlaces = nearbyPlaces.filter(place => {
        if (type === 'all') return true;
        return place.properties.category === type;
    });
    
    const nearbyList = document.getElementById('whatsNearbyList');
    nearbyList.innerHTML = '';
    
    if (filteredPlaces.length === 0) {
        nearbyList.innerHTML = '<p>Нет мест поблизости</p>';
        return;
    }
    
    filteredPlaces.forEach(place => {
        const placeElement = document.createElement('div');
        placeElement.className = 'search-result-item';
        placeElement.innerHTML = `
            <div>${place.properties.name}</div>
            <div class="search-result-category">${place.properties.category}</div>
        `;
        placeElement.addEventListener('click', function() {
            map.setCenter(place.geometry.coordinates, 15);
            openPlaceModal(place);
            document.getElementById('whatsNearbyModal').style.display = 'none';
        });
        nearbyList.appendChild(placeElement);
    });
}

function setupTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltipText = this.getAttribute('data-tooltip');
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = tooltipText;
            
            const rect = this.getBoundingClientRect();
            tooltip.style.left = `${rect.left + rect.width / 2}px`;
            tooltip.style.top = `${rect.top - 30}px`;
            
            document.body.appendChild(tooltip);
            
            tooltipTimeout = setTimeout(() => {
                tooltip.classList.add('visible');
            }, 100);
            
            this.addEventListener('mouseleave', function() {
                clearTimeout(tooltipTimeout);
                tooltip.remove();
            });
        });
    });
}

function confirmAction(action, message, callback) {
    document.getElementById('confirmModalText').textContent = message;
    document.getElementById('confirmModal').style.display = 'flex';
    
    document.getElementById('confirmAction').onclick = function() {
        callback();
        document.getElementById('confirmModal').style.display = 'none';
    };
    
    document.getElementById('cancelAction').onclick = function() {
        document.getElementById('confirmModal').style.display = 'none';
    };
}

function editCustomMarker(markerId) {
    const marker = customMarkers.find(m => m.id === markerId);
    if (!marker) return;
    
    document.getElementById('editMarkerName').value = marker.properties.name;
    document.getElementById('editMarkerDescription').value = marker.properties.description;
    document.getElementById('editMarkerCategory').value = marker.properties.subcategory;
    
    document.getElementById('editMarkerModal').style.display = 'flex';
    
    document.getElementById('saveEditedMarker').onclick = function() {
        const name = document.getElementById('editMarkerName').value;
        const description = document.getElementById('editMarkerDescription').value;
        const category = document.getElementById('editMarkerCategory').value;
        
        marker.properties.name = name;
        marker.properties.description = description;
        marker.properties.subcategory = category;
        
        objectManager.objects.remove(markerId);
        objectManager.objects.add(marker);
        
        document.getElementById('editMarkerModal').style.display = 'none';
        showNotification('Маркер успешно изменен');
    };
}

function deleteCustomMarker(markerId) {
    confirmAction('delete', 'Вы уверены, что хотите удалить этот маркер?', function() {
        customMarkers = customMarkers.filter(m => m.id !== markerId);
        objectManager.objects.remove(markerId);
        showNotification('Маркер удален');
    });
}

function addRoutePoint(coords) {
    if (!multiRoute) {
        multiRoute = new ymaps.multiRouter.MultiRoute({
            referencePoints: [],
            params: {
                routingMode: 'auto'
            }
        }, {
            boundsAutoApply: true,
            wayPointDraggable: true,
            viaPointDraggable: true,
            routeStrokeWidth: 3,
            routeActiveStrokeWidth: 5
        });
        
        map.geoObjects.add(multiRoute);
    }
    
    multiRoute.model.setReferencePoints(
        multiRoute.model.getReferencePoints().concat([coords])
    );
}

function clearMultiRoute() {
    if (multiRoute) {
        map.geoObjects.remove(multiRoute);
        multiRoute = null;
    }
}

function setupCollaborativeEditing() {
    const collaborationChannel = new BroadcastChannel('map-collaboration');
    
    collaborationChannel.addEventListener('message', function(event) {
        const data = event.data;
        
        switch(data.type) {
            case 'markerAdded':
                if (!objectManager.objects.getById(data.marker.id)) {
                    objectManager.objects.add(data.marker);
                }
                break;
            case 'markerUpdated':
                if (objectManager.objects.getById(data.marker.id)) {
                    objectManager.objects.remove(data.marker.id);
                    objectManager.objects.add(data.marker);
                }
                break;
            case 'markerDeleted':
                if (objectManager.objects.getById(data.markerId)) {
                    objectManager.objects.remove(data.markerId);
                }
                break;
            case 'viewChanged':
                if (data.center && data.zoom) {
                    map.setCenter(data.center, data.zoom);
                }
                break;
        }
    });
    
    map.events.add('boundschange', function() {
        collaborationChannel.postMessage({
            type: 'viewChanged',
            center: map.getCenter(),
            zoom: map.getZoom()
        });
    });
}

function shareToSocial(network) {
    let url = '';
    const text = currentPlace ? `Посмотрите ${currentPlace.properties.name} на FunMapApp` : 'Посмотрите эту карту на FunMapApp';
    
    if (currentPlace) {
        url = `${window.location.origin}${window.location.pathname}?place=${encodeURIComponent(currentPlace.id)}`;
    } else {
        url = window.location.href;
    }
    
    switch(network) {
        case 'facebook':
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
            break;
        case 'twitter':
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
            break;
        case 'vk':
            window.open(`https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`, '_blank');
            break;
    }
}

function toggleARMode() {
    if (!userLocation) {
        alert('Для использования AR-режима необходимо определить ваше местоположение');
        return;
    }
    
    if (document.getElementById('arOverlay').style.display === 'flex') {
        closeARMode();
        return;
    }
    
    document.getElementById('arOverlay').style.display = 'flex';
    
    if (navigator.xr) {
        navigator.xr.requestSession('immersive-ar').then(session => {
            arSession = session;
            setupARSession();
        }).catch(err => {
            console.error('AR session error:', err);
            fallbackARMode();
        });
    } else {
        fallbackARMode();
    }
}

function setupARSession() {
    const arVideo = document.getElementById('arVideo');
    const arCanvas = document.getElementById('arCanvas');
    const ctx = arCanvas.getContext('2d');
    
    arSession.addEventListener('end', () => {
        closeARMode();
    });
    
    function onXRFrame(time, frame) {
        const pose = frame.getViewerPose(arSession.refSpace);
        
        if (pose) {
            const view = pose.views[0];
            
            arCanvas.width = view.viewport.width;
            arCanvas.height = view.viewport.height;
            
            ctx.clearRect(0, 0, arCanvas.width, arCanvas.height);
            
            const nearbyPlaces = findNearbyPlaces(userLocation, 0.5, 10);
            nearbyPlaces.forEach(place => {
                const placeCoords = place.geometry.coordinates;
                const distance = getDistance(userLocation, placeCoords);
                const bearing = getBearing(userLocation, placeCoords);
                
                const x = arCanvas.width / 2 + (bearing - walkModeDirection) * 50;
                const y = arCanvas.height / 2 - distance * 100;
                
                if (x > 0 && x < arCanvas.width && y > 0 && y < arCanvas.height) {
                    ctx.fillStyle = '#4285F4';
                    ctx.beginPath();
                    ctx.arc(x, y, 10, 0, 2 * Math.PI);
                    ctx.fill();
                    
                    ctx.fillStyle = '#fff';
                    ctx.font = '12px Arial';
                    ctx.fillText(place.properties.name, x + 15, y + 5);
                }
            });
        }
        
        arSession.requestAnimationFrame(onXRFrame);
    }
    
    arSession.requestAnimationFrame(onXRFrame);
}

function getBearing(coords1, coords2) {
    const lat1 = coords1[0] * Math.PI / 180;
    const lon1 = coords1[1] * Math.PI / 180;
    const lat2 = coords2[0] * Math.PI / 180;
    const lon2 = coords2[1] * Math.PI / 180;
    
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - 
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    
    return Math.atan2(y, x);
}

function fallbackARMode() {
    const arVideo = document.getElementById('arVideo');
    const arCanvas = document.getElementById('arCanvas');
    const ctx = arCanvas.getContext('2d');
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(function(stream) {
                arVideo.srcObject = stream;
                arVideo.play();
                
                function updateARView() {
                    if (arVideo.paused || arVideo.ended) return;
                    
                    ctx.drawImage(arVideo, 0, 0, arCanvas.width, arCanvas.height);
                    
                    if (userLocation) {
                        const nearbyPlaces = findNearbyPlaces(userLocation, 0.5, 10);
                        nearbyPlaces.forEach(place => {
                            const placeCoords = place.geometry.coordinates;
                            const distance = getDistance(userLocation, placeCoords);
                            const bearing = getBearing(userLocation, placeCoords);
                            
                            const x = arCanvas.width / 2 + (bearing - walkModeDirection) * 50;
                            const y = arCanvas.height / 2 - distance * 100;
                            
                            if (x > 0 && x < arCanvas.width && y > 0 && y < arCanvas.height) {
                                ctx.fillStyle = '#4285F4';
                                ctx.beginPath();
                                ctx.arc(x, y, 10, 0, 2 * Math.PI);
                                ctx.fill();
                                
                                ctx.fillStyle = '#fff';
                                ctx.font = '12px Arial';
                                ctx.fillText(place.properties.name, x + 15, y + 5);
                            }
                        });
                    }
                    
                    requestAnimationFrame(updateARView);
                }
                
                arCanvas.width = arVideo.videoWidth;
                arCanvas.height = arVideo.videoHeight;
                updateARView();
            })
            .catch(function(error) {
                console.error('Camera access error:', error);
                arVideo.style.display = 'none';
            });
    } else {
        arVideo.style.display = 'none';
    }
}

function closeARMode() {
    document.getElementById('arOverlay').style.display = 'none';
    
    if (arSession) {
        arSession.end();
        arSession = null;
    }
    
    const video = document.getElementById('arVideo');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
}

function saveOfflineMap() {
    if (!navigator.storage || !navigator.storage.estimate) {
        alert('Оффлайн-карты не поддерживаются вашим браузером');
        return;
    }
    
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    
    const offlineData = {
        bounds: bounds,
        zoom: zoom,
        center: map.getCenter(),
        placemarks: allPlacemarks.filter(p => 
            bounds[0][0] <= p.geometry.coordinates[0] && 
            p.geometry.coordinates[0] <= bounds[1][0] && 
            bounds[0][1] <= p.geometry.coordinates[1] && 
            p.geometry.coordinates[1] <= bounds[1][1]
        ),
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('offlineMapData', JSON.stringify(offlineData));
    showNotification('Область карты сохранена для оффлайн использования');
}

function loadOfflineMap() {
    const offlineData = JSON.parse(localStorage.getItem('offlineMapData'));
    if (!offlineData) {
        alert('Нет сохраненных оффлайн-карт');
        return;
    }
    
    isOfflineMode = true;
    map.setBounds(offlineData.bounds, {checkZoomRange: true});
    objectManager.removeAll();
    objectManager.add(offlineData.placemarks);
    showNotification('Оффлайн-карта загружена');
}

function setupControls() {
    document.getElementById('locationButton').addEventListener('click', locateUser);
    document.getElementById('whatsNearbyBtn').addEventListener('click', showWhatsNearby);
    document.getElementById('arModeBtn').addEventListener('click', toggleARMode);
    document.getElementById('darkModeBtn').addEventListener('click', toggleDarkMode);
    document.getElementById('trafficBtn').addEventListener('click', toggleRealtimeTraffic);
    document.getElementById('saveOfflineBtn').addEventListener('click', saveOfflineMap);
    document.getElementById('loadOfflineBtn').addEventListener('click', loadOfflineMap);
    
    document.querySelector('.toggle-sidebar').addEventListener('click', function() {
        document.querySelector('.sidebar').classList.toggle('visible');
    });
    
    setupTooltips();
}

function generateInitialData() {
    const categories = [
        {id: 'cameras', name: 'Камеры', subcategories: ['traffic-cameras', 'security-cameras']},
        {id: 'places', name: 'Интересные места', subcategories: ['historical-places', 'viewpoints']},
        {id: 'entertainment', name: 'Развлечения', subcategories: ['parks', 'attractions']},
        {id: 'food', name: 'Еда', subcategories: ['restaurants', 'cafes', 'fastfood']},
        {id: 'shopping', name: 'Магазины', subcategories: ['malls', 'markets']},
        {id: 'sport', name: 'Спорт', subcategories: ['stadiums', 'gyms']},
        {id: 'tourism', name: 'Туризм', subcategories: ['hotels', 'hostels']},
        {id: 'sights', name: 'Достопримечательности', subcategories: ['monuments', 'museums', 'galleries', 'parks']}
    ];
    
    const placemarks = [];
    
    categories.forEach(category => {
        const count = 50 + Math.floor(Math.random() * 50);
        
        for (let i = 0; i < count; i++) {
            let coords, attempts = 0;
            let onLand = false;
            
            do {
                coords = [
                    russiaBounds[0][0] + Math.random() * (russiaBounds[1][0] - russiaBounds[0][0]),
                    russiaBounds[0][1] + Math.random() * (russiaBounds[1][1] - russiaBounds[0][1])
                ];
                attempts++;
                onLand = isOnLand(coords);
            } while (!onLand && attempts < 100);
            
            if (attempts >= 100) continue;
            
            const subcategory = category.subcategories[Math.floor(Math.random() * category.subcategories.length)];
            const popularity = Math.floor(Math.random() * 100);
            const rating = (Math.random() * 3 + 2).toFixed(1);
            const reviewsCount = Math.floor(Math.random() * 50);
            const visitsCount = Math.floor(Math.random() * 200);
            
            placemarks.push({
                id: `${category.id}-${i}`,
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: coords
                },
                properties: {
                    name: `${category.name} ${i + 1}`,
                    description: `Описание места ${i + 1} в категории ${category.name}. Это популярное место среди туристов и местных жителей.`,
                    category: category.id,
                    subcategory: subcategory,
                    popularity: popularity,
                    isHeritage: Math.random() > 0.9,
                    address: `ул. Примерная, ${Math.floor(Math.random() * 100) + 1}`,
                    phone: `+7 (${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 90) + 10}`,
                    hours: `${Math.floor(Math.random() * 3) + 8}:00 - ${Math.floor(Math.random() * 6) + 18}:00`,
                    rating: rating,
                    reviewsCount: reviewsCount,
                    visitsCount: visitsCount,
                    photos: generateRandomPhotos(category.id),
                    reviews: generateRandomReviews(reviewsCount),
                    features: generateRandomFeatures(),
                    events: generateRandomEvents()
                },
                options: {
                    preset: getPresetForCategory(category.id),
                    iconColor: getColorForCategory(category.id)
                }
            });
        }
    });
    
    culturalHeritagePlacemarks = [
        createCulturalPlacemark([55.752023, 37.617499], 'Большой театр', 'theater', 'sights'),
        createCulturalPlacemark([55.751244, 37.618423], 'Красная площадь', 'square', 'sights'),
        createCulturalPlacemark([55.744, 37.608], 'Третьяковская галерея', 'museum', 'sights'),
        createCulturalPlacemark([55.733, 37.587], 'Парк Горького', 'park', 'entertainment'),
        createCulturalPlacemark([59.934280, 30.335099], 'Эрмитаж', 'museum', 'sights'),
        createCulturalPlacemark([56.326887, 44.005986], 'Нижегородский кремль', 'fortress', 'sights'),
        createCulturalPlacemark([43.585525, 39.723062], 'Олимпийский парк Сочи', 'park', 'entertainment')
    ];
    
    allPlacemarks = [...placemarks, ...culturalHeritagePlacemarks];
    applyFilters();
}

function openPlaceModal(place) {
    currentPlace = place;
    document.getElementById('modalPlaceName').textContent = place.properties.name;
    document.getElementById('modalPlaceDescription').textContent = place.properties.description;
    document.getElementById('modalRating').textContent = place.properties.rating;
    document.getElementById('modalReviews').textContent = place.properties.reviewsCount;
    document.getElementById('modalVisits').textContent = place.properties.visitsCount;
    document.getElementById('modalAddress').textContent = place.properties.address;
    document.getElementById('modalCategory').textContent = place.properties.category;
    document.getElementById('modalPhone').textContent = place.properties.phone;
    document.getElementById('modalHours').textContent = place.properties.hours;
    
    $("#userRating").rateYo("rating", parseFloat(place.properties.rating));
    
    const reviewsList = document.getElementById('reviewsList');
    reviewsList.innerHTML = '';
    
    place.properties.reviews.forEach(review => {
        const reviewElement = document.createElement('div');
        reviewElement.className = 'review';
        reviewElement.innerHTML = `
            <div class="review-author">${review.author}</div>
            <div class="review-date">${review.date}</div>
            <div class="rating-container" data-rating="${review.rating}" style="margin: 5px 0;"></div>
            <div class="review-text">${review.text}</div>
        `;
        reviewsList.appendChild(reviewElement);
        
        $(reviewElement.querySelector('.rating-container')).rateYo({
            rating: parseFloat(review.rating),
            starWidth: "15px",
            readOnly: true
        });
    });
    
    const photoGallery = document.getElementById('photoGallery');
    photoGallery.innerHTML = '';
    currentPhotos = place.properties.photos;
    
    place.properties.photos.forEach((photo, index) => {
        const img = document.createElement('img');
        img.src = photo.url;
        img.alt = `Фото ${index + 1}`;
        img.className = 'photo-thumbnail';
        img.onclick = () => openPhotoModal(index);
        photoGallery.appendChild(img);
    });
    
    const nearbyPlacesList = document.getElementById('nearbyPlacesList');
    nearbyPlacesList.innerHTML = '';
    
    const nearbyPlaces = findNearbyPlaces(place.geometry.coordinates, 5);
    if (nearbyPlaces.length > 0) {
        nearbyPlaces.forEach(nearbyPlace => {
            const placeElement = document.createElement('div');
            placeElement.className = 'search-result-item';
            placeElement.innerHTML = `
                <div>${nearbyPlace.properties.name}</div>
                <div class="search-result-category">${nearbyPlace.properties.category}</div>
            `;
            placeElement.addEventListener('click', function() {
                map.setCenter(nearbyPlace.geometry.coordinates, 15);
                openPlaceModal(nearbyPlace);
                closeModal();
            });
            nearbyPlacesList.appendChild(placeElement);
        });
    } else {
        nearbyPlacesList.innerHTML = '<p>Нет мест поблизости</p>';
    }
    
    const featuresContainer = document.getElementById('placeFeatures');
    featuresContainer.innerHTML = '';
    
    place.properties.features.forEach(feature => {
        const chip = document.createElement('div');
        chip.className = 'feature-chip';
        chip.innerHTML = `<i class="fas fa-${feature.icon}"></i> ${feature.name}`;
        featuresContainer.appendChild(chip);
    });
    
    const eventsList = document.getElementById('eventsList');
    eventsList.innerHTML = '';
    
    if (place.properties.events.length > 0) {
        place.properties.events.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = 'event-card';
            eventElement.innerHTML = `
                <div class="event-date">${event.date}</div>
                <div class="event-title">${event.title}</div>
                <div>${event.description}</div>
            `;
            eventsList.appendChild(eventElement);
        });
    } else {
        eventsList.innerHTML = '<p>Нет предстоящих событий</p>';
    }
    
    document.getElementById('placeModal').style.display = 'flex';
}

function findNearbyPlaces(coords, radiusKm = 1, limit = 5) {
    const nearby = [];
    
    allPlacemarks.forEach(placemark => {
        if (placemark.id === currentPlace?.id) return;
        
        const distance = getDistance(coords, placemark.geometry.coordinates);
        if (distance <= radiusKm) {
            nearby.push({
                placemark: placemark,
                distance: distance
            });
        }
    });
    
    return nearby
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit)
        .map(item => item.placemark);
}

function getDistance(coords1, coords2) {
    const lat1 = coords1[0];
    const lon1 = coords1[1];
    const lat2 = coords2[0];
    const lon2 = coords2[1];
    
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function openPhotoModal(index) {
    currentPhotoIndex = index;
    document.getElementById('fullscreenPhoto').src = currentPhotos[index].url;
    document.getElementById('photoModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('placeModal').style.display = 'none';
}

function closePhotoModal() {
    document.getElementById('photoModal').style.display = 'none';
}

function closeReviewModal() {
    document.getElementById('reviewModal').style.display = 'none';
}

function closeSavedPlacesModal() {
    document.getElementById('savedPlacesModal').style.display = 'none';
}

function closeProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

function closeFriendsModal() {
    document.getElementById('friendsModal').style.display = 'none';
}

function closeAddFriendModal() {
    document.getElementById('addFriendModal').style.display = 'none';
}

function closeInstructionsModal() {
    document.getElementById('instructionsModal').style.display = 'none';
}

function closeARMode() {
    document.getElementById('arOverlay').style.display = 'none';
    const video = document.getElementById('arVideo');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
}

function closeCreateMarkerModal() {
    document.getElementById('createMarkerModal').style.display = 'none';
    isCreatingMarker = false;
}

function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
}

function closeCollaborationModal() {
    document.getElementById('collaborationModal').style.display = 'none';
}

function closeAnalyticsModal() {
    document.getElementById('analyticsModal').style.display = 'none';
}

function closeAccessibilityOptions() {
    document.getElementById('accessibilityOverlay').style.display = 'none';
}

function closeWhatsNearbyModal() {
    document.getElementById('whatsNearbyModal').style.display = 'none';
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

function closeEditMarkerModal() {
    document.getElementById('editMarkerModal').style.display = 'none';
}

function exitWalkMode() {
    isWalkModeActive = false;
    document.getElementById('walkModeOverlay').style.display = 'none';
    document.getElementById('walkModeMinimap').style.display = 'none';
    document.getElementById('walkModeBlueStreets').style.display = 'none';
    map.setCenter(walkModeStartPoint, 15);
}

function prevPhoto() {
    currentPhotoIndex = (currentPhotoIndex - 1 + currentPhotos.length) % currentPhotos.length;
    document.getElementById('fullscreenPhoto').src = currentPhotos[currentPhotoIndex].url;
}

function nextPhoto() {
    currentPhotoIndex = (currentPhotoIndex + 1) % currentPhotos.length;
    document.getElementById('fullscreenPhoto').src = currentPhotos[currentPhotoIndex].url;
}

function openTab(evt, tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove('active');
    }
    
    const tabs = document.getElementsByClassName('tab');
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }
    
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

function showReviewForm() {
    document.getElementById('reviewModal').style.display = 'flex';
}

function submitReview() {
    const rating = $("#reviewRating").rateYo("rating");
    const text = document.getElementById('reviewText').value;
    
    if (!text.trim()) {
        alert('Пожалуйста, напишите отзыв');
        return;
    }
    
    const newReview = {
        id: `review-${Math.random().toString(36).substr(2, 9)}`,
        author: 'Вы',
        rating: rating.toFixed(1),
        date: new Date().toLocaleDateString(),
        text: text
    };
    
    currentPlace.properties.reviews.push(newReview);
    currentPlace.properties.reviewsCount++;
    currentPlace.properties.rating = (
        (parseFloat(currentPlace.properties.rating) * (currentPlace.properties.reviewsCount - 1) + parseFloat(rating)) / 
        currentPlace.properties.reviewsCount
    ).toFixed(1);
    
    document.getElementById('modalRating').textContent = currentPlace.properties.rating;
    document.getElementById('modalReviews').textContent = currentPlace.properties.reviewsCount;
    
    const reviewsList = document.getElementById('reviewsList');
    const reviewElement = document.createElement('div');
    reviewElement.className = 'review';
    reviewElement.innerHTML = `
        <div class="review-author">${newReview.author}</div>
        <div class="review-date">${newReview.date}</div>
        <div class="rating-container" data-rating="${newReview.rating}" style="margin: 5px 0;"></div>
        <div class="review-text">${newReview.text}</div>
    `;
    reviewsList.insertBefore(reviewElement, reviewsList.firstChild);
    
    $(reviewElement.querySelector('.rating-container')).rateYo({
        rating: parseFloat(newReview.rating),
        starWidth: "15px",
        readOnly: true
    });
    
    document.getElementById('reviewText').value = '';
    closeReviewModal();
    openTab(null, 'reviews');
}

function ratePlace(placeId, rating) {
    alert(`Спасибо за оценку ${rating} для места ${placeId}!`);
}

function saveCurrentPlace() {
    if (!currentPlace) return;
    
    if (!savedPlaces.some(p => p.id === currentPlace.id)) {
        savedPlaces.push(currentPlace);
        localStorage.setItem('savedPlaces', JSON.stringify(savedPlaces));
        showNotification('Место сохранено в избранное!');
    } else {
        alert('Это место уже сохранено');
    }
}

function showSavedPlaces() {
    const savedPlacesList = document.getElementById('savedPlacesList');
    savedPlacesList.innerHTML = '';
    
    if (savedPlaces.length === 0) {
        savedPlacesList.innerHTML = '<p>У вас нет сохраненных мест</p>';
    } else {
        savedPlaces.forEach(place => {
            const placeElement = document.createElement('div');
            placeElement.className = 'search-result-item';
            placeElement.innerHTML = `
                <div>${place.properties.name}</div>
                <div class="search-result-category">${place.properties.category}</div>
            `;
            placeElement.addEventListener('click', function() {
                map.setCenter(place.geometry.coordinates, 15);
                openPlaceModal(place);
                closeSavedPlacesModal();
            });
            savedPlacesList.appendChild(placeElement);
        });
    }
    
    document.getElementById('savedPlacesModal').style.display = 'flex';
}

function toggleRoutePanel() {
    const panel = document.getElementById('routePanel');
    document.getElementById('sharePanel').style.display = 'none';
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
}

function toggleSharePanel() {
    const panel = document.getElementById('sharePanel');
    document.getElementById('routePanel').style.display = 'none';
    
    if (currentPlace) {
        const link = `${window.location.origin}${window.location.pathname}?place=${encodeURIComponent(currentPlace.id)}`;
        document.getElementById('shareLink').value = link;
        document.getElementById('embedCode').value = `<iframe src="${link}" width="600" height="400" frameborder="0" style="border:0" allowfullscreen></iframe>`;
    } else {
        const link = window.location.href;
        document.getElementById('shareLink').value = link;
        document.getElementById('embedCode').value = `<iframe src="${link}" width="600" height="400" frameborder="0" style="border:0" allowfullscreen></iframe>`;
    }
    
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
}

function shareMap() {
    if (navigator.share) {
        navigator.share({
            title: 'FunMapApp',
            text: 'Посмотрите эту карту в FunMapApp',
            url: document.getElementById('shareLink').value
        }).catch(err => {
            console.log('Ошибка при использовании Web Share API:', err);
        });
    } else {
        alert('Функция "Поделиться" доступна только в поддерживаемых браузерах. Скопируйте ссылку вручную.');
    }
}

function buildRoute() {
    if (!userLocation || !currentPlace) {
        alert('Необходимо определить ваше местоположение и выбрать место назначения');
        return;
    }
    
    const transportType = document.getElementById('transportType').value;
    let routingMode;
    
    switch (transportType) {
        case 'auto':
            routingMode = 'auto';
            break;
        case 'masstransit':
            routingMode = 'masstransit';
            break;
        case 'pedestrian':
            routingMode = 'pedestrian';
            break;
        case 'bicycle':
            routingMode = 'bicycle';
            break;
        default:
            routingMode = 'auto';
    }
    
    if (currentRoute) {
        map.geoObjects.remove(currentRoute);
    }
    
    ymaps.route([
        userLocation,
        currentPlace.geometry.coordinates
    ], {
        mapStateAutoApply: true,
        routingMode: routingMode
    }).then(function(route) {
        currentRoute = route;
        map.geoObjects.add(route);
        
        const routePanel = document.getElementById('routePanel');
        routePanel.innerHTML = `
            <div style="margin-bottom: 5px;">
                <strong>Расстояние:</strong> ${route.getHumanLength()}
            </div>
            <div style="margin-bottom: 5px;">
                <strong>Время:</strong> ${route.getHumanTime()}
            </div>
            <button onclick="clearRoute()">Очистить маршрут</button>
        `;
    }, function(error) {
        alert('Не удалось построить маршрут: ' + error.message);
    });
}

function clearRoute() {
    if (currentRoute) {
        map.geoObjects.remove(currentRoute);
        currentRoute = null;
        document.getElementById('routePanel').innerHTML = `
            <select id="transportType">
                <option value="auto">Автомобиль</option>
                <option value="masstransit">Общественный транспорт</option>
                <option value="pedestrian">Пешком</option>
                <option value="bicycle">Велосипед</option>
            </select>
            <button onclick="buildRoute()">Построить маршрут</button>
        `;
    }
}

function copyShareLink() {
    const shareLink = document.getElementById('shareLink');
    shareLink.select();
    document.execCommand('copy');
    showNotification('Ссылка скопирована в буфер обмена');
}

function updateWeatherInfo(coords) {
    if (!coords) {
        coords = userLocation || [55.7558, 37.6173];
    }
    
    const weatherTypes = [
        {type: 'clear', icon: 'fa-sun', desc: 'Ясно', color: '#f39c12'},
        {type: 'clouds', icon: 'fa-cloud', desc: 'Облачно', color: '#95a5a6'},
        {type: 'rain', icon: 'fa-cloud-rain', desc: 'Дождь', color: '#3498db'},
        {type: 'snow', icon: 'fa-snowflake', desc: 'Снег', color: '#ecf0f1'},
        {type: 'thunderstorm', icon: 'fa-bolt', desc: 'Гроза', color: '#9b59b6'}
    ];
    
    const randomWeather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
    const randomTemp = Math.floor(Math.random() * 30) - 5;
    const windSpeed = Math.floor(Math.random() * 10) + 1;
    const humidity = Math.floor(Math.random() * 50) + 30;
    const precipitation = Math.floor(Math.random() * 30);
    
    document.getElementById('weatherMainIcon').className = `fas ${randomWeather.icon} weather-icon`;
    document.getElementById('weatherMainIcon').style.color = randomWeather.color;
    document.getElementById('weatherTemp').textContent = `${randomTemp > 0 ? '+' : ''}${randomTemp}°C`;
    document.getElementById('weatherDesc').textContent = randomWeather.desc;
    document.getElementById('weatherWind').textContent = `${windSpeed} м/с`;
    document.getElementById('weatherHumidity').textContent = `${humidity}%`;
    document.getElementById('weatherPrecip').textContent = `${precipitation}%`;
    
    if (coords) {
        getLocationName(coords);
    }
}

function toggleMusic() {
    if (isMusicPlaying) {
        music.pause();
        musicIcon.classList.remove('fa-pause');
        musicIcon.classList.add('fa-play');
    } else {
        music.play();
        musicIcon.classList.remove('fa-play');
        musicIcon.classList.add('fa-pause');
    }
    isMusicPlaying = !isMusicPlaying;
}

function changeVolume() {
    music.volume = document.getElementById('musicVolume').value / 100;
}

function toggleProfileMenu() {
    document.getElementById('profileMenu').classList.toggle('show');
}

function showProfile() {
    document.getElementById('profileModal').style.display = 'flex';
    document.getElementById('profileMenu').classList.remove('show');
}

function showSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
    document.getElementById('profileMenu').classList.remove('show');
}

function showFriends() {
    const friendsList = document.getElementById('friendsList');
    friendsList.innerHTML = '';
    
    friends.forEach(friend => {
        const friendElement = document.createElement('div');
        friendElement.className = 'friend-item';
        friendElement.innerHTML = `
            <div class="friend-avatar">${friend.avatar}</div>
            <div class="friend-info">
                <div class="friend-name">${friend.name}</div>
                <div class="friend-status ${friend.online ? 'online' : ''}">
                    ${friend.online ? 'В сети' : 'Не в сети'}
                </div>
            </div>
        `;
        friendElement.addEventListener('click', function() {
            showFriendProfile(friend);
        });
        friendsList.appendChild(friendElement);
    });
    
    document.getElementById('friendsModal').style.display = 'flex';
    document.getElementById('profileMenu').classList.remove('show');
}

function showFriendProfile(friend) {
    alert(`Просмотр профиля друга: ${friend.name}`);
}

function showAddFriendModal() {
    document.getElementById('addFriendModal').style.display = 'flex';
}

function addFriend() {
    const friendInput = document.getElementById('friendSearchInput').value;
    if (!friendInput) {
        alert('Пожалуйста, введите email или имя пользователя');
        return;
    }
    
    const newFriend = {
        id: friends.length + 1,
        name: friendInput,
        avatar: friendInput.substring(0, 2).toUpperCase(),
        online: true
    };
    
    friends.push(newFriend);
    showNotification('Друг добавлен');
    closeAddFriendModal();
    showFriends();
}

function showARMode() {
    if (!userLocation) {
        alert('Для использования AR-режима необходимо определить ваше местоположение');
        return;
    }
    
    document.getElementById('arOverlay').style.display = 'flex';
    document.getElementById('profileMenu').classList.remove('show');
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(function(stream) {
                const video = document.getElementById('arVideo');
                video.srcObject = stream;
            })
            .catch(function(error) {
                console.error('Ошибка доступа к камере:', error);
                document.getElementById('arVideo').style.display = 'none';
            });
    } else {
        document.getElementById('arVideo').style.display = 'none';
    }
}

function switchARCamera() {
    const video = document.getElementById('arVideo');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    
    const facingMode = video.getAttribute('data-facing-mode') || 'user';
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    
    navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode }
    }).then(function(stream) {
        video.srcObject = stream;
        video.setAttribute('data-facing-mode', newFacingMode);
    }).catch(function(error) {
        console.error('Ошибка переключения камеры:', error);
    });
}

function showInstructions() {
    document.getElementById('instructionsModal').style.display = 'flex';
    document.getElementById('profileMenu').classList.remove('show');
}

function logout() {
    document.getElementById('profileMenu').classList.remove('show');
    document.querySelector('.user-profile').style.display = 'none';
    document.getElementById('loginBtn').style.display = 'block';
    showNotification('Вы успешно вышли из системы');
}

function goToLoginPage() {
    window.location.href = 'login.html';
}

function createCustomMarker() {
    isCreatingMarker = true;
    alert('Кликните правой кнопкой мыши на карте, чтобы создать маркер');
}

function saveCustomMarker() {
    const name = document.getElementById('markerName').value;
    const description = document.getElementById('markerDescription').value;
    const category = document.getElementById('markerCategory').value;
    
    if (!name) {
        alert('Пожалуйста, укажите название маркера');
        return;
    }
    
    if (!pendingMarkerCoords) {
        alert('Не удалось определить координаты маркера');
        return;
    }
    
    const newMarker = {
        id: `custom-${Math.random().toString(36).substr(2, 9)}`,
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: pendingMarkerCoords
        },
        properties: {
            name: name,
            description: description,
            category: 'custom',
            subcategory: category,
            popularity: 50,
            isHeritage: false,
            address: 'Пользовательский маркер',
            phone: '',
            hours: '',
            rating: '5.0',
            reviewsCount: 0,
            visitsCount: 1,
            photos: [],
            reviews: [],
            features: [],
            events: []
        },
        options: {
            preset: 'islands#greenDotIcon',
            iconColor: '#2ecc71'
        }
    };
    
    customMarkers.push(newMarker);
    objectManager.objects.add(newMarker);
    
    document.getElementById('markerName').value = '';
    document.getElementById('markerDescription').value = '';
    document.getElementById('markerCategory').value = 'custom';
    
    closeCreateMarkerModal();
    showNotification('Маркер успешно создан!');
}

function toggleMapType() {
    const mapTypes = ['map', 'satellite', 'hybrid'];
    const currentIndex = mapTypes.indexOf(mapType);
    const nextIndex = (currentIndex + 1) % mapTypes.length;
    mapType = mapTypes[nextIndex];
    
    switch (mapType) {
        case 'map':
            map.setType('yandex#map');
            break;
        case 'satellite':
            map.setType('yandex#satellite');
            break;
        case 'hybrid':
            map.setType('yandex#hybrid');
            break;
    }
}

function toggleTraffic() {
    if (!trafficLayer) {
        trafficLayer = new ymaps.TrafficLayer({
            providerKey: 'traffic#actual'
        });
        map.layers.add(trafficLayer);
        showNotification('Пробки включены');
    } else {
        map.layers.remove(trafficLayer);
        trafficLayer = null;
        showNotification('Пробки выключены');
    }
}

function showAccessibilityOptions() {
    document.getElementById('accessibilityOverlay').style.display = 'flex';
}

function applyAccessibilityOptions() {
    const highContrast = document.getElementById('highContrastMode').checked;
    const largeText = document.getElementById('textSizeLarge').checked;
    const voiceGuide = document.getElementById('voiceGuide').checked;
    
    if (highContrast) {
        document.body.style.filter = 'contrast(120%)';
    } else {
        document.body.style.filter = '';
    }
    
    if (largeText) {
        document.body.style.fontSize = '18px';
    } else {
        document.body.style.fontSize = '';
    }
    
    if (voiceGuide) {
        alert('Голосовое сопровождение включено');
    }
    
    closeAccessibilityOptions();
    showNotification('Настройки доступности применены');
}

function toggleOfflineMode() {
    isOfflineMode = !isOfflineMode;
    if (isOfflineMode) {
        showNotification('Оффлайн-режим включен. Некоторые функции могут быть недоступны.');
    } else {
        showNotification('Оффлайн-режим выключен.');
    }
}

function addToHistory(coords) {
    const timestamp = new Date().toLocaleString();
    userHistory.push({
        coords: coords,
        timestamp: timestamp
    });
    
    localStorage.setItem('userHistory', JSON.stringify(userHistory));
}

function loadUserHistory() {
    const savedHistory = localStorage.getItem('userHistory');
    if (savedHistory) {
        userHistory = JSON.parse(savedHistory);
    }
}

function showHistory() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    
    if (userHistory.length === 0) {
        historyList.innerHTML = '<p>История перемещений пуста</p>';
    } else {
        userHistory.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'search-result-item';
            historyItem.innerHTML = `
                <div>${item.timestamp}</div>
                <div class="search-result-category">Широта: ${item.coords[0].toFixed(4)}, Долгота: ${item.coords[1].toFixed(4)}</div>
            `;
            historyItem.addEventListener('click', function() {
                map.setCenter(item.coords, 15);
                closeHistoryModal();
            });
            historyList.appendChild(historyItem);
        });
    }
    
    document.getElementById('historyModal').style.display = 'flex';
}

function loadCollaborators() {
    const savedCollaborators = localStorage.getItem('collaborators');
    if (savedCollaborators) {
        collaborators = JSON.parse(savedCollaborators);
    }
}

function showCollaboration() {
    const collaboratorsList = document.getElementById('collaboratorsList');
    collaboratorsList.innerHTML = '';
    
    if (collaborators.length === 0) {
        collaboratorsList.innerHTML = '<p>Нет участников совместного редактирования</p>';
    } else {
        collaborators.forEach(collaborator => {
            const collaboratorItem = document.createElement('div');
            collaboratorItem.className = 'friend-item';
            collaboratorItem.innerHTML = `
                <div class="friend-avatar">${collaborator.avatar}</div>
                <div class="friend-info">
                    <div class="friend-name">${collaborator.name}</div>
                    <div class="friend-status">Участник</div>
                </div>
            `;
            collaboratorsList.appendChild(collaboratorItem);
        });
    }
    
    document.getElementById('collaborationModal').style.display = 'flex';
}

function saveCollaboration() {
    const inviteInput = document.getElementById('collaborationInvite').value;
    if (inviteInput) {
        const newCollaborator = {
            id: collaborators.length + 1,
            name: inviteInput,
            avatar: inviteInput.substring(0, 2).toUpperCase()
        };
        
        collaborators.push(newCollaborator);
        localStorage.setItem('collaborators', JSON.stringify(collaborators));
        showNotification('Участник добавлен');
        showCollaboration();
    }
}

function showAnalytics() {
    document.getElementById('analyticsModal').style.display = 'flex';
}

function changeAvatar() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = event => {
                const avatarPlaceholder = document.querySelector('.avatar-placeholder');
                avatarPlaceholder.innerHTML = '';
                const img = document.createElement('img');
                img.src = event.target.result;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.borderRadius = '50%';
                avatarPlaceholder.appendChild(img);
                
                const profileAvatar = document.querySelector('.user-profile');
                profileAvatar.innerHTML = '';
                const profileImg = document.createElement('img');
                profileImg.src = event.target.result;
                profileImg.style.width = '100%';
                profileImg.style.height = '100%';
                profileImg.style.borderRadius = '50%';
                profileImg.style.objectFit = 'cover';
                profileAvatar.appendChild(profileImg);
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

function saveProfile() {
    showNotification('Профиль сохранен');
    closeProfileModal();
}

function saveSettings() {
    showNotification('Настройки сохранены');
    closeSettingsModal();
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    document.getElementById('notificationText').textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function getPresetForCategory(category) {
    const presets = {
        'cameras': 'islands#blueCameraIcon',
        'places': 'islands#blueHomeIcon',
        'entertainment': 'islands#blueEntertainmentIcon',
        'food': 'islands#blueFoodIcon',
        'shopping': 'islands#blueShoppingIcon',
        'sport': 'islands#blueSportIcon',
        'tourism': 'islands#blueTourismIcon',
        'sights': 'islands#blueMonumentIcon'
    };
    
    return presets[category] || 'islands#blueCircleIcon';
}

function getColorForCategory(category) {
    const colors = {
        'cameras': '#3498db',
        'places': '#2ecc71',
        'entertainment': '#f39c12',
        'food': '#e74c3c',
        'shopping': '#9b59b6',
        'sport': '#1abc9c',
        'tourism': '#34495e',
        'sights': '#d35400'
    };
    
    return colors[category] || '#7f8c8d';
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('visible');
}

function viewAllRussia() {
    map.setBounds(russiaBounds, {checkZoomRange: true});
    applyFilters();
}

function startWalkMode() {
    if (!userLocation) {
        alert('Для использования режима прогулки необходимо определить ваше местоположение');
        return;
    }
    
    isWalkModeActive = true;
    walkModeStartPoint = userLocation;
    walkModeCurrentPosition = [...userLocation];
    walkModeDirection = 0;
    
    highlightStreetsNearby(userLocation);
    
    document.getElementById('walkModeOverlay').style.display = 'flex';
    document.getElementById('walkModeMinimap').style.display = 'block';
    document.getElementById('walkModeBlueStreets').style.display = 'block';
    
    map.setCenter(walkModeStartPoint, 18);
}

function highlightStreetsNearby(coords) {
    const blueStreetsContainer = document.getElementById('walkModeBlueStreets');
    blueStreetsContainer.innerHTML = '';
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    
    const streets = [
        {points: [[-0.001, -0.002], [0.001, -0.002], [0.001, 0.002], [-0.001, 0.002]]},
        {points: [[-0.002, -0.001], [-0.002, 0.001], [0.002, 0.001], [0.002, -0.001]]}
    ];
    
    streets.forEach(street => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let pathData = 'M ';
        
        street.points.forEach((point, index) => {
            const x = 50 + point[0] * 10000;
            const y = 50 + point[1] * 10000;
            pathData += (index === 0 ? '' : ' L ') + x + ' ' + y;
        });
        
        path.setAttribute('d', pathData + ' Z');
        path.setAttribute('class', 'walk-mode-blue-street');
        svg.appendChild(path);
    });
    
    blueStreetsContainer.appendChild(svg);
}

function moveForward() {
    if (!isWalkModeActive) return;
    
    const distance = 0.0001;
    walkModeCurrentPosition[0] += Math.sin(walkModeDirection) * distance;
    walkModeCurrentPosition[1] += Math.cos(walkModeDirection) * distance;
    
    updateWalkModePosition();
}

function moveBackward() {
    if (!isWalkModeActive) return;
    
    const distance = 0.0001;
    walkModeCurrentPosition[0] -= Math.sin(walkModeDirection) * distance;
    walkModeCurrentPosition[1] -= Math.cos(walkModeDirection) * distance;
    
    updateWalkModePosition();
}

function turnLeft() {
    if (!isWalkModeActive) return;
    
    walkModeDirection += Math.PI / 8;
    updateWalkModePosition();
}

function turnRight() {
    if (!isWalkModeActive) return;
    
    walkModeDirection -= Math.PI / 8;
    updateWalkModePosition();
}

function updateWalkModePosition() {
    map.setCenter(walkModeCurrentPosition, 18);
    
    document.querySelector('.walk-mode-position').textContent = 
        `${walkModeCurrentPosition[0].toFixed(6)}, ${walkModeCurrentPosition[1].toFixed(6)}`;
    
    const minimap = document.getElementById('walkModeMinimap');
    minimap.innerHTML = '';
    
    const minimapContent = document.createElement('div');
    minimapContent.style.width = '100%';
    minimapContent.style.height = '100%';
    minimapContent.style.background = '#f0f0f0';
    minimapContent.style.position = 'relative';
    
    const positionMarker = document.createElement('div');
    positionMarker.style.width = '10px';
    positionMarker.style.height = '10px';
    positionMarker.style.background = '#4285F4';
    positionMarker.style.borderRadius = '50%';
    positionMarker.style.position = 'absolute';
    positionMarker.style.left = '50%';
    positionMarker.style.top = '50%';
    positionMarker.style.transform = 'translate(-50%, -50%)';
    
    const directionMarker = document.createElement('div');
    directionMarker.style.width = '0';
    directionMarker.style.height = '0';
    directionMarker.style.borderLeft = '5px solid transparent';
    directionMarker.style.borderRight = '5px solid transparent';
    directionMarker.style.borderBottom = '10px solid #EA4335';
    directionMarker.style.position = 'absolute';
    directionMarker.style.left = '50%';
    directionMarker.style.top = '40%';
    directionMarker.style.transform = `translate(-50%, -50%) rotate(${walkModeDirection}rad)`;
    
    minimapContent.appendChild(positionMarker);
    minimapContent.appendChild(directionMarker);
    minimap.appendChild(minimapContent);
}

function translatePage(lang) {
    if (lang === currentLanguage) return;
    
    currentLanguage = lang;
    
    document.querySelectorAll('.language-switch button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    event.target.classList.add('active');
    
    if (lang === 'en') {
        document.querySelector('h1').innerText = 'FunMapApp';
        document.querySelector('.banner-text').innerText = 'Discover the world with FunMapApp';
        document.querySelector('.search-box').placeholder = 'Search places...';
        document.querySelector('.sidebar h3:nth-of-type(1)').innerText = 'Popularity filter';
        document.querySelector('.sidebar h3:nth-of-type(2)').innerText = 'Categories';
        document.querySelector('.filter-range div span:first-child').innerText = 'Low';
        document.querySelector('.filter-range div span:last-child').innerText = 'High';
        document.querySelector('#heritageCheckbox').nextSibling.textContent = ' Only cultural heritage';
        document.querySelector('#landOnlyCheckbox').nextSibling.textContent = ' Land only';
        document.querySelector('.view-all-btn').innerText = 'Show all in Russia';
        
        const categoryTranslations = {
            'Камеры': 'Cameras',
            'Интересные места': 'Interesting places',
            'Развлечения': 'Entertainment',
            'Еда': 'Food',
            'Магазины': 'Shopping',
            'Спорт': 'Sports',
            'Туризм': 'Tourism',
            'Достопримечательности': 'Attractions',
            'Дорожные камеры': 'Traffic cameras',
            'Камеры наблюдения': 'Security cameras',
            'Исторические места': 'Historical places',
            'Обзорные площадки': 'Viewpoints',
            'Парки': 'Parks',
            'Аттракционы': 'Attractions',
            'Рестораны': 'Restaurants',
            'Кафе': 'Cafes',
            'Фастфуд': 'Fast food',
            'Торговые центры': 'Shopping malls',
            'Рынки': 'Markets',
            'Стадионы': 'Stadiums',
            'Спортзалы': 'Gyms',
            'Отели': 'Hotels',
            'Хостелы': 'Hostels',
            'Памятники': 'Monuments',
            'Музеи': 'Museums',
            'Галереи': 'Galleries'
        };
        
        document.querySelectorAll('.filter-category-label, .filter-subcategory-label').forEach(label => {
            const text = label.textContent.trim();
            if (categoryTranslations[text]) {
                label.textContent = categoryTranslations[text];
            }
        });
        
        if (document.getElementById('placeModal').style.display === 'flex') {
            document.querySelector('.modal-title').innerText = currentPlace.properties.name;
            document.querySelector('.tab:nth-child(1)').innerText = 'Info';
            document.querySelector('.tab:nth-child(2)').innerText = 'Reviews';
            document.querySelector('.tab:nth-child(3)').innerText = 'Photos';
            document.querySelector('.tab:nth-child(4)').innerText = 'Nearby';
            document.querySelector('.tab:nth-child(5)').innerText = 'Events';
            document.querySelector('.stat-label:nth-child(1)').innerText = 'Rating';
            document.querySelector('.stat-label:nth-child(2)').innerText = 'Reviews';
            document.querySelector('.stat-label:nth-child(3)').innerText = 'Visits';
            document.querySelector('.add-review-btn').innerText = 'Add review';
        }
    } else {
        document.querySelector('h1').innerText = 'FunMapApp';
        document.querySelector('.banner-text').innerText = 'Откройте для себя мир с FunMapApp';
        document.querySelector('.search-box').placeholder = 'Поиск мест...';
        document.querySelector('.sidebar h3:nth-of-type(1)').innerText = 'Фильтр по популярности';
        document.querySelector('.sidebar h3:nth-of-type(2)').innerText = 'Категории';
        document.querySelector('.filter-range div span:first-child').innerText = 'Низкая';
        document.querySelector('.filter-range div span:last-child').innerText = 'Высокая';
        document.querySelector('#heritageCheckbox').nextSibling.textContent = ' Только культурное наследие';
        document.querySelector('#landOnlyCheckbox').nextSibling.textContent = ' Только на суше';
        document.querySelector('.view-all-btn').innerText = 'Показать все по России';
        
        const categoryTranslations = {
            'Cameras': 'Камеры',
            'Interesting places': 'Интересные места',
            'Entertainment': 'Развлечения',
            'Food': 'Еда',
            'Shopping': 'Магазины',
            'Sports': 'Спорт',
            'Tourism': 'Туризм',
            'Attractions': 'Достопримечательности',
            'Traffic cameras': 'Дорожные камеры',
            'Security cameras': 'Камеры наблюдения',
            'Historical places': 'Исторические места',
            'Viewpoints': 'Обзорные площадки',
            'Parks': 'Парки',
            'Attractions': 'Аттракционы',
            'Restaurants': 'Рестораны',
            'Cafes': 'Кафе',
            'Fast food': 'Фастфуд',
            'Shopping malls': 'Торговые центры',
            'Markets': 'Рынки',
            'Stadiums': 'Стадионы',
            'Gyms': 'Спортзалы',
            'Hotels': 'Отели',
            'Hostels': 'Хостелы',
            'Monuments': 'Памятники',
            'Museums': 'Музеи',
            'Galleries': 'Галереи'
        };
        
        document.querySelectorAll('.filter-category-label, .filter-subcategory-label').forEach(label => {
            const text = label.textContent.trim();
            if (categoryTranslations[text]) {
                label.textContent = categoryTranslations[text];
            }
        });
        
        if (document.getElementById('placeModal').style.display === 'flex') {
            document.querySelector('.modal-title').innerText = currentPlace.properties.name;
            document.querySelector('.tab:nth-child(1)').innerText = 'Информация';
            document.querySelector('.tab:nth-child(2)').innerText = 'Отзывы';
            document.querySelector('.tab:nth-child(3)').innerText = 'Фото';
            document.querySelector('.tab:nth-child(4)').innerText = 'Рядом';
            document.querySelector('.tab:nth-child(5)').innerText = 'События';
            document.querySelector('.stat-label:nth-child(1)').innerText = 'Рейтинг';
            document.querySelector('.stat-label:nth-child(2)').innerText = 'Отзывов';
            document.querySelector('.stat-label:nth-child(3)').innerText = 'Посещений';
            document.querySelector('.add-review-btn').innerText = 'Добавить отзыв';
        }
    }
}

window.addEventListener('load', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const placeId = urlParams.get('place');
    
    if (placeId) {
        const place = allPlacemarks.find(p => p.id === placeId);
        if (place) {
            map.setCenter(place.geometry.coordinates, 15);
            openPlaceModal(place);
        }
    }
});

window.addEventListener('click', function(event) {
    if (!event.target.closest('.user-profile') && !event.target.closest('.user-profile-menu')) {
        document.getElementById('profileMenu').classList.remove('show');
    }
});