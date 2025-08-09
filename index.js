const fastify = require('fastify')({ logger: true });
const { nanoid } = require('nanoid');
const db = require('./db');
const ms = require('ms');
const bcrypt = require('bcryptjs');

fastify.get('/', (request, reply) => {
  reply.send({ status: 'ok' });
});

fastify.post('/paste', (request, reply) => {
  let { content, expires_in, read_once, password, title, available_at } = request.body;
  const currentTime = Date.now();

  if (!content) {
    return reply.code(400).send({ error: 'Content is required' });
  }

  if (!title || title.trim() === "") {
    title = null;
  }

  if (!read_once) {
    read_once = '0';
  }
  if (read_once !== '0' && read_once !== '1') {
    return reply.code(400).send({ error: 'Invalid boolean. Use 0 for FALSE and 1 for TRUE!' });
  }

  if (!available_at || available_at.trim() === "") {
    available_at = 0;
  } else {
    const msValue = ms(available_at);
    if (!msValue) {
      return reply.code(400).send({ error: 'Invalid available_at format. Use "10m", "1h", etc.' });
    }
    available_at = currentTime + msValue;
  }

  if (!ms(expires_in)) {
    return reply.code(400).send({ error: 'Invalid expiration format. Use values like "10m", "1h", or "2d".' });
  }
  const expiresAt = currentTime + ms(expires_in || '1hr');

  if (!password || password.trim() === "") {
    password = null;
  } else {
    const salt = bcrypt.genSaltSync(10);
    password = bcrypt.hashSync(password, salt);
  }

  const id = nanoid(8);

  const stmt = db.prepare("INSERT INTO pastes(id, content, expires_at, created_at, read_once, password, available_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  stmt.run(id, content, expiresAt, currentTime, read_once, password, available_at);

  reply.send({ id });
});

fastify.get('/validate/:id', (request, reply) => {
  const { id } = request.params;
  const stmt = db.prepare('SELECT password, expires_at FROM pastes WHERE id = ?');
  const result = stmt.get(id);

  if (!result) {
    return reply.code(404).send({ error: 'Content not found' });
  }

  if (!result.password) {
    return reply.code(200).send({ requires_password: false, expires_at: result.expires_at });
  }
  reply.send({
    requires_password: true,
    expires_at: result.expires_at
  });
});

fastify.get('/paste/:id', (request, reply) => {
  const { id } = request.params;
  const stmt = db.prepare("SELECT content, expires_at, created_at, read_once, password, available_at FROM pastes WHERE id = ?");
  const row = stmt.get(id);

  if (!row) {
    return reply.code(404).send({ error: 'Content not found' });
  }

  if (Date.now() < row.available_at) {
    const waitTime = row.available_at - Date.now();
    return reply.code(403).send({
      error: "Paste not yet available",
      available_in: ms(waitTime, { long: true })
    });
  }

  if (row.password) {
    const password = request.query.password || '';
    if (!bcrypt.compareSync(password, row.password)) {
      return reply.code(401).send({ error: 'Password does not match' });
    }
  }

  if (row.read_once === '1') {
    const delStmt = db.prepare('DELETE FROM pastes WHERE id = ?');
    delStmt.run(id);
  }

  return reply.send({
    content: row.content,
    expires_at: new Date(row.expires_at).toISOString(),
    created_at: new Date(row.created_at).toISOString(),
  });
});

fastify.get('/pastes/recent', (request, reply) => {
  const now = Date.now();
  const stmt = db.prepare('SELECT content FROM pastes WHERE expires_at > ? AND available_at <= ? ORDER BY created_at DESC LIMIT 20');
  const result = stmt.all(now, now);
  reply.send(result);
});

fastify.delete('/paste/:id', (request, reply) => {
  const { id } = request.params;
  const stmt = db.prepare('SELECT content, password FROM pastes WHERE id = ?');
  const result = stmt.get(id);

  if (!result) {
    return reply.code(404).send({ error: "Paste doesn't exist!" });
  }

  const password = request.query.password || '';

  if (!result.password || bcrypt.compareSync(password, result.password)) {
    const delStmt = db.prepare("DELETE FROM pastes WHERE id = ?");
    delStmt.run(id);
    return reply.send({ success: true });
  }

  return reply.code(401).send({ error: "Unauthorized" });
});

fastify.get('/pastes/count', (request, reply) => {
  const stmt = db.prepare("SELECT COUNT(*) AS count FROM pastes");
  const result = stmt.get();
  reply.send(result);
});

fastify.get("/pastes/search", (request, reply) => {
  const { q } = request.query;
  const noQuotes = q.split('"').join('').split("'").join('');
  if (!noQuotes.trim()) return reply.code(400).send("Bad Request");

  const stmt = db.prepare("SELECT * FROM pastes WHERE content LIKE ? AND available_at <= ? LIMIT ?");
  const rows = stmt.all(`%${q}%`, Date.now(), 20);

  if (!rows || rows.length === 0) {
    return reply.code(200).send([]);
  }

  const result = rows.map(r => ({
    content: r.content,
    created_at: r.created_at
  }));

  reply.send(result);
});

fastify.get("/pastes/:id/meta", (request, reply) => {
  const { id } = request.params;
  const stmt = db.prepare("SELECT created_at, expires_at, read_once FROM pastes WHERE id = ?");
  const row = stmt.get(id);

  if (!row) {
    return reply.code(404).send({ error: "Paste not found" });
  }

  reply.send(row);
});

fastify.get("/pastes/expiring-soon", (request, reply) => {
  const now = Date.now();
  const dateIn10 = now + ms("10mins");
  const stmt = db.prepare("SELECT id, expires_at FROM pastes WHERE expires_at > ? AND expires_at < ? AND available_at <= ? LIMIT 20");
  const rows = stmt.all(now, dateIn10, now);
  reply.send(rows);
});

fastify.listen({ port: 3000 }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});

const cleanup = () => {
  const stmt = db.prepare("DELETE FROM pastes WHERE expires_at IS NOT NULL AND expires_at < (?)");
  const result = stmt.run(Date.now());
  console.log(`[CLEANUP] Deleted ${result.changes} expired pastes at ${new Date().toISOString()}`);
};

setInterval(cleanup, 60 * 10 * 1000);
