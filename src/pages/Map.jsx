import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import Swal from 'sweetalert2';

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
    const gameMarkersRef = useRef({});
    const activePopupRef = useRef(null);

    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [isChatOpen, setChatOpen] = useState(false);

    const handleJoinGame = async (gameToJoin, playerLocation) => {
        if (!currentUser) return Swal.fire("Error", "You must be logged in.", "error");
        // ... (Join game logic)
    };

    useEffect(() => {
        const user = getCachedUser();
        if (!user) { navigate('/login'); return; }
        setCurrentUser(user);

        if (mapRef.current) return;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: JSON.parse(sessionStorage.getItem('lastLocation')) || [-74.006, 40.7128],
            zoom: 12
        });
        mapRef.current = map;

        let intervalId = null;

        // ✅ FIX: This function contains all the logic that needs to run after the map is ready.
        const initializeMapFeatures = () => {
            const fetchAndDisplayGames = async () => {
                const { data: games } = await supabase.rpc('get_all_active_games_with_details');
                if (!games) return;

                games.forEach(game => {
                    if (gameMarkersRef.current[game.game_id] || !game.location?.coordinates) return;
                    
                    const el = document.createElement('div');
                    el.className = 'treasure-marker';
                    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
                        .setLngLat(game.location.coordinates)
                        .addTo(map);

                    el.addEventListener('click', () => {
                        if (activePopupRef.current) activePopupRef.current.remove();
                        const popupContent = `<div class="game-popup"><h3>${game.title}</h3><p>Prize: $${game.total_value}</p><button class="join-btn" id="join-btn-${game.game_id}">Join</button></div>`;
                        const popup = new mapboxgl.Popup({ offset: 25, anchor: 'bottom' }).setHTML(popupContent).setLngLat(game.location.coordinates).addTo(map);
                        activePopupRef.current = popup;
                        document.getElementById(`join-btn-${game.game_id}`).addEventListener('click', () => handleJoinGame(game, [map.getCenter().lng, map.getCenter().lat]));
                    });
                    gameMarkersRef.current[game.game_id] = marker;
                });
            };

            const geolocate = new mapboxgl.GeolocateControl({ trackUserLocation: true });
            map.addControl(geolocate);
            geolocate.trigger();

            fetchAndDisplayGames();
            intervalId = setInterval(fetchAndDisplayGames, 30000);
        };

        // ✅ FIX: Check if the map is already loaded. If so, run the code. Otherwise, wait for the 'load' event.
        if (map.loaded()) {
            initializeMapFeatures();
        } else {
            map.on('load', initializeMapFeatures);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
            if (mapRef.current) mapRef.current.remove();
        };
    }, [navigate]);

    return (
        <div className="map-page-container">
            <div ref={mapContainerRef} className="map-container" />
            
            <div className="ui-panel header">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                <div className="header-actions">
                    <Link to="/how-to-play" className="header-icon-btn"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg></Link>
                    <Link to="/create" className="header-icon-btn"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></Link>
                    <Link to="/profile" className="header-icon-btn"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2a5 5 0 110 10 5 5 0 010-10zm0 12c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/></svg></Link>
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
