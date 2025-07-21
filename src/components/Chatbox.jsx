import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase'; // Our new firebase service
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

const ChatBox = ({ game, currentUser, onSendMessage }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!game) return;
        
        const messagesRef = collection(db, 'chats', String(game.id), 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs = [];
            querySnapshot.forEach((doc) => {
                msgs.push({ id: doc.id, ...doc.data() });
            });
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [game]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newMessage.trim() === "") return;
        onSendMessage(newMessage.trim(), db); // Use the passed-in send function
        setNewMessage("");
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
            <form onSubmit={handleSubmit} className="chat-input">
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
