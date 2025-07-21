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

    useEffect(() => {
        const user = getCachedUser();
        if (!user) { navigate('/login'); return; }
        setCurrentUser(user);

        if (mapRef.current) return;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: JSON.parse(sessionStorage.getItem('lastLocation')) || [-74.006, 40.7128],
            zoom: 12
        });
        mapRef.current = map;

        map.on('load', () => {
            const fetchAndDisplayGames = async () => {
                const { data: games } = await supabase.rpc('get_all_active_games_with_details');
                if (!games) return;

                games.forEach(game => {
                    if (gameMarkersRef.current[game.game_id] || !game.location?.coordinates) return;
                    
                    const el = document.createElement('div');
                    el.className = 'treasure-marker';
                    const popupContent = `<div class="game-popup"><h3>${game.title}</h3><p>$${game.total_value} Prize | By: ${game.creator_username}</p></div>`;
                    const marker = new mapboxgl.Marker(el)
                        .setLngLat(game.location.coordinates)
                        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent))
                        .addTo(map);

                    gameMarkersRef.current[game.game_id] = marker;
                });
            };

            // Use Mapbox's control for geolocation
            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true
            });
            map.addControl(geolocate);
            
            // Trigger it to find location on load
            geolocate.trigger();

            // Fetch games initially and then on an interval
            fetchAndDisplayGames();
            const intervalId = setInterval(fetchAndDisplayGames, 30000);
            return () => clearInterval(intervalId);
        });

    }, [navigate]);

    return (
        <div className="map-page-container">
            <div ref={mapContainerRef} className="map-container" />
            
            <div className="ui-panel header">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                <div className="header-actions">
                    <Link to="/how-to-play" className="header-icon-btn" title="How to Play">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24
