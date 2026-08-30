"""Generate a bcrypt hash for ADMIN_BOOTSTRAP_PASSWORD_HASH.

Usage:
    docker compose run --rm backend python /app/../scripts/generate-bcrypt-hash.py mypassword
or, from a Python venv on host:
    python scripts/generate-bcrypt-hash.py mypassword
"""
import sys

from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: generate-bcrypt-hash.py <password>", file=sys.stderr)
        sys.exit(2)
    plain = sys.argv[1]
    print(_pwd_context.hash(plain))


if __name__ == "__main__":
    main()
