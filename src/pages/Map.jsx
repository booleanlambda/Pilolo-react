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

const getPopupHTML = (game, isSelected) => {
    let timeInfoHTML = '';
    const startTimeString = game.start_time;
    if (game.status && startTimeString && !isNaN(new Date(startTimeString).getTime())) {
        const startTime = new Date(startTimeString);
        const countdownId = `countdown-${game.game_id}`;
        if (game.status === 'pending' && startTime > new Date()) {
            timeInfoHTML = `<div class="status-box future">Starts in: <span class="countdown-timer" id="${countdownId}"></span></div>`;
        } else if (game.status === 'in_progress') {
            timeInfoHTML = `<div class="status-box live">Ends in: <span class="countdown-timer" id="${countdownId}"></span></div>`;
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

    const [games, setGames] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [digCounts, setDigCounts] = useState(null);
    const [playerLocation, setPlayerLocation] = useState(null);
    const [canDig, setCanDig] = useState(false);
    const [isChatOpen, setChatOpen] = useState(false);

    // Effect to update popups when the selected game changes
    useEffect(() => {
        Object.values(gameMarkersRef.current).forEach(marker => {
            const game = marker.gameData;
            const isSelected = selectedGame?.game_id === game.game_id;
            if (marker.getPopup()) {
                marker.getPopup().setHTML(getPopupHTML(game, isSelected));
            }
        });
    }, [selectedGame, games]);

    // Effect to fetch dig counts when a game is selected
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
                setDigCounts(null);
                return;
            }
            const counts = data[0];
            setDigCounts({
                standard: Math.max(0, counts.base_allowance - counts.digs_taken),
                bonus: Math.max(0, counts.bonus_balance - Math.max(0, counts.digs_taken - counts.base_allowance))
            });
        };
        updateDigCounts();
    }, [selectedGame, currentUser]);

    // Effect to check if player can dig
    useEffect(() => {
        if (playerLocation && selectedGame && selectedGame.status === 'in_progress') {
            const gamePoint = turf.point(selectedGame.location.coordinates);
            const playerPoint = turf.point(playerLocation);
            const distanceInMeters = turf.distance(playerPoint, gamePoint, { units: 'meters' });
            setCanDig(distanceInMeters <= 30.5);
        } else {
            setCanDig(false);
        }
    }, [playerLocation, selectedGame]);

    // Main setup effect - runs only once
    useEffect(() => {
        if (mapRef.current) return;

        const user = getCachedUser();
        if (!user) { navigate('/login'); return; }
        setCurrentUser(user);

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
                    el.innerHTML = "Updating...";
                    clearInterval(activeCountdownInterval.current);
                    return;
                }
                const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((distance % (1000 * 60)) / 1000);
                el.textContent = `${h}h ${m}m ${s}s`;
            }, 1000);
        };

        window.handleJoinGame = async (gameId) => {
            const gameToJoin = games.find(g => g.game_id === gameId);
            if (!gameToJoin || !user || !playerLocation) return;
            const { data, error } = await supabase.rpc('join_game', {
                user_id_input: user.id, game_id_input: gameId,
                player_lon: playerLocation[0], player_lat: playerLocation[1]
            });
            if (error || (data && data.startsWith('Error:'))) return Swal.fire('Could Not Join', data?.replace('Error: ', '') || error.message, 'warning');
            Swal.fire("Joined!", `You have joined the game: ${gameToJoin.title}`, "success");
            setSelectedGame(gameToJoin);
        };
        window.handleExitGame = () => {
            Swal.fire("Exited", "You have left the game.", "info");
            setSelectedGame(null);
            setChatOpen(false);
        };

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-73.7230, 40.9832],
            zoom: 14,
        });
        mapRef.current = map;

        map.on('load', async () => {
            const fetchGames = async () => {
                const { data } = await supabase.rpc('get_all_active_games_with_details');
                setGames(data || []);
            };
            
            const checkForActiveGame = async () => {
                const { data: activeGameGroup } = await supabase.from('user_groups').select('game_id').eq('user_id', user.id).eq('is_active', true).single();
                if (activeGameGroup) {
                    const { data: gameDetailsArr } = await supabase.rpc('get_game_details', { game_id_input: activeGameGroup.game_id });
                    if (gameDetailsArr && gameDetailsArr.length > 0) {
                        const game = gameDetailsArr[0];
                        if (game.game_id && !game.id) game.id = game.game_id;
                        setSelectedGame(game);
                    }
                }
            };

            await checkForActiveGame();

            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true, showUserHeading: true
            });
            map.addControl(geolocate);
            geolocate.on('geolocate', (e) => setPlayerLocation([e.coords.longitude, e.coords.latitude]));
            setTimeout(() => geolocate.trigger(), 500);

            fetchGames();
            setInterval(fetchGames, 15000);
        });

        return () => {
            if (mapRef.current) mapRef.current.remove();
            clearInterval(activeCountdownInterval.current);
            delete window.handleJoinGame;
            delete window.handleExitGame;
        };
    }, [navigate]);

    // Sync markers whenever the games list changes
    useEffect(() => {
        if (!mapRef.current || !games.length) return;
        const map = mapRef.current;

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
                
                popup.on('open', () => startCountdown(game));
                popup.on('close', () => clearInterval(activeCountdownInterval.current));

                marker.gameData = game;
                gameMarkersRef.current[gameId] = marker;
            }
        });
    }, [games, selectedGame]);

    const handleDig = async () => { /* Your dig logic */ };

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
                <button id="digButton" className={canDig ? 'enabled' : ''} disabled={!canDig} onClick={handleDig}>DIG</button>
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

