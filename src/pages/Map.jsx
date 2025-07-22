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
    const [navCountdownText, setNavCountdownText] = useState(''); // State for the nav timer

    // Effect for the navigation countdown timer
    useEffect(() => {
        if (!selectedGame) {
            setNavCountdownText('');
            return;
        }

        let targetTime;
        let prefix = '';

        if (selectedGame.status === 'pending' && new Date(selectedGame.start_time) > new Date()) {
            targetTime = new Date(selectedGame.start_time).getTime();
            prefix = 'Starts in: ';
        } else if (selectedGame.status === 'in_progress') {
            const endTime = new Date(selectedGame.start_time);
            endTime.setMinutes(0, 0, 0);
            endTime.setHours(endTime.getHours() + 1);
            targetTime = endTime.getTime();
            prefix = 'Ends in: ';
        } else {
            setNavCountdownText('');
            return;
        }

        const intervalId = setInterval(() => {
            const distance = targetTime - new Date().getTime();
            if (distance < 0) {
                setNavCountdownText("Updating status...");
                clearInterval(intervalId);
                return;
            }
            const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((distance % (1000 * 60)) / 1000);
            setNavCountdownText(`${prefix}${h}h ${m}m ${s}s`);
        }, 1000);

        return () => clearInterval(intervalId);
    }, [selectedGame]);

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

    // Effect for setting up join/exit handlers
    useEffect(() => {
        window.handleJoinGame = async (gameId) => {
            const gameToJoin = games.find(g => g.game_id === gameId);
            if (!gameToJoin || !currentUser || !playerLocation) {
                return Swal.fire('Error', 'Cannot get user, location, or game data to join.', 'error');
            }
            const { data, error } = await supabase.rpc('join_game', {
                user_id_input: currentUser.id, game_id_input: gameId,
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

        return () => {
            delete window.handleJoinGame;
            delete window.handleExitGame;
        };
    }, [games, currentUser, playerLocation]);

    // Main setup effect - runs only once
    useEffect(() => {
        if (mapRef.current) return;

        const user = getCachedUser();
        if (!user) { navigate('/login'); return; }
        setCurrentUser(user);

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-73.7230, 40.9832],
            zoom: 14,
        });
        mapRef.current = map;

        const fetchGames = async () => {
            const { data } = await supabase.rpc('get_all_active_games_with_details');
            setGames(data || []);
        };

        map.on('load', async () => {
            const checkForActiveGame = async () => {
                const { data: activeGameGroup } = await supabase.from('user_groups').select('game_id').eq('user_id', user.id).eq('is_active', true).single();
                if (activeGameGroup) {
                    const allGames = await supabase.rpc('get_all_active_games_with_details');
                    if (allGames.data) {
                        const activeGame = allGames.data.find(g => g.game_id === activeGameGroup.game_id);
                        if (activeGame) {
                            setSelectedGame(activeGame);
                        }
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
            const intervalId = setInterval(fetchGames, 15000);
            return () => clearInterval(intervalId);
        });

        return () => {
            if (mapRef.current) mapRef.current.remove();
            clearInterval(activeCountdownInterval.current);
        };
    }, [navigate]);

    // Effect to sync markers with the `games` and `selectedGame` states
    useEffect(() => {
        if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
        const map = mapRef.current;
        const currentGameIds = new Set(games.map(g => g.game_id));

        Object.keys(gameMarkersRef.current).forEach(markerId => {
            if (!currentGameIds.has(markerId)) {
                gameMarkersRef.current[markerId].remove();
                delete gameMarkersRef.current[markerId];
            }
        });

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

    // Effect to fetch dig counts
    useEffect(() => {
        const updateDigCounts = async () => {
            if (!currentUser || !selectedGame) { setDigCounts(null); return; }
            const { data } = await supabase.rpc('get_dig_counts', { user_id_input: currentUser.id, game_id_input: selectedGame.game_id });
            const counts = data?.[0];
            if (counts) {
                setDigCounts({
                    standard: Math.max(0, counts.base_allowance - counts.digs_taken),
                    bonus: Math.max(0, counts.bonus_balance - Math.max(0, counts.digs_taken - counts.base_allowance))
                });
            } else {
                setDigCounts(null);
            }
        };
        updateDigCounts();
    }, [selectedGame, currentUser]);

    // Effect to check if player can dig
    useEffect(() => {
        if (playerLocation && selectedGame && selectedGame.status === 'in_progress') {
            const gamePoint = turf.point(selectedGame.location.coordinates);
            const playerPoint = turf.point(playerLocation);
            setCanDig(turf.distance(playerPoint, gamePoint, { units: 'meters' }) <= 30.5);
        } else {
            setCanDig(false);
        }
    }, [playerLocation, selectedGame]);

    const handleDig = async () => {
        if (!canDig) return;
        try {
            const { data, error } = await supabase.rpc('dig_treasure', {
                user_id_input: currentUser.id,
                game_id_input: selectedGame.game_id,
                longitude: playerLocation[0],
                latitude: playerLocation[1]
            });
            if (error) throw error;
            const result = data?.[0];
            if (!result) throw new Error("No response from server after digging.");
            
            switch (result.status) {
                case 'ERROR':
                    Swal.fire({ title: 'Cannot Dig', text: result.message, icon: 'warning' });
                    break;
                case 'SUCCESS_HIT':
                    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
                    Swal.fire({ title: 'You Won!', text: result.message, icon: 'success' });
                    break;
                case 'SUCCESS_MISS':
                    Swal.fire({ title: 'Dug Dirt!', text: result.message, icon: 'info' });
                    break;
                default:
                    Swal.fire('Unknown Outcome', 'Received an unexpected response.', 'question');
            }
            const { data: countsData } = await supabase.rpc('get_dig_counts', { user_id_input: currentUser.id, game_id_input: selectedGame.game_id });
            const counts = countsData?.[0];
            if (counts) {
                setDigCounts({
                    standard: Math.max(0, counts.base_allowance - counts.digs_taken),
                    bonus: Math.max(0, counts.bonus_balance - Math.max(0, counts.digs_taken - counts.base_allowance))
                });
            }
        } catch (err) {
            Swal.fire('Client Error', err.message, 'error');
        }
    };

    return (
        <div className="map-page-container">
            <div ref={mapContainerRef} className="map-container" />
            <div className="ui-panel header">
                <h2>
                    {selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}
                    {navCountdownText && <span className="nav-countdown"> | {navCountdownText}</span>}
                </h2>
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
