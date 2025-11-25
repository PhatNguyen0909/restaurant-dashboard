import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './DroneMap.css';
import merchantAPI from '../../api/merchantAPI';

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const DroneMap = ({ 
  merchantLocation, // { lat, lng, name }
  deliveryLocation, // { lat, lng, address }
  droneLocation,
  droneId,
  droneStatus,
  orderStatus = 'CONFIRMED',
  autoAnimate = true,
  orderKey,
  canStartDelivery = false,
  onStartDelivery,
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const droneMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [dronePosition, setDronePosition] = useState(0); // 0-100%
  const movementTimerRef = useRef(null);
  const lastApiUpdateRef = useRef(0);


  const [pickupArrived, setPickupArrived] = useState(false);


  const merchantLat = toNumberOrNull(merchantLocation?.lat);
  const merchantLng = toNumberOrNull(merchantLocation?.lng);
  const merchantName = merchantLocation?.name;
  const deliveryLat = toNumberOrNull(deliveryLocation?.lat);
  const deliveryLng = toNumberOrNull(deliveryLocation?.lng);
  const deliveryAddress = deliveryLocation?.address;
  const droneLat = toNumberOrNull(droneLocation?.lat);
  const droneLng = toNumberOrNull(droneLocation?.lng);

  // Reset pickupArrived and dronePosition and force movement phase restart when switching to delivery phase
  const [deliveryKey, setDeliveryKey] = useState(0);
  useEffect(() => {
    if (orderStatus === 'DELIVERING') {
      setPickupArrived(false);
      setDronePosition(0);
      // Do NOT reset drone position to merchant, always use current drone position for both phases
      setDeliveryKey(k => k + 1); // force movementPhaseKey to change
    }
  }, [orderStatus]);



  // ...existing code...
  const [liveDroneCoords, setLiveDroneCoords] = useState(() => {
    if (droneLat === null || droneLng === null) return null;
    return { lat: droneLat, lng: droneLng };
  });
  const [liveDroneStatus, setLiveDroneStatus] = useState(droneStatus ?? null);

  useEffect(() => {
    if (droneLat !== null && droneLng !== null) {
      setLiveDroneCoords({ lat: droneLat, lng: droneLng });
    }
  }, [droneLat, droneLng]);

  useEffect(() => {
    setLiveDroneStatus(droneStatus ?? null);
  }, [droneStatus]);

  const effectiveDroneLat = toNumberOrNull(liveDroneCoords?.lat ?? droneLat);
  const effectiveDroneLng = toNumberOrNull(liveDroneCoords?.lng ?? droneLng);
  const hasDroneCoords = effectiveDroneLat !== null && effectiveDroneLng !== null;
  const currentDroneStatus = liveDroneStatus || droneStatus;
  const isDeliveryPhase = orderStatus === 'DELIVERING' || orderStatus === 'COMPLETED' || orderStatus === 'DRONE_ARRIVED';
  const isPickupPhase = !isDeliveryPhase && (orderStatus === 'READY' || currentDroneStatus === 'TO_PICKUP') && hasDroneCoords;

  const activeRoute = useMemo(() => {
    if (isDeliveryPhase && merchantLat != null && merchantLng != null && deliveryLat != null && deliveryLng != null) {
      return [
        [merchantLat, merchantLng],
        [deliveryLat, deliveryLng],
      ];
    }
    if (isPickupPhase && hasDroneCoords && merchantLat != null && merchantLng != null) {
      return [
        [effectiveDroneLat, effectiveDroneLng],
        [merchantLat, merchantLng],
      ];
    }
    if (merchantLat != null && merchantLng != null && deliveryLat != null && deliveryLng != null) {
      return [
        [merchantLat, merchantLng],
        [deliveryLat, deliveryLng],
      ];
    }
    return [];
  }, [isPickupPhase, isDeliveryPhase, hasDroneCoords, effectiveDroneLat, effectiveDroneLng, merchantLat, merchantLng, deliveryLat, deliveryLng]);

  // Check if Leaflet is loaded
  useEffect(() => {
    const checkLeaflet = setInterval(() => {
      if (window.L) {
        setMapLoaded(true);
        clearInterval(checkLeaflet);
      }
    }, 100);

    return () => clearInterval(checkLeaflet);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return;
    if (merchantLat == null || merchantLng == null || deliveryLat == null || deliveryLng == null) return;

    const merchantCoords = [merchantLat, merchantLng];
    const deliveryCoords = [deliveryLat, deliveryLng];

    // Calculate center between two points
    const centerLat = (merchantLat + deliveryLat) / 2;
    const centerLng = (merchantLng + deliveryLng) / 2;

    // Create map
    mapInstanceRef.current = window.L.map(mapRef.current).setView([centerLat, centerLng], 13);

    // Add OpenStreetMap tile layer
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);

    // Merchant marker (red)
    const redIcon = window.L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    window.L.marker(merchantCoords, { icon: redIcon })
      .addTo(mapInstanceRef.current)
      .bindPopup(`🏪 ${merchantName || 'Cửa hàng'}`)
      .openPopup();

    // Delivery location marker (green)
    const greenIcon = window.L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    window.L.marker(deliveryCoords, { icon: greenIcon })
      .addTo(mapInstanceRef.current)
      .bindPopup(`📍 ${deliveryAddress || 'Địa chỉ giao hàng'}`);

    // Draw route line (dashed blue line)
    polylineRef.current = window.L.polyline([merchantCoords, deliveryCoords], {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.7,
      dashArray: '10, 10',
      lineJoin: 'round'
    }).addTo(mapInstanceRef.current);

    // Create custom drone icon
    const droneIcon = window.L.divIcon({
      html: `
        <div class="drone-marker">
          <div class="drone-icon">✈️</div>
          <div class="drone-shadow"></div>
        </div>
      `,
      className: 'custom-drone-icon',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    // Drone marker
    droneMarkerRef.current = window.L.marker(merchantCoords, {
      icon: droneIcon,
      zIndexOffset: 1000
    }).addTo(mapInstanceRef.current);

    // Fit bounds to show both markers
    const bounds = window.L.latLngBounds([merchantCoords, deliveryCoords]);
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });

    setMapReady(true);

    return () => {
      if (movementTimerRef.current) {
        clearInterval(movementTimerRef.current);
        movementTimerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setMapReady(false);
    };
  }, [mapLoaded, merchantLat, merchantLng, merchantName, deliveryLat, deliveryLng, deliveryAddress]);

  // Update primary route polyline based on current phase
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !polylineRef.current) return;
    if (activeRoute.length < 2) return;

    polylineRef.current.setLatLngs(activeRoute);
    polylineRef.current.setStyle(isPickupPhase
      ? { color: '#f97316', weight: 3, dashArray: '6, 8', opacity: 0.9 }
      : { color: '#3b82f6', weight: 3, dashArray: '10, 10', opacity: 0.7 }
    );

    const bounds = window.L.latLngBounds(activeRoute);
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
  }, [mapReady, activeRoute, isPickupPhase]);

  const applyBackendDroneUpdate = useCallback((payload) => {
    if (!payload) return;
    const backendLat = toNumberOrNull(payload.latitude ?? payload.lat);
    const backendLng = toNumberOrNull(payload.longitude ?? payload.lng ?? payload.long);
    if (backendLat !== null && backendLng !== null) {
      setLiveDroneCoords({ lat: backendLat, lng: backendLng });
    }
    if (payload.status) {
      setLiveDroneStatus(payload.status);
    }
  }, []);

  const pushDroneLocationUpdate = useCallback((lat, lng) => {
    if (!droneId) return;
    merchantAPI
      .updateDroneLocation(droneId, lat, lng)
      .then((updated) => {
        if (updated) {
          applyBackendDroneUpdate(updated);
        }
      })
      .catch((err) => {
        console.error('Failed to sync drone location', err);
      });
  }, [droneId, applyBackendDroneUpdate]);

  // Step-by-step drone movement (matches admin map style)
  // Add a key that changes when phase switches to force animation restart
  const movementPhaseKey = `${orderStatus}-${deliveryKey}`;
  useEffect(() => {
    if (movementTimerRef.current) {
      clearInterval(movementTimerRef.current);
      movementTimerRef.current = null;
    }

    if (!mapReady || !mapInstanceRef.current || !droneMarkerRef.current) return;
    if (merchantLat == null || merchantLng == null || deliveryLat == null || deliveryLng == null) return;
    if (!autoAnimate) return;

    let startCoords = null;
    let endCoords = null;
    let phaseType = null;

    if (isPickupPhase && hasDroneCoords) {
      startCoords = [effectiveDroneLat, effectiveDroneLng];
      endCoords = [merchantLat, merchantLng];
      phaseType = 'pickup';
    } else if (isDeliveryPhase && hasDroneCoords) {
      startCoords = [effectiveDroneLat, effectiveDroneLng];
      endCoords = [deliveryLat, deliveryLng];
      phaseType = 'delivery';
    }

    if (!startCoords || !endCoords) return;

    // Check if already arrived (or very close)
    const dist = Math.sqrt(Math.pow(endCoords[0] - startCoords[0], 2) + Math.pow(endCoords[1] - startCoords[1], 2));
    if (dist < 0.0001) {
      droneMarkerRef.current.setLatLng(endCoords);
      setLiveDroneCoords({ lat: endCoords[0], lng: endCoords[1] });
      setDronePosition(100);
      
      if (phaseType === 'pickup') {
        setPickupArrived(true);
      }

      const popupMsg = phaseType === 'pickup'
        ? '🏪 Drone đã đến cửa hàng!'
        : '✅ Drone đã đến khách hàng!';
      droneMarkerRef.current.bindPopup(popupMsg).openPopup();
      return;
    }

    const totalDuration = 5000; // 5 seconds for both pickup and delivery legs
    const intervalMs = 100; // update every 100ms for smoothness
    const totalSteps = Math.max(1, Math.round(totalDuration / intervalMs));
    let currentStep = 0;

    const angle = Math.atan2(
      endCoords[1] - startCoords[1],
      endCoords[0] - startCoords[0]
    ) * (180 / Math.PI);

    const applyRotation = () => {
      const droneElement = droneMarkerRef.current?.getElement();
      if (!droneElement) return;
      const droneIcon = droneElement.querySelector('.drone-icon');
      if (droneIcon) {
        droneIcon.style.transform = `rotate(${angle + 90}deg)`;
      }
    };

    applyRotation();
    lastApiUpdateRef.current = 0;

    movementTimerRef.current = setInterval(() => {
      currentStep += 1;
      const progress = Math.min(currentStep / totalSteps, 1);
      const currentLat = startCoords[0] + (endCoords[0] - startCoords[0]) * progress;
      const currentLng = startCoords[1] + (endCoords[1] - startCoords[1]) * progress;

      const latLng = [currentLat, currentLng];
      droneMarkerRef.current.setLatLng(latLng);
      setLiveDroneCoords({ lat: currentLat, lng: currentLng });
      setDronePosition(Math.round(progress * 100));

      const now = Date.now();
      if (droneId && now - lastApiUpdateRef.current > 3000) {
        pushDroneLocationUpdate(currentLat, currentLng);
        lastApiUpdateRef.current = now;
      }

      if (progress >= 1) {
        // Ensure drone stops exactly at the destination and PUTs once more
        clearInterval(movementTimerRef.current);
        movementTimerRef.current = null;

        // Set marker to exact endCoords
        droneMarkerRef.current.setLatLng(endCoords);
        setLiveDroneCoords({ lat: endCoords[0], lng: endCoords[1] });
        setDronePosition(100);

        if (phaseType === 'pickup') {
          setPickupArrived(true);
        }

        const popupMsg = phaseType === 'pickup'
          ? '🏪 Drone đã đến cửa hàng!'
          : '✅ Drone đã đến khách hàng!';
        droneMarkerRef.current.bindPopup(popupMsg).openPopup();

        if (droneId) {
          // Final PUT at exact merchant location for pickup phase
          if (phaseType === 'pickup') {
            pushDroneLocationUpdate(merchantLat, merchantLng);
          } else {
            pushDroneLocationUpdate(endCoords[0], endCoords[1]);
          }
        }
      }
    }, intervalMs);

    return () => {
      if (movementTimerRef.current) {
        clearInterval(movementTimerRef.current);
        movementTimerRef.current = null;
      }
    };
  }, [mapReady, merchantLat, merchantLng, deliveryLat, deliveryLng, autoAnimate, isPickupPhase, isDeliveryPhase, hasDroneCoords, droneId, pushDroneLocationUpdate, orderKey, movementPhaseKey]);

  // Update drone position based on order status
  useEffect(() => {
    if (!droneMarkerRef.current) return;
    if (merchantLat == null || merchantLng == null || deliveryLat == null || deliveryLng == null) return;

    const merchantCoords = [merchantLat, merchantLng];
    const deliveryCoords = [deliveryLat, deliveryLng];
    const liveCoords = hasDroneCoords ? [effectiveDroneLat, effectiveDroneLng] : null;

    switch (orderStatus) {
      case 'CONFIRMED':
        // Drone at merchant
        droneMarkerRef.current.setLatLng(merchantCoords);
        droneMarkerRef.current.bindPopup('🏪 Drone đang chờ').openPopup();
        setDronePosition(0);
        break;
      case 'READY':
	 if (liveCoords) {
	     droneMarkerRef.current.setLatLng(liveCoords);
             droneMarkerRef.current.bindPopup('✈️ Drone đang đến cửa hàng').openPopup();
         }
         break;
      case 'DRONE_ARRIVED':
      case 'COMPLETED':
        // Drone at delivery location
        droneMarkerRef.current.setLatLng(deliveryCoords);
        droneMarkerRef.current.bindPopup('✅ Drone đã đến!').openPopup();
        setDronePosition(100);
        break;
      default:
        break;
    }
  }, [orderStatus, merchantLat, merchantLng, deliveryLat, deliveryLng, hasDroneCoords, effectiveDroneLat, effectiveDroneLng]);

  if (!mapLoaded) {
    return (
      <div className="drone-map-loading">
        <div className="loading-spinner"></div>
        <p>Đang tải bản đồ...</p>
      </div>
    );
  }

  if (merchantLat == null || merchantLng == null || deliveryLat == null || deliveryLng == null) {
    return (
      <div className="drone-map-error">
        <p>⚠️ Thiếu thông tin vị trí để hiển thị bản đồ</p>
      </div>
    );
  }

  const getStatusText = () => {
    switch (orderStatus) {
      case 'CONFIRMED':
        return '🏪 Đơn hàng đã xác nhận - Chờ nhà hàng sẵn sàng';
      case 'READY':
        return '✈️ Drone đang bay đến cửa hàng để lấy món';
      case 'DELIVERING':
        return '✈️ Drone đang bay đến địa chỉ giao hàng';
      case 'DRONE_ARRIVED':
        return '📍 Drone đã đến - Vui lòng nhận hàng';
      case 'COMPLETED':
        return '✅ Đã hoàn thành giao hàng';
      default:
        return 'ℹ️ Đang xử lý đơn hàng';
    }
  };

  const renderPickupPrompt = () => {
    if (!pickupArrived || !canStartDelivery) return null;
    return (
      <div className="drone-map-alert">
        <div>
          <strong>Drone đã tới cửa hàng.</strong>
          <div>Nhấn bắt đầu để giao hàng cho khách.</div>
        </div>
        <button
          type="button"
          className="drone-map-alert-btn"
          onClick={() => {
            if (typeof onStartDelivery === 'function') {
              onStartDelivery();
            }
          }}
        >
          Bắt đầu giao hàng
        </button>
      </div>
    );
  };

  return (
    <div className="drone-map-container">
      {renderPickupPrompt()}
      <div className="drone-map-header">
        <div className="status-text">{getStatusText()}</div>
        {orderStatus === 'DELIVERING' && (
          <div className="progress-info">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${dronePosition}%` }}></div>
            </div>
            <div className="progress-text">{dronePosition}%</div>
          </div>
        )}
      </div>
      <div ref={mapRef} className="map-container"></div>
      <div className="drone-map-legend">
        <div className="legend-item">
          <span className="legend-icon red">🏪</span>
          <span className="legend-text">{merchantLocation.name || 'Cửa hàng'}</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon blue">✈️</span>
          <span className="legend-text">Drone giao hàng</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon green">📍</span>
          <span className="legend-text">Địa chỉ giao hàng</span>
        </div>
      </div>
    </div>
  );
};

export default DroneMap;