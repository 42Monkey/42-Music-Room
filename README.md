# Music Room

A 42 school project

It is a collaborative music platform for live events.
People suggest tracs, vote in real time and edit playlists together.
Everything is driven by a NestJS backend that is the single source of truth.

**Implemented services (2 of 3 required):**
- **Music Track Vote**: real-time voting with concurrency control and visibility rules
- **Music Playlist Editor**: simultaenous multi-user editing with conflict handling

## Team

| Member | Role | Focus |
|--------|------|-------|
| [42Monkey](https://github.com/42Monkey) | Backend lead | Architecture, NestJS core, security, tests, load testing, Docker, API design |
| [prvdnx](https://github.com/prvdnx) | Backend features | Google sign-in, user search, friend requests, Deezer integration |
| [olegpreed](https://github.com/olegpreed) | Mobile (account) | Profile, friends, Google sign-in on the app |
| [BenGallagh42](https://github.com/BenGallagh42) | Mobile (core) | App base, rooms, Track Vote UI, Playlist Editor, player |

## Architecture

![](https://mermaid.ink/img/pako:eNp9VG1P2zAQ_iuWERNoaclrm4YJaaOMMQHKSKVJI_vgOJcmIo0rJ4EC5b_PL2nV8LJ8iO_Od8_dPT77GVOWAg7wnJNljmbTuELiq9tEG07LAqoG3ca4ky7JI_AY_9V-8gtzVoFwUOuXhB-d3AChDbomTXEP6OBstWSH2wio0rh6leQsnYNModZP6KKac6jrXpJZW1VQqjJYm2Yl4dDZVMZlm5QFRT9mszDqxV3Pi2olwtSKAt_0TRVwyUiKvpGSVHSnnfeK-0bonbDL-jbiRZVxUje8pU0r6jiYMmHnh73EX8MLmRbq5mckFU3MWTRDn1Ek_ZthwXoRN5AW9e1BjJUQ48Ndjs_lRsjqRlAT_brs716RQlIjl5zN_0_1qgFekVLRvZEj4PcFhT7jU4An4MJNC7KH95D399H3kj3UWlMzgAaDk3XX6m9IdLfr7ri0n5aloz4hbdWHJI0ymTLpv1DRYChQTwnN5YiEbXIUtclak7bjJGLD874uaXkDJrBmXByn6J1wmqMj0W8jHOt113ivH5naMVGNQg73BTzseG1ZiJrHErpSaEnqegqZENSlyYqyDPYyM5tkmSEGh91BsGfavkvHnTp4KNImD-zlyqCsZFxsO6MJsY5fAYK8Ih0cZBT8LRwlPjHdD-GINbLN8Wu4pJvobYFp5m4RrRFxXPIhouX5ppO-KXAzVNsi7czeQqbUHtmjDyGTiUUterxhVYF2Z6CZ3M3WDZGhp0YS09sVx2yo6TDCc0POwKbZnlc33Juqj7EhXsIixYG43WDgBfAFkSp-llExbnJYQIwDIXJI29UgJfxuoMqPcVy9iPglqf4wtthAcNbOcxxkpKyF1i5T0sC0IOI6LrZWLsoCfsraqsHBeDxWIDh4xiscOO5w4jmeP_LGvhgJyzXwIw5szx-6rmfZE2fieo5ley8GflJpTeFv26blih3XsYRsYMFDw_iVfurVi__yD69B3Ow?type=png)

### Design principles
- The backend is the source of thruth (rooms, tracks, votes, user live)
- Three API instances behinx nginx, Redis keep live Socket.io connections in sync.
- Cloudflare Tunnel gives a public HTTPS address so any phone can reach the API.
- The mobile app only stores the auth tokens and the backend address.

## Stack

| Layer        | Technology                        | Why it was chosen |
|--------------|-----------------------------------|-------------------|
| App          | React Native + Expo (TypeScript)  | One codebase, easy testing on real devices via Expo Go |
| API          | NestJS (TypeScript, Node 22)      | Modular architecture, guards, validation, Swagger out of the box |
| Database     | PostgreSQL + Prisma               | Relational model, transactions, unique constraints for concurrent votes |
| Real-time    | Socket.io + Redis adapter         | Server-push updates shared across multiple API instances |
| Auth         | JWT + Argon2 + Google ID tokens   | Short-lived access tokens, secure password hashing, social login |
| Infra        | Docker Compose, nginx, Cloudflare | One-command setup, load balancing, public HTTPS |
| Load testing | k6                                | Realistic concurrent-user scenarios |

## API

- **Style**: REST + JSON
- **Documentation**: Swagger at `http://localhost:8080/docs` (generated from the code)
- **Real-time events** (Socket.io):
  - Client → Server: `joinRoom`, `leaveRoom`
  - Server → Client: `tracks:updated`, `playback:next`

Every protected route requires a valid JWT. Private rooms return “Room not found” to unauthorized users.

## Run

**Requirements**
- Docker
- `backend/.env` (copy from `backend/.env.example`)
- Expo Go on a phone (or iOS Simulator)

| Command                 | Action                                 |
|-------------------------|----------------------------------------|
| `make`                  | Start everything                       |
| `make down`             | Stop (keeps database)                  |
| `make clean` / `fclean` | Stop and remove database + packages    |
| `make re`               | Full reset                             |
| `make test`             | Backend tests                          |
| `make k6`               | Load test                              |
| `make throttle`         | Rate-limit test                        |
| `make help`             | All commands                           |

**Test accounts**: `user1@test.com` … `user50@test.com` — password `password123`
(user1–user11 are already friends)

## Docs

- [docs/BACKEND.md](docs/BACKEND.md): API, database, auth, real time, concurrency, logs, load test
- [docs/FRONTEND.md](docs/FRONTEND.md): the app, how each feature works (with links to the code), working in the code
- Swagger: `http://localhost:8080/docs`
