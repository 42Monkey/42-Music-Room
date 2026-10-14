# TO DO FRONTEND (Ben)

## Rooms (V.2.1, V.2.3)

- invite users (`GET /users?search=`, `POST /rooms/:roomId/members`)

## Track Vote (V.2.1)

- suggest a track (deezer search)
- vote, send location in RESTRICTED rooms (`?lat=&lng=`)
- show the error when a vote is refused
- player + next button (waiting for Tony: now playing, and Fega: fresh preview links)

## Playlist Editor (V.2.3)

- add / remove / drag to reorder
- concurrent edits: always re-render from `tracks:updated`

## Google (V.1, V.5)

- login: `POST /auth/google/mobile { idToken }`
- link account: `POST /auth/google/link { idToken }`
- request the token with the web client ID, the backend only accepts `GOOGLE_CLIENT_ID`

## Tests (V.8)

- tests for each new screen (`mobile/tests/`, `npm test` in `mobile/`)

## Before the evaluation

- remove the temporary test login (`src/app/(auth)/login.tsx`) once Oleg's login works
- school Mac: `node -v` (20.19+), `npx ngrok authtoken <token>` (per machine), `node_modules` on `/sgoinfre`
- Expo SDK of the project = the one the current Expo Go supports
- run `make` and load the app before the evaluator sits down
