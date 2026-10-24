# TO DO FRONTEND (Oleg)

Base app is ready in `mobile/` (Expo + Expo Router). Run `make`, scan the QR code with Expo Go.

- your screens: `src/app/(auth)/` (logged out) and `src/app/(app)/profile/`, `src/app/(app)/friends/` (tabs), empty files are already there
- your API calls: `src/api/auth.ts`, `users.ts`, `friends.ts` (use `api.get / post / patch` from `src/api/client.ts`)
- after login: `signIn(tokens)` from `useSession()` with the whole login answer (access + refresh token), the app switches to the tabs by itself and renews the login on its own
- `src/app/(auth)/login.tsx` is a temporary test login, replace the whole file with your login screen (keep a link to `/settings`, the backend address must stay reachable before login)
- components: `Screen`, `Button`, `TextField` in `src/components/`
- errors: `<ErrorText error={error} />` under the action, `useFeedback()` for toasts and dialogs
- tests in `mobile/tests/`, `npm test` in `mobile/`

## Account (V.1)

- account required on first launch
- register / login with email + password (`POST /auth/register { email, password, displayName }`, `POST /auth/login { email, password }`)
- login is refused until the email is verified (403 "Verify your email before logging in"), send them to the code screen
- email validation: 6-digit code typed in the app (`GET /auth/verify-email?email=&token=`)
- forgot password: `POST /auth/request-password-reset { email }`, then `POST /auth/reset-password { email, token, newPassword }`
- codes: 5 wrong tries and the code is dead, they have to ask for a new one

## Google (V.1, V.5)

The subject wants both: sign up / log in with Google, and link Google to an existing account.

- log in or sign up: `POST /auth/google/mobile { idToken }`, returns the same tokens as login -> `signIn(tokens)`
- link (logged in, from the profile): `POST /auth/google/link { idToken }`
- the idToken has to be asked with the web client ID (`GOOGLE_CLIENT_ID` in `backend/.env`), the backend only accepts that one
- Expo Go can't run native Google sign-in (`@react-native-google-signin` needs a custom build), only the browser flow works (`expo-web-browser`)
- Google only sends back to fixed https addresses registered in Google Cloud, no wildcards, and our tunnel address changes at every `make`. What I'd do: a tiny static page on GitHub Pages as redirect URI, it gets the id token from Google and sends it back to the app (`Linking.createURL('google')`, `exp://...` in Expo Go). Only forward to `exp://` / `musicroom://` addresses
- whoever owns the Google Cloud project adds that page as authorized redirect URI of the web client
