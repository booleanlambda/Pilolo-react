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
    const mapRef = useRef(null); // Use a ref to hold the map instance

    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [isChatOpen, setChatOpen] = useState(false);

    useEffect(() => {
        // --- FIX: This entire useEffect block is structured to run only ONCE ---
        
        // Guard 1: If the map is already initialized, do nothing.
        if (mapRef.current) return;
        
        // Guard 2: If the container div isn't ready, do nothing. This prevents the crash.
        if (!mapContainerRef.current) return;

        // Initialize the map
        const map = new mapboxgl.Map({
            container: mapContainerRef.current, // Now we know this is a valid HTMLElement
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-73.955, 40.815],
            zoom: 14,
        });

        // Save the map instance to the ref
        mapRef.current = map;

        // All map-related setup happens inside the 'load' event
        map.on('load', () => {
            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: false,
                showUserHeading: true
            });
            map.addControl(geolocate);
            setTimeout(() => geolocate.trigger(), 500);

            // You can add your fetchAndDisplayGames logic and other initial setup here
        });

        // Check for user session
        const user = getCachedUser();
        if (!user) {
            navigate('/login');
        } else {
            setCurrentUser(user);
        }

        // Cleanup function to remove the map when the component unmounts
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };

    }, []); // <-- FIX: The empty array ensures this effect runs only once after the first render.

    // The rest of your functions (handleJoinGame, etc.) and JSX return go here...
    // The JSX has not changed.

    return (
        <div className="map-page-container">
            <div ref={mapContainerRef} className="map-container" />
            <div className="ui-panel header">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                <div className="header-actions">
                    <Link to="/how-to-play" className="header-icon-btn" aria-label="How to Play">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
                    </Link>
                    <Link to="/create" className="header-icon-btn" aria-label="Create Game">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </Link>
                    <Link to="/profile" className="header-icon-btn" aria-label="Profile">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 2a5 5 0 110 10 5 5 0 010-10zm0 12c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/></svg>
                    </Link>
                </div>
            </div>
            <div className="ui-panel bottom-bar">
                <button id="digButton">DIG</button>
                <button id="chatBtn" onClick={() => selectedGame && currentUser && setChatOpen(p => !p)}>
                    {/* Assuming ChatIcon is a valid component */}
                </button>
            </div>
            {isChatOpen && selectedGame && currentUser && (
                <ChatBox game={selectedGame} currentUser={currentUser} />
            )}
        </div>
    );
};

export default MapPage;
