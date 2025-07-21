// In src/pages/Map.jsx, replace the entire useEffect hook

useEffect(() => {
    // 1. Get User
    const user = getCachedUser();
    if (!user) {
        navigate('/login');
        return;
    }
    setCurrentUser(user);

    // 2. Prevent Map Re-initialization
    if (mapRef.current) return;

    // 3. Initialize Map
    const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: JSON.parse(sessionStorage.getItem('lastLocation')) || [-74.006, 40.7128],
        zoom: 12
    });
    mapRef.current = map;

    const fetchAndDisplayGames = async () => {
        const { data: games } = await supabase.rpc('get_all_active_games_with_details');
        if (!games) return;

        games.forEach(game => {
            if (gameMarkersRef.current[game.game_id] || !game.location?.coordinates) return;
            const el = document.createElement('div');
            el.className = 'treasure-marker';
            const marker = new mapboxgl.Marker(el)
                .setLngLat(game.location.coordinates)
                .addTo(map);
            gameMarkersRef.current[game.game_id] = marker;
        });
    };
    
    // 4. Wait for map to be fully loaded
    map.on('load', () => {
        // 5. Fetch games and user location only after the map is ready
        fetchAndDisplayGames();
        
        const geolocate = new mapboxgl.GeolocateControl({ trackUserLocation: true });
        map.addControl(geolocate);
        geolocate.trigger();
    });

}, [navigate]); // Run this effect only once
