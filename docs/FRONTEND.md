# Frontend

`mobile/`: React Native + Expo (SDK 58), iOS and Android, runs in Expo Go. The app is a remote control (V.5): no data of its own, everything is stored and decided by the backend.

## Run

- `make` at the root: backend, database, public link, then the Expo QR code. Scan it with Expo Go, or press `i` for the iOS simulator
- test accounts: `user1@test.com` ... `user50@test.com`, password `password123` (also printed above the QR code)
- the backend address can be changed in the app (Server settings, V.5)
- iPhone: Expo Go and the Expo CLI have to be signed in to the same Expo account, once per Mac: `cd mobile && npx expo login`. The iOS Simulator and Android don't need it
- tunnel mode: `r`, fast refresh and `j` never reach the app. Reload by hand: Cmd+R in the simulator (Cmd+D then Reload), shake a phone
- every `make` gives the backend a new public address, so you're logged out once (a login only goes back to the server that issued it)
- if the tunnel dies (Mac asleep, Wi-Fi drop), the app says it can't reach the server: restart `make`
- new package: `npx expo install <name>` in `mobile/` (picks the version that fits SDK 58), then restart `make`
- checks: `npm test` and `npx tsc --noEmit` in `mobile/`
- Node 22.13+: `make` downloads it into `.node/` when the machine's is older. To run `npm`/`npx` yourself with it: `export PATH="$PWD/.node/bin:$PATH"` at the root

## Stack

| | Why |
| --- | --- |
| **React Native + Expo** | One TypeScript codebase for iOS and Android. Expo Go runs it on any phone without building the app, which is what evaluators use |
| **Expo Router** | Navigation from files: one file in `src/app/` is one screen. Logged-in and logged-out screens are separated with `Stack.Protected` |
| **socket.io-client** | Live updates pushed by the server (votes, playlist, player) |
| **expo-secure-store** | Login tokens encrypted on the phone (iOS Keychain / Android Keystore) |
| **AsyncStorage** | Plain settings (backend address) |
| **expo-location** | Phone position for "place and time" rooms |
| **expo-audio** | Plays the 30 s Deezer previews |
| **expo-web-browser** | Google sign-in through the browser (native Google sign-in doesn't run in Expo Go) |
| **react-native-reanimated** | Animations off the main thread |
| **react-native-gesture-handler** | Drag and drop in playlists |
| **react-native-svg** | The animated logo at launch |
| **expo-device / expo-constants** | Phone model and app version for the backend logs (V.6) |
| **Jest + React Native Testing Library** | Tests, written the way a user uses the app (find the button by its name, press it) |

## How it works

### Talking to the backend
- every call goes through one function: login token, 10 s timeout, and 3 headers on every request and on the live connection: `x-platform`, `x-device`, `x-app-version`. The backend logs every action with them (V.6) → [`client.ts request()`](../mobile/src/api/client.ts#L41-L80), [`deviceHeaders.ts`](../mobile/src/lib/deviceHeaders.ts#L6-L12), [`SocketProvider.tsx`](../mobile/src/socket/SocketProvider.tsx#L25-L29), [`log.interceptor.ts`](../backend/src/common/interceptors/log.interceptor.ts#L35)
- errors come back as `ApiError` (the server said no) or `NetworkError` (no answer) → [`errors.ts`](../mobile/src/api/errors.ts)
- `describeError()` turns them into a title, a plain sentence and what to do next (open settings, phone settings, try again) → [`describeError()`](../mobile/src/feedback/describeError.ts#L140-L158), [`showError()`](../mobile/src/feedback/FeedbackProvider.tsx#L49-L68)

### Session
- login gives 2 JWT: access (15 min) and refresh (7 days). Saved encrypted, together with the address of the server that issued them: a login is never sent to another server → [`tokenStorage.ts`](../mobile/src/session/tokenStorage.ts#L13-L27), [`signIn()`](../mobile/src/session/SessionProvider.tsx#L111-L126), [`server check`](../mobile/src/session/SessionProvider.tsx#L54)
- when the access token expires the app renews it in the background (`POST /auth/refresh`) and replays the call. Several calls expiring together share one renewal → [`client.ts (401)`](../mobile/src/api/client.ts#L69-L76), [`renew()`](../mobile/src/session/SessionProvider.tsx#L81-L98)
- renewal refused: "Session ended" dialog, back to login → [`SessionWatcher.tsx`](../mobile/src/session/SessionWatcher.tsx#L6-L26)

### Live updates
- one Socket.io connection per login (websocket only), opened with the token → [`SocketProvider.tsx`](../mobile/src/socket/SocketProvider.tsx#L25-L29)
- opening a room sends `joinRoom`; the server pushes `tracks:updated` (the whole list after any change) and `playback:next` (`{ track, startedAt }`) → [`useRoomTracks.ts`](../mobile/src/socket/useRoomTracks.ts#L40-L60), [`useNowPlaying.ts`](../mobile/src/player/useNowPlaying.ts#L29-L39), [`rooms.gateway.ts`](../backend/src/modules/rooms/rooms.gateway.ts#L33-L47)
- profile and friends don't use it: the friends tab reloads each time it opens
- the On air badge shows the connection. After a drop the app reconnects, joins again and reloads the room → [`OnAirBadge.tsx`](../mobile/src/components/OnAirBadge.tsx#L5-L16), [`ConnectionWatcher.tsx`](../mobile/src/socket/ConnectionWatcher.tsx#L6-L24), [`useRoomTracks.ts reconnect`](../mobile/src/socket/useRoomTracks.ts#L45-L48)

### Rooms (V.2.1, V.2.3)
- create: kind (Track vote / Playlist), who can see it (Public by default / Private), who can vote or edit (Everyone by default / Invited / Place and time, votes only) → [`new.tsx`](../mobile/src/app/%28app%29/rooms/new.tsx#L56-L206), [`roomForm.ts defaults`](../mobile/src/rooms/roomForm.ts#L26-L38), [`roomForm.ts checks`](../mobile/src/rooms/roomForm.ts#L49-L82)
- place and time: the owner's position, a radius (100 m, 300 m, 1 km) and opening hours. The phone's position is sent with each vote or added track (`?lat=&lng=`), the backend checks distance and time → [`new.tsx locate()`](../mobile/src/app/%28app%29/rooms/new.tsx#L76-L86), [`location.ts`](../mobile/src/lib/location.ts#L13-L22), [`[id].tsx vote`](../mobile/src/app/%28app%29/rooms/%5Bid%5D.tsx#L98), [`add-track.tsx`](../mobile/src/app/%28app%29/rooms/add-track.tsx#L40), [`access.guard.ts`](../backend/src/modules/rooms/guards/access.guard.ts#L45-L87)
- private rooms only exist for their owner and invited people; people who can see a room but not take part (public room, "Invited" rule, not invited) see the list without the buttons → [`visibility.guard.ts`](../backend/src/modules/rooms/guards/visibility.guard.ts#L13-L36), [`roomAccess.ts`](../mobile/src/rooms/roomAccess.ts#L4-L8), [`[id].tsx`](../mobile/src/app/%28app%29/rooms/%5Bid%5D.tsx#L181-L188)
- the owner of a private or "Invited" room invites people: search by name or email, tap to invite, tap again to take the invite back → [`[id].tsx button`](../mobile/src/app/%28app%29/rooms/%5Bid%5D.tsx#L197-L205), [`invite.tsx toggle()`](../mobile/src/app/%28app%29/rooms/invite.tsx#L67-L83)

### Track search (Deezer)
- typing searches once the user pauses (350 ms); late answers from older searches are ignored → [`useSearch.ts`](../mobile/src/lib/useSearch.ts#L8-L55)
- the search goes through our backend (`/rooms/:id/tracks/search`), which asks Deezer's public API → [`tracks.ts searchTracks`](../mobile/src/api/tracks.ts#L19-L21), [`deezer.service.ts`](../backend/src/modules/tracks/deezer.service.ts#L60-L77)
- adding a track sends only its Deezer id, the backend fetches and stores the details → [`add-track.tsx add()`](../mobile/src/app/%28app%29/rooms/add-track.tsx#L35-L48), [`tracks.service.ts addTrack`](../backend/src/modules/tracks/tracks.service.ts#L21-L56)

### Votes (V.2.1)
- the vote pill changes at once, then the call goes out. Refused (too far, closed): the reason is shown and the pill goes back → [`[id].tsx toggleVote()`](../mobile/src/app/%28app%29/rooms/%5Bid%5D.tsx#L91-L110), [`VoteButton`](../mobile/src/app/%28app%29/rooms/%5Bid%5D.tsx#L293-L329)
- one vote per person and track, counted by the server in a transaction; the list comes back sorted by votes for everyone → [`tracks.service.ts voteForTrack`](../backend/src/modules/tracks/tracks.service.ts#L77-L102), [`tracks.service.ts getQueue`](../backend/src/modules/tracks/tracks.service.ts#L128-L153)
- the server also says which tracks I voted for, so votes are still there after leaving the room → [`useRoomTracks.ts`](../mobile/src/socket/useRoomTracks.ts#L21-L34)

### Playlist editing (V.2.3)
- hold the handle, drag: the other rows slide aside, the page stops scrolling → [`PlaylistEditor.tsx drag`](../mobile/src/rooms/PlaylistEditor.tsx#L102-L124)
- the move shows at once, the app sends "put this track after that one" (`afterTrackId`). Refused: the list reloads from the server → [`[id].tsx move()`](../mobile/src/app/%28app%29/rooms/%5Bid%5D.tsx#L120-L133)
- the server gives the track a position between its 2 neighbours (only that track changes), retries on conflict, and sends the final order to everyone → [`tracks.service.ts reorderTrack`](../backend/src/modules/tracks/tracks.service.ts#L155-L192), [`index.util.ts`](../backend/src/modules/tracks/utils/index.util.ts#L4-L21)
- anyone allowed to edit can remove a track (with a confirmation) → [`PlaylistEditor.tsx bin`](../mobile/src/rooms/PlaylistEditor.tsx#L150-L160), [`[id].tsx confirmRemove()`](../mobile/src/app/%28app%29/rooms/%5Bid%5D.tsx#L136-L152)

### Synced player
- the server keeps the current track and when it started (`currentTrackStartedAt`) → [`tracks.service.ts triggerNext`](../backend/src/modules/tracks/tracks.service.ts#L233-L284), [`useNowPlaying.ts`](../mobile/src/player/useNowPlaying.ts#L15-L42)
- every phone in the room asks Deezer for a fresh preview link (they expire after a few minutes), then plays from "now − start time", so everyone hears the same second → [`NowPlaying.tsx load`](../mobile/src/player/NowPlaying.tsx#L52-L74), [`deezer.ts`](../mobile/src/lib/deezer.ts#L10-L16)
- every half second it checks; more than 1 s off (slow network, unmuting), it jumps back in line. Someone opening the room mid-track joins at the right second → [`NowPlaying.tsx sync`](../mobile/src/player/NowPlaying.tsx#L76-L88)
- the owner starts and skips tracks (backend rule); when a preview ends, the owner's phone moves the room on → [`advance()`](../mobile/src/player/NowPlaying.tsx#L107-L120), [`NowPlaying.tsx auto next`](../mobile/src/player/NowPlaying.tsx#L122-L127)
- mute only affects my phone → [`mute`](../mobile/src/player/NowPlaying.tsx#L130-L138)

### Account, profile, friends, Google (V.1)
- sign up, 6-digit email code, log in (refused until the email is verified), forgot password with a code → [`register.tsx`](../mobile/src/app/%28auth%29/register.tsx), [`verify-email.tsx`](../mobile/src/app/%28auth%29/verify-email.tsx), [`login.tsx`](../mobile/src/app/%28auth%29/login.tsx), [`forgot-password.tsx`](../mobile/src/app/%28auth%29/forgot-password.tsx), [`reset-password.tsx`](../mobile/src/app/%28auth%29/reset-password.tsx)
- profile: public (name, bio, music genres), friends only (location, phone), private (birth date) → [`ProfileView.tsx`](../mobile/src/profile/ProfileView.tsx), [`edit.tsx`](../mobile/src/app/%28app%29/profile/edit.tsx), [`GenrePicker.tsx`](../mobile/src/profile/GenrePicker.tsx)
- friends: search people, send and accept requests → [`friends/index.tsx`](../mobile/src/app/%28app%29/friends/index.tsx), [`friends/search.tsx`](../mobile/src/app/%28app%29/friends/search.tsx), [`friends/[id].tsx`](../mobile/src/app/%28app%29/friends/%5Bid%5D.tsx)
- Google: "Continue with Google" (sign up or log in) and "Link Google account" (profile). The app opens Google's page in the browser and asks for an id token. Google only sends back to fixed https addresses, so it goes to a small page on GitHub Pages that hands the token back to the app. A random value is checked on the way back. The backend checks the token with Google → [`google.ts`](../mobile/src/auth/google.ts#L16-L29), [`GoogleButton.tsx`](../mobile/src/auth/GoogleButton.tsx), [`LinkGoogle.tsx`](../mobile/src/profile/LinkGoogle.tsx), [`google-redirect/index.html`](../google-redirect/index.html#L31)

## Security on the app side

- tokens in encrypted storage, tied to the server that issued them, renewed in the background → [`tokenStorage.ts`](../mobile/src/session/tokenStorage.ts#L13-L27), [`renew()`](../mobile/src/session/SessionProvider.tsx#L81-L98)
- `http://` refused for addresses outside the local network (the password would travel in clear) → [`serverUrl.ts`](../mobile/src/settings/serverUrl.ts#L16-L35)
- the Google redirect page only sends back to the app's own addresses (`exp://`, `musicroom://`), no external scripts → [`google-redirect/index.html`](../google-redirect/index.html#L31)
- no keys in the code: the Google client id and redirect address are copied from `backend/.env` into `mobile/.env.local` by `make` (both git-ignored) → [`Makefile google`](../Makefile#L114)

## Tests

- 330 tests, one file per layer in `mobile/tests/`: API calls, session, settings, live connection, error messages, components, and every screen. The backend is replaced by a fake server and a fake socket, so they run without Docker
- Jest + React Native Testing Library
- `renderWithProviders(<MyScreen />)` from `tests/helpers.tsx`: same providers as the app
- fake backend: `const fetchMock = mockFetch()` then `routeFetch(fetchMock, { '/users/me': reply(200, me) })`
- logged in: `await tokenStorage.set('token', SERVER)` + a `/users/me` route
- router, location, audio, secure storage, gestures are faked in `jest.setup.ts`, `router.push` etc. are `jest.fn()`
- find things like a user would: `getByRole('button', { name: 'Save profile' })`, `getByLabelText('Email')`, `getByText`
- `render` and `fireEvent` are async in this version: always `await` them
- fake timers: put the real ones back only after `cleanup()`, or the test hangs (see `LaunchAnimation` in `components.test.tsx`)

## Working in the code

### Folders

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

### Login and session

- `useSession()`: `status` (`loading` / `signedOut` / `signedIn`), `user`, `signIn(tokens)`, `signOut()`, `refreshUser()`, `updateUser(user)`
- after login: `signIn(answer)` with the backend's `{ accessToken, refreshToken }`. Tokens get saved, the app switches to the tabs by itself (`Stack.Protected` in `src/app/_layout.tsx`), nothing to navigate
- `src/app/(auth)/login.tsx` is the login screen (email + password), it keeps a link to `/settings` so the backend address can be changed before login. The seeded test accounts log in there
- `user` is loaded at login and is the one copy of my profile: after `PATCH /users/me`, `updateUser(answer)`; `refreshUser()` loads it again (pull to refresh on the profile tab)

### Backend calls

- `api.get<T>(path)`, `api.post<T>(path, body)`, `api.patch`, `api.delete` from `src/api/client.ts`
- no `fetch` straight to the backend
- all endpoints and bodies: `<backend address>/docs` (Swagger)

### Errors

- under the action that failed: `<ErrorText error={error} />`
- whole screen didn't load: `<ErrorState error={error} onRetry={load} />`
- it worked: `useFeedback().toast('Profile saved', 'success')`
- needs a yes / no: `useFeedback().dialog({ title, message, primary, secondary })`
- `useFeedback().showError(error)` shows the right buttons by itself (Open settings, phone settings, Try again)
- a backend message that reads badly: add it to `ROOM_RULES` in `src/feedback/describeError.ts`

### UI

- design "On air": raspberry `#E0306A`, ink `#1D1B34`, grey background `#F2F3F7`, white cards (radius 18), system font. Always from `theme.ts`, no raw colours
- `Screen`: page frame with the big title, `back` (back link) or `onClose` (sheets), scrolls, leaves room for the tab bar
- `Button` (`primary` / `secondary` / `quiet` / `danger`, `icon`, `loading`), `TextField` (label, error, hint), `SegmentedControl`, `Tag`, `TimeField`, `DateField` (can stay empty), `Avatar` (photo or the initial)
- icons: Ionicons (`@expo/vector-icons`)
- forms open as sheets: `presentation: 'modal'` in the folder's `_layout.tsx` (see `rooms/_layout.tsx`)
- animations: Reanimated, short (150 to 300ms), `Easing.bezier(0.23, 1, 0.32, 1)`, skip them with `useReducedMotion()`
- text: sentence case. The button says what happens ("Save profile"), the toast says the same ("Profile saved"), errors say what to do
- toast only when nothing on screen shows it worked (a sheet that closes). A button that turns into "Sent" needs no toast
- one short comment line before the key functions

### Reuse

- `useSearch(find)` in `src/lib/useSearch.ts`: search as you type (waits for a pause, ignores late answers). Used by the track search, the invite sheet and the friends search
- `searchUsers(text)` in `src/api/users.ts` calls `GET /users?search=` (invite sheet, friends search)
- `ProfileView` in `src/profile/` shows any profile: `seenAs` `self` / `friend` / `other` decides which parts appear

### Endpoints of the account screens

Auth

- `POST /auth/register { email, password, displayName }` -> the new user, no tokens: send the code screen, then login
- `POST /auth/login { email, password }` -> `{ accessToken, refreshToken }`, 403 "Verify your email before logging in" until the code is done
- `GET /auth/verify-email?email=&token=` (6-digit code)
- `POST /auth/request-password-reset { email }`, then `POST /auth/reset-password { email, token, newPassword }`
- 5 wrong codes and the code is dead, ask for a new one
- Google: `POST /auth/google/mobile { idToken }` (log in / sign up), `POST /auth/google/link { idToken }` (logged in). how the app gets the id token: Google in How it works

Users

- `GET /users/me`, `PATCH /users/me { displayName, bio, avatarUrl, location, phoneNumber, musicPreference, birthDate }` (all optional)
- `GET /users/:id` only returns what you're allowed to see: friends-only fields are left out (not `null`) for non-friends
- `GET /users?search=` by name or email, emails aren't sent back

Friends

- `POST /friends/request { receiverId }`, `GET /friends/requests` (received, waiting), `POST /friends/:id/accept` (the sender's id), `GET /friends`
- a request that already exists either way: 409 "Friendship relation already exists with status: PENDING" (or `ACCEPTED`). No decline, cancel or unfriend yet

### Before pushing

- `npm test` and `npx tsc --noEmit` pass in `mobile/`
- no `.env` in git (the root `.gitignore` covers it)
