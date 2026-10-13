# TO DO BACKEND (Tony)

- fix Jest config: Nest 12 is ESM only and Jest on Node 22 can't load it (e2e fails with "Must use import to load ES Module"). Blocks every test that imports Nest
- Phase 9 tests: unit, integration, e2e, websocket (V.8). `test/app.e2e-spec.ts` is still the Nest template (`GET /` -> "Hello World!")
- Phase 10 load tests: k6 scripts + report with server specs and max simultaneous users (V.7)
- docs: why REST + JSON (V.4), security hazards + protections (V.6), backend tech choices (IV.1). `docs/BACKEND.md` is still empty

## Fixes

- now playing (V.2.1 "played earlier"): `POST /rooms/:roomId/tracks/next` only emits `playback:next`, nothing changes so the top track never moves. Set `currentTrackId` to the top track, set `playedAt` on the previous one and take it out of the queue, broadcast the current track. Fields already exist in the schema. Ben's player needs it
- access guard also blocks reading: in a public room everyone should see the track list, the license only limits who can vote / edit (V.2.1, V.2.3). Put `AccessPolicyGuard` on write routes only
- remove track is owner only, subject says everyone can edit the playlist by default (V.2.3) -> same rule as add / move
- reset and verify codes can be bruteforced: lookup by code only, no attempt limit (V.6) -> check email + code, kill the code after a few wrong tries
- refresh token (7d) is accepted as an access token (same secret, same payload) and there's no `/auth/refresh` (V.6). Also 15m is hardcoded in `issueTokens`, `JWT_EXPIRES_IN` is never read
- login works without a validated email, subject says the app must demand it (V.1)
