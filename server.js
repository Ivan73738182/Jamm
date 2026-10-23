const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/', (req, res) => {
  res.send('Jamm Server is running! 🎵');
});

app.post('/api/create-room', async (req, res) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const result = await pool.query(
      'INSERT INTO rooms (code) VALUES ($1) RETURNING id, code',
      [code]
    );
    res.json({ success: true, room: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка создания комнаты' });
  }
});

app.get('/api/room/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const room = await pool.query('SELECT id, code FROM rooms WHERE code = $1', [code]);
    if (room.rows.length === 0) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }
    const tracks = await pool.query(
      'SELECT id, title, artist, added_by, url, cover_url FROM tracks WHERE room_id = $1 ORDER BY created_at ASC', 
      [room.rows[0].id]
    );
    res.json({ room: room.rows[0], tracks: tracks.rows });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения комнаты' });
  }
});

app.post('/api/room/:code/add-track', async (req, res) => {
  try {
    const { code } = req.params;
    const { title, artist, added_by, url, cover_url } = req.body;
    const room = await pool.query('SELECT id FROM rooms WHERE code = $1', [code]);
    if (room.rows.length === 0) return res.status(404).json({ error: 'Комната не найдена' });

    const newTrack = await pool.query(
      'INSERT INTO tracks (room_id, title, artist, added_by, url, cover_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [room.rows[0].id, title, artist, added_by, url, cover_url]
    );
    res.json({ success: true, track: newTrack.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка добавления трека' });
  }
});

app.delete('/api/track/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tracks WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

app.put('/api/track/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    await pool.query('UPDATE tracks SET title = $1 WHERE id = $2', [title, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

// --- НОВЫЕ ЭНДПОИНТЫ ДЛЯ ЧАТА ---

// Получить сообщения комнаты
app.get('/api/room/:code/messages', async (req, res) => {
  try {
    const { code } = req.params;
    const room = await pool.query('SELECT id FROM rooms WHERE code = $1', [code]);
    if (room.rows.length === 0) return res.status(404).json({ error: 'Комната не найдена' });

    const messages = await pool.query(
      'SELECT id, sender_name, text, created_at FROM messages WHERE room_id = $1 ORDER BY created_at ASC',
      [room.rows[0].id]
    );
    res.json({ messages: messages.rows });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения сообщений' });
  }
});

// Отправить сообщение
app.post('/api/room/:code/messages', async (req, res) => {
  try {
    const { code } = req.params;
    const { sender_name, text } = req.body;
    const room = await pool.query('SELECT id FROM rooms WHERE code = $1', [code]);
    if (room.rows.length === 0) return res.status(404).json({ error: 'Комната не найдена' });

    const newMessage = await pool.query(
      'INSERT INTO messages (room_id, sender_name, text) VALUES ($1, $2, $3) RETURNING *',
      [room.rows[0].id, sender_name, text]
    );
    res.json({ success: true, message: newMessage.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка отправки сообщения' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
