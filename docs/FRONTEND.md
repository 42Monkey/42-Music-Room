# Frontend

`mobile/`: Expo SDK 58 + Expo Router, iOS and Android only, runs in Expo Go.

## Run

- `make` at the root: backend, database, public link, then the Expo QR code. Scan it with Expo Go, or press `i` for the iOS simulator
- test logins are printed just above the QR code (`user1@test.com` ...)
- iPhone: Expo Go and the Expo CLI have to be signed in to the same Expo account, once per Mac: `cd mobile && npx expo login`. The iOS Simulator and Android don't need it
- tunnel mode: `r`, fast refresh and `j` never reach the app. Reload by hand: Cmd+R in the simulator (Cmd+D then Reload), shake a phone
- every `make` gives the backend a new public address, so you're logged out once (a login only goes back to the server that issued it)
- if the tunnel dies (Mac asleep, Wi-Fi drop), the app says it can't reach the server: restart `make`
- new package: `npx expo install <name>` in `mobile/` (picks the version that fits SDK 58), then restart `make`
- checks: `npm test` and `npx tsc --noEmit` in `mobile/`
- Node 22.13+: `make` downloads it into `.node/` when the machine's is older. To run `npm`/`npx` yourself with it: `export PATH="$PWD/.node/bin:$PATH"` at the root

## Folders

- `src/app/` screens, one file = one route (Expo Router)
  - `(auth)/` logged out: login, register, verify-email, forgot-password, reset-password
  - `(app)/` the tabs: `rooms/`, `profile/`, `friends/`
  - `settings.tsx` backend address, reachable logged in or not
- `src/api/` backend calls, one file per part
- `src/components/` shared UI
- `src/feedback/` errors, toasts, dialogs
- `src/session/` who's logged in, tokens in the phone's encrypted storage
- `src/settings/` backend address
- `src/socket/` live connection (Socket.io)
- `src/rooms/`, `src/player/` rooms, playlist editing, player
- `src/profile/` profile layout (`ProfileView`), edit form rules, genres
- `src/friends/` sending a friend request
- `src/lib/` small helpers (location, Deezer, search as you type)
- `src/types/api.ts` shapes of the backend answers, add yours there
- `src/theme.ts` colours, spacing, text sizes
- `tests/` one file per part

## Login and session

- `useSession()`: `status` (`loading` / `signedOut` / `signedIn`), `user`, `signIn(tokens)`, `signOut()`, `refreshUser()`, `updateUser(user)`
- after login: `signIn(answer)` with the backend's `{ accessToken, refreshToken }`. Tokens get saved, the app switches to the tabs by itself (`Stack.Protected` in `src/app/_layout.tsx`), nothing to navigate
- a login lasts 15 min, the app renews it with the refresh token on its own. When renewing fails (7 days), "Session ended" dialog and back to login
- `src/app/(auth)/login.tsx` is the login screen (email + password), it keeps a link to `/settings` so the backend address can be changed before login. The seeded test accounts log in there
- `user` is loaded at login and is the one copy of my profile: after `PATCH /users/me`, `updateUser(answer)`; `refreshUser()` loads it again (pull to refresh on the profile tab)

## Backend calls

- `api.get<T>(path)`, `api.post<T>(path, body)`, `api.patch`, `api.delete` from `src/api/client.ts`
- token, log headers (`x-platform`, `x-device`, `x-app-version`) and timeout are added for you
- fails with `ApiError` (status + server message) or `NetworkError` (no address / unreachable / timeout)
- no `fetch` straight to the backend
- all endpoints and bodies: `<backend address>/docs` (Swagger)

## Errors

- everything goes through `describeError()`: a title, a message in plain words, what to do next
- under the action that failed: `<ErrorText error={error} />`
- whole screen didn't load: `<ErrorState error={error} onRetry={load} />`
- it worked: `useFeedback().toast('Profile saved', 'success')`
- needs a yes / no: `useFeedback().dialog({ title, message, primary, secondary })`
- `useFeedback().showError(error)` shows the right buttons by itself (Open settings, phone settings, Try again)
- a backend message that reads badly: add it to `ROOM_RULES` in `src/feedback/describeError.ts`

## UI

- design "On air": raspberry `#E0306A`, ink `#1D1B34`, grey background `#F2F3F7`, white cards (radius 18), system font. Always from `theme.ts`, no raw colours
- `Screen`: page frame with the big title, `back` (back link) or `onClose` (sheets), scrolls, leaves room for the tab bar
- `Button` (`primary` / `secondary` / `quiet` / `danger`, `icon`, `loading`), `TextField` (label, error, hint), `SegmentedControl`, `Tag`, `TimeField`, `DateField` (can stay empty), `Avatar` (photo or the initial)
- icons: Ionicons (`@expo/vector-icons`)
- forms open as sheets: `presentation: 'modal'` in the folder's `_layout.tsx` (see `rooms/_layout.tsx`)
- animations: Reanimated, short (150 to 300ms), `Easing.bezier(0.23, 1, 0.32, 1)`, skip them with `useReducedMotion()`
- text: sentence case. The button says what happens ("Save profile"), the toast says the same ("Profile saved"), errors say what to do
- toast only when nothing on screen shows it worked (a sheet that closes). A button that turns into "Sent" needs no toast
- one short comment line before the key functions

## Reuse

- `useSearch(find)` in `src/lib/useSearch.ts`: search as you type (waits for a pause, ignores late answers). Used by the track search, the invite sheet and the friends search
- `searchUsers(text)` in `src/api/users.ts` calls `GET /users?search=` (invite sheet, friends search)
- `ProfileView` in `src/profile/` shows any profile: `seenAs` `self` / `friend` / `other` decides which parts appear

## Endpoints for your screens

Auth

- `POST /auth/register { email, password, displayName }` -> the new user, no tokens: send the code screen, then login
- `POST /auth/login { email, password }` -> `{ accessToken, refreshToken }`, 403 "Verify your email before logging in" until the code is done
- `GET /auth/verify-email?email=&token=` (6-digit code)
- `POST /auth/request-password-reset { email }`, then `POST /auth/reset-password { email, token, newPassword }`
- 5 wrong codes and the code is dead, ask for a new one
- Google: `POST /auth/google/mobile { idToken }` (log in / sign up), `POST /auth/google/link { idToken }` (logged in). How to get the idToken in Expo Go: Google part of `TODO_OLEG.md`

Users

- `GET /users/me`, `PATCH /users/me { displayName, bio, avatarUrl, location, phoneNumber, musicPreference, birthDate }` (all optional)
- `GET /users/:id` only returns what you're allowed to see: friends-only fields are left out (not `null`) for non-friends
- `GET /users?search=` by name or email, emails aren't sent back

Friends

- `POST /friends/request { receiverId }`, `GET /friends/requests` (received, waiting), `POST /friends/:id/accept` (the sender's id), `GET /friends`
- a request that already exists either way: 409 "Friendship relation already exists with status: PENDING" (or `ACCEPTED`). No decline, cancel or unfriend yet

## Live updates

- `useSocket()`: `socket`, `connected` (the On air badge)
- only rooms use it: `joinRoom` / `leaveRoom`, the server sends `tracks:updated` (the whole list) and `playback:next` (`{ track, startedAt }`)
- profile and friends don't use it: the friends tab reloads each time it opens

## Tests

- Jest + React Native Testing Library, in `tests/`, one file per part
- `renderWithProviders(<MyScreen />)` from `tests/helpers.tsx`: same providers as the app
- fake backend: `const fetchMock = mockFetch()` then `routeFetch(fetchMock, { '/users/me': reply(200, me) })`
- logged in: `await tokenStorage.set('token', SERVER)` + a `/users/me` route
- router, location, audio, secure storage, gestures are faked in `jest.setup.ts`, `router.push` etc. are `jest.fn()`
- find things like a user would: `getByRole('button', { name: 'Save profile' })`, `getByLabelText('Email')`, `getByText`
- `render` and `fireEvent` are async in this version: always `await` them
- fake timers: put the real ones back only after `cleanup()`, or the test hangs (see `LaunchAnimation` in `components.test.tsx`)

## Before pushing

- `npm test` and `npx tsc --noEmit` pass in `mobile/`
- no `.env` in git (the root `.gitignore` covers it)
