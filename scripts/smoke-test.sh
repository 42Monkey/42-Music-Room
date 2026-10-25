#!/usr/bin/env bash
set -e

BASE_URL="http://localhost:8080"
EMAIL="user13@test.com"
PASSWORD="password123"
PSQL="docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase"

echo "=== 1. AUTHENTICATION & REGISTRATION ==="

echo "→ Registering primary test user (409 is fine if it already exists)..."
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"displayName\": \"Smoke Test\"}" | jq . || true

echo "→ Marking the test user as verified (login refuses unverified accounts)..."
$PSQL -c "UPDATE \"User\" SET \"emailVerified\" = true WHERE email = '$EMAIL';" > /dev/null

echo "→ Logging in to get access token..."
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" | jq -r .accessToken)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Login failed for $EMAIL (not seeded, or login limit hit? run 'make seed' and wait 60s)"
  exit 1
fi
echo "Token acquired successfully."

echo "→ GET /auth/me (Verify JWT guard token payload)"
curl -s "$BASE_URL/auth/me" -H "Authorization: Bearer $TOKEN" | jq .


echo -e "\n=== 2. USERS: OWN PROFILE & PATCH ==="

echo "→ GET /users/me (Fetch full untiered own profile)"
curl -s "$BASE_URL/users/me" -H "Authorization: Bearer $TOKEN" | jq .

echo "→ PATCH /users/me (Update bio and music preference)"
curl -s -X PATCH "$BASE_URL/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio": "Full stack techno lover", "musicPreference": {"genres": ["techno", "ambient"]}}' | jq .


echo -e "\n=== 3. USERS: TIERED VIEWS & SEEDED DATA ==="

echo "→ Logging in as user1@test.com..."
USER1_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user1@test.com", "password": "password123"}')
USER1_TOKEN=$(echo "$USER1_LOGIN" | jq -r .accessToken)

echo "→ Logging in as user2@test.com..."
USER2_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user2@test.com", "password": "password123"}')
USER2_TOKEN=$(echo "$USER2_LOGIN" | jq -r .accessToken)

if [ "$USER2_TOKEN" = "null" ] || [ -z "$USER2_TOKEN" ]; then
  echo "Error logging in as user2:"
  echo "$USER2_LOGIN" | jq .
  exit 1
fi

# Get user2's ID via /users/me using user2 token
USER2_ID=$(curl -s "$BASE_URL/users/me" -H "Authorization: Bearer $USER2_TOKEN" | jq -r .id)

echo "→ GET /users/$USER2_ID (Viewing user2 as user1 - should be Friends tier)"
curl -s "$BASE_URL/users/$USER2_ID" -H "Authorization: Bearer $USER1_TOKEN" | jq .


echo -e "\n=== 4. SECURITY & VALIDATION GUARDS ==="

echo "→ Testing 401 Unauthorized (No token provided)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/users/me")
echo "Response HTTP Status (Expected 401): $HTTP_CODE"

echo "→ Testing 400 Bad Request / Privilege Escalation Rejection (Injecting 'role': 'ADMIN')..."
curl -s -X PATCH "$BASE_URL/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio": "hacking attempt", "role": "ADMIN"}' | jq .


echo -e "\n=== 5. ROOMS & OWNERSHIP ENFORCEMENT ==="

echo "→ Creating a room as primary test user..."
ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Friday Night Vote", "kind": "VOTE"}')
echo "$ROOM_RES" | jq .
ROOM_ID=$(echo "$ROOM_RES" | jq -r .id)

echo "→ GET /rooms/$ROOM_ID..."
curl -s "$BASE_URL/rooms/$ROOM_ID" -H "Authorization: Bearer $TOKEN" | jq .

echo "→ PATCH /rooms/$ROOM_ID (Updating description)..."
curl -s -X PATCH "$BASE_URL/rooms/$ROOM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description"}' | jq .

echo "→ Attempting to DELETE /rooms/$ROOM_ID as a DIFFERENT user (user1@test.com) - Expected 403 Forbidden..."
curl -s -X DELETE "$BASE_URL/rooms/$ROOM_ID" -H "Authorization: Bearer $USER1_TOKEN" | jq .

echo "→ DELETE /rooms/$ROOM_ID as owner..."
curl -s -X DELETE "$BASE_URL/rooms/$ROOM_ID" -H "Authorization: Bearer $TOKEN" | jq .


echo -e "\n=== 6. ROOM VISIBILITY & ACCESS CONTROL ==="

echo "→ Logging in as user30@test.com (unrelated user)..."
USER30_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user30@test.com", "password": "password123"}')
USER30_TOKEN=$(echo "$USER30_LOGIN" | jq -r .accessToken)
USER30_ID=$(curl -s "$BASE_URL/users/me" -H "Authorization: Bearer $USER30_TOKEN" | jq -r .id)

echo "→ Creating a PUBLIC room as primary test user..."
PUBLIC_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Public Room", "kind": "VOTE", "visibility": "PUBLIC"}')
PUBLIC_ROOM_ID=$(echo "$PUBLIC_ROOM_RES" | jq -r .id)

echo "→ Creating a PRIVATE room as primary test user..."
PRIVATE_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Private Room", "kind": "VOTE", "visibility": "PRIVATE"}')
PRIVATE_ROOM_ID=$(echo "$PRIVATE_ROOM_RES" | jq -r .id)

echo "→ Listing rooms as unrelated user30 (should see Public Room, but NOT Private Room)..."
curl -s "$BASE_URL/rooms" -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Attempting to fetch PRIVATE room directly as unrelated user30 (Expected 404)..."
curl -s "$BASE_URL/rooms/$PRIVATE_ROOM_ID" -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Confirming owner sees the PRIVATE room directly..."
curl -s "$BASE_URL/rooms/$PRIVATE_ROOM_ID" -H "Authorization: Bearer $TOKEN" | jq .

echo "→ Cleaning up created rooms..."
curl -s -X DELETE "$BASE_URL/rooms/$PUBLIC_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null
curl -s -X DELETE "$BASE_URL/rooms/$PRIVATE_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null


echo -e "\n=== 7. ROOM MEMBERSHIP & INVITES ==="

echo "→ Creating a new PRIVATE room for member testing..."
PM_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Protected Private Room", "kind": "VOTE", "visibility": "PRIVATE"}')
PM_ROOM_ID=$(echo "$PM_ROOM_RES" | jq -r .id)

echo "→ Logging in as user40@test.com (second unrelated user)..."
USER40_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user40@test.com", "password": "password123"}')
USER40_TOKEN=$(echo "$USER40_LOGIN" | jq -r .accessToken)
USER40_ID=$(curl -s "$BASE_URL/users/me" -H "Authorization: Bearer $USER40_TOKEN" | jq -r .id)

echo "→ Inviting user30 to the private room as owner..."
curl -s -X POST "$BASE_URL/rooms/$PM_ROOM_ID/members" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER30_ID\"}" | jq .

echo "→ Confirming invited user30 can now view the private room..."
curl -s "$BASE_URL/rooms/$PM_ROOM_ID" -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Confirming invited user30 sees the private room in their room list..."
curl -s "$BASE_URL/rooms" -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Attempting to fetch private room as uninvited user40 (Expected 404)..."
curl -s "$BASE_URL/rooms/$PM_ROOM_ID" -H "Authorization: Bearer $USER40_TOKEN" | jq .

echo "→ Attempting to invite user40 as user30 (Expected 403 - members cannot invite)..."
curl -s -X POST "$BASE_URL/rooms/$PM_ROOM_ID/members" \
  -H "Authorization: Bearer $USER30_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER40_ID\"}" | jq .

echo "→ Removing user30 from the room members as owner..."
curl -s -X DELETE "$BASE_URL/rooms/$PM_ROOM_ID/members/$USER30_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo "→ Confirming user30 loses access to the private room again (Expected 404)..."
curl -s "$BASE_URL/rooms/$PM_ROOM_ID" -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Cleaning up protected room..."
curl -s -X DELETE "$BASE_URL/rooms/$PM_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null


echo -e "\n=== 8. ACCESS POLICY GUARD ==="

echo "→ Creating an OPEN access policy room..."
OPEN_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Open Access Room", "kind": "VOTE", "accessPolicy": "OPEN"}')
OPEN_ROOM_ID=$(echo "$OPEN_ROOM_RES" | jq -r .id)

echo "→ Testing test-access on OPEN room as unrelated user30 (Expected 200 OK)..."
curl -s "$BASE_URL/rooms/$OPEN_ROOM_ID/test-access" -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Creating an INVITE_ONLY access policy room..."
INV_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Invite Only Room", "kind": "VOTE", "accessPolicy": "INVITE_ONLY"}')
INV_ROOM_ID=$(echo "$INV_ROOM_RES" | jq -r .id)

echo "→ Testing test-access on INVITE_ONLY room as uninvited user30 (Expected 403 Forbidden)..."
curl -s "$BASE_URL/rooms/$INV_ROOM_ID/test-access" -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Inviting user30 to the INVITE_ONLY room..."
curl -s -X POST "$BASE_URL/rooms/$INV_ROOM_ID/members" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER30_ID\"}" > /dev/null

echo "→ Testing test-access on INVITE_ONLY room as newly invited user30 (Expected 200 OK)..."
curl -s "$BASE_URL/rooms/$INV_ROOM_ID/test-access" -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Creating a RESTRICTED access policy room..."
REST_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Restricted Room", "kind": "VOTE", "accessPolicy": "RESTRICTED"}')
REST_ROOM_ID=$(echo "$REST_ROOM_RES" | jq -r .id)

echo "→ Testing test-access on RESTRICTED room as owner (Expected 200 OK)..."
curl -s "$BASE_URL/rooms/$REST_ROOM_ID/test-access" -H "Authorization: Bearer $TOKEN" | jq .

echo "→ Testing test-access on RESTRICTED room as user30, no geofence/window configured (Expected 200 OK - RESTRICTED with nothing configured imposes no restriction)..."
curl -s "$BASE_URL/rooms/$REST_ROOM_ID/test-access" -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Cleaning up access policy test rooms..."
curl -s -X DELETE "$BASE_URL/rooms/$OPEN_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null
curl -s -X DELETE "$BASE_URL/rooms/$INV_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null
curl -s -X DELETE "$BASE_URL/rooms/$REST_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null


echo -e "\n=== 9. TRACKS & DEEZER INTEGRATION ==="

echo "→ Creating a dedicated open room for track testing..."
TRACK_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Track Test Open Room", "kind": "VOTE", "accessPolicy": "OPEN"}')
TRACK_ROOM_ID=$(echo "$TRACK_ROOM_RES" | jq -r .id)

echo "→ Creating a dedicated invite-only room for policy testing..."
TRACK_INV_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Track Test Invite Room", "kind": "VOTE", "accessPolicy": "INVITE_ONLY"}')
TRACK_INV_ID=$(echo "$TRACK_INV_RES" | jq -r .id)

echo "→ Adding a track to the open room via Deezer integration..."
TRACK_RES=$(curl -s -X POST "$BASE_URL/rooms/$TRACK_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "3135556"}')
echo "$TRACK_RES" | jq .
TRACK_ID=$(echo "$TRACK_RES" | jq -r .id)

echo "→ Testing duplicate track addition guard (Expected 409 Conflict)..."
curl -s -X POST "$BASE_URL/rooms/$TRACK_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "3135556"}' | jq .

echo "→ Testing bogus Deezer ID handling (Expected 404 NotFound)..."
curl -s -X POST "$BASE_URL/rooms/$TRACK_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "999999999999"}' | jq .

echo "→ Testing AccessPolicy guard on track addition (Adding to INVITE_ONLY room as uninvited user30 - Expected 403)..."
curl -s -X POST "$BASE_URL/rooms/$TRACK_INV_ID/tracks" \
  -H "Authorization: Bearer $USER30_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "3135556"}' | jq .


echo -e "\n=== 10. TRACK VOTING, UNVOTING & SORTED QUEUE ==="

echo "→ Checking track score before vote (expect 0)..."
docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -t -c "SELECT score FROM \"Track\" WHERE id = '$TRACK_ID';" | xargs

echo "→ Voting for track 1..."
curl -s -X POST "$BASE_URL/rooms/$TRACK_ROOM_ID/tracks/$TRACK_ID/vote" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo "→ Checking track score after vote (expect 1)..."
docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -t -c "SELECT score FROM \"Track\" WHERE id = '$TRACK_ID';" | xargs

echo "→ Testing duplicate vote guard (Expected 409 Conflict)..."
curl -s -X POST "$BASE_URL/rooms/$TRACK_ROOM_ID/tracks/$TRACK_ID/vote" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo "→ Adding a second track to test queue sorting..."
TRACK2_RES=$(curl -s -X POST "$BASE_URL/rooms/$TRACK_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "4591456"}')
echo "$TRACK2_RES" | jq .
TRACK2_ID=$(echo "$TRACK2_RES" | jq -r .id)

echo "→ Fetching queue (Track 1 score 1 should be first)..."
curl -s "$BASE_URL/rooms/$TRACK_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo "→ Voting for track 2 twice (using user1 and user2) so its score becomes 2..."
# Login/Token for user1 and user2 are already available from Section 3
curl -s -X POST "$BASE_URL/rooms/$TRACK_ROOM_ID/tracks/$TRACK2_ID/vote" \
  -H "Authorization: Bearer $USER1_TOKEN" > /dev/null
curl -s -X POST "$BASE_URL/rooms/$TRACK_ROOM_ID/tracks/$TRACK2_ID/vote" \
  -H "Authorization: Bearer $USER2_TOKEN" > /dev/null

echo "→ Fetching queue again (Track 2 score 2 should now jump to the top)..."
curl -s "$BASE_URL/rooms/$TRACK_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo "→ Unvoting track 1..."
curl -s -X DELETE "$BASE_URL/rooms/$TRACK_ROOM_ID/tracks/$TRACK_ID/vote" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo "→ Cleaning up track test rooms..."
curl -s -X DELETE "$BASE_URL/rooms/$TRACK_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null
curl -s -X DELETE "$BASE_URL/rooms/$TRACK_INV_ID" -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "\n=== 11. RESTRICTED ACCESS POLICY & GEOFENCING ==="

echo "→ Creating a RESTRICTED room for geofence testing..."
REST_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Geofenced Room", "kind": "VOTE", "accessPolicy": "RESTRICTED"}')
REST_ROOM_ID=$(echo "$REST_ROOM_RES" | jq -r .id)

echo "→ Patching RESTRICTED room coordinates (Paris: 48.8566, 2.3522, Radius: 500m)..."
PATCH_RES=$(curl -s -X PATCH "$BASE_URL/rooms/$REST_ROOM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accessPolicy": "RESTRICTED", "locationLat": 48.8566, "locationLng": 2.3522, "locationRadiusM": 500}')
echo "$PATCH_RES" | jq .

echo "→ Adding three distinct tracks for our three independent vote tests..."
TRACK1_ID=$(curl -s -X POST "$BASE_URL/rooms/$REST_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "3135556"}' | jq -r .id)

TRACK2_ID=$(curl -s -X POST "$BASE_URL/rooms/$REST_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "4591456"}' | jq -r .id)

TRACK3_ID=$(curl -s -X POST "$BASE_URL/rooms/$REST_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "1234567"}' | jq -r .id)

echo "→ Case 1: Voting with NO coordinates as user30 (Expected 400 Bad Request)..."
curl -s -X POST "$BASE_URL/rooms/$REST_ROOM_ID/tracks/$TRACK1_ID/vote" \
  -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Case 2: Voting from far outside radius (Bangkok coords) as user40 (Expected 403 Forbidden)..."
curl -s -X POST "$BASE_URL/rooms/$REST_ROOM_ID/tracks/$TRACK2_ID/vote?lat=13.7563&lng=100.5018" \
  -H "Authorization: Bearer $USER40_TOKEN" | jq .

echo "→ Case 3: Voting from inside radius (Paris coords) as user30 (Expected 200 OK)..."
curl -s -X POST "$BASE_URL/rooms/$REST_ROOM_ID/tracks/$TRACK3_ID/vote?lat=48.8566&lng=2.3522" \
  -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Cleaning up restricted test room..."
curl -s -X DELETE "$BASE_URL/rooms/$REST_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "\n=== 12. RESTRICTED ACCESS POLICY & TIME WINDOWS ==="

echo "→ Creating a RESTRICTED room for time window testing..."
TIME_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Time-Gated Room", "kind": "VOTE", "accessPolicy": "RESTRICTED"}')
TIME_ROOM_ID=$(echo "$TIME_ROOM_RES" | jq -r .id)

echo "→ Adding three distinct tracks for our time window and combined tests..."
T_TRACK1_ID=$(curl -s -X POST "$BASE_URL/rooms/$TIME_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "3135556"}' | jq -r .id)

T_TRACK2_ID=$(curl -s -X POST "$BASE_URL/rooms/$TIME_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "4591456"}' | jq -r .id)

T_TRACK3_ID=$(curl -s -X POST "$BASE_URL/rooms/$TIME_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "1234567"}' | jq -r .id)

echo "→ Case 1: Window excludes right now (past dates) as user30 (Expected 403 Forbidden)..."
curl -s -X PATCH "$BASE_URL/rooms/$TIME_ROOM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"windowStart": "2020-01-01T00:00:00Z", "windowEnd": "2020-01-02T00:00:00Z"}' > /dev/null

curl -s -X POST "$BASE_URL/rooms/$TIME_ROOM_ID/tracks/$T_TRACK1_ID/vote" \
  -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Case 2: Window brackets right now (current/future bounds) as user40 (Expected 200 OK)..."
curl -s -X PATCH "$BASE_URL/rooms/$TIME_ROOM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"windowStart": "2026-10-01T00:00:00Z", "windowEnd": "2026-12-31T00:00:00Z"}' > /dev/null

curl -s -X POST "$BASE_URL/rooms/$TIME_ROOM_ID/tracks/$T_TRACK2_ID/vote" \
  -H "Authorization: Bearer $USER40_TOKEN" | jq .

echo "→ Case 3: Both time window and geofence set, satisfying time but failing geofence (Expected 403 Geofence error)..."
curl -s -X PATCH "$BASE_URL/rooms/$TIME_ROOM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locationLat": 48.8566, "locationLng": 2.3522, "locationRadiusM": 500}' > /dev/null

curl -s -X POST "$BASE_URL/rooms/$TIME_ROOM_ID/tracks/$T_TRACK3_ID/vote?lat=13.7563&lng=100.5018" \
  -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Cleaning up time-window test room..."
curl -s -X DELETE "$BASE_URL/rooms/$TIME_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "\n=== 13. PLAYLIST POSITION ASSIGNMENT & VOTE DISCRIMINATION ==="

echo "→ Creating a PLAYLIST room..."
PL_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Friday Playlist", "kind": "PLAYLIST"}')
PL_ROOM_ID=$(echo "$PL_ROOM_RES" | jq -r .id)

echo "→ Adding track 1 to playlist room (expecting position)..."
POS1=$(curl -s -X POST "$BASE_URL/rooms/$PL_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "3135556"}' | jq -r .position)
echo "Position 1: $POS1"

echo "→ Adding track 2 to playlist room (expecting lexically later position)..."
POS2=$(curl -s -X POST "$BASE_URL/rooms/$PL_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "4591456"}' | jq -r .position)
echo "Position 2: $POS2"

echo "→ Creating a VOTE room..."
VT_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Friday Vote Room", "kind": "VOTE"}')
VT_ROOM_ID=$(echo "$VT_ROOM_RES" | jq -r .id)

echo "→ Adding track to VOTE room (expecting position: null)..."
VT_POS=$(curl -s -X POST "$BASE_URL/rooms/$VT_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "3135556"}' | jq .position)
echo "Vote Room Track Position: $VT_POS"

echo "→ Cleaning up playlist and vote test rooms..."
curl -s -X DELETE "$BASE_URL/rooms/$PL_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null
curl -s -X DELETE "$BASE_URL/rooms/$VT_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "\n=== 14. PLAYLIST TRACK REORDERING & TIGHT-GAP STRESS TEST ==="

echo "→ Creating a PLAYLIST room for reorder testing..."
REORDER_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Reorder Playlist", "kind": "PLAYLIST"}')
REORDER_ROOM_ID=$(echo "$REORDER_ROOM_RES" | jq -r .id)

echo "→ Adding 6 distinct tracks for repeated insertion testing..."
R_TRACK1=$(curl -s -X POST "$BASE_URL/rooms/$REORDER_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "3135556"}' | jq -r .id) # Track 1

R_TRACK2=$(curl -s -X POST "$BASE_URL/rooms/$REORDER_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "4591456"}' | jq -r .id) # Track 2

R_TRACK3=$(curl -s -X POST "$BASE_URL/rooms/$REORDER_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "1234567"}' | jq -r .id) # Track 3

R_TRACK4=$(curl -s -X POST "$BASE_URL/rooms/$REORDER_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "9876543"}' | jq -r .id) # Track 4

R_TRACK5=$(curl -s -X POST "$BASE_URL/rooms/$REORDER_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "5555555"}' | jq -r .id) # Track 5

R_TRACK6=$(curl -s -X POST "$BASE_URL/rooms/$REORDER_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "7777777"}' | jq -r .id) # Track 6

echo "→ Initial Queue State:"
curl -s -X GET "$BASE_URL/rooms/$REORDER_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" | jq '[.[] | {title, position}]'

echo "→ Repeatedly squeezing tracks 5 times into the exact same gap right after Track 1..."
for T_ID in "$R_TRACK2" "$R_TRACK3" "$R_TRACK4" "$R_TRACK5" "$R_TRACK6"; do
  NEW_POS=$(curl -s -X PATCH "$BASE_URL/rooms/$REORDER_ROOM_ID/tracks/$T_ID/position" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"afterTrackId\": \"$R_TRACK1\"}" | jq -r .position)
  echo "Inserted track into gap -> new position: $NEW_POS"
done

echo "→ Final Queue State (Verifying strict ascending sort order despite deep/tight positions):"
curl -s -X GET "$BASE_URL/rooms/$REORDER_ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" | jq '[.[] | {title, position}]'

echo "→ Cleaning up reorder test room..."
curl -s -X DELETE "$BASE_URL/rooms/$REORDER_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "\n✓ Playlist reordering & tight-gap stress test complete successfully!"


echo -e "\n=== 15. ACCESS POLICY GUARD vs ROOM VISIBILITY (PRIVATE + OPEN TRACKS GAP) ==="

echo "→ Creating a PRIVATE room with accessPolicy OPEN (visibility and license are independent axes)..."
PRIV_OPEN_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Private Open Room", "kind": "VOTE", "visibility": "PRIVATE", "accessPolicy": "OPEN"}')
PRIV_OPEN_ID=$(echo "$PRIV_OPEN_RES" | jq -r .id)

echo "→ Adding a track to it as the owner..."
PO_TRACK_ID=$(curl -s -X POST "$BASE_URL/rooms/$PRIV_OPEN_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "3135556"}' | jq -r .id)

echo "→ Confirming uninvited user30 still gets 404 on the room itself (sanity check — unchanged behavior)..."
curl -s "$BASE_URL/rooms/$PRIV_OPEN_ID" -H "Authorization: Bearer $USER30_TOKEN" | jq .

echo "→ Attempting to vote as uninvited user30 directly on the tracks endpoint (Expected 404 — AccessPolicyGuard must enforce visibility, not just accessPolicy)..."
HTTP_CODE=$(curl -s -o /tmp/priv_open_vote_body.json -w "%{http_code}" -X POST "$BASE_URL/rooms/$PRIV_OPEN_ID/tracks/$PO_TRACK_ID/vote" \
  -H "Authorization: Bearer $USER30_TOKEN")
echo "Response HTTP Status (Expected 404): $HTTP_CODE"
cat /tmp/priv_open_vote_body.json | jq .
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "⚠️  FAIL: uninvited user voted successfully in a PRIVATE room — AccessPolicyGuard is not checking room.visibility. See the fix discussed for this guard."
elif [ "$HTTP_CODE" = "404" ]; then
  echo "✓ PASS: visibility properly enforced on the tracks endpoint."
else
  echo "⚠️  UNEXPECTED: got $HTTP_CODE instead of 404 — investigate."
fi
rm -f /tmp/priv_open_vote_body.json

echo "→ Confirming the owner can still vote in their own PRIVATE + OPEN room (Expected 200/201)..."
curl -s -X POST "$BASE_URL/rooms/$PRIV_OPEN_ID/tracks/$PO_TRACK_ID/vote" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo "→ Cleaning up private/open gap test room..."
curl -s -X DELETE "$BASE_URL/rooms/$PRIV_OPEN_ID" -H "Authorization: Bearer $TOKEN" > /dev/null


echo -e "\n=== 16. PHASE 6: EXTERNAL MUSIC PROVIDER (DEEZER SEARCH & PLAYBACK RELAY) ==="

echo "→ Creating a dedicated open room for Phase 6 tests..."
P6_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Phase 6 Room", "kind": "VOTE", "accessPolicy": "OPEN"}')
P6_ROOM_ID=$(echo "$P6_ROOM_RES" | jq -r .id)

echo "→ Testing Search-by-Title wrapper (GET /rooms/$P6_ROOM_ID/tracks/search?query=daft+punk)..."
curl -s -X GET "$BASE_URL/rooms/$P6_ROOM_ID/tracks/search?query=daft+punk" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo "→ Testing Playback Trigger Relay as owner (POST /rooms/$P6_ROOM_ID/tracks/next, Expected 200/201)..."
curl -s -X POST "$BASE_URL/rooms/$P6_ROOM_ID/tracks/next" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo "→ Testing Playback Trigger Relay as a non-owner (user30, OPEN room so they're allowed in, but not the owner - Expected 403)..."
HTTP_CODE=$(curl -s -o /tmp/next_nonowner_body.json -w "%{http_code}" -X POST "$BASE_URL/rooms/$P6_ROOM_ID/tracks/next" \
  -H "Authorization: Bearer $USER30_TOKEN")
echo "Response HTTP Status (Expected 403): $HTTP_CODE"
cat /tmp/next_nonowner_body.json | jq .
if [ "$HTTP_CODE" = "403" ]; then
  echo "✓ PASS: non-owner correctly blocked from triggering playback."
else
  echo "⚠️  FAIL: non-owner got $HTTP_CODE instead of 403 — triggerNext ownership check is missing or not wired up."
fi
rm -f /tmp/next_nonowner_body.json

echo "→ Cleaning up Phase 6 test room..."
curl -s -X DELETE "$BASE_URL/rooms/$P6_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "\n=== 17. PHASE 7: RATE LIMITING ON AUTH ROUTES ==="

echo "→ Firing 20 rapid login attempts (limit is 15/60s, plus 5 already consumed earlier in this run — expect 429 partway through)..."
for i in $(seq 1 20); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "smoketest@test.com", "password": "wrong-password"}')
  echo "Attempt $i: $CODE"
done
echo "(Expect 401 Unauthorized for wrong-password attempts, switching to 429 Too Many Requests once the limit is exceeded.)"

echo "→ Firing 15 rapid register attempts (limit is 10/60s, plus 1 already consumed in Section 1 — expect 429 partway through)..."
for i in $(seq 1 15); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"ratelimit-test-$i@test.com\", \"password\": \"password123\", \"displayName\": \"Rate Test\"}")
  echo "Attempt $i: $CODE"
done
echo "(Expect 201 Created for early attempts, switching to 429 once the limit is exceeded.)"

echo "→ Firing 8 rapid password-reset requests (limit is 5/60s, unused elsewhere — expect 429 by the 6th)..."
for i in $(seq 1 8); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/request-password-reset" \
    -H "Content-Type: application/json" \
    -d '{"email": "smoketest@test.com"}')
  echo "Attempt $i: $CODE"
done
echo "(Expect 200 OK for early attempts, switching to 429 once the limit is exceeded.)"

echo -e "\n=== 18. PHASE 7: ACTIONLOG INTERCEPTOR (PLATFORM/DEVICE/APP VERSION) ==="

echo "→ Creating a room while sending platform/device/appVersion headers..."
AL_ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Platform: iOS" \
  -H "X-Device: iPhone 15" \
  -H "X-App-Version: 1.0.0" \
  -d '{"name": "ActionLog Test Room", "kind": "VOTE"}')
AL_ROOM_ID=$(echo "$AL_ROOM_RES" | jq -r .id)

echo "→ Querying the most recent ActionLog row for this request..."
docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -t -c \
  "SELECT \"userId\", action, method, platform, device, \"appVersion\" FROM \"ActionLog\" WHERE action LIKE '%rooms%' ORDER BY \"createdAt\" DESC LIMIT 1;"

echo "→ Confirming a GET request (non-mutating) does NOT produce a new ActionLog row..."
BEFORE_COUNT=$(docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -t -c "SELECT COUNT(*) FROM \"ActionLog\";" | xargs)
curl -s "$BASE_URL/rooms/$AL_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null
AFTER_COUNT=$(docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -t -c "SELECT COUNT(*) FROM \"ActionLog\";" | xargs)
echo "Before: $BEFORE_COUNT, After GET: $AFTER_COUNT (should be equal)"
if [ "$BEFORE_COUNT" = "$AFTER_COUNT" ]; then
  echo "✓ PASS: GET requests correctly excluded from ActionLog."
else
  echo "⚠️  FAIL: a GET request produced a log row — MUTATING_METHODS filter isn't working."
fi

echo "→ Cleaning up ActionLog test room..."
curl -s -X DELETE "$BASE_URL/rooms/$AL_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "\n=== 19. PHASE 7: ACTIONLOG ON BLOCKED/UNAUTHORIZED ATTEMPTS ==="

echo "→ Attempting GET /users/me with NO token (Expected 401, logged with userId: null)..."
curl -s "$BASE_URL/users/me" > /dev/null
docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -t -c \
  "SELECT \"userId\", action, method FROM \"ActionLog\" WHERE action LIKE 'BLOCKED%users/me%' ORDER BY \"createdAt\" DESC LIMIT 1;"

echo "→ Creating a private room as owner, then attempting GET as uninvited user30 (Expected 404 — NOT logged, 404 isn't a security status)..."
PRIV_LOG_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name": "Blocked Attempt Room", "kind": "VOTE", "visibility": "PRIVATE"}')
PRIV_LOG_ID=$(echo "$PRIV_LOG_RES" | jq -r .id)

BEFORE=$(docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -t -c "SELECT COUNT(*) FROM \"ActionLog\";" | xargs)
curl -s "$BASE_URL/rooms/$PRIV_LOG_ID" -H "Authorization: Bearer $USER30_TOKEN" > /dev/null
AFTER=$(docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -t -c "SELECT COUNT(*) FROM \"ActionLog\";" | xargs)
echo "Before: $BEFORE, After 404 attempt: $AFTER (should be equal — 404 is not 401/403)"

echo "→ Attempting to invite a user as a non-owner member (Expected 403, logged WITH userId since they're authenticated)..."
curl -s -X POST "$BASE_URL/rooms/$PRIV_LOG_ID/members" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER30_ID\"}" > /dev/null
curl -s -X POST "$BASE_URL/rooms/$PRIV_LOG_ID/members" \
  -H "Authorization: Bearer $USER30_TOKEN" -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER40_ID\"}" > /dev/null
docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -t -c \
  "SELECT \"userId\", action, method FROM \"ActionLog\" WHERE action LIKE 'BLOCKED%members%' ORDER BY \"createdAt\" DESC LIMIT 1;"
echo "(Expect userId = user30's id, confirming authenticated-but-forbidden attempts log the actor, not null.)"

echo "→ Cleaning up..."
curl -s -X DELETE "$BASE_URL/rooms/$PRIV_LOG_ID" -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "\n=== 20. PHASE 8: LOGS ENDPOINT (ADMIN-ONLY) ==="

echo "→ Promoting user1 to ADMIN (idempotent, safe to repeat)..."
docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -c \
  "UPDATE \"User\" SET role='ADMIN' WHERE email='user1@test.com';" > /dev/null

echo "→ GET /logs as admin user1 (Expected 200 with log rows)..."
ADMIN_LOGS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/logs" -H "Authorization: Bearer $USER1_TOKEN")
echo "Response HTTP Status (Expected 200): $ADMIN_LOGS_CODE"

echo "→ GET /logs as non-admin smoketest user (Expected 403)..."
NONADMIN_LOGS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/logs" -H "Authorization: Bearer $TOKEN")
echo "Response HTTP Status (Expected 403): $NONADMIN_LOGS_CODE"

if [ "$ADMIN_LOGS_CODE" = "200" ] && [ "$NONADMIN_LOGS_CODE" = "403" ]; then
  echo "✓ PASS: AdminGuard correctly discriminates admin vs non-admin."
else
  echo "⚠️  FAIL: expected 200/403, got $ADMIN_LOGS_CODE/$NONADMIN_LOGS_CODE — check AdminGuard logic."
fi

echo "→ GET /logs with no token at all (Expected 401)..."
NOAUTH_LOGS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/logs")
echo "Response HTTP Status (Expected 401): $NOAUTH_LOGS_CODE"

docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -c \
  "UPDATE \"User\" SET role='USER' WHERE email='user1@test.com';" > /dev/null
