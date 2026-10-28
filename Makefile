# Project Music Room

TUNNEL = music-tunnel
SEED   = backend/prisma/seed.ts

# Seeded test accounts, read from the seed script (no password copied here)
SEED_PASSWORD = $(shell sed -n "s/.*SEED_PASSWORD = '\(.*\)'.*/\1/p" $(SEED) 2>/dev/null)
SEED_USERS    = $(shell grep -o "i < [0-9]*" $(SEED) 2>/dev/null | head -1 | grep -o "[0-9]*")

# Node for the app (Expo SDK 58 needs 22.13+). When the machine's Node is older,
# `make node` downloads this one into .node/ (git-ignored, no sudo needed)
NODE_VERSION = v22.23.3
NODE_DIR     = $(CURDIR)/.node
WITH_NODE    = PATH="$(NODE_DIR)/bin:$$PATH"

# Colors
GREEN  = \033[1;32m
RED    = \033[1;31m
YELLOW = \033[1;33m
BLUE   = \033[1;34m
RESET  = \033[0m

# Everything: backend, database, public link, then the app's QR code
all: check node up prisma seed tunnel google mobile

# Stops early with a clear message when something is missing
check:
	@docker info >/dev/null 2>&1 || (printf "$(RED)❌ Docker is not running. Start Docker, then run make again.$(RESET)\n" && exit 1)
	@[ -f backend/.env ] || (printf "$(RED)❌ backend/.env is missing. Copy backend/.env.example to backend/.env and fill it in.$(RESET)\n" && exit 1)
	@printf "$(GREEN)✅ Docker and backend/.env ready$(RESET)\n"

# Uses the machine's Node when it is 22.13+, otherwise downloads Node $(NODE_VERSION)
node:
	@if $(WITH_NODE) node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)" 2>/dev/null; then \
		printf "$(GREEN)✅ Node $$($(WITH_NODE) node -v) ready$(RESET)\n"; \
	else \
		case "$$(uname -s)" in Darwin) OS=darwin ;; *) OS=linux ;; esac; \
		case "$$(uname -m)" in arm64|aarch64) ARCH=arm64 ;; *) ARCH=x64 ;; esac; \
		printf "$(BLUE)📦 Node 22.13+ not found, downloading Node $(NODE_VERSION)...$(RESET)\n"; \
		rm -rf "$(NODE_DIR)" && mkdir -p "$(NODE_DIR)" && \
		curl -fsSL "https://nodejs.org/dist/$(NODE_VERSION)/node-$(NODE_VERSION)-$$OS-$$ARCH.tar.gz" \
			| tar -xz -C "$(NODE_DIR)" --strip-components=1 \
		|| (rm -rf "$(NODE_DIR)"; printf "$(RED)❌ Could not download Node. Install Node 22.13 or newer, then run make again.$(RESET)\n"; exit 1); \
		printf "$(GREEN)✅ Node $$($(WITH_NODE) node -v) ready$(RESET)\n"; \
	fi

up:
	@printf "$(BLUE)🎵 Launching backend containers...$(RESET)\n"
	@docker compose up --build -d
	@printf "$(GREEN)✅ Containers running$(RESET)\n"

# Tunnel goes first: it holds the network open
down:
	@printf "$(YELLOW)🛑 Stopping everything (keeping the database)...$(RESET)\n"
	@docker rm -f $(TUNNEL) >/dev/null 2>&1 || true
	@docker compose down
	@rm -f mobile/.env.local
	@printf "$(GREEN)✅ Stopped$(RESET)\n"

logs:
	docker compose logs -f

clean:
	@printf "$(YELLOW)🧹 Stopping everything and dropping the database...$(RESET)\n"
	@rm -rf backend/dist backend/node_modules
	@docker rm -f $(TUNNEL) >/dev/null 2>&1 || true
	@docker compose down -v
	@rm -rf mobile/node_modules mobile/.expo mobile/.env.local
	@printf "$(GREEN)✅ Containers, database and dependencies removed$(RESET)\n"

fclean:
	@printf "$(RED)💥 Deep clean...$(RESET)\n"
	@docker rm -f $(TUNNEL) >/dev/null 2>&1 || true
	@docker compose down -v --remove-orphans
	@rm -rf mobile/node_modules mobile/.expo mobile/.env.local .node
	@printf "$(GREEN)✅ Clean state restored$(RESET)\n"

prisma:
	docker compose exec api-1 npx prisma db push

studio:
	docker compose exec api-1 npx prisma studio

k6:
	docker compose run --rm k6 run /scripts/load-test.js

throttle:
	docker compose run --rm k6 run /scripts/throttle-test.js

seed:
	@printf "$(BLUE)🌱 Seeding test accounts...$(RESET)\n"
	@docker compose exec api-1 npx prisma db seed
	@printf "$(GREEN)✅ Database seeded$(RESET)\n"

# Public https link to the backend (Cloudflare, no account), given to the app
tunnel:
	@docker rm -f $(TUNNEL) >/dev/null 2>&1 || true
	@docker run -d --name $(TUNNEL) --network music-network cloudflare/cloudflared:latest \
		tunnel --no-autoupdate --url http://nginx:80 >/dev/null
	@printf "$(BLUE)🌍 Opening a public link to the backend$(RESET)"
	@for i in $$(seq 1 60); do \
		URL=$$(docker logs $(TUNNEL) 2>&1 | grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1); \
		if [ -n "$$URL" ] && curl -sf "$$URL/health" >/dev/null 2>&1; then \
			echo "EXPO_PUBLIC_API_URL=$$URL" > mobile/.env.local; \
			printf "\n$(GREEN)✅ Public link open$(RESET)\n"; \
			exit 0; \
		fi; \
		printf "."; sleep 2; \
	done; \
	rm -f mobile/.env.local; \
	printf "\n$(YELLOW)⚠️  The public link did not open. The app will use the address in mobile/.env$(RESET)\n"

# Google sign-in settings for the app, copied from backend/.env (git-ignored, no keys in the repo)
google:
	@ID=$$(sed -n 's/^GOOGLE_CLIENT_ID=//p' backend/.env); \
	REDIRECT=$$(sed -n 's/^GOOGLE_MOBILE_REDIRECT_URL=//p' backend/.env); \
	if [ -n "$$ID" ] && [ -n "$$REDIRECT" ]; then \
		printf "EXPO_PUBLIC_GOOGLE_CLIENT_ID=%s\nEXPO_PUBLIC_GOOGLE_REDIRECT_URL=%s\n" "$$ID" "$$REDIRECT" >> mobile/.env.local; \
	else \
		printf "$(YELLOW)⚠️  Google sign-in is off: set GOOGLE_CLIENT_ID and GOOGLE_MOBILE_REDIRECT_URL in backend/.env$(RESET)\n"; \
	fi

# Links and logins, printed just before Expo's QR code
banner:
	@URL=$$(sed -n 's/^EXPO_PUBLIC_API_URL=//p' mobile/.env.local 2>/dev/null); \
	printf "\n$(GREEN)  🎵 Music Room is up$(RESET)\n\n"; \
	if [ -n "$$URL" ]; then \
		printf "     Backend          $(BLUE)%s$(RESET)  (the app uses it by default)\n" "$$URL"; \
		printf "     API docs         $(BLUE)%s/docs$(RESET)\n" "$$URL"; \
	else \
		printf "     $(YELLOW)⚠️  No public link: phones must be on this Mac's Wi-Fi (address in mobile/.env)$(RESET)\n"; \
	fi; \
	printf "     Backend on Mac   $(BLUE)http://localhost:8080$(RESET)\n"; \
	printf "     MailHog (emails) $(BLUE)http://localhost:8025$(RESET)\n\n"; \
	printf "     Seeded logins    $(BLUE)user1@test.com$(RESET) .. $(BLUE)user$(SEED_USERS)@test.com$(RESET)\n"; \
	printf "     Password         $(BLUE)$(SEED_PASSWORD)$(RESET)  (same for every seeded account)\n\n"; \
	printf "     Scan the QR code below with Expo Go\n"; \
	printf "     make down        Stop everything\n"; \
	printf "     make help        Every command\n\n"

# App dependencies (errors only), clean screen, banner, then Expo and its QR code
# Reinstalls when package-lock.json is newer than the installed packages (e.g. after a pull)
# ngrok tunnel: Expo's default tunnel needs an Expo account login
mobile: node
	@[ mobile/node_modules/.package-lock.json -nt mobile/package-lock.json ] || (printf "$(BLUE)📦 Installing app dependencies...$(RESET)\n" \
		&& cd mobile && $(WITH_NODE) npm ci --loglevel=error --no-audit --no-fund)
	@clear 2>/dev/null || true
	@$(MAKE) --no-print-directory banner
	@cd mobile && $(WITH_NODE) npx expo start --tunnel ngrok

test:
	npm --prefix backend test --verbose

status:
	@echo ""
	@docker compose ps --format "table {{.Service}}\t{{.Name}}\t{{.State}}\t{{.Ports}}"
	@echo ""
	@docker network ls --filter name=music --format "table {{.Name}}\t{{.Driver}}\t{{.Scope}}"
	@echo ""
	@docker volume ls --filter name=music --format "table {{.Name}}\t{{.Driver}}"
	@echo ""

re: fclean up prisma

help:
	@echo "\nAvailable commands:"
	@echo "  make up       - Build and start containers in the background"
	@echo "  make down     - Stop containers"
	@echo "  make logs     - Follow container logs"
	@echo "  make status   - Show detailed container, network, and volume status"
	@echo "  make prisma   - Push Prisma schema changes to the database"
	@echo "  make studio   - Open Prisma Studio database GUI"
	@echo "  make seed     - Seed the database with initial users"
	@echo "  make test     - Run backend logical/unit tests"
	@echo "  make k6       - Run the k6 load-testing suite"
	@echo "  make throttle - Run the throttle testing suite"
	@echo "  make clean    - Stop containers and remove build artifacts & volumes"
	@echo "  make fclean   - Deep clean (stop, remove volumes, and orphaned containers)"
	@echo "  make re       - Full reset and restart (fclean -> up -> prisma)\n"

.PHONY: all check node up down logs clean fclean prisma studio seed tunnel google banner mobile status help re test k6
