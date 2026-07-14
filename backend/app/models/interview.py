from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field

class InterviewModel(BaseModel):
    """
    Pydantic database model representing the 'interviews' table/document.
    Separates database schemas from API-facing request/response schemas.
    """
    id: UUID = Field(..., description="Unique database primary key for the interview.")
    title: str = Field(..., description="The title of the interview session.")
    transcript: str = Field(..., description="The full raw text transcript of the interview.")
    participant_info: Optional[Dict[str, Any]] = Field(default=None, description="Demographic/job info about participant.")
    date: Optional[datetime] = Field(default=None, description="The date the interview took place.")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Custom dictionary for any external platform metadata.")
    embedding: Optional[List[float]] = Field(default=None, description="768-dimensional document vector embedding for semantic search.")
    user_id: Optional[UUID] = Field(default=None, description="The ID of the user who owns this interview.")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of when the database record was created."
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of when the database record was last updated."
    )

