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

    const handleJoinGame = async (gameToJoin) => {
        if (!currentUser) {
            return Swal.fire("Error", "You must be logged in.", "error");
        }
        console.log("Attempting to join game:", gameToJoin.game_id);
        Swal.fire("Joined!", `You have joined the game: ${gameToJoin.title}`, "success");
    };

    useEffect(() => {
        const user = getCachedUser();
        if (!user) {
            navigate('/login');
            return;
        }
        setCurrentUser(user);

        if (mapRef.current) return;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/navigation-night-v1?optimized=true',
            center: [-73.955, 40.815],
            zoom: 14
        });
        mapRef.current = map;

        let intervalId = null;

        const initializeMapFeatures = () => {
            const fetchAndDisplayGames = async () => {
                const { data: games } = await supabase.rpc('get_all_active_games_with_details');
                if (!games) return;

                games.forEach(game => {
                    const gameId = game.game_id || game.id;
                    if (!gameId || !game.location?.coordinates) return;

                    if (gameMarkersRef.current[gameId]) {
                        // If marker exists, just update its data
                        gameMarkersRef.current[gameId].gameData = game;
                    } else {
                        // Create a new marker if it doesn't exist
                        const el = document.createElement('div');
                        el.className = 'treasure-marker'; // Use a class for styling
                        const newMarker = new mapboxgl.Marker(el)
                            .setLngLat(game.location.coordinates)
                            .addTo(map);
                        newMarker.gameData = game;
                        gameMarkersRef.current[gameId] = newMarker;

                        newMarker.getElement().addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (activePopupRef.current) activePopupRef.current.remove();

                            // --- LOGIC DIRECTLY FROM MAP.HTML ---

                            let timeInfoHTML = '';
                            
                            // Check game status first
                            if (game.status === 'pending') {
                                // Use 'start_time' variable
                                const formattedStartTime = new Date(game.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                timeInfoHTML = `<div class="status-box future">Starts at: ${formattedStartTime}</div>`;
                            
                            } else if (game.status === 'in_progress') {
                                // Calculate end time based on start_time, exactly like in map.html
                                const startTime = new Date(game.start_time);
                                const endTime = new Date(startTime);
                                endTime.setMinutes(0, 0, 0);
                                endTime.setHours(startTime.getHours() + 1);
                                
                                const formattedEndTime = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                timeInfoHTML = `<div class="status-box live">Live! Ends at: ${formattedEndTime}</div>`;
                            }

                            const popupContent = `
                                <div class="game-popup">
                                    <h3>${game.title}</h3>
                                    {/* Use 'treasure_count' variable */}
                                    <p class="details">Prize: $${game.total_value} | Treasures: ${game.treasure_count}</p>
                                    <p class="creator">by ${game.creator_username}</p>
                                    ${timeInfoHTML}
                                    <button class="join-btn" id="join-btn-${gameId}">Join Game</button>
                                </div>`;
                            
                            // --- END OF MAP.HTML LOGIC ---

                            const popup = new mapboxgl.Popup({ offset: 25, anchor: 'bottom' })
                                .setHTML(popupContent)
                                .setLngLat(game.location.coordinates)
                                .addTo(map);

                            activePopupRef.current = popup;

                            // Must add event listener after popup is in the DOM
                            document.getElementById(`join-btn-${gameId}`).addEventListener('click', () => {
                                handleJoinGame(game);
                            });
                        });
                    }
                });
            };

            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true
            });
            map.addControl(geolocate);
            map.on('idle', () => geolocate.trigger());

            fetchAndDisplayGames();
            intervalId = setInterval(fetchAndDisplayGames, 30000);
        };

        map.on('load', initializeMapFeatures);

        return () => {
            if (intervalId) clearInterval(intervalId);
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
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                <div className="header-actions">{/* ...icons... */}</div>
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
