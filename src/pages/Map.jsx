import React, { useState, useEffect, useRef } from 'react';
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

// Helper function to generate popup HTML
const getPopupHTML = (game, isSelected) => {
    let timeInfoHTML = '';
    const startTimeString = game.start_time;
    if (game.status && startTimeString && !isNaN(new Date(startTimeString).getTime())) {
        const startTime = new Date(startTimeString);
        if (game.status === 'pending' && startTime > new Date()) {
            timeInfoHTML = `<div class="status-box future">Starts in: <span class="countdown-timer" id="countdown-${game.game_id}"></span></div>`;
        } else if (game.status === 'in_progress') {
            const endTime = new Date(startTime);
            endTime.setMinutes(0, 0, 0);
            endTime.setHours(startTime.getHours() + 1);
            timeInfoHTML = `<div class="status-box live">Ends in: <span class="countdown-timer" id="countdown-${game.game_id}"></span></div>`;
        }
    }
    const buttonHTML = isSelected
        ? `<button class="join-btn exit-btn" onclick="window.handleExitGame()">Exit Game</button>`
        : `<button class="join-btn" onclick="window.handleJoinGame('${game.game_id}')">Join Game</button>`;

    return `
        <div class="game-popup">
            <h3>${game.title}</h3>
            <p class="details">Prize: $${game.total_value} | Treasures: ${game.treasure_count}</p>
            <p class="creator">by ${game.creator_username}</p>
            ${timeInfoHTML}
            ${buttonHTML}
        </div>`;
};

const MapPage = () => {
    const navigate = useNavigate();
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const gameMarkersRef = useRef({});
    const activeCountdownInterval = useRef(null);

    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [playerLocation, setPlayerLocation] = useState(null);
    const [canDig, setCanDig] = useState(false);
    const [isChatOpen, setChatOpen] = useState(false);
    
    // --- FIX: Restored full Join and Exit Game functionality ---
    useEffect(() => {
        const handleJoinGame = async (gameId) => {
            if (!currentUser || !playerLocation) {
                return Swal.fire('Error', 'Cannot get user or location data.', 'error');
            }
            const game = Object.values(gameMarkersRef.current).find(m => m.gameData.game_id === gameId)?.gameData;
            if (!game) return;

            const { data, error } = await supabase.rpc('join_game', {
                user_id_input: currentUser.id,
                game_id_input: gameId,
                player_lon: playerLocation[0],
                player_lat: playerLocation[1]
            });

            if (error || (data && data.startsWith('Error:'))) {
                const errorMessage = data ? data.replace('Error: ', '') : error.message;
                return Swal.fire('Could Not Join', errorMessage, 'warning');
            }
            
            Swal.fire("Joined!", `You have joined the game: ${game.title}`, "success");
            setSelectedGame(game);
        };

        const handleExitGame = () => {
            // Future: Add Supabase call to exit game if needed
            Swal.fire("Exited", "You have left the game.", "info");
            setSelectedGame(null);
        };
        
        window.handleJoinGame = handleJoinGame;
        window.handleExitGame = handleExitGame;

        return () => {
            delete window.handleJoinGame;
            delete window.handleExitGame;
        };
    }, [currentUser, playerLocation]); // Dependencies ensure the functions have latest data

    // --- FIX: Restored countdown timer logic ---
    const startCountdown = (game) => {
        if (activeCountdownInterval.current) clearInterval(activeCountdownInterval.current);
        const countdownId = `countdown-${game.game_id}`;
        let targetTime;

        if (game.status === 'pending') {
            targetTime = new Date(game.start_time).getTime();
        } else if (game.status === 'in_progress') {
            const endTime = new Date(game.start_time);
            endTime.setMinutes(0, 0, 0);
            endTime.setHours(endTime.getHours() + 1);
            targetTime = endTime.getTime();
        } else return;

        activeCountdownInterval.current = setInterval(() => {
            const el = document.getElementById(countdownId);
            if (!el) { clearInterval(activeCountdownInterval.current); return; }
            const distance = targetTime - new Date().getTime();

            if (distance < 0) {
                el.innerHTML = game.status === 'pending' ? "Starting..." : "Game Over";
                clearInterval(activeCountdownInterval.current);
                return;
            }
            const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((distance % (1000 * 60)) / 1000);
            el.textContent = `${h}h ${m}m ${s}s`;
        }, 1000);
    };

    // The rest of your component logic remains largely the same...
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
            // ... (fetch logic is the same)
            const { data: games } = await supabase.rpc('get_all_active_games_with_details');
            if(!games) return;

            games.forEach(game => {
                const gameId = game.game_id || game.id;
                if (!gameId) return;

                const isSelected = selectedGame?.game_id === gameId;
                const popupHTML = getPopupHTML(game, isSelected);

                if (gameMarkersRef.current[gameId]) {
                    gameMarkersRef.current[gameId].getPopup().setHTML(popupHTML);
                    gameMarkersRef.current[gameId].gameData = game;
                } else {
                    const el = document.createElement('div');
                    el.className = 'treasure-marker';
                    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML);
                    const marker = new mapboxgl.Marker(el).setLngLat(game.location.coordinates).setPopup(popup).addTo(mapRef.current);
                    
                    // FIX: Attach listeners to start/stop countdown when popup opens/closes
                    popup.on('open', () => startCountdown(game));
                    popup.on('close', () => clearInterval(activeCountdownInterval.current));
                    
                    marker.gameData = game;
                    gameMarkersRef.current[gameId] = marker;
                }
            });
        };

        map.on('load', () => {
            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true
            });
            map.addControl(geolocate);
            geolocate.on('geolocate', (e) => setPlayerLocation([e.coords.longitude, e.coords.latitude]));
            setTimeout(() => geolocate.trigger(), 500);
            
            fetchAndDisplayGames();
            setInterval(fetchAndDisplayGames, 15000);
        });

        const user = getCachedUser();
        if (user) setCurrentUser(user); else navigate('/login');
        
        return () => { 
            clearInterval(activeCountdownInterval.current);
            if (mapRef.current) mapRef.current.remove(); 
        };
    }, [navigate, selectedGame]); // Add selectedGame to dependency array

    // JSX for rendering UI remains the same
    return (
        <div className="map-page-container">
            <div ref={mapContainerRef} className="map-container" />
            <div className="ui-panel header">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                <div className="header-actions">
                    <Link to="/how-to-play" className="header-icon-btn"><svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg></Link>
                    <Link to="/create" className="header-icon-btn"><svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></Link>
                    <Link to="/profile" className="header-icon-btn"><svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2a5 5 0 110 10 5 5 0 010-10zm0 12c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/></svg></Link>
                </div>
            </div>
            <div className="ui-panel bottom-bar">
                <button id="digButton" className={canDig ? 'enabled' : ''} disabled={!canDig} onClick={handleDig}>DIG</button>
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
