from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID
from pydantic import Field
from app.schemas.base import BaseSchema

class InterviewBase(BaseSchema):
    title: str = Field(
        ...,
        min_length=3,
        description="The title of the interview session."
    )
    transcript: str = Field(
        ...,
        min_length=15,
        description="The full raw text transcript of the interview."
    )
    participant_info: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional structured metadata about the participant (e.g. email, role, company)."
    )
    date: Optional[datetime] = Field(
        default=None,
        description="The date and time when the interview occurred."
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Any additional custom metadata related to the interview session."
    )

class InterviewCreate(InterviewBase):
    """
    Schema for creating a new interview. All base fields are required/optional as specified.
    """
    pass

class InterviewUpdate(BaseSchema):
    """
    Schema for updating an existing interview. All fields are optional.
    """
    title: Optional[str] = Field(None, description="The updated title.")
    transcript: Optional[str] = Field(None, description="The updated transcript text.")
    participant_info: Optional[Dict[str, Any]] = Field(None, description="Updated participant information.")
    date: Optional[datetime] = Field(None, description="Updated date of the interview.")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Updated custom metadata.")

class InterviewResponse(InterviewBase):
    """
    Schema returning the interview details from the database, including system fields.
    """
    id: UUID = Field(..., description="Unique database ID of the interview.")
    user_id: Optional[UUID] = Field(None, description="The ID of the user who owns this interview.")
    created_at: datetime = Field(..., description="Timestamp of when the interview record was created.")
    updated_at: datetime = Field(..., description="Timestamp of when the interview record was last updated.")
