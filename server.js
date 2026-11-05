/**
 * SFL Bypass 2.0 — JIYYAD TOOLS
 * Proxy ke API jerexd (tanpa scraper lokal)
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.SFL_API_URL || 'https://api.zyvor.my.id/api/bypass/bypasslink';
const ANDROID_ID = process.env.SFL_ANDROID_ID || 'a1b2c3d4e5f6a7b8';

app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function extractDest(data) {
  return (
    data?.result?.destination_url ||
    data?.result?.url ||
    data?.destination_url ||
    data?.url ||
    data?.data?.url ||
    data?.data?.destination_url ||
    null
  );
}

function extractShort(data, fallback) {
  return (
    data?.result?.short_url ||
    data?.short_url ||
    data?.data?.short_url ||
    fallback
  );
}

async function callApi(url) {
  const { data } = await axios.post(
    API_URL,
    { url: String(url).trim(), androidId: ANDROID_ID },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
      validateStatus: () => true,
    }
  );
  return data;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'SFL Bypass 2.0', brand: 'JIYYAD TOOLS', mode: 'api-proxy' });
});

app.post('/api/bypass', async (req, res) => {
  const start = Date.now();
  try {
    const url = (req.body && req.body.url) || '';
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ status: false, error: 'URL wajib diisi' });
    }
    const data = await callApi(url);
    const dest = extractDest(data);
    const short = extractShort(data, url.trim());
    const failed = data?.status === false || data?.success === false;

    if (failed || !dest) {
      return res.json({
        status: false,
        error: data?.error || data?.message || 'Gagal bypass / tidak ada destination URL',
        time: `${Date.now() - start}ms`,
        raw: data,
      });
    }
    res.json({
      status: true,
      time: `${Date.now() - start}ms`,
      result: { short_url: short, destination_url: dest },
    });
  } catch (e) {
    res.status(500).json({
      status: false,
      error: e.message || 'Gagal menghubungi API',
      time: `${Date.now() - start}ms`,
    });
  }
});

app.get('/api/bypass', async (req, res) => {
  const start = Date.now();
  const url = req.query.url;
  if (!url) return res.status(400).json({ status: false, error: 'Query ?url= required' });
  try {
    const data = await callApi(url);
    const dest = extractDest(data);
    if (!dest) {
      return res.json({
        status: false,
        error: data?.error || data?.message || 'No destination',
        time: `${Date.now() - start}ms`,
        raw: data,
      });
    }
    res.json({
      status: true,
      time: `${Date.now() - start}ms`,
      result: { short_url: extractShort(data, url), destination_url: dest },
    });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'API error', time: `${Date.now() - start}ms` });
  }
});


// ——— Music search (iTunes) + audio proxy ———
app.get('/api/music/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ status: false, error: 'Query kosong' });
    const { data } = await axios.get('https://itunes.apple.com/search', {
      params: { term: q, media: 'music', entity: 'song', limit: 25 },
      timeout: 15000,
    });
    const results = (data.results || []).map((t) => ({
      id: t.trackId,
      title: t.trackName,
      artist: t.artistName,
      album: t.collectionName,
      artwork: (t.artworkUrl100 || '').replace('100x100bb', '300x300bb'),
      preview: t.previewUrl || null,
      duration: t.trackTimeMillis ? Math.round(t.trackTimeMillis / 1000) : null,
      url: t.trackViewUrl,
    }));
    res.json({ status: true, count: results.length, results });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Search gagal' });
  }
});

app.get('/api/proxy-audio', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).send('Invalid url');
    }
    const range = req.headers.range;
    const headers = {
      'User-Agent': 'Mozilla/5.0',
      ...(range ? { Range: range } : {}),
    };
    const upstream = await axios.get(url, {
      responseType: 'stream',
      headers,
      timeout: 30000,
      validateStatus: () => true,
    });
    res.status(upstream.status);
    const hop = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    hop.forEach((h) => {
      if (upstream.headers[h]) res.setHeader(h, upstream.headers[h]);
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    upstream.data.pipe(res);
  } catch (e) {
    res.status(502).json({ error: e.message || 'Proxy audio gagal' });
  }
});


app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SFL Bypass 2.0 — JIYYAD TOOLS → http://localhost:${PORT}`);
});
