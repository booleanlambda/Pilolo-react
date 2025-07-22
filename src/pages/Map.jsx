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
    // ... (This helper function remains the same as the last version)
    let timeInfoHTML = '';
    const startTimeString = game.start_time;
    if (game.status && startTimeString && !isNaN(new Date(startTimeString).getTime())) {
        const startTime = new Date(startTimeString);
        const endTime = new Date(startTime);
        endTime.setMinutes(0, 0, 0);
        endTime.setHours(startTime.getHours() + 1);
        const formattedEndTime = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (game.status === 'pending' && startTime > new Date()) {
            timeInfoHTML = `<div class="status-box future">Starts in: <span class="countdown-timer" id="countdown-${game.game_id}"></span> | Ends: ${formattedEndTime}</div>`;
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
            <button class="join-btn" id="join-btn-${game.game_id}">Join Game</button>
        </div>`;
};

const MapPage = () => {
    const navigate = useNavigate();
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const gameMarkersRef = useRef({});
    const activePopupRef = useRef(null);
    const countdownIntervalRef = useRef(null);

    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [isChatOpen, setChatOpen] = useState(false);

    const startCountdown = (game) => {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = setInterval(() => {
            const el = document.getElementById(`countdown-${game.game_id}`);
            if (!el) { clearInterval(countdownIntervalRef.current); return; }
            const distance = new Date(game.start_time).getTime() - new Date().getTime();
            if (distance < 0) {
                el.innerHTML = "Starting...";
                clearInterval(countdownIntervalRef.current);
                return;
            }
            const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((distance % (1000 * 60)) / 1000);
            el.textContent = `${h}h ${m}m ${s}s`;
        }, 1000);
    };

    const handleJoinGame = (game) => { /* Your join game logic */ };

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

            // FIX: This logic now correctly handles creating NEW markers and updating EXISTING ones.
            games.forEach(game => {
                const gameId = game.game_id || game.id;
                if (!gameId || !game.location?.coordinates) return;

                // Check if marker already exists
                if (gameMarkersRef.current[gameId]) {
                    // If it exists, you can update it if necessary (future feature)
                    // For now, we just ensure it's there.
                } else {
                    // If marker does NOT exist, create it
                    const el = document.createElement('div');
                    el.className = 'treasure-marker';
                    const marker = new mapboxgl.Marker(el)
                        .setLngLat(game.location.coordinates)
                        .addTo(mapRef.current);

                    marker.getElement().addEventListener('click', () => {
                        if (activePopupRef.current) activePopupRef.current.remove();
                        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

                        const popupHTML = getPopupHTML(game);
                        const popup = new mapboxgl.Popup({ offset: 25 })
                            .setHTML(popupHTML)
                            .setLngLat(game.location.coordinates)
                            .addTo(mapRef.current);
                        activePopupRef.current = popup;

                        if (game.status === 'pending' && new Date(game.start_time) > new Date()) {
                            startCountdown(game);
                        }
                        
                        document.getElementById(`join-btn-${gameId}`).addEventListener('click', () => handleJoinGame(game));
                    });
                    
                    // Store the new marker in our reference object
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
            clearInterval(countdownIntervalRef.current);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
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
