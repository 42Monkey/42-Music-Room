# TO DO FRONTEND (Oleg)

Base app is ready in `mobile/` (Expo + Expo Router). Run `make`, scan the QR code with Expo Go.

- your screens: `src/app/(auth)/` (logged out) and `src/app/(app)/profile/`, `src/app/(app)/friends/` (tabs), empty files are already there
- your API calls: `src/api/auth.ts`, `users.ts`, `friends.ts` (use `api.get / post / patch` from `src/api/client.ts`)
- after login: `signIn(tokens)` from `useSession()` with the whole login answer (access + refresh token), the app switches to the tabs by itself and renews the login on its own
- components: `Screen`, `Button`, `TextField` in `src/components/`
- errors: `<ErrorText error={error} />` under the action, `useFeedback()` for toasts and dialogs
- tests in `mobile/tests/`, `npm test` in `mobile/`

## Google (V.1, V.5)

The subject wants both: sign up / log in with Google, and link Google to an existing account.

- log in or sign up: `POST /auth/google/mobile { idToken }`, returns the same tokens as login -> `signIn(tokens)`
- link (logged in, from the profile): `POST /auth/google/link { idToken }`
- the idToken has to be asked with the web client ID (`GOOGLE_CLIENT_ID` in `backend/.env`), the backend only accepts that one
- Expo Go can't run native Google sign-in (`@react-native-google-signin` needs a custom build), only the browser flow works (`expo-web-browser`)
- Google only sends back to fixed https addresses registered in Google Cloud, no wildcards, and our tunnel address changes at every `make`. What I'd do: a tiny static page on GitHub Pages as redirect URI, it gets the id token from Google and sends it back to the app (`Linking.createURL('google')`, `exp://...` in Expo Go). Only forward to `exp://` / `musicroom://` addresses
- whoever owns the Google Cloud project adds that page as authorized redirect URI of the web client

## Profile (V.1)

- edit my profile (`PATCH /users/me`): public (name, bio, avatar, music preferences), friends only (location, phone), private (birth date)
- other user's profile (`GET /users/:id`), shows only what the backend returns

## Friends (V.1)

- search users (`GET /users?search=`)
- send request (`POST /friends/request`)
- incoming requests (`GET /friends/requests`) + accept (`POST /friends/:id/accept`)
- friends list (`GET /friends`)

## Tests (V.8)

- tests for these screens (`tests/profile.test.tsx`, `tests/friends.test.tsx`)
