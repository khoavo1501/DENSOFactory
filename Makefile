.PHONY: help up down logs ps restart build rebuild hash bootstrap-admin stop-simulator start-simulator clean

help:
	@echo "v0.9.0 commands:"
	@echo "  make up              - start core stack (postgres, influxdb, emqx, redis, backend, webapp)"
	@echo "  make down            - stop all (keep volumes)"
	@echo "  make status          - show service health summary"
	@echo "  make logs [SERVICE]  - tail logs (all or 1 service)"
	@echo "  make ps              - list running services"
	@echo "  make build           - build Docker images"
	@echo "  make rebuild         - rebuild images (no cache)"
	@echo "  make restart [SVC]   - restart 1 service (default: backend)"
	@echo "  make hash P=xxx      - generate bcrypt hash for password"
	@echo "  make start-simulator - start simulator (3 devices, profile with-simulator)"
	@echo "  make stop-simulator  - stop simulator"
	@echo "  make smoke           - run quick smoke test (15 checks, ~30s)"
	@echo "  make clean           - remove volumes (DESTROYS DATA)"

up:
	docker compose up -d postgres influxdb emqx redis backend webapp
	@echo "Waiting for backend + webapp health..."
	@for i in $$(seq 1 30); do \
		if docker compose exec -T backend curl -sf http://localhost:8000/healthz >/dev/null 2>&1; then \
			if curl -sf http://localhost:5173/ >/dev/null 2>&1; then \
				echo "Backend + webapp healthy"; break; \
			fi; \
		fi; \
		sleep 2; \
	done
	@echo "Open http://localhost:5173/ (login: admin / admin123)"

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

status:
	@docker compose ps --format "table {{.Service}}\t{{.Status}}"

smoke:
	@bash scripts/quick_smoke.sh
