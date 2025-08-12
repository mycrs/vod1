const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

console.log('🎬 QRUZE PLAYER - Dinamik Xtream Sunucusu v14.0 (Mantıksal Ayırma Motoru)');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            console.error('❌ index.html dosyası gönderilirken hata:', err);
            res.status(500).send("Uygulama yüklenemedi. 'public' klasörünün içinde 'index.html' dosyası olduğundan emin olun.");
        }
    });
});

const userCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000;

async function fetchFromXtreamAPI(host, username, password, params) {
    const url = new URL('/player_api.php', host);
    url.searchParams.set('username', username);
    url.searchParams.set('password', password);
    for (const key in params) {
        url.searchParams.set(key, params[key]);
    }

    try {
        const response = await axios.get(url.toString(), { timeout: 20000 });
        if (response.data && !Array.isArray(response.data) && Object.keys(response.data).length === 0) {
           return [];
        }
        return response.data;
    } catch (error) {
        console.error(`❌ Xtream API Hatası (action=${params.action}):`, error.message);
        throw new Error(`IPTV sunucusuna bağlanırken hata oluştu (${params.action}).`);
    }
}

app.use('/api', (req, res, next) => {
    req.xtream = {
        host: req.headers['x-xtream-host'],
        username: req.headers['x-xtream-username'],
        password: req.headers['x-xtream-password']
    };
    if (!req.xtream.host || !req.xtream.username || !req.xtream.password) {
        return res.status(401).json({ status: 'error', message: 'Giriş bilgileri eksik.' });
    }
    next();
});

app.get('/api/categories', async (req, res) => {
    const cacheKey = `categories@${req.xtream.username}`;
    if (userCache.has(cacheKey) && (Date.now() - userCache.get(cacheKey).timestamp < CACHE_DURATION)) {
        return res.json({ status: 'success', data: userCache.get(cacheKey).data });
    }
    try {
        console.log('🔄 Kategoriler API üzerinden çekiliyor...');
        const [movieCategories, seriesCategories] = await Promise.all([
            fetchFromXtreamAPI(req.xtream.host, req.xtream.username, req.xtream.password, { action: 'get_vod_categories' }),
            fetchFromXtreamAPI(req.xtream.host, req.xtream.username, req.xtream.password, { action: 'get_series_categories' })
        ]);
        console.log(`✅ Kategoriler alındı. Film: ${movieCategories.length}, Dizi: ${seriesCategories.length}`);

        const data = {
            movieCategories: movieCategories.map(c => ({ id: c.category_id, name: c.category_name })),
            seriesCategories: seriesCategories.map(c => ({ id: c.category_id, name: c.category_name }))
        };

        userCache.set(cacheKey, { data, timestamp: Date.now() });
        res.json({ status: 'success', data });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/movies', async (req, res) => {
    const { category_id } = req.query;
    try {
        console.log(`🎬 Film içeriği isteniyor: Kategori ID ${category_id}`);
        const movies = await fetchFromXtreamAPI(req.xtream.host, req.xtream.username, req.xtream.password, { action: 'get_vod_streams', category_id });
        console.log(`🎥 ${movies.length} adet film bulundu.`);
        res.json({ status: 'success', data: movies });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// DOĞRU DİZİ İÇERİK ENDPOINT'İ
app.get('/api/series', async (req, res) => {
    const { category_id } = req.query;
    try {
        console.log(`📺 Dizi içeriği isteniyor: Kategori ID ${category_id}`);
        // Dizileri getirmek için doğru ve standart komut 'get_series' kullanılır.
        const series = await fetchFromXtreamAPI(req.xtream.host, req.xtream.username, req.xtream.password, { action: 'get_series', category_id });
        console.log(`🎞️  ${series.length} adet dizi bulundu.`);
        res.json({ status: 'success', data: series });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/series_info/:series_id', async (req, res) => {
    const { series_id } = req.params;
    try {
        const seriesInfo = await fetchFromXtreamAPI(req.xtream.host, req.xtream.username, req.xtream.password, { action: 'get_series_info', series_id });
        res.json({ status: 'success', data: seriesInfo });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 QRUZE PLAYER sunucusu http://localhost:${PORT} adresinde başlatıldı!`);
});