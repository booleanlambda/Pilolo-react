import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import Swal from 'sweetalert2';

import { supabase } from '../services/supabase.js';
import { getCachedUser } from '../services/session.js';
import ChatBox from '../components/ChatBox';

import 'mapbox-gl/dist/mapbox-gl.css';
import '../Map.css';

// Set Mapbox Access Token from your .env file
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

    // This function updates a marker's popup content
    const updateGameMarkerPopup = useCallback((gameId, gameData) => {
        const marker = gameMarkersRef.current[gameId]?.marker;
        if (!marker) return;

        const timeInfo = gameData.status === 'in_progress' 
            ? `Live! Ends: ${new Date(gameData.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : `Starts: ${new Date(gameData.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        const popupContent = `
            <div class="game-popup">
                <h3>${gameData.title}</h3>
                <p>Prize: $${gameData.total_value} | By: ${gameData.creator_username}</p>
                <p class="time-info">${timeInfo}</p>
            </div>`;
        
        marker.getPopup().setHTML(popupContent);
    }, []);

    // Effect to fetch and display games on the map
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const fetchAndDisplayGames = async () => {
            const { data: games } = await supabase.rpc('get_all_active_games_with_details');
            if (!games) return;

            const activeGameIds = new Set(games.map(g => g.id));

            // Remove markers for games that are no longer active
            Object.keys(gameMarkersRef.current).forEach(id => {
                if (!activeGameIds.has(Number(id))) {
                    gameMarkersRef.current[id].marker.remove();
                    delete gameMarkersRef.current[id];
                }
            });

            // Add or update markers for active games
            games.forEach(game => {
                if (!game.location?.coordinates) return;

                if (gameMarkersRef.current[game.id]) {
                    // If marker exists, just update its data
                    gameMarkersRef.current[game.id].gameData = game;
                    updateGameMarkerPopup(game.id, game);
                } else {
                    // Create a new marker with the diamond style
                    const el = document.createElement('div');
                    el.className = 'treasure-marker';

                    const marker = new mapboxgl.Marker(el)
                        .setLngLat(game.location.coordinates)
                        .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }))
                        .addTo(map);
                    
                    gameMarkersRef.current[game.id] = { marker, gameData: game };
                    updateGameMarkerPopup(game.id, game);
                }
            });
        };

        // Fetch games when the map loads and then every 30 seconds
        map.on('load', () => {
            fetchAndDisplayGames();
            const intervalId = setInterval(fetchAndDisplayGames, 30000);
            return () => clearInterval(intervalId); // Cleanup interval
        });
    }, [updateGameMarkerPopup]);


    // Main initialization effect
    useEffect(() => {
        const user = getCachedUser();
        if (!user) { navigate('/login'); return; }
        setCurrentUser(user);

        if (mapRef.current) return;
        const lastLocation = JSON.parse(sessionStorage.getItem('lastLocation')) || [-74.006, 40.7128];
        
        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11', // Dark map style
            center: lastLocation,
            zoom: 12
        });
    }, [navigate]);

    return (
        <div>
            <div ref={mapContainerRef} className="map-container" />
            
            <div className="ui-panel header">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                {/* Header Actions */}
            </div>

            <div className="ui-panel bottom-bar">
                <button id="digButton">DIG</button>
                <button id="chatBtn" onClick={() => selectedGame && setChatOpen(p => !p)}>
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
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
