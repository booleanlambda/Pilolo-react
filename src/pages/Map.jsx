import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import Swal from 'sweetalert2';
import * as turf from '@turf/turf';
import confetti from 'canvas-confetti';

import { supabase } from '../services/supabase';
import { getCachedUser } from '../services/session'; // Assuming you create this service
import ChatBox from '../components/ChatBox';

import 'mapbox-gl/dist/mapbox-gl.css';
import '../Map.css'; // We will create this file for styles

// Set Mapbox Access Token
mapboxgl.accessToken = 'pk.eyJ1Ijoid2VtYXB6IiwiYSI6ImNtY3J0MDlqYjBwdXcyanExcTRsaG5pZXUifQ.gBtrb0P7o0ukM8HtyBcTrw';

const MapPage = () => {
    const navigate = useNavigate();
    const mapContainer = useRef(null);
    const map = useRef(null);
    const userMarker = useRef(null);
    const gameMarkers = useRef({});

    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [playerLocation, setPlayerLocation] = useState(null);
    const [isChatOpen, setChatOpen] = useState(false);
    
    // Remember the username fix from our previous conversation
    const handleSendMessage = useCallback(async (msg, db) => {
        if (!msg || !selectedGame || !currentUser) return;
        try {
            const { collection, doc, addDoc, serverTimestamp } = await import('firebase/firestore');
            const messagesRef = collection(db, 'chats', String(selectedGame.id), 'messages');
            await addDoc(messagesRef, {
                text: msg,
                userId: currentUser.id,
                username: currentUser.user_metadata?.username,
                createdAt: serverTimestamp()
            });
        } catch (err) {
            console.error("Error sending message:", err);
            Swal.fire("Chat Error", "Could not send your message.", "error");
        }
    }, [currentUser, selectedGame]);


    // Initialization Effect
    useEffect(() => {
        const user = getCachedUser();
        if (!user) {
            navigate('/login');
            return;
        }
        setCurrentUser(user);

        if (map.current) return; // Initialize map only once

        const lastLocation = JSON.parse(sessionStorage.getItem('lastLocation')) || [-74.006, 40.7128];

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/navigation-night-v1',
            center: lastLocation,
            zoom: 12
        });
    }, [navigate]);
    
    // Additional logic for digging, joining games, etc. would go in other functions
    // and useEffect hooks here. This is a simplified structure to get you started.

    return (
        <div>
            <div ref={mapContainer} className="map-container" />
            {/* We would create separate components for the UI overlays */}
            <div className="ui-panel header">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                {/* ... Header buttons */}
            </div>
            <div className="ui-panel bottom-bar">
                <button id="digButton">DIG</button>
                <button id="chatBtn" onClick={() => setChatOpen(!isChatOpen)}>
                    {/* ... Chat SVG icon */}
                </button>
            </div>
            {isChatOpen && selectedGame && (
                <ChatBox 
                    game={selectedGame}
                    currentUser={currentUser}
                    onSendMessage={handleSendMessage}
                />
            )}
        </div>
    );
};

export default MapPage;
