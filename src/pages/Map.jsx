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

const getPopupHTML = (game) => {
    let timeInfoHTML = '';
    const startTimeString = game.start_time;
    if (game.status && startTimeString && !isNaN(new Date(startTimeString).getTime())) {
        const startTime = new Date(startTimeString);
        const endTime = new Date(startTime);
        endTime.setMinutes(0, 0, 0);
        endTime.setHours(startTime.getHours() + 1);
        const formattedEndTime = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (game.status === 'pending' && startTime > new Date()) {
            timeInfoHTML = `<div class="status-box future">Starts at: ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
        } else if (game.status === 'in_progress') {
            timeInfoHTML = `<div class="status-box live">Live! Ends at: ${formattedEndTime}</div>`;
        }
    }
    return `
        <div class="game-popup">
            <h3>${game.title}</h3>
            <p class="details">Prize: $${game.total_value} | Treasures: ${game.treasure_count}</p>
            <p class="creator">by ${game.creator_username}</p>
            ${timeInfoHTML}
            <button class="join-btn" onclick="window.handleJoinGame('${game.game_id}')">Join Game</button>
        </div>`;
};


const MapPage = () => {
    const navigate = useNavigate();
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const gameMarkersRef = useRef({});

    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [isChatOpen, setChatOpen] = useState(false);

    useEffect(() => {
        // Expose join game function to the window so popups can call it
        window.handleJoinGame = (gameId) => {
            const game = Object.values(gameMarkersRef.current).find(m => m.gameData.game_id === gameId)?.gameData;
            if (game) {
                console.log("Joining game:", game.title);
                Swal.fire("Joined!", `You have joined the game: ${game.title}`, "success");
            }
        };
        
        return () => {
            delete window.handleJoinGame; // Cleanup
        };
    }, []);

    useEffect(() => {
        if (mapRef.current || !mapContainerRef.current) return;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-74.0060, 40.7128],
            zoom: 12,
        });
        mapRef.current = map;
        
        const fetchAndDisplayGames = async () => {
            if (!supabase || !mapRef.current) return;
            const { data: games } = await supabase.rpc('get_all_active_games_with_details');
            if (!games) return;

            games.forEach(game => {
                const gameId = game.game_id || game.id;
                if (!gameId || !game.location?.coordinates) return;

                // FIX: This new, simplified logic uses Mapbox's built-in popup handling.
                if (gameMarkersRef.current[gameId]) {
                    // If marker exists, just update its popup content
                    const popupHTML = getPopupHTML(game);
                    gameMarkersRef.current[gameId].getPopup().setHTML(popupHTML);
                    gameMarkersRef.current[gameId].gameData = game; // Keep data fresh
                } else {
                    // If marker does NOT exist, create it with its popup attached
                    const el = document.createElement('div');
                    el.className = 'treasure-marker';

                    const popup = new mapboxgl.Popup({ offset: 25 })
                        .setHTML(getPopupHTML(game));
                    
                    const marker = new mapboxgl.Marker(el)
                        .setLngLat(game.location.coordinates)
                        .setPopup(popup) // Attach the popup directly to the marker
                        .addTo(mapRef.current);
                    
                    marker.gameData = game; // Store game data on the marker object
                    gameMarkersRef.current[gameId] = marker;
                }
            });
        };

        map.on('load', () => {
            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: false
            });
            map.addControl(geolocate);
            setTimeout(() => geolocate.trigger(), 500);
            
            fetchAndDisplayGames();
            setInterval(fetchAndDisplayGames, 30000);
        });

        const user = getCachedUser();
        if (user) setCurrentUser(user); else navigate('/login');
        
        return () => {
            if (mapRef.current) mapRef.current.remove();
        };
    }, [navigate]);

    return (
        <div className="map-page-container">
            <div ref={mapContainerRef} className="map-container" />
            <div className="ui-panel header">
                <h2>Explore Games</h2>
                <div className="header-actions">
                    <Link to="/how-to-play" className="header-icon-btn"><svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg></Link>
                    <Link to="/create" className="header-icon-btn"><svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></Link>
                    <Link to="/profile" className="header-icon-btn"><svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2a5 5 0 110 10 5 5 0 010-10zm0 12c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/></svg></Link>
                </div>
            </div>
            <div className="ui-panel bottom-bar">
                <button id="digButton">DIG</button>
                <button id="chatBtn" onClick={() => selectedGame && currentUser && setChatOpen(p => !p)}>
                    <ChatIcon />
                </button>
            </div>
            {isChatOpen && selectedGame && currentUser && (
                <ChatBox game={selectedGame} currentUser={currentUser} />
            )}
        </div>
    );
};

export default MapPage;
