# Fega Backend Implementation Checklist

## Phase 1: Database & Prisma Schema
- [x] **1.1** Add `birthDate DateTime?` to `User` model in `backend/prisma/schema.prisma`
- [x] **1.2** Add `previewUrl String?` to `Track` model in `backend/prisma/schema.prisma`
- [x] **1.3** Run `prisma generate` and sync database schema

---

## Phase 2: Track Preview Audio Support
- [x] **2.1** Update `DeezerService.getTrackById` in `backend/src/modules/tracks/deezer.service.ts` to extract `previewUrl: data.preview`
- [x] **2.2** Update `TracksService.addTrack` in `backend/src/modules/tracks/tracks.service.ts` to store `previewUrl` on track creation

---

## Phase 3: Users & Friends Module
- [x] **3.1** Update `UpdateProfileDto` in `backend/src/modules/users/dto/update.dto.ts` to support `birthDate` (`@IsDateString()`)
- [x] **3.2** Verify `UsersService.getOwnProfile` returns `birthDate` and `UsersService.getProfileForViewer` keeps it strictly private (never exposed to friends or public)
- [x] **3.3** Implement `UsersService.searchUsers(query, limit)` returning **only public fields** (`id`, `displayName`, `avatarUrl`, `bio`, `musicPreference`)
- [x] **3.4** Add `GET /users?search=` endpoint in `backend/src/modules/users/users.controller.ts` with query validation and Swagger decorators
- [x] **3.5** Add `GET /friends/requests` endpoint in `backend/src/modules/users/friends.controller.ts` exposing `friendsService.getPendingRequests(req.user.id)` with Swagger decorators

---

## Phase 4: Google Mobile Authentication & Linking
- [x] **4.1** Install `google-auth-library` in `backend/`
- [x] **4.2** Create `GoogleMobileAuthDto` with `idToken: string`
- [x] **4.3** Implement Google `idToken` verification in `backend/src/modules/auth/auth.service.ts` using `OAuth2Client`
- [x] **4.4** Add `POST /auth/google/mobile` in `backend/src/modules/auth/auth.controller.ts` for mobile app login
- [x] **4.5** Add `POST /auth/google/link` in `backend/src/modules/auth/auth.controller.ts` (protected with `JwtAuthGuard`) to link Google account to logged-in user

---

## Phase 5: Swagger Documentation & Verification
- [x] **5.1** Ensure all new endpoints and DTOs have comprehensive Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth`, `@ApiQuery`, `@ApiBody`)
- [x] **5.2** Run TypeScript build (`npm run build`) in `backend/` to ensure zero type errors
- [x] **5.3** Run automated tests (`npm run test`) in `backend/` to ensure zero regressions
- [x] **5.4** Commit and push changes to `origin/fega-backend`
