# TO DO BACKEND (Fega)

- preview links expire after 15 min (Deezer `exp=` param), the one saved when the track is added is dead by the time it plays -> fetch a fresh `previewUrl` when a track becomes current (see with Tony, he's doing now playing). Ben's player needs it
- google: fail if `GOOGLE_CLIENT_ID` is missing (audience `undefined` accepts tokens from any app), check `email_verified` before matching an existing account by email (V.6)
