import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase'; // Assuming supabase client is exported from here
import './Login.css'; // We will create this file next

const LoginPage = () => {
    const [view, setView] = useState('login'); // Controls 'login' or 'register' view
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Form state for both forms
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');

    const navigate = useNavigate();

    // Generate a unique username when switching to register view
    useEffect(() => {
        if (view === 'register') {
            const uniqueUser = `user_${Math.random().toString(36).substring(2, 9)}`;
            setUsername(uniqueUser);
        }
    }, [view]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError('Invalid login credentials.');
        } else if (data.user) {
            sessionStorage.setItem('piloloUser', JSON.stringify(data.user));
            navigate('/'); // Redirect to the main map page
        }
        setIsLoading(false);
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        if (password !== passwordConfirm) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        
        setIsLoading(true);
        setError('');

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username } }
        });

        if (error) {
            setError(error.message.includes('User already registered') ? 'This email is already in use.' : 'Signup failed. Please try again.');
        } else {
            alert('Signup successful! Please check your email to verify your account.');
            setView('login'); // Switch back to login view
        }
        setIsLoading(false);
    };

    return (
        <div className="login-body">
            <div className="container">
                {view === 'login' ? (
                    /* LOGIN VIEW */
                    <div>
                        <div className="title-container">
                            {/* SVG Icon */}
                            <h1 className="game-title">Pilolo</h1>
                        </div>
                        <h2>Welcome Back</h2>
                        <form onSubmit={handleLogin}>
                            <label htmlFor="loginEmail">Email</label>
                            <input type="email" id="loginEmail" placeholder="Enter your email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                            
                            <label htmlFor="loginPassword">Password</label>
                            <input type="password" id="loginPassword" placeholder="Enter your password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                            
                            <div className="error">{error}</div>
                            
                            <button type="submit" className="btn" disabled={isLoading}>
                                <span className="btn-text">Login</span>
                                {isLoading && <div className="loader"></div>}
                            </button>
                        </form>
                        <div className="switch">Don't have an account? <a onClick={() => setView('register')}>Register</a></div>
                    </div>
                ) : (
                    /* REGISTER VIEW */
                    <div>
                        <div className="title-container">
                            {/* SVG Icon */}
                            <h1 className="game-title">Pilolo</h1>
                        </div>
                        <h2>Create Account</h2>
                        <form onSubmit={handleRegister}>
                            <label htmlFor="regUsername">Username</label>
                            <input type="text" id="regUsername" value={username} disabled />

                            <label htmlFor="regEmail">Email</label>
                            <input type="email" id="regEmail" placeholder="your@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} />

                            <label htmlFor="regPassword">Password</label>
                            <input type="password" id="regPassword" placeholder="At least 6 characters" required value={password} onChange={(e) => setPassword(e.target.value)} />
                            
                            <label htmlFor="regPasswordConfirm">Confirm Password</label>
                            <input type="password" id="regPasswordConfirm" placeholder="Repeat password" required value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
                            
                            <div className="error">{error}</div>
                            
                            <button type="submit" className="btn" disabled={isLoading}>
                                <span className="btn-text">Register</span>
                                {isLoading && <div className="loader"></div>}
                            </button>
                        </form>
                        <div className="switch">Already have an account? <a onClick={() => setView('login')}>Login</a></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoginPage;
