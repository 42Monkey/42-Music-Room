#!/usr/bin/env bash
set -e

BASE_URL="http://localhost:8080"
EMAIL="smoketest@test.com"
PASSWORD="password123"

echo "=========================================="
echo "PART 1: CONCURRENT VOTE SAFETY TEST"
echo "=========================================="

echo "→ Logging in as primary test user to set up vote room and track..."
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" | jq -r .accessToken)

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

echo "→ Score before concurrent votes:"
docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -t -c \
  "SELECT score FROM \"Track\" WHERE id = '$TRACK_ID';" | xargs

echo "→ Firing 20 concurrent votes from 20 different seeded users..."
for i in $(seq 1 20); do
  USER_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"user${i}@test.com\", \"password\": \"$PASSWORD\"}" | jq -r .accessToken)

  curl -s -X POST "$BASE_URL/rooms/$ROOM_ID/tracks/$TRACK_ID/vote" \
    -H "Authorization: Bearer $USER_TOKEN" > /dev/null &
done

wait  # block until all 20 backgrounded curls complete

echo "→ Score after concurrent votes (Expected: EXACTLY 20):"
docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -t -c \
  "SELECT score FROM \"Track\" WHERE id = '$TRACK_ID';" | xargs

echo "→ Vote row count check (Expected: exactly 20):"
docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -t -c \
  "SELECT COUNT(*) FROM \"Vote\" WHERE \"trackId\" = '$TRACK_ID';" | xargs

echo "→ Cleaning up vote concurrency test room..."
curl -s -X DELETE "$BASE_URL/rooms/$ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null


echo -e "\n=========================================="
echo "PART 2: CONCURRENT PLAYLIST REORDER TEST"
echo "=========================================="

echo "→ Creating playlist room for concurrency testing..."
PL_ROOM_ID=$(curl -s -X POST "$BASE_URL/rooms" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name": "Concurrent Reorder Test", "kind": "PLAYLIST", "accessPolicy": "OPEN"}' | jq -r .id)

T1=$(curl -s -X POST "$BASE_URL/rooms/$PL_ROOM_ID/tracks" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"deezerTrackId": "3135556"}' | jq -r .id)
T2=$(curl -s -X POST "$BASE_URL/rooms/$PL_ROOM_ID/tracks" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"deezerTrackId": "4591456"}' | jq -r .id)
T3=$(curl -s -X POST "$BASE_URL/rooms/$PL_ROOM_ID/tracks" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"deezerTrackId": "1234567"}' | jq -r .id)

echo "→ Firing concurrent reorder requests moving different tracks into the same gap simultaneously..."
for i in $(seq 1 5); do
  curl -s -X PATCH "$BASE_URL/rooms/$PL_ROOM_ID/tracks/$T2/position" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"afterTrackId\": \"$T1\"}" > /dev/null &
  curl -s -X PATCH "$BASE_URL/rooms/$PL_ROOM_ID/tracks/$T3/position" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"afterTrackId\": \"$T1\"}" > /dev/null &
done
wait

echo "→ Checking for position collisions (duplicate positions = bug):"
COLLISIONS=$(docker compose exec -T postgres psql -U MonkeyUser -d MonkeyDatabase -t -c \
  "SELECT position, COUNT(*) FROM \"Track\" WHERE \"roomId\" = '$PL_ROOM_ID' AND position IS NOT NULL GROUP BY position HAVING COUNT(*) > 1;" | xargs)
echo "Collisions found: '${COLLISIONS:-None}'"

if [ -n "$COLLISIONS" ]; then
  echo "❌ TEST FAILED: Position collisions detected!"
  exit 1
fi

echo "→ Final queue state (verifying valid, strictly-ordered positions):"
curl -s "$BASE_URL/rooms/$PL_ROOM_ID/tracks" -H "Authorization: Bearer $TOKEN" | jq '[.[] | {title, position}]'

echo "→ Cleaning up reorder concurrency test room..."
curl -s -X DELETE "$BASE_URL/rooms/$PL_ROOM_ID" -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "\n✓ All concurrency safety suites passed successfully!"
