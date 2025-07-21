import { supabase } from './supabase.js';

/**
 * Retrieves the cached user from sessionStorage for fast page loads.
 * @returns {object|null} The cached user object, or null.
 */
export function getCachedUser() {
    try {
        const cachedUserJSON = sessionStorage.getItem('piloloUser');
        return cachedUserJSON ? JSON.parse(cachedUserJSON) : null;
    } catch (error) {
        console.error("Error parsing cached user:", error);
        return null;
    }
}

/**
 * Logs the user out by signing out from Supabase and clearing the cache.
 * The component that calls this will be responsible for redirecting the user.
 */
export async function logout() {
  await supabase.auth.signOut();
  sessionStorage.removeItem('piloloUser');
  sessionStorage.removeItem('lastLocation');
}
