# Git Workflow

## Branches

- `main` — luôn ổn định, production-ready.
- `feat/<milestone>-<short>` — feature branch cho mỗi milestone (vd. `feat/m2-frontend`, `feat/m6-real-integration`).
- `docs/<topic>` — branch chỉ chứa tài liệu (vd. `docs/decisions`, `docs/runbook-deploy`).
- `fix/<short>` — bugfix ngoài milestone scope.

## Commit message convention

Theo [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<body>

<footer>
```

**Type:** `feat` | `fix` | `docs` | `chore` | `refactor` | `test` | `perf` | `ci`

**Scope:** `backend` | `frontend` | `docs` | `infra` | `mqtt` | `ws` | `auth` | `api` | `simulator` | `runbook`

**Ví dụ:**

- `feat(backend): M1 - backend & data layer`
- `fix(api): telemetry history 500 when bucket empty`
- `docs(decisions): add DECISIONS.md - ADR registry`
- `chore(deps): bump fastapi to 0.116`
- `test(auth): add CSRF double-submit test cases`

## PR flow

1. Branch từ `main`: `git checkout -b feat/<name>`
2. Commit nhỏ, có ý nghĩa. Mỗi PR chỉ chứa 1 milestone hoặc 1 concern.
3. Trước khi push: `git fetch && git rebase origin/main`
4. Push: `git push -u origin feat/<name>`
5. Tạo PR với template (xem `.github/PULL_REQUEST_TEMPLATE.md` nếu có).
6. Squash-merge khi review xong, **KHÔNG xoá branch sau merge** (để có thể truy vết nếu cần).

## Do NOT commit

- File `.env` thực tế (chỉ commit `.env.example`).
- `node_modules/`, `__pycache__/`, `.venv/`, `*.pyc`.
- Secrets (password, token, MAC thật).
- File artifact tạm (`tmp/`, `*.log`).

Đã được list trong `.gitignore`.

## Useful commands

```bash
# Xem commit graph đẹp
git log --oneline --graph --all

# Undo commit cuối, giữ working tree
git reset --soft HEAD~1

# Xem thay đổi của 1 commit
git show <commit>

# Tìm commit theo message
git log --oneline --grep="M1"

# Squash n commit gần nhất
git rebase -i HEAD~3
```

## Release tags

Theo [SemVer](https://semver.org/) cho `webapp`:
- `v0.1.0` — M0 (docs skeleton)
- `v0.2.0` — M1 (backend)
- `v0.3.0` — M2 (frontend skeleton + realtime)
- ...

Tag ăn khớp với entry trong `docs/06_changelog/CHANGELOG_webapp.md`.

## Tài liệu liên quan

- [File Management Standard](../FILE_MANAGEMENT.md)
- [DECISIONS](../DECISIONS.md)
- [Plan Overview](../01_plan/plan_overview.md)
