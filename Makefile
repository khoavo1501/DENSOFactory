.PHONY: help up down logs ps restart build rebuild hash bootstrap-admin stop-simulator start-simulator clean

help:
	@echo "M1 commands:"
	@echo "  make up            - start core stack (postgres, influxdb, emqx, backend)"
	@echo "  make down          - stop all"
	@echo "  make logs          - tail logs"
	@echo "  make ps            - list running services"
	@echo "  make build         - build images"
	@echo "  make rebuild       - rebuild images (no cache)"
	@echo "  make hash P=xxx    - generate bcrypt hash for password P"
	@echo "  make start-simulator - start simulator profile"
	@echo "  make stop-simulator  - stop simulator"
	@echo "  make clean         - remove volumes (DESTROYS DATA)"

up:
	docker compose up -d postgres influxdb emqx backend
	@echo "Waiting for backend health..."
	@for i in $$(seq 1 30); do \
		if docker compose exec -T backend curl -sf http://localhost:8000/healthz >/dev/null 2>&1; then \
			echo "Backend healthy"; break; \
		fi; \
		sleep 2; \
	done

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

restart:
	docker compose restart backend

build:
	docker compose build

rebuild:
	docker compose build --no-cache

hash:
	@if [ -z "$(P)" ]; then echo "usage: make hash P=mypassword"; exit 2; fi
	docker compose run --rm backend python -c "from passlib.context import CryptContext; c=CryptContext(schemes=['bcrypt'], deprecated='auto', bcrypt__rounds=12); print(c.hash('$(P)'))"

start-simulator:
	docker compose --profile with-simulator up -d simulator

stop-simulator:
	docker compose --profile with-simulator stop simulator

clean:
	docker compose down -v
