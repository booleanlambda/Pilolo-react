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

// This is a stable helper function to generate the popup's HTML content.
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

    const [games, setGames] = useState([]); // Holds the list of games from the database
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [digCounts, setDigCounts] = useState(null);
    const [playerLocation, setPlayerLocation] = useState(null);
    const [canDig, setCanDig] = useState(false);
    const [isChatOpen, setChatOpen] = useState(false);

    // Effect for ONE-TIME setup of the map, user, and data fetching interval
    useEffect(() => {
        const user = getCachedUser();
        if (!user) {
            navigate('/login');
            return;
        }
        setCurrentUser(user);

        // Define join/exit handlers that will be put on the window object
        window.handleJoinGame = (gameId) => {
            const gameToJoin = games.find(g => g.game_id === gameId);
            if (gameToJoin) {
                // Your actual Supabase RPC call to join the game would go here
                Swal.fire("Joined!", `You have joined the game: ${gameToJoin.title}`, "success");
                setSelectedGame(gameToJoin);
            }
        };
        window.handleExitGame = () => {
            // Your actual Supabase RPC call to exit the game would go here
            Swal.fire("Exited", "You have left the game.", "info");
            setSelectedGame(null);
        };
        
        // Initialize the map
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-73.7230, 40.9832], // Harrison, NY
            zoom: 14,
        });
        mapRef.current = map;

        // Function to fetch game data
        const fetchGames = async () => {
            const { data } = await supabase.rpc('get_all_active_games_with_details');
            setGames(data || []);
        };

        map.on('load', () => {
            // Setup geolocation
            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true
            });
            map.addControl(geolocate);
            geolocate.on('geolocate', (e) => setPlayerLocation([e.coords.longitude, e.coords.latitude]));
            setTimeout(() => geolocate.trigger(), 500);

            // Fetch games initially, then set up an interval
            fetchGames();
            const intervalId = setInterval(fetchGames, 15000);

            // Cleanup when the component unmounts
            return () => clearInterval(intervalId);
        });

        // Main cleanup function for the component
        return () => {
            if (mapRef.current) mapRef.current.remove();
            delete window.handleJoinGame;
            delete window.handleExitGame;
        };
    }, [navigate]); // This effect runs only once.

    // Effect to sync markers with the `games` state
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        // Add/Update markers
        games.forEach(game => {
            const gameId = game.game_id;
            const isSelected = selectedGame?.game_id === gameId;
            const popupHTML = getPopupHTML(game, isSelected);

            if (gameMarkersRef.current[gameId]) {
                gameMarkersRef.current[gameId].getPopup().setHTML(popupHTML);
            } else {
                const el = document.createElement('div');
                el.className = 'treasure-marker';
                const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML);
                const marker = new mapboxgl.Marker(el).setLngLat(game.location.coordinates).setPopup(popup).addTo(map);
                marker.gameData = game;
                gameMarkersRef.current[gameId] = marker;
            }
        });

        // Remove old markers that are no longer in the games list
        const currentGameIds = new Set(games.map(g => g.game_id));
        Object.keys(gameMarkersRef.current).forEach(markerId => {
            if (!currentGameIds.has(markerId)) {
                gameMarkersRef.current[markerId].remove();
                delete gameMarkersRef.current[markerId];
            }
        });
    }, [games, selectedGame]);

    // Effect to fetch dig counts when a game is selected
    useEffect(() => {
        const updateDigCounts = async () => {
            if (!currentUser || !selectedGame) {
                setDigCounts(null);
                return;
            }
            const { data } = await supabase.rpc('get_dig_counts', {
                user_id_input: currentUser.id,
                game_id_input: selectedGame.id
            });
            const counts = data?.[0];
            if (counts) {
                setDigCounts({
                    standard: Math.max(0, counts.base_allowance - counts.digs_taken),
                    bonus: Math.max(0, counts.bonus_balance - Math.max(0, counts.digs_taken - counts.base_allowance))
                });
            }
        };
        updateDigCounts();
    }, [selectedGame, currentUser]);

    return (
        <div className="map-page-container">
            <div ref={mapContainerRef} className="map-container" />
            <div className="ui-panel header">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                {selectedGame && digCounts && (
                    <div id="digs-info">
                        <span>Digs: {digCounts.standard}</span> | <span>Bonus: {digCounts.bonus}</span>
                    </div>
                )}
                <div className="header-actions">
                    <Link to="/how-to-play" className="header-icon-btn"><svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg></Link>
                    <Link to="/create" className="header-icon-btn"><svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></Link>
                    <Link to="/profile" className="header-icon-btn"><svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2a5 5 0 110 10 5 5 0 010-10zm0 12c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/></svg></Link>
                </div>
            </div>
            <div className="ui-panel bottom-bar">
                <button id="digButton" className={canDig ? 'enabled' : ''} disabled={!canDig}>DIG</button>
                <button id="chatBtn" onClick={() => selectedGame && setChatOpen(p => !p)}>
                    <ChatIcon />
                </button>
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
