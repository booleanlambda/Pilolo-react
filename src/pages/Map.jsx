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

// --- Helper function to generate popup HTML ---
const getPopupHTML = (game) => {
    let timeInfoHTML = '';
    const startTimeString = game.start_time;

    if (game.status && startTimeString && !isNaN(new Date(startTimeString).getTime())) {
        const startTime = new Date(startTimeString);
        const endTime = new Date(startTime);
        endTime.setMinutes(0, 0, 0);
        endTime.setHours(startTime.getHours() + 1);
        const formattedEndTime = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (game.status === 'pending' && startTime > new Date()) {
            // Use a placeholder for the countdown timer
            timeInfoHTML = `<div class="status-box future">Starts in: <span class="countdown-timer" id="countdown-${game.game_id}"></span> | Ends: ${formattedEndTime}</div>`;
        } else if (game.status === 'in_progress') {
            timeInfoHTML = `<div class="status-box live">Live! Ends at: ${formattedEndTime}</div>`;
        }
    }
    
    return `
        <div class="game-popup">
            <h3>${game.title}</h3>
            <p class="details">Prize: $${game.total_value} | Treasures: ${game.treasure_count}</p>
            <p class="creator">by ${game.creator_username}</p>
            ${timeInfoHTML}
            <button class="join-btn" id="join-btn-${game.game_id}">Join Game</button>
        </div>`;
};

const MapPage = () => {
    const navigate = useNavigate();
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const gameMarkersRef = useRef({});
    const activePopupRef = useRef(null);
    let countdownIntervalRef = useRef(null);

    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [isChatOpen, setChatOpen] = useState(false);

    // --- NEW: useEffect for hourly data refresh ---
    useEffect(() => {
        const fetchAndDisplayGames = async () => {
            const { data: games } = await supabase.rpc('get_all_active_games_with_details');
            if (!games) return;

            games.forEach(game => {
                const gameId = game.game_id || game.id;
                const marker = gameMarkersRef.current[gameId];
                if (marker) {
                    const hasStatusChanged = marker.gameData.status !== game.status;
                    marker.gameData = game; // Update data regardless

                    // FIX: Update popup content if it's open and status has changed
                    if (hasStatusChanged && marker.getPopup() && marker.getPopup().isOpen()) {
                        marker.getPopup().setHTML(getPopupHTML(game));
                        // If it changed to pending, restart the countdown
                        if (game.status === 'pending') {
                            startCountdown(game);
                        }
                    }
                }
            });
        };

        const scheduleHourlyFetch = () => {
            const now = new Date();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();
            
            // Calculate ms until the next hour's 1-minute mark
            const msToNextRun = ((60 - minutes + 1) % 60) * 60 * 1000 - (seconds * 1000);

            const timeoutId = setTimeout(() => {
                fetchAndDisplayGames(); // First run
                const intervalId = setInterval(fetchAndDisplayGames, 3600 * 1000); // Subsequent hourly runs
                return () => clearInterval(intervalId); // Cleanup for interval
            }, msToNextRun > 0 ? msToNextRun : 3600 * 1000); // If calculation is negative, wait an hour

            return () => clearTimeout(timeoutId); // Cleanup for timeout
        };

        const cleanup = scheduleHourlyFetch();
        return cleanup;
    }, []); // Runs only once on mount

    // --- NEW: Function to handle countdown timer ---
    const startCountdown = (game) => {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

        countdownIntervalRef.current = setInterval(() => {
            const countdownElement = document.getElementById(`countdown-${game.game_id}`);
            if (!countdownElement) {
                clearInterval(countdownIntervalRef.current);
                return;
            }

            const startTime = new Date(game.start_time).getTime();
            const now = new Date().getTime();
            const distance = startTime - now;

            if (distance < 0) {
                countdownElement.innerHTML = "Starting...";
                clearInterval(countdownIntervalRef.current);
                // Optionally trigger a refresh here
                return;
            }
            
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            countdownElement.textContent = `${hours}h ${minutes}m ${seconds}s`;
        }, 1000);
    };

    useEffect(() => {
        // Main setup logic... (shortened for brevity)
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-73.955, 40.815],
            zoom: 14,
        });
        mapRef.current = map;

        map.on('load', () => {
            // FIX: Add Geolocate control and blue dot correctly
            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: false,
                showUserHeading: true
            });
            map.addControl(geolocate);
            setTimeout(() => geolocate.trigger(), 500); // Trigger once after load

            // Your existing fetchAndDisplayGames logic...
            const fetchAndDisplayGames = async () => {
                 const { data: games } = await supabase.rpc('get_all_active_games_with_details');
                 if (!games) return;
                 games.forEach(game => {
                    const gameId = game.game_id || game.id;
                    if (gameMarkersRef.current[gameId]) return;

                    const el = document.createElement('div');
                    el.className = 'treasure-marker';
                    const newMarker = new mapboxgl.Marker(el)
                        .setLngLat(game.location.coordinates)
                        .addTo(map);

                    newMarker.getElement().addEventListener('click', () => {
                        if (activePopupRef.current) activePopupRef.current.remove();
                        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

                        const popupHTML = getPopupHTML(game);
                        const popup = new mapboxgl.Popup({ offset: 25, anchor: 'bottom' })
                            .setHTML(popupHTML)
                            .setLngLat(game.location.coordinates)
                            .addTo(map);
                        
                        activePopupRef.current = popup;

                        // Start countdown if game is pending
                        if (game.status === 'pending' && new Date(game.start_time) > new Date()) {
                            startCountdown(game);
                        }
                    });
                    newMarker.gameData = game;
                    gameMarkersRef.current[gameId] = newMarker;
                });
            };
            fetchAndDisplayGames();
            setInterval(fetchAndDisplayGames, 30000);
        });

        const user = getCachedUser();
        if (!user) navigate('/login');
        setCurrentUser(user);

        return () => {
             if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
             if (mapRef.current) mapRef.current.remove();
        };
    }, [navigate]);

    // JSX return remains the same...
    return (
        <div className="map-page-container">
            {/* ... */}
        </div>
    );
};

export default MapPage;
