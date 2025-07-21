import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Make sure your VITE_MAPBOX_TOKEN is set in your Vercel project settings
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const MapPage = () => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);

    useEffect(() => {
        if (mapRef.current || !mapContainerRef.current) return;

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

    }, []);

    return (
        // ✅ FIX: The height and width are now applied directly.
        <div 
            ref={mapContainerRef} 
            style={{ 
                position: 'absolute', 
                top: 0, 
                bottom: 0, 
                width: '100%', 
                height: '100%' 
            }} 
        />
    );
};

export default MapPage;
