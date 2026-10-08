# TO DO BACKEND (Fega)

- `POST /auth/google/mobile { idToken }`: google login from the app (V.1, V.5). Verify the token with google-auth-library, return access + refresh tokens. Google Cloud client IDs to set up with Ben
- `POST /auth/google/link { idToken }`: link google to the logged in user (V.1)
- `GET /users?search=`: search users by name/email, public fields only (needed to add friends and invite to rooms)
- `GET /friends/requests`: pending requests, `getPendingRequests()` already exists in friends.service
- `previewUrl` on Track, saved when a track is added (deezer already returns it)
- private profile info (V.1): no private field yet (birth date?), only returned on `/users/me`
- swagger decorators on every new route (V.4)
