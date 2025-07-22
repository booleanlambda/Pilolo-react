import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import Swal from 'sweetalert2';
import * as turf from '@turf/turf'; // Import turf for distance calculations

import { supabase } from '../services/supabase.js';
import { getCachedUser } from '../services/session.js';
// ... other imports

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const getPopupHTML = (game, isSelected) => {
    // ... timeInfoHTML logic remains the same ...
    let timeInfoHTML = '';
    // ...

    // FIX: Button logic now changes based on whether the game is selected
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
    const [playerLocation, setPlayerLocation] = useState(null); // For player's coordinates
    const [canDig, setCanDig] = useState(false); // To enable/disable the DIG button
    
    // --- Join and Exit Game Logic ---
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

    // --- FIX: Proximity check for Dig button ---
    useEffect(() => {
        if (playerLocation && selectedGame && selectedGame.status === 'in_progress') {
            const gamePoint = turf.point(selectedGame.location.coordinates);
            const playerPoint = turf.point(playerLocation);
            const distanceInMeters = turf.distance(playerPoint, gamePoint, { units: 'meters' });

            // Enable dig if player is within 30 meters
            setCanDig(distanceInMeters <= 30);
        } else {
            setCanDig(false); // Disable dig if no game selected or game not in progress
        }
    }, [playerLocation, selectedGame]);

    // --- FIX: Dig Treasure Logic ---
    const handleDig = async () => {
        if (!canDig) return;
        
        Swal.fire({
            title: 'Digging...',
            text: 'Good luck!',
            icon: 'info',
            showConfirmButton: false,
            timer: 1500
        });

        // This is a placeholder for your rpc('dig_treasure', ...) call
        // Replace with your actual Supabase call from map.html
        console.log("Digging at", playerLocation, "for game", selectedGame.game_id);
    };

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
            // FIX: Continuously watch position to update playerLocation state
            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true, // Keep tracking for proximity checks
                showUserHeading: true
            });
            map.addControl(geolocate);
            
            geolocate.on('geolocate', (e) => {
                setPlayerLocation([e.coords.longitude, e.coords.latitude]);
            });
            
            setTimeout(() => geolocate.trigger(), 500);
            
            fetchAndDisplayGames();
            setInterval(fetchAndDisplayGames, 15000); // Fetch more frequently
        });

        const user = getCachedUser();
        if (user) setCurrentUser(user); else navigate('/login');
        
        return () => { if (mapRef.current) mapRef.current.remove(); };
    }, [navigate, selectedGame]); // Add selectedGame dependency to re-render popups

    return (
        <div className="map-page-container">
            <div ref={mapContainerRef} className="map-container" />
            <div className="ui-panel header">
                {/* Header content... */}
            </div>
            <div className="ui-panel bottom-bar">
                {/* FIX: Use `disabled` attribute and `className` for styling */}
                <button id="digButton" className={canDig ? 'enabled' : ''} disabled={!canDig} onClick={handleDig}>
                    DIG
                </button>
                {/* Chat button... */}
            </div>
            {/* ChatBox component... */}
        </div>
    );
};

export default MapPage;
