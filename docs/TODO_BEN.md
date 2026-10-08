# TO DO FRONTEND (Ben)

## Setup

- choose stack (Expo / React Native + TS?)
- `mobile/` folder
- Makefile rule to install the app deps (IV.1)
- backend address configurable in the app (V.5)
- headers on every request: `x-platform`, `x-device`, `x-app-version` (V.6)
- socket.io client: `joinRoom`/`leaveRoom`, `tracks:updated`, `playback:next`

## Account (V.1, V.5)

- account required on first launch
- register / login with email + password
- email validation (waiting for Tony)
- forgot password (waiting for Tony)
- google login (waiting for Fega)
- link google account (waiting for Fega)

## Profile / friends (V.1)

- edit public / friends only / private info + music preferences
- other users' profile
- friends: search, send request, incoming requests, accept (waiting for Tony + Fega)

## Rooms (V.2.1, V.2.3)

- rooms list
- create room: VOTE / PLAYLIST, public / private, OPEN / INVITE_ONLY / RESTRICTED (place + time window)
- invite users (waiting for Fega)

## Track Vote (V.2.1)

- live list sorted by votes
- suggest a track (deezer search)
- vote, send location in RESTRICTED rooms (`?lat=&lng=`)
- show the error when a vote is refused
- player, next track on `playback:next` (waiting for Fega)

## Playlist Editor (V.2.3)

- real time playlist
- add / remove / move tracks
- concurrent edits: always re-render from `tracks:updated`
- no editing if not allowed

## Tests (V.8)

- app tests
