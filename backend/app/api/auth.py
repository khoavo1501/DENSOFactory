"""POST /api/auth/login, /refresh, /logout, GET /api/auth/me."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, is_refresh_revoked
from app.core.config import get_settings
from app.core.cookies import (
    COOKIE_ACCESS,
    COOKIE_CSRF,
    COOKIE_REFRESH,
    cookie_common_kwargs,
    csrf_cookie_kwargs,
)
from app.core.csrf import new_csrf_token
from app.core.jwt import (
    JWTError_,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.security import verify_password
from app.db.session import get_db
from app.models import RevokedRefresh, User
from app.schemas.common import LoginRequest, UserOut
from app.services import audit


router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    s = get_settings()
    response.set_cookie(
        COOKIE_ACCESS,
        access,
        max_age=s.access_token_ttl_sec,
        **cookie_common_kwargs(),
    )
    response.set_cookie(
        COOKIE_REFRESH,
        refresh,
        max_age=s.refresh_token_ttl_sec,
        **cookie_common_kwargs(),
    )
    response.set_cookie(
        COOKIE_CSRF,
        new_csrf_token(),
        max_age=s.access_token_ttl_sec,
        **csrf_cookie_kwargs(),
    )


@router.post("/login", response_model=UserOut)
def login(
    body: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> UserOut:
    user = db.get(User, body.username)
    if not user or not verify_password(body.password, user.password_hash):
        audit.write(db, action="auth.login.fail", target=body.username)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials"
        )
    access, _, _ = create_access_token(user.username, user.role)
    refresh, _, _ = create_refresh_token(user.username)
    _set_auth_cookies(response, access, refresh)
    audit.write(db, action="auth.login.success", user_name=user.username)
    db.commit()
    return UserOut(username=user.username, role=user.role)


@router.post("/refresh", response_model=UserOut)
def refresh(
    response: Response,
    rt: str | None = Cookie(default=None, alias=COOKIE_REFRESH),
    db: Session = Depends(get_db),
) -> UserOut:
    if not rt:
        raise HTTPException(status_code=401, detail="missing refresh token")
    try:
        payload = decode_token(rt, expected_type="refresh")
    except JWTError_ as e:
        raise HTTPException(status_code=401, detail=str(e))
    if is_refresh_revoked(db, payload["jti"]):
        raise HTTPException(status_code=401, detail="refresh token revoked")

    user = db.get(User, payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="user not found")

    access, _, _ = create_access_token(user.username, user.role)
    new_refresh, _, _ = create_refresh_token(user.username)
    _set_auth_cookies(response, access, new_refresh)
    return UserOut(username=user.username, role=user.role)


@router.post("/logout", status_code=204, response_class=Response)
def logout(
    response: Response,
    user: CurrentUser = Depends(get_current_user),
    rt: str | None = Cookie(default=None, alias=COOKIE_REFRESH),
    db: Session = Depends(get_db),
) -> Response:
    if rt:
        try:
            payload = decode_token(rt, expected_type="refresh")
            db.add(
                RevokedRefresh(
                    jti=payload["jti"],
                    user_name=payload["sub"],
                    expires_at=datetime.fromtimestamp(
                        payload["exp"], tz=timezone.utc
                    ),
                )
            )
            audit.write(
                db,
                action="auth.logout",
                user_name=user.username,
                target=payload["jti"],
            )
            db.commit()
        except JWTError_:
            pass

    response.delete_cookie(COOKIE_ACCESS, path="/")
    response.delete_cookie(COOKIE_REFRESH, path="/")
    response.delete_cookie(COOKIE_CSRF, path="/")
    return Response(status_code=204)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser = Depends(get_current_user)) -> UserOut:
    return UserOut(username=user.username, role=user.role)
