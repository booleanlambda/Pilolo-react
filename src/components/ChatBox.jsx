// In ChatBox.jsx

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

const ChatBox = ({ game, currentUser }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef(null);

    // FIX: This useEffect clears messages when you switch games
    useEffect(() => {
        // Clear previous messages when the game changes
        setMessages([]);

        if (!game) return;
        
        const messagesRef = collection(db, 'chats', String(game.id), 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [game]); // The effect re-runs whenever the game prop changes

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => { /* ... (no changes here) ... */ };

    // This is the UI for the chat box itself
    return (
        <div className="ui-panel chat-box">
            <div className="chat-messages">
                {messages.map(msg => (
                    <div key={msg.id}>
                        <b>{msg.username || 'A User'}:</b> {msg.text}
                    </div>
                ))}
                <div ref={messagesEndRef} />
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
    );
};

export default ChatBox;
