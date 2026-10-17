up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

clean:
	rm -rf backend/dist
	rm -rf backend/node_modules
	docker compose down -v

fclean:
	docker compose down -v --remove-orphans

prisma:
	@sleep 3
	docker compose exec api-1 npx prisma db push

studio:
	docker compose exec api-1 npx prisma studio

k6:
	docker compose run --rm k6 run /scripts/load-test.js

seed:
	docker compose exec api-1 npx prisma db seed

test:
	npm --prefix backend test

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
	@echo "  make up      - Build and start containers in the background"
	@echo "  make down    - Stop containers"
	@echo "  make logs    - Follow container logs"
	@echo "  make status  - Show detailed container, network, and volume status"
	@echo "  make test    - Run backend logical/unit tests"
	@echo "  make prisma  - Push Prisma schema changes to the database"
	@echo "  make studio  - Open Prisma Studio database GUI"
	@echo "  make seed    - Seed the database with initial users"
	@echo "  make k6      - Run the k6 load-testing suite"
	@echo "  make clean   - Stop containers and remove build artifacts & volumes"
	@echo "  make fclean  - Deep clean (stop, remove volumes, and orphaned containers)"
	@echo "  make re      - Full reset and restart (fclean -> up -> prisma)\n"

.PHONY: up down logs clean fclean status help re test prisma studio k6 seed

