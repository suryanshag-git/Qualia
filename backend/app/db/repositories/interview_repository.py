from uuid import UUID
from typing import Optional, Dict
from app.models.interview import InterviewModel
from app.db.supabase import supabase_client
import logging

logger = logging.getLogger(__name__)

# Fallback global mock database to simulate state persistence when Supabase is not configured
_mock_interviews_db: Dict[UUID, InterviewModel] = {}

class InterviewRepository:
    def __init__(self) -> None:
        self.client = supabase_client

    async def create(self, interview: InterviewModel) -> InterviewModel:
        """
        Inserts an interview record into the Supabase database.
        Falls back to a static in-memory store if Supabase is unconfigured or fails.
        """
        if self.client is None:
            logger.info(f"[Mock DB] Saving interview record locally: {interview.id}")
            _mock_interviews_db[interview.id] = interview
            return interview

        try:
            # model_dump(mode="json") automatically converts UUIDs & datetimes to strings
            payload = interview.model_dump(mode="json")
            self.client.table("interviews").insert(payload).execute()
            logger.info(f"[Supabase DB] Saved interview: {interview.id}")
            return interview
        except Exception as e:
            logger.error(f"Supabase interview insert failed: {e}. Falling back to local in-memory DB.")
            _mock_interviews_db[interview.id] = interview
            return interview

    async def get(self, interview_id: UUID) -> Optional[InterviewModel]:
        """
        Retrieves an interview record by its unique ID.
        """
        if self.client is None:
            return _mock_interviews_db.get(interview_id)

        try:
            response = self.client.table("interviews").select("*").eq("id", str(interview_id)).execute()
            if not response.data:
                return _mock_interviews_db.get(interview_id)
            return InterviewModel(**response.data[0])
        except Exception as e:
            logger.error(f"Supabase interview select failed: {e}. Checking local in-memory DB.")
            return _mock_interviews_db.get(interview_id)
