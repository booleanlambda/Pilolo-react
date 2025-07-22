import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import Swal from 'sweetalert2';
import * as turf from '@turf/turf';
import confetti from 'canvas-confetti';

import { supabase } from '../services/supabase.js';
import { getCachedUser } from '../services/session.js';
import ChatBox from '../components/ChatBox.jsx';
import ChatIcon from '../components/ChatIcon.jsx';

import 'mapbox-gl/dist/mapbox-gl.css';
import '../App.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// This helper function remains the same.
const getPopupHTML = (game, isSelected) => {
    let timeInfoHTML = '';
    const startTimeString = game.start_time;
    if (game.status && startTimeString && !isNaN(new Date(startTimeString).getTime())) {
        const startTime = new Date(startTimeString);
        const endTime = new Date(startTime);
        endTime.setMinutes(0, 0, 0);
        endTime.setHours(startTime.getHours() + 1);
        const formattedEndTime = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (game.status === 'pending' && startTime > new Date()) {
            timeInfoHTML = `<div class="status-box future">Starts: ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
        } else if (game.status === 'in_progress') {
            timeInfoHTML = `<div class="status-box live">Live! Ends at: ${formattedEndTime}</div>`;
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

    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [playerLocation, setPlayerLocation] = useState(null);
    const [canDig, setCanDig] = useState(false);
    const [isChatOpen, setChatOpen] = useState(false);

    // This effect now ONLY runs when selectedGame changes.
    // Its job is to update the popups.
    useEffect(() => {
        Object.values(gameMarkersRef.current).forEach(marker => {
            const game = marker.gameData;
            const isSelected = selectedGame?.game_id === game.game_id;
            if (marker.getPopup()) {
                marker.getPopup().setHTML(getPopupHTML(game, isSelected));
            }
        });
    }, [selectedGame]);

    // This is the main setup effect. It runs ONLY ONCE.
    useEffect(() => {
        if (mapRef.current) return; // Already initialized

        const user = getCachedUser();
        if (!user) {
            navigate('/login');
            return;
        }
        setCurrentUser(user);

        // Define join/exit functions that can modify state
        window.handleJoinGame = (gameId) => {
            const game = Object.values(gameMarkersRef.current).find(m => m.gameData.game_id === gameId)?.gameData;
            if (game) {
                Swal.fire("Joined!", `You have joined the game: ${game.title}`, "success");
                setSelectedGame(game);
            }
        };
        window.handleExitGame = () => {
            Swal.fire("Exited", "You have left the game.", "info");
            setSelectedGame(null);
        };

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-73.7230, 40.9832],
            zoom: 14,
        });
        mapRef.current = map;

        map.on('load', () => {
            const fetchAndDisplayGames = async () => {
                const { data: games } = await supabase.rpc('get_all_active_games_with_details');
                if (!games) return;
                games.forEach(game => {
                    const gameId = game.game_id || game.id;
                    if (!gameId || gameMarkersRef.current[gameId]) return;
                    
                    const el = document.createElement('div');
                    el.className = 'treasure-marker';
                    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(getPopupHTML(game, false));
                    const marker = new mapboxgl.Marker(el).setLngLat(game.location.coordinates).setPopup(popup).addTo(map);
                    marker.gameData = game;
                    gameMarkersRef.current[gameId] = marker;
                });
            };

            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true
            });
            map.addControl(geolocate);
            geolocate.on('geolocate', (e) => {
                setPlayerLocation([e.coords.longitude, e.coords.latitude]);
            });
            setTimeout(() => geolocate.trigger(), 500);

            fetchAndDisplayGames();
            setInterval(fetchAndDisplayGames, 15000);
        });

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            delete window.handleJoinGame;
            delete window.handleExitGame;
        };
    }, [navigate]); // Only depends on navigate now.

    const handleDig = () => { /* Your dig logic */ };

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
                <button id="digButton" className={canDig ? 'enabled' : ''} disabled={!canDig} onClick={handleDig}>
                    DIG
                </button>
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
