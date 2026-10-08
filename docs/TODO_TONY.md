# TO DO BACKEND (Tony)

- tracks, rooms, users, logs specs
- k6 loading testing
- documentation: API + why REST/JSON (V.4), security hazards (V.6), server specs + max users (V.7), backend tech choices (IV.1)

## Fixes

- friends controller uses `req.user.sub` but the jwt strategy returns `{ id, email, role }` -> friends don't work. Use `req.user.id`
- email links: reset link goes to `GET /auth/reset-password` (route is POST), and both links use `localhost:8080` -> doesn't work from a phone. See with Ben (deep link or code typed in the app)
- logs: only POST/PUT/PATCH/DELETE are logged, subject says any action (V.6) -> log GET and socket `joinRoom`/`leaveRoom` too
- google link: `GET /auth/google/link` also uses `req.user.sub`, and the state isn't signed (anyone can link their google to someone else's account). Remove it once Fega's `POST /auth/google/link` works
