# Backend

This is the backend, doing backend stuff.

## Tech Stack

| Component | Technology |
| --- | --- |
| **Runtime** | Node.js |
| **Language** | TypeScript |
| **Framework** | NestJS |
| **Database** | PostgreSQL |
| **ORM** | Prisma |
| **Authentication** | Google OAuth 2.0, JWT & Argon2 |
| **Real-Time** | Socket.io |
| **Pub/Sub** | Redis |
| **API Documentation** | Swagger |
| **Testing** | Jest |
| **Load Testing** | k6 (by Grafana) |
| **Audit & Logging** | NestJS Custom Interceptors |

## Architecture

The backend is a custom-built NestJS application and the single source of truth for the system, handling all business logic, validation, security and state management.

The codebase is split into isolated, domain-driven modules:

- [AuthModule](../backend/src/modules/auth/auth.module.ts) : Authentication and sessions
- [UsersModule](../backend/src/modules/users/users.module.ts) : User profiles and accounts
- [RoomsModule](../backend/src/modules/rooms/rooms.module.ts) : Rooms and membership
- [TracksModule](../backend/src/modules/tracks/tracks.module.ts) : Track management
- [LogsModule](../backend/src/modules/logs/logs.module.ts) : Auditing and activity logs

Sub-features like Mail, Members and Friends live inside their parent domains rather than as top-level modules.

Every module follows the same pattern:
- `*.module.ts` encapsulates providers and dependencies.
- `*.controller.ts` handles incoming HTTP routing and responses.
- `*.service.ts` executes the core business logic.
- `*.dto.ts` validates payload and data transfer.
- `*.spec.ts` are unit tests for services and controllers.

NestJS enforces this discipline out of the box, keeping the codebase clean, modular and straightforward for all team members (and our evaluators).

---

## Database

PostgreSQL is a reliable relational database that handles concurrent users safely and guarantees consistency through ACID transaction.

Prisma ORM generates TypeScript types from the schema so invalid queries fail at compile time, not in production.

- [schema.prisma](../backend/prisma/schema.prisma) : the single source of truth for the data model.
- [seed.ts](../backend/prisma/seed.ts) : populates the database with demo users, rooms and tracks for local development and evaluation.

![](https://mermaid.ink/img/pako:eNqtV11v4jgU_SvIz7QqbSmUNxbobLaUIgpIs0JCJr6ARRJHtgPtFv772kkgDjYaNBoe0tjn-Pp--Tj9Rj4jgFoIeJfiFcfhLKqo34gFUPnO3vVPSE6jVWXy0RtZk-3umzfIZg_H1Sx8pRFxWJi-j3vW5LDf_tn3PsYlI1Mq6IIGVH45zAwnf_W9jj098qbt4wa5nbbvgxBDFlDfZel92BtYk95g6o178_dB_6eFjXof45HXGfe6pW1eOIWIiDWNPySWiXA53Rt0vcEPO4GdTm9o2steJgK4wwolleGrNQshpkFlYgMxFmLHOPkbi3UBLpgqMI6yZVPgdEmBuI1mqI8lZdGYbSAqaDSSNqctJYSxFBc9GYEAeWapiyWMaQhlUu8zphxEW5a3LHHs7TRFavPKK6EcshwhVMQB_hrgEAos7XiuHhZ9QZk1h7dYYj7hgYUELEuDHf6aRTBIwgXwAvtHsKgSJoL6Qw5L4BD54MjKgnK51iMH5nNQr8RM0glLYmJieav-YGwVgDoXLFGpurbDVukqj7iaLFGtaiCGDFxtPipV41gpED6ncTmfJ3XZqEcxbejF9vRawCUZwMbA2pTtojSaF8PJZcCwPNW2j-VFKFqVO_EIjDChiXhzFGmnwmA7pRpcXkR7ZqS_U3ojPj_hqs_kmGN_cxZmYdngpJ5ZTaSr8Aa6mx0l5gr0dJmrLxebxQBzk-luVzdMvodjg5izLSXmMTsDPFvqJJWOo68Cp-JMfUjC04K-ORSOw5bCriQLeonwGbeNx0zQcmef0o8JuVBWLVxWLaZMwtV5y9PvyJt0dIR2f4uD5ArlOd236Tlgqz_gEfadUqou2pgpzywgBLlmdnFV0uSS8dChL1vqO8oex5fuDhq3CVF3krg6H8WHwdUJEWrBpZRw8IFuLdT6_BDpnz8mGjGm_BW-TIk3vlL2-5sbtj-7WFqVGVpjMUPnxO_sZtC40tqLhFxdNI2KeZiO5mzpoqcHQBN9LKTTYNGVmhYD1_3gZBr10lRdi2t4eV1SqnH9ueNRackDOlo2yZkOpuGwSGJapKhg7Q2W1gQxzyW72D8jnGfI9tMI5KDI-30WpiYHNNqIedaORx9-ST926AyhKlpxSlBL8gSqKASuPhbVEKUHYYbkGtSljzK3SPJ5QzDf3PgsYOluB7U-xtG_KuijCc6S1Rq1ljgQapS1a_6Py4mSetvRLYhazeZDagO1vtEnat03G7e1WrP-XHu4U8-HRr2KvlCr1ry7bT7d1Z_rjbuH2n39UEX_pZvWbutPjfpT7fnx8b7xWKs_3h_-B8BWEwI?type=png)


* `Role` defines user permission levels (USER, ADMIN).
* `RoomKind` defines whether a room is for voting or playlists.
* `Visibility` controls whether a room is public or private.
* `AccessPolicy` defines how users can access a room (open, invite-only, restricted).
* `FriendshipStatus` defines the state of a friend request (pending, accepted).
* `User` handles user profiles, login info, roles and tokenVersion.
* `GoogleAccount` links a Google account to a specific `User`.
* `Room` is a shared space tracking visibility, access rules and the currently playing track.
* `RoomMember` is a relation table tracking who belongs to which rooms.
* `Track` stores track details, duration and vote scores.
* `Vote` handles upvotes and downvotes on tracks, prevents double voting.
* `Friendship` handles friend requests and connections.
* `ActionLog` is an audit trail of user actions, endpoints, devices and IP addresses.

---

## Authentification

The authentication system handles user registration, session management, password hashing and Google OAuth.

- [auth.module.ts](../backend/src/modules/auth/auth.module.ts) encapsulates auth controllers, services and strategies.
- [auth.controller.ts](../backend/src/modules/auth/auth.controller.ts) handles HTTP endpoints, local login and Google OAuth callbacks.
- [auth.service.ts](../backend/src/modules/auth/auth.service.ts) implements business logic for credentials validation, password hashing and user creation/linking.
- [jwt.strategy.ts](../backend/src/modules/auth/strategies/jwt.strategy.ts) validates incoming JWT access tokens and check tokenVersion against the database.
- [google.strategy.ts](../backend/src/modules/auth/strategies/google.strategy.ts) manages Google OAuth integration and profile retrieval.

<details>
	<summary>Diagram</summary>

![](https://mermaid.ink/img/pako:eNq9Vltv4jgU_iuWH1apFGi4FZqHkTrMqsvspVXpzEorXtzkEKwGm7UdpkzV_77HdgIpARZpV4PEJeQ7t-9858SvNJEp0Jhq-LsAkcAnzjLFljNB8LViyvCEr5gwZJxzwC-mq1-X5MukCbu9KczCom6lzHIgd_b6gDejcoty6LEURsk8B9UETtfJFjcFteYJNEFfNKgHWEmLvFdcL5n7qwn8_M1V8PnPx50zj1KQGKKyp6AXhaTfCcng-sLfsS8hDRC5BlUWH9q8YheEPEDGtVHMcCl2Fh7X-vDBVhqT-7vpI7lkWMWlcng0DGDJeB5iglp_kyoNScr1KmebP9gSasGtB3TkIlbGNnLQbrdrMLyPqIqKmCQKmIEDwArSqpxqtoaUFLYYzJmbzXun2yIcwrtN99KzGFdxTLpRh4w9iAQ1hkBBWmYBIm3wPkDOrwYhGQ3-nff7kjHym8z4WaTnFthg_AjJa5bztOLuuMk-4XMu0p3JKcIdkRiBkaDy-wvTi4Zvnw0oPt9sEyDBjcqk6F4caVKVvG_o4QIzEICChUf5DEIHFtiIjaOCyuCZcCDMc5NLlsbkVRdPvoIJKhbHFt5qtmi1rXKKxpiGHbabJAGtiXN1JG9j75GnQqQ5nBJXRO5-JcEDmEIJN8knNHXmLLudFb_bWOSn_WS32irRTtlccMORyO26szW36pJ06HoF3r39kIp_d1sDF2AK56g480ECu7OPaHfBLIE-Gzcd-2Df3bIIeEnQIANiQWQula8aq79Xcs7rndgW4sKU5ToSSigJfHpWFvsTcGhU7tR4t6GOmzaGJ-fi-dS6-vHStb0p9atAr6TQ_5uCz9yKO2YnIpFLLjJcuvhA10Yf1dXtzyirlUJfCW6LFmYuC5VgG99pMyYfgSkM5epris5x7VeUZ3sfV9LqY5ataHhpLtGPm0lada6NfTuiiNqDaV8LpWuP-FpuRV_GV1Dazh3LGBfaHNqUtY6VTKIePuHK_s_bZlcrzqcsDA7bFBVm85mIcnufeZTIvYMf0DES1Gbn4kT_uMADwhLzfawRfX4jV7tH1-GGHpikir0HWGPM2hmDhjRTPKWxUQWEdAkKdwte0lcLmVGzwExnNMafeDYpXlopU8-tROZSzehMvKE9nhr_knJZuVCyyBY0nrNc45XPtjwxb_9VGBnUWBbC0LgbXfecFxq_0he8HvXbg07vqhONetejfm84COmGxoNhe9TtdK56neGwfx11e_23kH53gaP26Go0GuK724n63ajfDymk3Ej1uz-5J1LMeUbf_gEHzLNl?type=png)

</details><br>

- `@nestjs/jwt` handles signing, encoding and checks JWT for session state.
- `@nestjs/passport` + `passport` authentication middleware framework for NestJS strategies.
- `passport-jwt` extracts and verifies Bearer tokens from HTTP request headers.
- `passport-google-oauth20` manages OAuth 2.0 handshake and extracts Google profile.
- `argon2` provides secure, memory-hard password hashing and verification.
- `class-validator` + `class-transformer` validates and transforms incoming request payload against DTOs.

### API Endpoints

| Method | Endpoint | Description | Access / Rate Limit |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Creates a new local user account. | Public (10 req / min) |
| `POST` | `/auth/login` | Authenticates email/password and returns tokens. | Public (Configurable limit) |
| `GET` | `/auth/me` | Returns the currently authenticated user's profile. | Protected (`JwtAuthGuard`) |
| `GET` | `/auth/verify-email` | Verifies account email using a code query parameter. | Public (10 req / min) |
| `POST` | `/auth/resend-verification` | Resends a new email verification code if unverified. | Public (3 req / min) |
| `POST` | `/auth/request-password-reset` | Sends password reset instructions/token via email. | Public (5 req / min) |
| `POST` | `/auth/reset-password` | Resets account password using a valid token. | Public (5 req / min) |
| `GET` | `/auth/google` | Initiates the web-based Google OAuth flow. | Public (`GoogleAuthGuard`) |
| `POST` | `/auth/google/mobile` | Logs in or signs up using a Google ID token from a mobile app. | Public (15 req / min) |
| `POST` | `/auth/google/link` | Links a Google account to an already authenticated user. | Protected (`JwtAuthGuard`, 10 req / min) |
| `POST` | `/auth/refresh` | Exchanges a valid refresh token for a new token pair. | Public (5 req / min) |

### Required Environment Variables

```env
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=15m
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

---

## WebSockets

Collaborative music rooms need instant updates. When a user votes, adds a track, or changes playback, everyone in the room should see the change right away, without any delay or overhead of asking the server for updates.

To do this, we use WebSockets, which keep a persistent, low-latency connection open between the client and server. Each Socket.IO room maps 1:1 to a domain `Room`, so broadcasts are scoped to actual Room Members only.

- [rooms.gateway.ts](../backend/src/modules/rooms/rooms.gateway.ts) defines the WebSocket gateway, event handlers (`joinRoom`, `leaveRoom`) and event listeners (`room.tracks.updated`, `room.playback.next`).
- [ws-jwt.guard.ts](../backend/src/modules/auth/guards/ws-jwt.guard.ts) authenticates sockets via JWT on connection, rejecting unauthenticated clients before they can subscribe to any room.
- [redis-io.adapter.ts](../backend/src/redis-io.adapter.ts) is a custom Redis adapter that broadcasts events across multiple backend instances, ensuring a vote on `api-1` reaches listeners on `api-2` and `api-3`.

![](https://mermaid.ink/img/pako:eNqNVNFuGjEQ_JWVHwpVDxoCx3H3EImmUZtIVauEJlLFi7E34HLY1PbRUMS_d-8MBARFvRdsM7M7M155xYSRyDLm8FeBWuBHxceWz4Ya6Jtz65VQc649XOcK6Ye77eo9fL89hn3iHn_zZYm7N2bmtgcnkAW3ssQ9PUC_8JNwcIx7WIjXag9oF0rgMeoepXIVrlr0JZ97tEMdkBaFBzse1dsXEXRaEcTp2_BP-WnjEcwC7cZaFKRkcG20JqYyGt7AZ66lm_ApvhIDvHF1tTG5Y0B9hwZO3jLwZop6r-eGUXJDr0e06nkJd08DGJTYPWgJaOx3eeS5kmR_mRsuoS4qGc3CkQPuPRcTlCdaUYUg-MDYjfN8lCtHnEBBLY9iiymybhxBLz4bG11VBndGaaXHwKsrOxfWzUx5qP0kfImsQX0Flha3EtYnk6rKPystv2p8VE6NchyYeqBEUNq_3fdN8IPU-kKgo4G0NC9bs4cNtvE4I6bom6Wyeq2sn9Xg3Ubb-WDv0RdWwwpwUe0rdyiDv_W_A_7PuayGu-zC88ZAzRA-WJoAwZ1354Ku98Nde6vGY7QOFCVgNc-DzJNhb1p9K6rhAC6sofBEXjiikjSJey0r8EHYO2E0-VVyICachi4_G1-YCG-5mLqsmEtCyBoYC7V5zpcjOs40vvjaLkgWsbFVkmXeFhixGdoZL7dsVUKGzE9whkOW0dKiLF4akttpQ5jc2CEb6jXx6fn4Qfq2JawpxhOWPfPc0S5o2DyKu1NLndFem0J7ll12e1URlq3YC8vacbeZtC46SZq0u-3LXitiSwLFabPTS5NWHCfdVtJK1xH7U3W9aHbStHPR6bUuk14vbadJxChNb-yX8DJXD_T6L9TYzRg?type=png)

### Dependencies & Packages
- **`@nestjs/websockets`** provides NestJS decorators (`@WebSocketGateway`, `@SubscribeMessage`) and structural execution context.
- **`@nestjs/platform-socket.io` & `socket.io`** handle low-level TCP connection management, heartbeats, and room-scoped emission.
- **`@socket.io/redis-adapter` & `ioredis`** enable event broadcasting across distributed server instances.

---

## Concurrency

When multiple people are in the same music room voting, adding tracks or changing playback all at once, things can easily get out of sync if two requests hit the server at the exact same time (in millisecond).

To prevent race conditions and make sure data stays correct, we use:

- Database transaction (`Prisma.$transaction`) when a user votes or updates a queue. It wraps the database operations in a transaction. This ensures that either all database changes succeed together.
- Redis for multi-server sync, since the app can run on multiple backend instances, a user action on one instance needs to reach everyone else. Redis handles this by broadcasting messages across all instances instantly.
- Rate limiting to stop users from spamming buttons or flooding routes too fast. We use NestJS throttlers to limit how many requests a client can send in a give timeframe.

![](https://mermaid.ink/img/pako:eNqNlF1v2jAUhv_KkTUJJgWGQwIhF5VKmbjZpraMIW3swiSnYDWxmT9YacV_30mgBa2om6_y8Zz3PR-2n1imc2Qps_jLo8pwJMXSiHKugNZaGCczuRbKwZSDsDC1aIBDU6xli78_Q4UvVLinwjPUeFZRt1qXFsbC4W-xfQ2NhhV0ra1bGpzcfILmtZG2FGf0bjGXtpasH6794sPEL-ZqTxrMHJjlotntBBDxAOLBQaNaSjsEvaGEp_RrNExhIktfOKFQ-0qR-mKdPQZMeeviYjxL4WMpHTQ2FH8lrGtA0xmR3cPlifg0_D8WVf4q25jS6cUBJPHZbMezfbaXTpcyg69GKCsyJ7U60uMZ2VfQuu5c-507Us0ffp1T77-Rog1gie7Go8efJ2ajYeuQ_ok6ZLqkYhzmYH2WobV3vii20PyigWpC-q9yWZH2jeL-MYqquHqWNI2tylZGK_kozhR3gGjihbQraNRttem-tLwBuEHljjE1_lzU0GiRZzQOcBpEUcCCYilZkMrS-Km0wz4P4HQjH7xJZMqfB_uX7SswfBMkTxawpZE5S53xGLASTSmqV_ZUIXPmVljinKX0aDD3D61cmPtWpgtt5myudhRPJ-E7nahnCaP9csXSO1FYetsbHg73y1dDzmiutFeOpTyJahGWPrEHlkZJm4dJFEW9Pu91O0kvYFuWdsOoHXGeDOJ-zAdxl-8C9li7dtqDfmfQDzvJgIedbjdKAkbddtp83t8w9UWz-wMY2F25?type=png)

- `prisma.service.ts` handles database client connections and transaction blocks.
- `redis-io.adapter.ts` syncs real-time events across multiple servers instances.
- `rooms.gateway.ts` manages incoming WebSocket messages and room broadcasts safely.

---

## Audit

---

## Infrastructure

---

## Testing + Performance

---

## References


