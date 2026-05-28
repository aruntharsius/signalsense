from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from auth import verify_credentials, create_access_token

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest):
    if not verify_credentials(body.username, body.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect username or password")
    token = create_access_token({"sub": body.username})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def me_endpoint(token: str):
    from auth import decode_token
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"username": payload.get("sub")}
