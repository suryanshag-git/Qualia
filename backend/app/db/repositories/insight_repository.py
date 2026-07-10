from uuid import UUID
from typing import Optional, Dict
from app.models.insight import InsightModel
from app.db.supabase import supabase_client
import logging

logger = logging.getLogger(__name__)

# Fallback global mock database to simulate state persistence when Supabase is not configured
_mock_insights_db: Dict[UUID, InsightModel] = {}

class InsightRepository:
    def __init__(self) -> None:
        self.client = supabase_client

    async def create(self, insight: InsightModel) -> InsightModel:
        """
        Inserts an insight record into the Supabase database.
        Falls back to a static in-memory store if Supabase is unconfigured or fails.
        """
        if self.client is None:
            logger.info(f"[Mock DB] Saving insight record locally: {insight.id}")
            _mock_insights_db[insight.id] = insight
            return insight

        try:
            # model_dump(mode="json") automatically converts nested schemas, UUIDs & datetimes to JSON formats
            payload = insight.model_dump(mode="json")
            self.client.table("insights").insert(payload).execute()
            logger.info(f"[Supabase DB] Saved insight: {insight.id}")
            return insight
        except Exception as e:
            logger.error(f"Supabase insight insert failed: {e}. Falling back to local in-memory DB.")
            _mock_insights_db[insight.id] = insight
            return insight

    async def get_by_interview_id(self, interview_id: UUID) -> Optional[InsightModel]:
        """
        Retrieves an insight record associated with a specific interview ID.
        """
        if self.client is None:
            for insight in _mock_insights_db.values():
                if insight.interview_id == interview_id:
                    return insight
            return None

        try:
            response = self.client.table("insights").select("*").eq("interview_id", str(interview_id)).execute()
            if not response.data:
                for insight in _mock_insights_db.values():
                    if insight.interview_id == interview_id:
                        return insight
                return None
            return InsightModel(**response.data[0])
        except Exception as e:
            logger.error(f"Supabase insight select failed: {e}. Checking local in-memory DB.")
            for insight in _mock_insights_db.values():
                if insight.interview_id == interview_id:
                    return insight
            return None
