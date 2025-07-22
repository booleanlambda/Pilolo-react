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

// This helper function remains the same
const getPopupHTML = (game, isSelected) => { /* ... */ };

const MapPage = () => {
    const navigate = useNavigate();
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const gameMarkersRef = useRef({});
    
    // ... other state variables and helper functions (startCountdown, handleDig) ...
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    
    // This effect updates popups when the selected game changes.
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
        if (mapRef.current) return;

        const user = getCachedUser();
        if (!user) {
            navigate('/login');
            return;
        }
        setCurrentUser(user);

        // Define join/exit functions that can modify state
        window.handleJoinGame = (gameId) => {
            // ... (Join game logic)
            const game = Object.values(gameMarkersRef.current).find(m => m.gameData.game_id === gameId)?.gameData;
            if (game) {
                Swal.fire("Joined!", `You have joined the game: ${game.title}`, "success");
                setSelectedGame(game);
            }
        };
        window.handleExitGame = () => {
            Swal.fire("Exited", "You have left the game.", "info");
            setSelectedGame(null);
            setChatOpen(false); // Also close chat on exit
        };

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-73.7230, 40.9832],
            zoom: 14,
        });
        mapRef.current = map;

        map.on('load', async () => {
            // FIX: Check if the user is already in an active game on load
            const checkForActiveGame = async () => {
                const { data: activeGameGroup } = await supabase
                    .from('user_groups')
                    .select('game_id')
                    .eq('user_id', user.id)
                    .eq('is_active', true)
                    .single();
                
                if (activeGameGroup) {
                    const { data: gameDetails } = await supabase.rpc('get_game_details', { game_id_input: activeGameGroup.game_id });
                    if (gameDetails && gameDetails.length > 0) {
                        const game = gameDetails[0];
                        if (game.game_id && !game.id) game.id = game.game_id;
                        setSelectedGame(game); // Automatically select the active game
                    }
                }
            };
            
            await checkForActiveGame();

            // ... (rest of the map.on('load') logic for fetchAndDisplayGames and geolocate)
        });

        return () => {
            // ... (cleanup logic)
        };
    }, []); // <-- FIX: The empty array ensures this runs only once, preventing reloads.

    return (
        <div className="map-page-container">
            <div ref={mapContainerRef} className="map-container" />
            
            {/* The rest of your UI, including the chat box wrapper, remains the same */}
            <div className="ui-panel header">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                {/* ... header icons ... */}
            </div>

            <div className="ui-panel bottom-bar">
                {/* ... dig and chat buttons ... */}
            </div>

            {isChatOpen && selectedGame && currentUser && (
                <div className="chat-container">
                    <ChatBox game={selectedGame} currentUser={currentUser} />
                </div>
            )}
        </div>
    );
};

export default MapPage;
