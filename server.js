const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Подключение к базе Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Тестовый запрос для проверки работы (его пингует UptimeRobot)
app.get('/', (req, res) => {
  res.send('Jamm Server is running! 🎵');
});

// 1. Создать комнату (плейлист)
app.post('/api/create-room', async (req, res) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const result = await pool.query(
      'INSERT INTO rooms (code) VALUES ($1) RETURNING id, code',
      [code]
    );
    res.json({ success: true, room: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания комнаты' });
  }
});

// 2. Войти в комнату по коду и получить список треков
app.get('/api/room/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const room = await pool.query('SELECT id, code FROM rooms WHERE code = $1', [code]);
    if (room.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }
    
    // Запрашиваем треки, включая новую колонку url
    const tracks = await pool.query(
      'SELECT id, title, artist, added_by, url FROM tracks WHERE room_id = $1 ORDER BY created_at ASC', 
      [room.rows[0].id]
    );
    res.json({ room: room.rows[0], tracks: tracks.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения комнаты' });
  }
});

// 3. Добавить трек в плейлист
app.post('/api/room/:code/add-track', async (req, res) => {
  try {
    const { code } = req.params;
    const { title, artist, added_by, url } = req.body;
    
    const room = await pool.query('SELECT id FROM rooms WHERE code = $1', [code]);
    if (room.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const newTrack = await pool.query(
      'INSERT INTO tracks (room_id, title, artist, added_by, url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [room.rows[0].id, title, artist, added_by, url]
    );
    res.json({ success: true, track: newTrack.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка добавления трека' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
