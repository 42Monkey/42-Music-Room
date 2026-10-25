#!/usr/bin/env bash
set -e

BASE_URL="http://localhost:8080"
EMAIL="smoketest@test.com"
PASSWORD="password123"
# Login limit is 15/min per IP: 1 primary login + VOTERS logins must stay under it.
VOTERS="${VOTERS:-10}"
PSQL="docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase"

echo "=========================================="
echo "SETUP"
echo "=========================================="

echo "→ Ensuring the primary test user exists and is verified..."
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"displayName\": \"Smoke Test\"}" > /dev/null || true
$PSQL -c "UPDATE \"User\" SET \"emailVerified\" = true WHERE email = '$EMAIL';" > /dev/null

TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" | jq -r .accessToken)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Login failed for $EMAIL (not seeded, or login limit hit? run 'make seed' and wait 60s)"
  exit 1
fi

echo "=========================================="
echo "PART 1: CONCURRENT VOTE SAFETY TEST ($VOTERS voters)"
echo "=========================================="

ROOM_RES=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Concurrency Vote Test Room", "kind": "VOTE", "accessPolicy": "OPEN"}')
ROOM_ID=$(echo "$ROOM_RES" | jq -r .id)

TRACK_RES=$(curl -s -X POST "$BASE_URL/rooms/$ROOM_ID/tracks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deezerTrackId": "3135556"}')
TRACK_ID=$(echo "$TRACK_RES" | jq -r .id)

if [ "$ROOM_ID" = "null" ] || [ "$TRACK_ID" = "null" ]; then
  echo "Setup failed. Room: $ROOM_RES  Track: $TRACK_RES"
  exit 1
fi

echo "→ Logging in $VOTERS seeded users one by one (to stay under the login limit)..."
TOKENS=()
for i in $(seq 1 "$VOTERS"); do
  T=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"user${i}@test.com\", \"password\": \"$PASSWORD\"}" | jq -r .accessToken)
  if [ -z "$T" ] || [ "$T" = "null" ]; then
    echo "Login failed for user${i}@test.com (not seeded, or login limit hit?)"
    exit 1
  fi
  TOKENS+=("$T")
done

echo "→ Firing $VOTERS votes at the same moment..."
for T in "${TOKENS[@]}"; do
  curl -s -X POST "$BASE_URL/rooms/$ROOM_ID/tracks/$TRACK_ID/vote" \
    -H "Authorization: Bearer $T" > /dev/null &
done
wait

SCORE=$($PSQL -t -c "SELECT score FROM \"Track\" WHERE id = '$TRACK_ID';" | xargs)
VOTES=$($PSQL -t -c "SELECT COUNT(*) FROM \"Vote\" WHERE \"trackId\" = '$TRACK_ID';" | xargs)
echo "Score: $SCORE (expected $VOTERS)   Vote rows: $VOTES (expected $VOTERS)"

curl -s -X DELETE "$BASE_URL/rooms/$ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null

if [ "$SCORE" != "$VOTERS" ] || [ "$VOTES" != "$VOTERS" ]; then
  echo "❌ TEST FAILED: vote counts do not match the number of voters!"
  exit 1
fi
echo "✓ Vote counts are exact."


echo -e "\n=========================================="
echo "PART 2: CONCURRENT PLAYLIST REORDER TEST"
echo "=========================================="

PL_ROOM_ID=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name": "Concurrent Reorder Test", "kind": "PLAYLIST", "accessPolicy": "OPEN"}' | jq -r .id)

add_track() {
  curl -s -X POST "$BASE_URL/rooms/$PL_ROOM_ID/tracks" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" -d "{\"deezerTrackId\": \"$1\"}" | jq -r .id
}
T1=$(add_track 3135556)
T2=$(add_track 4591456)
T3=$(add_track 1234567)

if [ "$PL_ROOM_ID" = "null" ] || [ "$T1" = "null" ] || [ "$T2" = "null" ] || [ "$T3" = "null" ]; then
  echo "Setup failed for the playlist room or its tracks"
  exit 1
fi

echo "→ Firing concurrent reorder requests moving different tracks into the same gap..."
for i in $(seq 1 5); do
  curl -s -X PATCH "$BASE_URL/rooms/$PL_ROOM_ID/tracks/$T2/position" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"afterTrackId\": \"$T1\"}" > /dev/null &
  curl -s -X PATCH "$BASE_URL/rooms/$PL_ROOM_ID/tracks/$T3/position" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"afterTrackId\": \"$T1\"}" > /dev/null &
done
wait

COLLISIONS=$($PSQL -t -c \
  "SELECT position, COUNT(*) FROM \"Track\" WHERE \"roomId\" = '$PL_ROOM_ID' AND position IS NOT NULL GROUP BY position HAVING COUNT(*) > 1;" | xargs)
echo "Collisions found: '${COLLISIONS:-None}'"

echo "→ Final queue state:"
curl -s "$BASE_URL/rooms/$PL_ROOM_ID/tracks" -H "Authorization: Bearer $TOKEN" | jq '[.[] | {title, position}]'

curl -s -X DELETE "$BASE_URL/rooms/$PL_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null

if [ -n "$COLLISIONS" ]; then
  echo "❌ TEST FAILED: Position collisions detected!"
  exit 1
fi

echo -e "\n✓ All concurrency safety suites passed successfully!"
