from datetime import datetime, timezone
from uuid import UUID
from pydantic import BaseModel, Field

class UserModel(BaseModel):
    """
    Pydantic database model representing the 'users' table.
    """
    id: UUID = Field(..., description="Unique database primary key for the user.")
    username: str = Field(..., description="Unique login identifier for the user.")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of when the user registered."
    )
