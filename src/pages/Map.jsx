import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import Swal from 'sweetalert2';
import * as turf from '@turf/turf';

import { supabase } from '../services/supabase.js';
import { getCachedUser } from '../services/session.js';
import ChatBox from '../components/ChatBox.jsx';
import ChatIcon from '../components/ChatIcon.jsx';

import 'mapbox-gl/dist/mapbox-gl.css';
import '../App.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const MapPage = () => {
    const navigate = useNavigate();
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const userMarkerRef = useRef(null);
    const gameMarkersRef = useRef({});

    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [isChatOpen, setChatOpen] = useState(false);
    
    // --- DATA FETCHING ---
 // In src/pages/Map.jsx...

const fetchAndDisplayGames = useCallback(async () => {
    // DEBUG STEP 1: See if the function is running at all
    console.log("Attempting to fetch and display games...");

    const map = mapRef.current;
    if (!map) {
        console.error("Map not available for fetching games.");
        return;
    }

    const { data: games, error } = await supabase.rpc('get_all_active_games_with_details');

    if (error) {
        console.error("Error fetching games from Supabase:", error);
        return;
    }

    // DEBUG STEP 2: See what data (if any) is returned
    console.log("Data received from Supabase:", games);

    if (!games) return;

    games.forEach(game => {
        // DEBUG STEP 3: Check if the code is trying to create a marker
        console.log(`Processing marker for game: ${game.title}`);

        if (gameMarkersRef.current[game.id] || !game.location?.coordinates) return;
        
        const el = document.createElement('div');
        el.className = 'treasure-marker';

        const marker = new mapboxgl.Marker(el)
            .setLngLat(game.location.coordinates)
            .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`<h3>${game.title}</h3>`))
            .addTo(map);

        gameMarkersRef.current[game.id] = marker;
    });
}, []);


    // --- INITIALIZATION & PERMISSIONS ---
    useEffect(() => {
        const user = getCachedUser();
        if (!user) { navigate('/login'); return; }
        setCurrentUser(user);

        if (mapRef.current) return;

        const defaultCenter = [-74.006, 40.7128]; // Default center
        
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: defaultCenter,
            zoom: 12
        });
        mapRef.current = map;

        map.on('load', () => {
            fetchAndDisplayGames();
            
            // ✅ Explicitly ask for and handle location
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const userLngLat = [position.coords.longitude, position.coords.latitude];
                        sessionStorage.setItem('lastLocation', JSON.stringify(userLngLat));
                        map.flyTo({ center: userLngLat, zoom: 15 });

                        // Create the user marker
                        const el = document.createElement('div');
                        el.className = 'user-marker'; // You can style this in App.css
                        userMarkerRef.current = new mapboxgl.Marker(el).setLngLat(userLngLat).addTo(map);
                    },
                    (error) => {
                        console.error("Geolocation error:", error);
                        Swal.fire('Location Error', 'Could not get your location. Please ensure location services are enabled.', 'warning');
                    },
                    { enableHighAccuracy: true }
                );
            } else {
                Swal.fire('Unsupported', 'Geolocation is not supported by your browser.', 'error');
            }

            const intervalId = setInterval(fetchAndDisplayGames, 30000);
            return () => clearInterval(intervalId);
        });
    }, [navigate, fetchAndDisplayGames]);

    return (
        <div>
            <div ref={mapContainerRef} className="map-container" />
            
            <div className="ui-panel header">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                <div className="header-actions">
                    <Link to="/how-to-play" className="header-icon-btn" title="How to Play">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
                    </Link>
                    <Link to="/create" className="header-icon-btn" title="Create Game">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </Link>
                    <Link to="/profile" className="header-icon-btn" title="Profile">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2a5 5 0 110 10 5 5 0 010-10zm0 12c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/></svg>
                    </Link>
                </div>
            </div>

            <div className="ui-panel bottom-bar">
                <button id="digButton">DIG</button>
                <button id="chatBtn" onClick={() => selectedGame && setChatOpen(p => !p)}>
                    <ChatIcon />
                </button>
            </div>

            {isChatOpen && (
                <ChatBox 
                    game={selectedGame}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};

export default MapPage;
