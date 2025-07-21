import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css';
import '../App.css';

// Make sure your VITE_MAPBOX_TOKEN is set in your .env file
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const MapPage = () => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);

    useEffect(() => {
        // Prevent the map from being initialized more than once
        if (mapRef.current) return;

        // Add a check to ensure the container element is in the DOM
        if (!mapContainerRef.current) {
            console.error("Map container element not found.");
            return;
        }
        console.log("Map container element is ready.", mapContainerRef.current);

        try {
            const map = new mapboxgl.Map({
                container: mapContainerRef.current,
                style: 'mapbox://styles/mapbox/dark-v11',
                center: [-74.006, 40.7128],
                zoom: 12
            });
            mapRef.current = map;
        } catch (error) {
            console.error("Error initializing Mapbox:", error);
        }

    }, []); // Empty dependency array ensures this runs only once

    return (
        <div className="map-page-container">
            <div ref={mapContainerRef} className="map-container" />
            {/* All other UI has been temporarily removed for this test */}
        </div>
    );
};

export default MapPage;
