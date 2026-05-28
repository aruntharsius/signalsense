"""
auth.py — JWT token utilities and credential verification.
"""

import os
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.environ.get("SS_SECRET_KEY", "signalsense-dev-secret-change-in-prod")
ALGORITHM  = "HS256"
TOKEN_TTL_MINUTES = 60 * 24  # 24 hours


def _hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def verify_credentials(username: str, password: str) -> bool:
    env_user = os.environ.get("SS_USERNAME", "admin")
    env_hash = os.environ.get("SS_PASSWORD_HASH", "")
    if env_hash:
        return (
            hmac.compare_digest(username, env_user)
            and hmac.compare_digest(_hash_pw(password), env_hash)
        )
    env_pass = os.environ.get("SS_PASSWORD", "changeme")
    return hmac.compare_digest(username, env_user) and hmac.compare_digest(password, env_pass)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=TOKEN_TTL_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
