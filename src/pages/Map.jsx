import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';

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
        if (!user) {
            navigate('/login');
            return;
        }
        setCurrentUser(user);

        if (mapRef.current) return;

        const lastLocation = sessionStorage.getItem('lastLocation');
        const centerCoords = lastLocation ? JSON.parse(lastLocation) : [-74.006, 40.7128];

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: centerCoords,
            zoom: 12
        });
        mapRef.current = map;

        let intervalId = null;

        map.on('load', () => {
            const fetchAndDisplayGames = async () => {
                const { data: games, error } = await supabase.rpc('get_all_active_games_with_details');
                if (error) {
                    console.error('Supabase Error:', error.message);
                    return;
                }

                if (!games || !Array.isArray(games)) return;

                games.forEach(game => {
                    const coords = game.location?.coordinates;
                    if (!coords || !Array.isArray(coords) || coords.length !== 2) return;

                    if (gameMarkersRef.current[game.game_id]) return;

                    const el = document.createElement('div');
                    el.className = 'treasure-marker';

                    const popupContent = `
                        <div class="game-popup">
                            <h3>${game.title}</h3>
                            <p>$${game.total_value} Prize | By: ${game.creator_username}</p>
                        </div>
                    `;

                    const marker = new mapboxgl.Marker(el)
                        .setLngLat(coords)
                        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent))
                        .addTo(map);

                    gameMarkersRef.current[game.game_id] = marker;

                    // Set selected game if current user is a participant
                    if (!selectedGame && game.participants?.some(p => p.user_id === user.id)) {
                        setSelectedGame(game);
                    }
                });
            };

            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true
            });
            map.addControl(geolocate);

            setTimeout(() => geolocate.trigger(), 1000);

            geolocate.on('error', (e) => {
                console.error('Geolocate Error:', e.message);
            });

            fetchAndDisplayGames();
            intervalId = setInterval(fetchAndDisplayGames, 30000);
        });

        return () => {
            if (intervalId) clearInterval(intervalId);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [navigate, selectedGame]);

    return (
        <div className="map-page-container">
            <div ref={mapContainerRef} className="map-container" />

            <div id="header" className="ui-panel">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                <div className="header-actions">
                    <Link to="/how-to-play" className="header-icon-btn" title="How to Play">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
                    </Link>
                    <Link to="/create" className="header-icon-btn" title="Create Game">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </Link>
                    <Link to="/profile" className="header-icon-btn" title="Profile">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2a5 5 0 110 10 5 5 0 010-10zm0 12c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/></svg>
                    </Link>
                </div>
            </div>

            <div id="bottom-bar" className="ui-panel bottom-bar">
                <button id="digButton">DIG</button>
                <button id="chatBtn" onClick={() => selectedGame && setChatOpen(prev => !prev)}>
                    <ChatIcon />
                </button>
            </div>

            {isChatOpen && (
                <ChatBox
                    game={selectedGame}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};

export default MapPage;
