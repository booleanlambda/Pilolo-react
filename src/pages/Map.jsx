import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import Swal from 'sweetalert2';
import * as turf from '@turf/turf';
import confetti from 'canvas-confetti';

import { supabase } from '../services/supabase';
import { getCachedUser } from '../services/session';
import ChatBox from '../components/ChatBox';

import 'mapbox-gl/dist/mapbox-gl.css';
import '../Map.css';

// Set Mapbox Access Token from your .env file
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const MapPage = () => {
    const navigate = useNavigate();
    
    // Refs for map and markers to avoid re-renders
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const userMarkerRef = useRef(null);
    const gameMarkersRef = useRef({});

    // React state for managing the application
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [playerLocation, setPlayerLocation] = useState(null);
    const [isChatOpen, setChatOpen] = useState(false);
    const [distance, setDistance] = useState(0);
    const [canDig, setCanDig] = useState(false);

    // Initialize the application
    useEffect(() => {
        const user = getCachedUser();
        if (!user) {
            navigate('/login');
            return;
        }
        setCurrentUser(user);

        const lastLocation = JSON.parse(sessionStorage.getItem('lastLocation')) || [-74.006, 40.7128];

        if (mapRef.current) return; // Initialize map only once

        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/navigation-night-v1',
            center: lastLocation,
            zoom: 12
        });
    }, [navigate]);

    // This is a simplified combination of the logic from your original file
    // A full implementation would require breaking this down further.
    const checkProximity = useCallback(() => {
        if (!playerLocation || !selectedGame) {
            setCanDig(false);
            return;
        }
        const gameCenter = turf.point(selectedGame.location.coordinates);
        const playerPoint = turf.point(playerLocation);
        const dist = turf.distance(playerPoint, gameCenter, { units: 'meters' });
        
        setDistance(dist);
        setCanDig(dist <= 30.5); // 100 feet
    }, [playerLocation, selectedGame]);

    useEffect(() => {
        checkProximity();
    }, [playerLocation, selectedGame, checkProximity]);

    return (
        <div>
            <div ref={mapContainerRef} className="map-container" />
            
            {/* UI Components would be built out here */}
            <div className="ui-panel header">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                {/* Header Actions */}
            </div>

            {distance > 30.5 && selectedGame && (
                <div id="distance-info">
                    {Math.round(distance * 3.28)} feet from game area
                </div>
            )}

            <div className="ui-panel bottom-bar">
                <button id="digButton" className={canDig ? 'enabled' : ''} disabled={!canDig}>
                    DIG
                </button>
                <button id="chatBtn" onClick={() => setChatOpen(prev => !prev)}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                </button>
            </div>

            {isChatOpen && selectedGame && (
                <ChatBox 
                    game={selectedGame}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};

export default MapPage;
