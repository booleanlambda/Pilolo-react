import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const MapPage = () => {
    const navigate = useNavigate();
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const userMarkerRef = useRef(null);
    const gameMarkersRef = useRef({});

    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [isChatOpen, setChatOpen] = useState(false);
    
    // --- DATA FETCHING ---
 // In src/pages/Map.jsx...
// In src/pages/Map.jsx...
// Replace the existing fetchAndDisplayGames function with this one

const fetchAndDisplayGames = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    const { data: games } = await supabase.rpc('get_all_active_games_with_details');
    if (!games) return;

    const activeGameIds = new Set(games.map(g => g.game_id));

    Object.keys(gameMarkersRef.current).forEach(id => {
        if (!activeGameIds.has(id)) {
            gameMarkersRef.current[id].remove();
            delete gameMarkersRef.current[id];
        }
    });

    games.forEach(game => {
        if (gameMarkersRef.current[game.game_id] || !game.location?.coordinates) return;

        const el = document.createElement('div');
        el.className = 'treasure-marker';

        // ✅ This section now builds the full popup content
        const timeInfo = game.status === 'in_progress'
            ? `Live! Ends: ${new Date(game.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : `Starts: ${new Date(game.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        const popupContent = `
            <div class="game-popup">
                <h3>${game.title}</h3>
                <p class="game-creator">Prize: $${game.total_value} | By: ${game.creator_username}</p>
                <p class="time-info">${timeInfo}</p>
            </div>`;

        const marker = new mapboxgl.Marker(el)
            .setLngLat(game.location.coordinates)
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent))
            .addTo(map);

        gameMarkersRef.current[game.game_id] = marker;
    });
}, []);





    // --- INITIALIZATION & PERMISSIONS ---
    // Replace your existing initialization useEffect (the long one) with this.
// The rest of your MapPage component can stay the same.

useEffect(() => {
    const user = getCachedUser();
    if (!user) { navigate('/login'); return; }
    setCurrentUser(user);

    if (mapRef.current) return;

    const lastLocation = JSON.parse(sessionStorage.getItem('lastLocation')) || [-74.006, 40.7128];
    
    const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: lastLocation,
        zoom: 12
    });
    mapRef.current = map;

    // --- NEW STRUCTURE ---
    // Define the function inside the useEffect that has access to the 'map' variable
    const fetchAndDisplayGames = async () => {
        const { data: games, error } = await supabase.rpc('get_all_active_games_with_details');
        if (error || !games) {
            console.error("Error fetching games:", error);
            return;
        }

        const activeGameIds = new Set(games.map(g => g.game_id));

        Object.keys(gameMarkersRef.current).forEach(id => {
            if (!activeGameIds.has(id)) {
                gameMarkersRef.current[id].remove();
                delete gameMarkersRef.current[id];
            }
        });

        games.forEach(game => {
            if (gameMarkersRef.current[game.game_id] || !game.location?.coordinates) return;
            
            const el = document.createElement('div');
            el.className = 'treasure-marker';

            const popupContent = `
                <div class="game-popup">
                    <h3>${game.title}</h3>
                    <p class="game-creator">Prize: $${game.total_value} | By: ${game.creator_username}</p>
                </div>`;

            const marker = new mapboxgl.Marker(el)
                .setLngLat(game.location.coordinates)
                .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent))
                .addTo(map);

            gameMarkersRef.current[game.game_id] = marker;
        });
    };

    map.on('load', () => {
        fetchAndDisplayGames(); // Initial fetch
        
        // Setup user location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const userLngLat = [position.coords.longitude, position.coords.latitude];
                map.flyTo({ center: userLngLat, zoom: 15 });
                const el = document.createElement('div');
                el.className = 'user-marker';
                new mapboxgl.Marker(el).setLngLat(userLngLat).addTo(map);
            });
        }
        
        // Set interval for refreshing games
        const intervalId = setInterval(fetchAndDisplayGames, 30000);
        return () => clearInterval(intervalId); // Cleanup
    });

}, [navigate]); // Note: dependency array is now simpler

};

export default MapPage;
