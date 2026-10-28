# Music Room — mobile app

React Native + Expo (SDK 58), iOS and Android, runs in Expo Go. The app is a remote control (V.5): no data of its own, everything is stored and decided by the backend.

Working in the code (folders, conventions, test helpers): [`docs/FRONTEND.md`](../docs/FRONTEND.md).

## Run

- from the repo root: `make`, then scan the QR code with Expo Go (or press `i` for the iOS Simulator)
- iPhone: Expo Go and the Expo CLI must be signed in to the same Expo account (`npx expo login` here, once per Mac). Android and the Simulator don't need it
- test accounts: `user1@test.com` ... `user50@test.com`, password `password123`
- the backend address can be changed in the app (Server settings, V.5)
- tests: `npm test`, types: `npx tsc --noEmit`

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
- every call goes through one function: login token, 10 s timeout, and 3 headers on every request and on the live connection: `x-platform`, `x-device`, `x-app-version`. The backend logs every action with them (V.6) → [`client.ts request()`](src/api/client.ts#L41-L80), [`deviceHeaders.ts`](src/lib/deviceHeaders.ts#L6-L12), [`SocketProvider.tsx`](src/socket/SocketProvider.tsx#L25-L29), [`log.interceptor.ts`](../backend/src/common/interceptors/log.interceptor.ts#L35)
- errors come back as `ApiError` (the server said no) or `NetworkError` (no answer) → [`errors.ts`](src/api/errors.ts)
- `describeError()` turns them into a title, a plain sentence and what to do next (open settings, phone settings, try again) → [`describeError()`](src/feedback/describeError.ts#L140-L158), [`showError()`](src/feedback/FeedbackProvider.tsx#L49-L68)

### Session
- login gives 2 JWT: access (15 min) and refresh (7 days). Saved encrypted, together with the address of the server that issued them: a login is never sent to another server → [`tokenStorage.ts`](src/session/tokenStorage.ts#L13-L27), [`signIn()`](src/session/SessionProvider.tsx#L111-L126), [`server check`](src/session/SessionProvider.tsx#L54)
- when the access token expires the app renews it in the background (`POST /auth/refresh`) and replays the call. Several calls expiring together share one renewal → [`client.ts (401)`](src/api/client.ts#L69-L76), [`renew()`](src/session/SessionProvider.tsx#L81-L98)
- renewal refused: "Session ended" dialog, back to login → [`SessionWatcher.tsx`](src/session/SessionWatcher.tsx#L6-L26)

### Live updates
- one Socket.io connection per login (websocket only), opened with the token → [`SocketProvider.tsx`](src/socket/SocketProvider.tsx#L25-L29)
- opening a room sends `joinRoom`; the server pushes `tracks:updated` (the whole list after any change) and `playback:next` (`{ track, startedAt }`) → [`useRoomTracks.ts`](src/socket/useRoomTracks.ts#L40-L60), [`useNowPlaying.ts`](src/player/useNowPlaying.ts#L29-L39), [`rooms.gateway.ts`](../backend/src/modules/rooms/rooms.gateway.ts#L33-L47)
- the On air badge shows the connection. After a drop the app reconnects, joins again and reloads the room → [`OnAirBadge.tsx`](src/components/OnAirBadge.tsx#L5-L16), [`ConnectionWatcher.tsx`](src/socket/ConnectionWatcher.tsx#L6-L24), [`useRoomTracks.ts reconnect`](src/socket/useRoomTracks.ts#L45-L48)

### Rooms (V.2.1, V.2.3)
- create: kind (Track vote / Playlist), who can see it (Public by default / Private), who can vote or edit (Everyone by default / Invited / Place and time, votes only) → [`new.tsx`](src/app/%28app%29/rooms/new.tsx#L56-L206), [`roomForm.ts defaults`](src/rooms/roomForm.ts#L26-L38), [`roomForm.ts checks`](src/rooms/roomForm.ts#L49-L82)
- place and time: the owner's position, a radius (100 m, 300 m, 1 km) and opening hours. The phone's position is sent with each vote or added track (`?lat=&lng=`), the backend checks distance and time → [`new.tsx locate()`](src/app/%28app%29/rooms/new.tsx#L76-L86), [`location.ts`](src/lib/location.ts#L13-L22), [`[id].tsx vote`](src/app/%28app%29/rooms/%5Bid%5D.tsx#L98), [`add-track.tsx`](src/app/%28app%29/rooms/add-track.tsx#L40), [`access.guard.ts`](../backend/src/modules/rooms/guards/access.guard.ts#L45-L87)
- private rooms only exist for their owner and invited people; people who can see a room but not take part (public room, "Invited" rule, not invited) see the list without the buttons → [`visibility.guard.ts`](../backend/src/modules/rooms/guards/visibility.guard.ts#L13-L36), [`roomAccess.ts`](src/rooms/roomAccess.ts#L4-L8), [`[id].tsx`](src/app/%28app%29/rooms/%5Bid%5D.tsx#L181-L188)
- the owner of a private or "Invited" room invites people: search by name or email, tap to invite, tap again to take the invite back → [`[id].tsx button`](src/app/%28app%29/rooms/%5Bid%5D.tsx#L197-L205), [`invite.tsx toggle()`](src/app/%28app%29/rooms/invite.tsx#L67-L83)

### Track search (Deezer)
- typing searches once the user pauses (350 ms); late answers from older searches are ignored → [`useSearch.ts`](src/lib/useSearch.ts#L8-L55)
- the search goes through our backend (`/rooms/:id/tracks/search`), which asks Deezer's public API → [`tracks.ts searchTracks`](src/api/tracks.ts#L19-L21), [`deezer.service.ts`](../backend/src/modules/tracks/deezer.service.ts#L60-L77)
- adding a track sends only its Deezer id, the backend fetches and stores the details → [`add-track.tsx add()`](src/app/%28app%29/rooms/add-track.tsx#L35-L48), [`tracks.service.ts addTrack`](../backend/src/modules/tracks/tracks.service.ts#L21-L56)

### Votes (V.2.1)
- the vote pill changes at once, then the call goes out. Refused (too far, closed): the reason is shown and the pill goes back → [`[id].tsx toggleVote()`](src/app/%28app%29/rooms/%5Bid%5D.tsx#L91-L110), [`VoteButton`](src/app/%28app%29/rooms/%5Bid%5D.tsx#L293-L329)
- one vote per person and track, counted by the server in a transaction; the list comes back sorted by votes for everyone → [`tracks.service.ts voteForTrack`](../backend/src/modules/tracks/tracks.service.ts#L77-L102), [`tracks.service.ts getQueue`](../backend/src/modules/tracks/tracks.service.ts#L128-L153)
- the server also says which tracks I voted for, so votes are still there after leaving the room → [`useRoomTracks.ts`](src/socket/useRoomTracks.ts#L21-L34)

### Playlist editing (V.2.3)
- hold the handle, drag: the other rows slide aside, the page stops scrolling → [`PlaylistEditor.tsx drag`](src/rooms/PlaylistEditor.tsx#L102-L124)
- the move shows at once, the app sends "put this track after that one" (`afterTrackId`). Refused: the list reloads from the server → [`[id].tsx move()`](src/app/%28app%29/rooms/%5Bid%5D.tsx#L120-L133)
- the server gives the track a position between its 2 neighbours (only that track changes), retries on conflict, and sends the final order to everyone → [`tracks.service.ts reorderTrack`](../backend/src/modules/tracks/tracks.service.ts#L155-L192), [`index.util.ts`](../backend/src/modules/tracks/utils/index.util.ts#L4-L21)
- anyone allowed to edit can remove a track (with a confirmation) → [`PlaylistEditor.tsx bin`](src/rooms/PlaylistEditor.tsx#L150-L160), [`[id].tsx confirmRemove()`](src/app/%28app%29/rooms/%5Bid%5D.tsx#L136-L152)

### Synced player
- the server keeps the current track and when it started (`currentTrackStartedAt`) → [`tracks.service.ts triggerNext`](../backend/src/modules/tracks/tracks.service.ts#L233-L284), [`useNowPlaying.ts`](src/player/useNowPlaying.ts#L15-L42)
- every phone in the room asks Deezer for a fresh preview link (they expire after a few minutes), then plays from "now − start time", so everyone hears the same second → [`NowPlaying.tsx load`](src/player/NowPlaying.tsx#L52-L74), [`deezer.ts`](src/lib/deezer.ts#L10-L16)
- every half second it checks; more than 1 s off (slow network, unmuting), it jumps back in line. Someone opening the room mid-track joins at the right second → [`NowPlaying.tsx sync`](src/player/NowPlaying.tsx#L76-L88)
- the owner starts and skips tracks (backend rule); when a preview ends, the owner's phone moves the room on → [`advance()`](src/player/NowPlaying.tsx#L107-L120), [`NowPlaying.tsx auto next`](src/player/NowPlaying.tsx#L122-L127)
- mute only affects my phone → [`mute`](src/player/NowPlaying.tsx#L130-L138)

### Account, profile, friends, Google (V.1)
- sign up, 6-digit email code, log in (refused until the email is verified), forgot password with a code → [`register.tsx`](src/app/%28auth%29/register.tsx), [`verify-email.tsx`](src/app/%28auth%29/verify-email.tsx), [`login.tsx`](src/app/%28auth%29/login.tsx), [`forgot-password.tsx`](src/app/%28auth%29/forgot-password.tsx), [`reset-password.tsx`](src/app/%28auth%29/reset-password.tsx)
- profile: public (name, bio, music genres), friends only (location, phone), private (birth date) → [`ProfileView.tsx`](src/profile/ProfileView.tsx), [`edit.tsx`](src/app/%28app%29/profile/edit.tsx), [`GenrePicker.tsx`](src/profile/GenrePicker.tsx)
- friends: search people, send and accept requests → [`friends/index.tsx`](src/app/%28app%29/friends/index.tsx), [`friends/search.tsx`](src/app/%28app%29/friends/search.tsx), [`friends/[id].tsx`](src/app/%28app%29/friends/%5Bid%5D.tsx)
- Google: "Continue with Google" (sign up or log in) and "Link Google account" (profile). The app opens Google's page in the browser and asks for an id token. Google only sends back to fixed https addresses, so it goes to a small page on GitHub Pages that hands the token back to the app. A random value is checked on the way back. The backend checks the token with Google → [`google.ts`](src/auth/google.ts#L16-L29), [`GoogleButton.tsx`](src/auth/GoogleButton.tsx), [`LinkGoogle.tsx`](src/profile/LinkGoogle.tsx), [`google-redirect/index.html`](../google-redirect/index.html#L31)

## Security on the app side

- tokens in encrypted storage, tied to the server that issued them, renewed in the background → [`tokenStorage.ts`](src/session/tokenStorage.ts#L13-L27), [`renew()`](src/session/SessionProvider.tsx#L81-L98)
- `http://` refused for addresses outside the local network (the password would travel in clear) → [`serverUrl.ts`](src/settings/serverUrl.ts#L16-L35)
- the Google redirect page only sends back to the app's own addresses (`exp://`, `musicroom://`), no external scripts → [`google-redirect/index.html`](../google-redirect/index.html#L31)
- no keys in the code: the Google client id and redirect address are copied from `backend/.env` into `mobile/.env.local` by `make` (both git-ignored) → [`Makefile google`](../Makefile#L114)

## Tests (V.8)

330 tests, one file per layer in `tests/`: API calls, session, settings, live connection, error messages, components, and every screen (rooms, votes, playlist, player, invites, auth, profile, friends, Google). The backend is replaced by a fake server and a fake socket, so the tests run without Docker.
