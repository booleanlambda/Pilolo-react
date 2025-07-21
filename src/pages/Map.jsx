import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import Swal from 'sweetalert2';
import * as turf from '@turf/turf';
import confetti from 'canvas-confetti';

// Import services
import { supabase } from '../services/supabase.js';
import { getCachedUser } from '../services/session.js';
import { db } from '../services/firebase.js'; // For chat
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

// Import CSS
import 'mapbox-gl/dist/mapbox-gl.css';
import '../Map.css';

// Set Mapbox Access Token from your .env file
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const MapPage = () => {
    const navigate = useNavigate();

    // Refs to hold instances that shouldn't trigger re-renders
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const userMarkerRef = useRef(null);
    const gameMarkersRef = useRef({});

    // State for managing UI and game logic
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const [playerLocation, setPlayerLocation] = useState(null);
    const [isChatOpen, setChatOpen] = useState(false);
    const [distanceInfo, setDistanceInfo] = useState('');
    const [canDig, setCanDig] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');

    // --- Core Logic ---

    // Function to update a game marker's popup
    const updateGameMarkerPopup = useCallback((gameId, gameData) => {
        const marker = gameMarkersRef.current[gameId];
        if (!marker) return;
        
        let buttonHTML = `<button id="join-btn-${gameId}" class="popup-btn">Join Game</button>`;
        if (selectedGame?.id === gameId) {
            buttonHTML = `<div class="button-group"><button id="chat-btn-${gameId}" class="popup-btn chat">Chat</button><button id="exit-btn-${gameId}" class="popup-btn exit">Exit</button></div>`;
        }

        const timeInfo = gameData.status === 'in_progress' 
            ? `Live! Ends: ${new Date(gameData.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : `Starts: ${new Date(gameData.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        const popupContent = `
            <div class="game-popup">
                <h3>${gameData.title}</h3>
                <p>Prize: $${gameData.total_value} | By: ${gameData.creator_username}</p>
                <p class="time-info">${timeInfo}</p>
                ${buttonHTML}
            </div>`;
        
        marker.getPopup().setHTML(popupContent);
    }, [selectedGame]);

    // Function to handle joining a game
    const handleJoinGame = useCallback(async (gameId) => {
        if (!currentUser || !playerLocation) return;
        // ... (rest of the logic from handleGameInteraction)
        setSelectedGame(gameDataFromRPC); // On success, set the selected game
    }, [currentUser, playerLocation]);

    // --- Effects ---

    // Main initialization effect (runs once)
    useEffect(() => {
        const user = getCachedUser();
        if (!user) {
            navigate('/login');
            return;
        }
        setCurrentUser(user);

        const lastLocation = JSON.parse(sessionStorage.getItem('lastLocation')) || [-74.006, 40.7128];
        
        if (mapRef.current) return; // Prevent re-initialization

        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/navigation-night-v1',
            center: lastLocation,
            zoom: 12
        });

        // Add map click listeners, geolocator, etc. here
    }, [navigate]);

    // Effect for chat subscription
    useEffect(() => {
        if (!selectedGame) return;

        const messagesRef = collection(db, 'chats', String(selectedGame.id), 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe(); // Cleanup on game change or unmount
    }, [selectedGame]);
    
    // The username fix is implemented here
    const handleSendMessage = async (e) => {
        e.preventDefault();
        const msg = newMessage.trim();
        if (!msg || !selectedGame || !currentUser) return;

        const messagesRef = collection(db, 'chats', String(selectedGame.id), 'messages');
        await addDoc(messagesRef, {
            text: msg,
            userId: currentUser.id,
            username: currentUser.user_metadata?.username, // ✅ THE FIX
            createdAt: serverTimestamp()
        });
        setNewMessage('');
    };

    return (
        <div>
            <div ref={mapContainerRef} className="map-container" />
            
            <div className="ui-panel header">
                <h2>{selectedGame ? `Playing: ${selectedGame.title}` : 'Explore Games'}</h2>
                {/* Header actions (buttons to other pages) would go here */}
            </div>

            {distanceInfo && <div id="distance-info">{distanceInfo}</div>}

            <div className="ui-panel bottom-bar">
                <button id="digButton" disabled={!canDig} className={canDig ? 'enabled' : ''}>DIG</button>
                <button id="chatBtn" onClick={() => selectedGame && setChatOpen(p => !p)}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                </button>
            </div>

            {isChatOpen && (
                <div className="ui-panel chat-box">
                    <div className="chat-messages">
                        {messages.map(msg => (
                            <div key={msg.id}>
                                <b>{msg.username || 'A User'}:</b> {msg.text}
                            </div>
                        ))}
                    </div>
                    <form onSubmit={handleSendMessage} className="chat-input">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Say something..."
                        />
                        <button type="submit">Send</button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default MapPage;
