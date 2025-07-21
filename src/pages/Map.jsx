import React, { useState, useEffect, useRef, useCallback } from 'react';
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

    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [isChatOpen, setChatOpen] = useState(false);

    const fetchAndDisplayGames = useCallback(async () => {
        const map = mapRef.current;
        if (!map) return;

        const { data: games } = await supabase.rpc('get_all_active_games_with_details');
        if (!games) return;

        games.forEach(game => {
            if (gameMarkersRef.current[game.game_id] || !game.location?.coordinates) return;
            
            const el = document.createElement('div');
            el.className = 'treasure-marker';

            const timeInfo = game.status === 'in_progress'
                ? `Live! Ends: ${new Date(game.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : `Starts: ${new Date(game.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

            const popupContent = `
                <div class="game-popup">
                    <h3>${game.title}</h3>
                    <p>${game.total_value} Prize | By: ${game.creator_username}</p>
                    <p class="time-info">${timeInfo}</p>
                </div>`;

            const marker = new mapboxgl.Marker(el)
                .setLngLat(game.location.coordinates)
                .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent))
                .addTo(map);

            gameMarkersRef.current[game.game_id] = marker;
        });
    }, []);

    // In src/pages/Map.jsx, replace the existing useEffect with this one...

useEffect(() => {
    const user = getCachedUser();
    if (!user) { navigate('/login'); return; }
    setCurrentUser(user);

    if (mapRef.current) return; // Ensures map is only initialized once

    // Initialize the map
    const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: JSON.parse(sessionStorage.getItem('lastLocation')) || [-74.006, 40.7128],
        zoom: 12
    });
    mapRef.current = map;

    // Wait for the map to fully load before doing anything else
    map.on('load', () => {
        
        // --- This function now lives inside the 'load' event ---
        const fetchAndDisplayGames = async () => {
            const { data: games } = await supabase.rpc('get_all_active_games_with_details');
            if (!games) return;

            games.forEach(game => {
                if (gameMarkersRef.current[game.game_id] || !game.location?.coordinates) return;
                
                const el = document.createElement('div');
                el.className = 'treasure-marker';

                const marker = new mapboxgl.Marker(el)
                    .setLngLat(game.location.coordinates)
                    .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<h3>${game.title}</h3>`))
                    .addTo(map);

                gameMarkersRef.current[game.game_id] = marker;
            });
        };
        
        // --- Location logic also runs after load ---
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const userLngLat = [position.coords.longitude, position.coords.latitude];
                map.flyTo({ center: userLngLat, zoom: 15 });
                const el = document.createElement('div');
                el.className = 'user-marker';
                new mapboxgl.Marker(el).setLngLat(userLngLat).addTo(map);
            });
        }

        // --- Fetch games and set the refresh interval ---
        fetchAndDisplayGames();
        const intervalId = setInterval(fetchAndDisplayGames, 30000);
        
        // Cleanup function for when the component is unmounted
        return () => clearInterval(intervalId);
    });

}, [navigate]); // Dependency array is simplified

};

export default MapPage;
