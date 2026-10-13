TUNNEL = music-tunnel

# Everything: backend, database, public link, then the app's QR code
all: check up prisma seed tunnel mobile

# Stops early with a clear message when something is missing
check:
	@docker info >/dev/null 2>&1 || (echo "Docker is not running. Start Docker, then run make again." && exit 1)
	@[ -f backend/.env ] || (echo "backend/.env is missing. Copy backend/.env.example to backend/.env and fill it in." && exit 1)
	@command -v node >/dev/null 2>&1 || (echo "Node.js is missing. Install Node 20.19 or newer, then run make again." && exit 1)
	@node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>20||(a===20&&b>=19)?0:1)" \
		|| (echo "Node $$(node -v) is too old. Install Node 20.19 or newer." && exit 1)

up:
	docker compose up --build -d

# Tunnel goes first: it holds the network open
down:
	@docker rm -f $(TUNNEL) >/dev/null 2>&1 || true
	docker compose down
	@rm -f mobile/.env.local

logs:
	docker compose logs -f

clean:
	rm -rf backend/dist
	rm -rf backend/node_modules
	@docker rm -f $(TUNNEL) >/dev/null 2>&1 || true
	docker compose down -v
	rm -rf mobile/node_modules mobile/.expo mobile/.env.local

fclean:
	@docker rm -f $(TUNNEL) >/dev/null 2>&1 || true
	docker compose down -v --remove-orphans
	rm -rf mobile/node_modules mobile/.expo mobile/.env.local

prisma:
	@sleep 3
	docker compose exec api-1 npx prisma db push

studio:
	docker compose exec api-1 npx prisma studio

seed:
	docker compose exec api-1 npx prisma db seed

# Public https link to the backend (Cloudflare, no account), given to the app
tunnel:
	@docker rm -f $(TUNNEL) >/dev/null 2>&1 || true
	@docker run -d --name $(TUNNEL) --network music-network cloudflare/cloudflared:latest \
		tunnel --no-autoupdate --url http://nginx:80 >/dev/null
	@printf "Opening a public link to the backend"
	@for i in $$(seq 1 60); do \
		URL=$$(docker logs $(TUNNEL) 2>&1 | grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1); \
		if [ -n "$$URL" ] && curl -sf "$$URL/health" >/dev/null 2>&1; then \
			echo "EXPO_PUBLIC_API_URL=$$URL" > mobile/.env.local; \
			printf "\n\n  Backend public link: $$URL\n\n"; \
			exit 0; \
		fi; \
		printf "."; sleep 2; \
	done; \
	rm -f mobile/.env.local; \
	printf "\n\n  The public link did not open. The app will use the address in mobile/.env\n\n"

# App dependencies, then Expo with its own tunnel and the QR code
mobile:
	@[ -d mobile/node_modules ] || (cd mobile && npm ci)
	@cd mobile && npx expo start --tunnel

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
	@echo "  make         - Start everything: backend, database, public link, app QR code"
	@echo "  make up      - Build and start containers in the background"
	@echo "  make down    - Stop everything"
	@echo "  make logs    - Follow container logs"
	@echo "  make status  - Show container status"
	@echo "  make clean   - Stop everything and remove volumes and dependencies"
	@echo "  make fclean  - Deep clean (stop, volumes, orphaned containers, app dependencies)"
	@echo "  make re      - Full reset and restart\n"

.PHONY: all check up down logs clean fclean prisma studio seed tunnel mobile status help re
