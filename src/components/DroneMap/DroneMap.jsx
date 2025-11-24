import React, { useEffect, useRef, useState } from 'react';
import './DroneMap.css';

const DroneMap = ({ 
  merchantLocation, // { lat, lng, name }
  deliveryLocation, // { lat, lng, address }
  orderStatus = 'CONFIRMED',
  autoAnimate = true 
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const droneMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [dronePosition, setDronePosition] = useState(0); // 0-100%
  const animationRef = useRef(null);
  const merchantLat = merchantLocation?.lat;
  const merchantLng = merchantLocation?.lng;
  const merchantName = merchantLocation?.name;
  const deliveryLat = deliveryLocation?.lat;
  const deliveryLng = deliveryLocation?.lng;
  const deliveryAddress = deliveryLocation?.address;

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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setMapReady(false);
    };
  }, [mapLoaded, merchantLat, merchantLng, merchantName, deliveryLat, deliveryLng, deliveryAddress]);

  // Animate drone movement
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !droneMarkerRef.current) return;
    if (merchantLat == null || merchantLng == null || deliveryLat == null || deliveryLng == null) return;
    if (orderStatus !== 'DELIVERING' || !autoAnimate) return;

    const merchantCoords = [merchantLat, merchantLng];
    const deliveryCoords = [deliveryLat, deliveryLng];

    let progress = 0;
    const duration = 10000; // 10 seconds for full journey
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);

      // Linear interpolation between merchant and delivery
      const currentLat = merchantCoords[0] + (deliveryCoords[0] - merchantCoords[0]) * progress;
      const currentLng = merchantCoords[1] + (deliveryCoords[1] - merchantCoords[1]) * progress;

      droneMarkerRef.current.setLatLng([currentLat, currentLng]);
      setDronePosition(Math.round(progress * 100));

      // Calculate rotation angle
      const angle = Math.atan2(
        deliveryCoords[1] - merchantCoords[1],
        deliveryCoords[0] - merchantCoords[0]
      ) * (180 / Math.PI);

      // Update drone rotation
      const droneElement = droneMarkerRef.current.getElement();
      if (droneElement) {
        const droneIcon = droneElement.querySelector('.drone-icon');
        if (droneIcon) {
          droneIcon.style.transform = `rotate(${angle + 90}deg)`;
        }
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Arrived
        droneMarkerRef.current.bindPopup('✅ Drone đã đến!').openPopup();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [mapReady, merchantLat, merchantLng, deliveryLat, deliveryLng, orderStatus, autoAnimate]);

  // Update drone position based on order status
  useEffect(() => {
    if (!droneMarkerRef.current) return;
    if (merchantLat == null || merchantLng == null || deliveryLat == null || deliveryLng == null) return;

    const merchantCoords = [merchantLat, merchantLng];
    const deliveryCoords = [deliveryLat, deliveryLng];

    switch (orderStatus) {
      case 'CONFIRMED':
        // Drone at merchant
        droneMarkerRef.current.setLatLng(merchantCoords);
        droneMarkerRef.current.bindPopup('🏪 Drone đang chờ tại cửa hàng').openPopup();
        setDronePosition(0);
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
  }, [orderStatus, merchantLat, merchantLng, deliveryLat, deliveryLng]);

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
        return '🏪 Drone đang chờ tại cửa hàng';
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

  return (
    <div className="drone-map-container">
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
