# Backend

This is the backend, doing backend stuff.

A NestJS backend for collaborative music rooms with real-time, audited and load-tested to 400 concurrent users.

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

PostgreSQL is a reliable relational database that handles concurrent users safely and guarantees consistency through ACID transactions.

Prisma ORM generates TypeScript types from the schema so invalid queries fail at compile time, not in production.

- [schema.prisma](../backend/prisma/schema.prisma) is the single source of truth for the data model.
- [seed.ts](../backend/prisma/seed.ts) populates the database with 50 users and 10 friendships.

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
* `Vote` handles upvotes on tracks, removes votes and prevents double voting.
* `Friendship` handles friend requests and connections.
* `ActionLog` is an audit trail of user actions, endpoints, devices and IP addresses.

---

## Authentication

The authentication system handles user registration, session management, password hashing, JWT validation and mobile Google ID token verification..

- [auth.module.ts](../backend/src/modules/auth/auth.module.ts) encapsulates auth controllers, services and token strategies.
- [auth.controller.ts](../backend/src/modules/auth/auth.controller.ts) handles HTTP endpoints, login, token refresh and Google mobile ID token verification.
- [auth.service.ts](../backend/src/modules/auth/auth.service.ts) implements business logic for credentials validation, password hashing, user creation, account linking and Google ID token validation.
- [jwt.strategy.ts](../backend/src/modules/auth/strategies/jwt.strategy.ts) manages incoming JWT access token and check `tokenVersion` against the database.
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

To do this, we use WebSockets, which keep a persistent, low-latency connection open between the client and server. Each Socket.IO room maps 1:1 to an active room session, and broadcasts are scoped to everyone currently viewing or connected to that room.

- [rooms.gateway.ts](../backend/src/modules/rooms/rooms.gateway.ts) defines the WebSocket gateway, event handlers (`joinRoom`, `leaveRoom`) and event listeners (`room.tracks.updated`, `room.playback.next`).
- [ws-jwt.guard.ts](../backend/src/modules/auth/guards/ws-jwt.guard.ts) authenticates sockets via JWT when handling event actions, ensuring unauthenticated clients cannot participate or join rooms.
- [redis-io.adapter.ts](../backend/src/redis-io.adapter.ts) is a custom Redis adapter that broadcasts events across multiple backend instances, ensuring a vote on `api-1` reaches listeners on `api-2` and `api-3`.

![](https://mermaid.ink/img/pako:eNqNVNFuGjEQ_JWVHwpVDxoCx3H3EImmUZtIVauEJlLFi7E34HLY1PbRUMS_d-8MBARFvRdsM7M7M155xYSRyDLm8FeBWuBHxceWz4Ya6Jtz65VQc649XOcK6Ye77eo9fL89hn3iHn_zZYm7N2bmtgcnkAW3ssQ9PUC_8JNwcIx7WIjXag9oF0rgMeoepXIVrlr0JZ97tEMdkBaFBzse1dsXEXRaEcTp2_BP-WnjEcwC7cZaFKRkcG20JqYyGt7AZ66lm_ApvhIDvHF1tTG5Y0B9hwZO3jLwZop6r-eGUXJDr0e06nkJd08DGJTYPWgJaOx3eeS5kmR_mRsuoS4qGc3CkQPuPRcTlCdaUYUg-MDYjfN8lCtHnEBBLY9iiymybhxBLz4bG11VBndGaaXHwKsrOxfWzUx5qP0kfImsQX0Flha3EtYnk6rKPystv2p8VE6NchyYeqBEUNq_3fdN8IPU-kKgo4G0NC9bs4cNtvE4I6bom6Wyeq2sn9Xg3Ubb-WDv0RdWwwpwUe0rdyiDv_W_A_7PuayGu-zC88ZAzRA-WJoAwZ1354Ku98Nde6vGY7QOFCVgNc-DzJNhb1p9K6rhAC6sofBEXjiikjSJey0r8EHYO2E0-VVyICachi4_G1-YCG-5mLqsmEtCyBoYC7V5zpcjOs40vvjaLkgWsbFVkmXeFhixGdoZL7dsVUKGzE9whkOW0dKiLF4akttpQ5jc2CEb6jXx6fn4Qfq2JawpxhOWPfPc0S5o2DyKu1NLndFem0J7ll12e1URlq3YC8vacbeZtC46SZq0u-3LXitiSwLFabPTS5NWHCfdVtJK1xH7U3W9aHbStHPR6bUuk14vbadJxChNb-yX8DJXD_T6L9TYzRg?type=png)

### Dependencies & Packages
- **`@nestjs/websockets`** provides NestJS decorators (`@WebSocketGateway`, `@SubscribeMessage`) and structural execution context.
- **`@nestjs/platform-socket.io` + `socket.io`** handle low-level TCP connection management, heartbeats, and room-scoped emission.
- **`@socket.io/redis-adapter` + `ioredis`** enable event broadcasting across distributed server instances.

---

## Concurrency

When multiple people are in the same music room voting, adding tracks or changing playback all at once, things can easily get out of sync if two requests hit the server at the exact same time (down to the millisecond).

To prevent race conditions and make sure data stays correct, we use:

- Database transaction (`Prisma.$transaction`) when a user votes, unvotes or playback next. It wraps the database operations in a transaction. This ensures that either all database changes succeed together or fail together.
- Redis for multi-server sync. Since the app can run on multiple backend instances, a user action on one instance needs to reach everyone else. Redis handles this by broadcasting messages across all instances instantly.
- Rate limiting to stop users from spamming buttons or flooding routes too fast. We use NestJS throttlers to limit how many requests a client can send in a given timeframe.

![](https://mermaid.ink/img/pako:eNqNlF1v2jAUhv_KkTUJJgWGQwIhF5VKmbjZpraMIW3swiSnYDWxmT9YacV_30mgBa2om6_y8Zz3PR-2n1imc2Qps_jLo8pwJMXSiHKugNZaGCczuRbKwZSDsDC1aIBDU6xli78_Q4UvVLinwjPUeFZRt1qXFsbC4W-xfQ2NhhV0ra1bGpzcfILmtZG2FGf0bjGXtpasH6794sPEL-ZqTxrMHJjlotntBBDxAOLBQaNaSjsEvaGEp_RrNExhIktfOKFQ-0qR-mKdPQZMeeviYjxL4WMpHTQ2FH8lrGtA0xmR3cPlifg0_D8WVf4q25jS6cUBJPHZbMezfbaXTpcyg69GKCsyJ7U60uMZ2VfQuu5c-507Us0ffp1T77-Rog1gie7Go8efJ2ajYeuQ_ok6ZLqkYhzmYH2WobV3vii20PyigWpC-q9yWZH2jeL-MYqquHqWNI2tylZGK_kozhR3gGjihbQraNRttem-tLwBuEHljjE1_lzU0GiRZzQOcBpEUcCCYilZkMrS-Km0wz4P4HQjH7xJZMqfB_uX7SswfBMkTxawpZE5S53xGLASTSmqV_ZUIXPmVljinKX0aDD3D61cmPtWpgtt5myudhRPJ-E7nahnCaP9csXSO1FYetsbHg73y1dDzmiutFeOpTyJahGWPrEHlkZJm4dJFEW9Pu91O0kvYFuWdsOoHXGeDOJ-zAdxl-8C9li7dtqDfmfQDzvJgIedbjdKAkbddtp83t8w9UWz-wMY2F25?type=png)

- [prisma.service.ts](../backend/src/prisma/prisma.service.ts) handles database client connections and transaction blocks.
- [redis-io.adapter.ts](../backend/src/redis-io.adapter.ts) syncs real-time events across multiple servers instances.
- [rooms.gateway.ts](../backend/src/modules/rooms/rooms.gateway.ts) manages incoming WebSocket messages and room broadcasts safely.

---

## Audit

To keep track of what's happening in the application and troubleshoot issues quickly, the application have an activity audit log. Read requests are excluded, only mutation actions (add track, voting, moving track, join/leve room) are recorded with context (IP address, platform and user info).

```bash
# to check the logs
docker compose up --build

# output
music-mailhog   | [APIv1] KEEPALIVE /api/v1/events
music-nginx     | 172.18.0.1 - - [28/Oct/2026:08:07:21 +0000] "GET /docs HTTP/1.1" 200 3126 "-" "Mozilla/5.0 (X11; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0"
music-nginx     | 172.18.0.1 - - [28/Oct/2026:08:07:21 +0000] "GET /docs/swagger-ui-init.js HTTP/1.1" 200 36469 "http://localhost:8080/docs" "Mozilla/5.0 (X11; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0"
music-nginx     | 172.18.0.1 - - [28/Oct/2026:08:07:21 +0000] "GET /docs/swagger-ui.css HTTP/1.1" 200 186154 "http://localhost:8080/docs" "Mozilla/5.0 (X11; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0"
music-nginx     | 172.18.0.1 - - [28/Oct/2026:08:07:21 +0000] "GET /docs/swagger-ui-standalone-preset.js HTTP/1.1" 200 267767 "http://localhost:8080/docs" "Mozilla/5.0 (X11; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0"
music-nginx     | 172.18.0.1 - - [28/Oct/2026:08:07:21 +0000] "GET /docs/swagger-ui-bundle.js HTTP/1.1" 200 1585988 "http://localhost:8080/docs" "Mozilla/5.0 (X11; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0"
music-nginx     | 172.18.0.1 - - [28/Oct/2026:08:07:21 +0000] "GET /docs/favicon-32x32.png HTTP/1.1" 200 628 "http://localhost:8080/docs" "Mozilla/5.0 (X11; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0"
music-nginx     | 172.18.0.1 - - [28/Oct/2026:08:07:34 +0000] "GET /health HTTP/1.1" 200 15 "-" "Mozilla/5.0 (X11; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0"
music-nginx     | 172.18.0.1 - - [28/Oct/2026:08:07:34 +0000] "GET /favicon.ico HTTP/1.1" 404 115 "http://localhost:8080/health" "Mozilla/5.0 (X11; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0"
music-nginx     | 172.18.0.9 - - [28/Oct/2026:08:07:39 +0000] "GET /health HTTP/1.1" 200 15 "-" "curl/7.81.0"
```

- [logs.controller.ts](../backend/src/modules/logs/logs.controller.ts)
- [logs.service.ts](../backend/src/modules/logs/logs.service.ts)
- [admin.guard.ts](../backend/src/modules/logs/guards/admin.guard.ts)

---

## Infrastructure

The stack is fully containerized with Docker Compose:
- PostgreSQL
- Redis
- NestJS API
- Nginx
- Mailhog.
- [docker-compose.yml](../docker-compose.yml)
- [backend - dockerfile](../backend/Dockerfile)
- [.env.example](../backend/.env.example)

![](https://mermaid.ink/img/pako:eNqNVFtvmzAU_iuWI02tBqnBQABVkbpE6lY1GWsiTdrYgwEnsQJ2ZEzXLOl_nzG0TXeR6hfsw3c5x8f2AeaioDCGa0l2G7CcphzoMSkZ5ep7CrtJCn8A2x4fEyEVCFGILjN5MX4Pbr4uAePgIyUFlfURzNeMP2jWrSAF-EBKwnMqDfasamqW27wFnGu5zmYbaPA2-Eu-V0p5B6ubrEtvKvItlWBO1U8ht93Pdhh0KwEWVN5T6WjZOa3VzaIPgDOyY7ZzbnK5ZGPjhBFClxdsbNJ5EeslgD3UKS1mywSIVsFQHOT6RzAjrNyItTbpZ6clVl3opchXmq1kW4QaMgGSJrtYNBm4KshO9Rv1TmPrmgkOFnueH8EdLVitncz31Ee2gVcFxSDAo-i5on95J5LVFQGf72aGeDX5NAVLSXhNcqU9dQuTa22WiFqtJV18uT113HXRP019D7uvTCkvnjun9iXt27NiZRkP3AKPvNCqlRRbGg_yrPApsnJRChkPVqvVKe8p856ZBXmG3sZMrp9Iq9D3ydtIZot7Xu5jhN9o1h-CnlkEEXXp_5nQ0neNFTBWsqEWrKjUJ0Yv4aHVTKHa0IqmMNZT3eLmwS6I3NqGn8KUP2r-jvBvQlRPElI06w2MV6Ss9arZFUTRKSP6ylTPUambQuVENFzB2A18IwLjA3yAsRM4Q4Q9D0coDCLHQ4EF9xrl-UPsRTjyR74T-dhxHy34y_iiYRh62HOwP3IcjEduZEG9eUrIWfeamEfl8TdT6F_8?type=png)

---

## Testing

We are using Jest, a powerful JavaScript/TypeScript testing framework. It focuses on simplicity, speed and zero configuration setups, making it the industry standard for testing NestJS applications.

In this project, we have:
- Unit Tests are isolated testing of service, DTO validation rules and utility functions (see below).
- WebSocket Gateway Tests to check real-time room joining/leaving and event broadcasting (`rooms.gateway.spec.ts`)
- HTTP Integration Tests: end-to-end bootstrap testing for route handling, health checks and middleware behaviour (`app.integration.spec.ts`)

```bash
make test

# output (Pass)
> music-room-api@1.0.0 test
> jest

 PASS  src/app.integration.spec.ts
 PASS  src/modules/rooms/rooms.gateway.spec.ts
 PASS  src/modules/auth/auth.service.spec.ts
 PASS  src/modules/users/user.service.spec.ts
 PASS  src/common/interceptors/log.interceptor.spec.ts
 PASS  src/modules/users/friends.service.spec.ts
 PASS  src/modules/auth/dto/dto.spec.ts
 PASS  src/modules/tracks/utils/index.util.spec.ts
 PASS  src/modules/rooms/utils/haversine.util.spec.ts

Test Suites: 9 passed, 9 total
Tests:       89 passed, 89 total
Snapshots:   0 total
Time:        1.874 s
Ran all test suites.
```

## Scaling

To show that this backend is ready for production, we run three separate copies of the NestJS API (`api-1`, `api-2`, `api-3`) behind a Nginx load balancer.

Nginx acts like a traffic cop, it decides which API instance handles each incoming request.

If one container gets hit with heavy traffic or needs to restart, users don't notice anything. Traffic is automatically sent to the healthy instances instead.

This setup proves our backend is stateless, meaning no single server remembers a user as session are checked using JWT tokens.

### Redis

Real-time music rooms depend on persistent WebSocket connections. With multiple API instances, this creates a problem :
- A user connected to `api-1` might be in the same room as users connected to `api-2`.

Redis Pub/Sub (Publish/Subscribe) solves this using `@socket.io/redis-adapter`.
- When a user on `api-1` votes on a track or changes playback, `api-1` publishes that event to Redis.
- Redis broadcasts the message to `api-2` and `api-3`
- Every connected client, no matter which instance they are on, receives the update at the same time.

No missed events. See diagram in #Concurrency.

---

## Performance

k6 is an open-source, load-testing tool created by Grafana Labs. It allows devs to write performance and stress-testing scripts in JavaScript/TypeScript to simulate heavy concurrent traffic and measure system bottlenecks and response times.

We simulate a realistic user journey, spanning authentication, user profile, friend requests, room lifecycles, track queues and admin guard checks, scaling up to a maximum of 400 Virtual Users (VUs) over 2 minutes.

```bash
make k6
```

| Metric | Result | Description |
| --- | --- | --- |
| **Max Virtual Users** | 400 VUs | Peak concurrent simulated users |
| **Total Requests** | 38,833 requests | Total HTTP calls processed (~304.7 req/s) |
| **Check Success Rate** | 100.00% (37,000 / 37,000) | Zero hard failures or assertions dropped |
| **Median Latency (med)** | 338.25 ms | Typical request response time |
| **95th Percentile (p95)** | 1.66 s | Tail latency under heavy concurrency |
| **Average Latency** | 527.6 ms | Overall mean request duration |

- [load-test.js](../scripts/load-test.js)

### Ramp-Up

To evaluate our system capacity, we tested how many simultaneous users our backend can handle across our 3 core services (NestJS API backend, PostgreSQL database and Nginx/Redis).

- Environment: local linux development (42 school workstation, x86_64 CPU, 16GB RAM).
- Target Deployment: designed for a standard low-end cloud VPS (ex 2vCPUs, 4GB RAM).

By scaling up to 400 simultaneous Virtual Users processing over 38,800 requests (~304 req/s) with 0% failure rate, our architecture easily proves it can support heavy concurrent traffic on standard cloud hardware.

---

Thank you for reading, this was fun.
