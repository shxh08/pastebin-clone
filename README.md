# 📝 Pastebin Clone (Fastify + SQLite)

A simple, privacy-focused pastebin clone built with [Fastify](https://www.fastify.io/), [SQLite](https://www.sqlite.org/), and [better-sqlite3](https://github.com/WiseLibs/better-sqlite3).

## Features

- 🔐 Optional password-protected pastes
- ⏰ Expiring pastes (e.g. 10m, 1h, 2d)
- 🔥 "Read once" option to auto-delete after viewing
- 🕒 Optional "available_at" delay before paste becomes visible
- 🔎 Search functionality
- 🧮 Paste count and expiring soon endpoints
- 🧼 Automatic cleanup of expired pastes

## API Endpoints

### `POST /paste`
Create a new paste.

**Body parameters:**
- `content` (string, required)
- `expires_in` (string, e.g. `"10m"`, required)
- `read_once` (`'0'` or `'1'`, optional)
- `password` (string, optional)
- `title` (string, optional)
- `available_at` (string, optional, delay before visible — e.g. `"5m"`)

---

### `GET /paste/:id`
Retrieve a paste.  
If it's password-protected, provide `?password=...` in the query.

---

### `GET /validate/:id`
Check if a paste requires a password and get expiration time.

---

### `DELETE /paste/:id`
Delete a paste.  
If it's password-protected, provide `?password=...` in the query.

---

### `GET /pastes/recent`
Get the 20 most recent unexpired and available pastes.

---

### `GET /pastes/count`
Returns total number of pastes stored.

---

### `GET /pastes/search?q=word`
Search for pastes containing a given keyword.

---

### `GET /pastes/:id/meta`
Get metadata about a paste (`created_at`, `expires_at`, `read_once`).

---

### `GET /pastes/expiring-soon`
Lists pastes expiring in the next 10 minutes.

## Dev Notes

- Uses `better-sqlite3` for sync SQLite access.
- Expired pastes are cleaned up every 10 minutes.
- Timestamps are stored as Unix time (`Date.now()`).

## Install & Run

```bash
npm install
node index.js

## License

This project is licensed under the MIT License.
