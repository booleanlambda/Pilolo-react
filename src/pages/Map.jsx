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

    useEffect(() => {
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
        return () => {
            delete window.handleJoinGame;
            delete window.handleExitGame;
        };
    }, []);

    useEffect(() => {
        if (playerLocation && selectedGame && selectedGame.status === 'in_progress') {
            const gamePoint = turf.point(selectedGame.location.coordinates);
            const playerPoint = turf.point(playerLocation);
            const distanceInMeters = turf.distance(playerPoint, gamePoint, { units: 'meters' });
            setCanDig(distanceInMeters <= 30);
        } else {
            setCanDig(false);
        }
    }, [playerLocation, selectedGame]);

    const handleDig = async () => { /* Your full dig logic here */ };

    useEffect(() => {
        if (mapRef.current || !mapContainerRef.current) return;
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-73.7230, 40.9832], // Harrison, NY
            zoom: 14,
        });
        mapRef.current = map;
        
        const fetchAndDisplayGames = async () => {
            const { data: games } = await supabase.rpc('get_all_active_games_with_details');
            if (!games) return;
            games.forEach(game => {
                const gameId = game.game_id || game.id;
                if (!gameId) return;

                const isSelected = selectedGame?.game_id === gameId;
                const popupHTML = getPopupHTML(game, isSelected);

                if (gameMarkersRef.current[gameId]) {
                    gameMarkersRef.current[gameId].getPopup().setHTML(popupHTML);
                } else {
                    const el = document.createElement('div');
                    el.className = 'treasure-marker';
                    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML);
                    const marker = new mapboxgl.Marker(el).setLngLat(game.location.coordinates).setPopup(popup).addTo(mapRef.current);
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
            geolocate.on('geolocate', (e) => {
                setPlayerLocation([e.coords.longitude, e.coords.latitude]);
            });
            setTimeout(() => geolocate.trigger(), 500);
            fetchAndDisplayGames();
            setInterval(fetchAndDisplayGames, 15000);
        });

        const user = getCachedUser();
        if (user) setCurrentUser(user); else navigate('/login');
        
        return () => { if (mapRef.current) mapRef.current.remove(); };
    }, [navigate, selectedGame]);

    return (
        <div className="map-page-container">
            <div ref={mapContainerRef} className="map-container" />

            {/* FIX: Restored the complete header UI */}
            <div className="ui-panel header">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                <div className="header-actions">
                    <Link to="/how-to-play" className="header-icon-btn" aria-label="How to Play">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
                    </Link>
                    <Link to="/create" className="header-icon-btn" aria-label="Create Game">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </Link>
                    <Link to="/profile" className="header-icon-btn" aria-label="Profile">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2a5 5 0 110 10 5 5 0 010-10zm0 12c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/></svg>
                    </Link>
                </div>
            </div>

            {/* FIX: Restored the complete bottom bar UI */}
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
