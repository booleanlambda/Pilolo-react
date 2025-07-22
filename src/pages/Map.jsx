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

    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [digCounts, setDigCounts] = useState(null); // FIX: State for dig counts
    // ... other state variables

    // ... (other helper functions like startCountdown)

    // FIX: useEffect to fetch dig counts when a game is selected
    useEffect(() => {
        const updateDigCounts = async () => {
            if (!currentUser || !selectedGame) {
                setDigCounts(null);
                return;
            }
            const { data, error } = await supabase.rpc('get_dig_counts', {
                user_id_input: currentUser.id,
                game_id_input: selectedGame.id
            });
            if (error || !data || data.length === 0) {
                console.error("Could not fetch dig counts:", error);
                setDigCounts(null);
                return;
            }
            const counts = data[0];
            const standardDigsRemaining = Math.max(0, counts.base_allowance - counts.digs_taken);
            const bonusDigsUsed = Math.max(0, counts.digs_taken - counts.base_allowance);
            const bonusDigsRemaining = Math.max(0, counts.bonus_balance - bonusDigsUsed);
            setDigCounts({ standard: standardDigsRemaining, bonus: bonusDigsRemaining });
        };

        updateDigCounts();
    }, [selectedGame, currentUser]);


    const handleDig = async () => {
        // ... (handleDig logic)
        // At the end of the dig, refresh the counts
        // To do this, we need to call the same logic as the useEffect
        // For simplicity, we can just refetch here or abstract it.
        // For now, let's assume the component will handle it via state updates.
    };

    // FIX: This is the main setup effect. It now has an empty dependency array [] to run ONLY ONCE.
    useEffect(() => {
        if (mapRef.current) return;
        
        const user = getCachedUser();
        if (!user) { navigate('/login'); return; }
        setCurrentUser(user);

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

        map.on('load', async () => {
            const fetchAndDisplayGames = async () => { /* ... */ };
            const checkForActiveGame = async () => { /* ... */ };
            
            await checkForActiveGame();
            fetchAndDisplayGames();
            setInterval(fetchAndDisplayGames, 15000);
            
            // ... (geolocate logic)
        });

        return () => {
            if (mapRef.current) mapRef.current.remove();
            delete window.handleJoinGame;
            delete window.handleExitGame;
        };
    }, []);

    return (
        <div className="map-page-container">
            <div ref={mapContainerRef} className="map-container" />
            <div className="ui-panel header">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                
                {/* FIX: Conditionally render the dig counts in the header */}
                {selectedGame && digCounts && (
                    <div id="digs-info">
                        <span>Standard Digs: {digCounts.standard}</span> | <span>Bonus Digs: {digCounts.bonus}</span>
                    </div>
                )}
                
                <div className="header-actions">
                    {/* ... header icons ... */}
                </div>
            </div>
            {/* ... rest of the UI ... */}
        </div>
    );
};

export default MapPage;
