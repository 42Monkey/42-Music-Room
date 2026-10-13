# TO DO FRONTEND (Oleg)

Base app is ready in `mobile/` (Expo + Expo Router). Run `make`, scan the QR code with Expo Go.

- your screens: `src/app/(auth)/` (logged out) and `src/app/(app)/profile/`, `src/app/(app)/friends/` (tabs), empty files are already there
- your API calls: `src/api/auth.ts`, `users.ts`, `friends.ts` (use `api.get / post / patch` from `src/api/client.ts`)
- after login: `signIn(tokens)` from `useSession()`, the app switches to the tabs by itself
- `src/app/(auth)/login.tsx` is a temporary test login, replace the whole file with your login screen (keep a link to `/settings`, the backend address must stay reachable before login)
- components: `Screen`, `Button`, `TextField` in `src/components/`
- errors: `<ErrorText error={error} />` under the action, `useFeedback()` for toasts and dialogs
- tests in `mobile/tests/`, `npm test` in `mobile/`

## Account (V.1)

- account required on first launch
- register / login with email + password (`POST /auth/register`, `POST /auth/login`)
- email validation: 6-digit code typed in the app (`GET /auth/verify-email?token=`)
- forgot password: `POST /auth/request-password-reset`, then code + new password (`POST /auth/reset-password`)
- Tony is changing the code check to email + code, so the last two will change a bit

## Profile (V.1)

- edit my profile (`PATCH /users/me`): public (name, bio, avatar, music preferences), friends only (location, phone), private (birth date)
- other user's profile (`GET /users/:id`), shows only what the backend returns

## Friends (V.1)

- search users (`GET /users?search=`)
- send request (`POST /friends/request`)
- incoming requests (`GET /friends/requests`) + accept (`POST /friends/:id/accept`)
- friends list (`GET /friends`)

## Tests (V.8)

- tests for these screens
