import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your Firebase configuration from map.html
const firebaseConfig = {
    apiKey: "AIzaSyCQ7lGF8CRYOZC8m94vqNSbuFFKQAhKeTE",
    authDomain: "pilolo-chat-7c443.firebaseapp.com",
    projectId: "pilolo-chat-7c443",
    storageBucket: "pilolo-chat-7c443.appspot.com",
    messagingSenderId: "328898324550",
    appId: "1:328898324550:web:d1e8f4b6869c9920ff4247"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
