from uuid import UUID
from pydantic import BaseModel, Field, field_validator
import re

class UserSignup(BaseModel):
    username: str = Field(..., description="Unique alphanumeric username.")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v_stripped = v.strip()
        if len(v_stripped) < 3:
            raise ValueError("Username must be at least 3 characters long.")
        if len(v_stripped) > 30:
            raise ValueError("Username cannot exceed 30 characters.")
        if not re.match(r"^[a-zA-Z0-9_\-]+$", v_stripped):
            raise ValueError("Username can only contain alphanumeric characters, underscores, and dashes.")
        return v_stripped

class UserLogin(BaseModel):
    username: str = Field(..., description="The user's unique username.")

class AuthResponse(BaseModel):
    user_id: UUID = Field(..., description="Unique database ID of the user.")
    token: str = Field(..., description="Session authentication token (UUID-based).")
    username: str = Field(..., description="The user's username.")
