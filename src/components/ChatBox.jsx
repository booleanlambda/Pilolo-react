import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

const ChatBox = ({ game, currentUser }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef(null);

    // Effect to subscribe to chat messages for the selected game
    useEffect(() => {
        if (!game) return;
        
        const messagesRef = collection(db, 'chats', String(game.id), 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);
        });

        return () => unsubscribe(); // Cleanup subscription on component unmount
    }, [game]);

    // Effect to auto-scroll to the latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const msg = newMessage.trim();
        if (!msg) return;

        try {
            const messagesRef = collection(db, 'chats', String(game.id), 'messages');
            await addDoc(messagesRef, {
                text: msg,
                userId: currentUser.id,
                // ✅ THE FIX: Using the correct username property
                username: currentUser.user_metadata?.username,
                createdAt: serverTimestamp()
            });
            setNewMessage("");
        } catch (err) {
            console.error("Error sending message:", err);
            // You could add a user-facing error here
        }
    };

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
