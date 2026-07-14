import logging
from uuid import UUID
from typing import Optional, List, Dict
from pydantic import BaseModel
from app.db.repositories.interview_repository import InterviewRepository
from app.db.repositories.insight_repository import InsightRepository

logger = logging.getLogger(__name__)

class ClusteredTheme(BaseModel):
    name: str
    frequency: int
    representative_quote: str
    supporting_interview_ids: List[UUID]

# Module-level in-memory cache for clustered themes: user_id -> List[ClusteredTheme]
_cached_themes: Dict[UUID, List[ClusteredTheme]] = {}

def clear_themes_cache(user_id: Optional[UUID] = None) -> None:
    """
    Clears the cached theme clusters. 
    Called when a new interview is successfully processed to trigger recalculation.
    """
    global _cached_themes
    if user_id:
        logger.info(f"Invalidating theme clustering cache for user: {user_id}")
        if user_id in _cached_themes:
            del _cached_themes[user_id]
    else:
        logger.info("Invalidating all theme clustering caches.")
        _cached_themes = {}

class ThemeClusteringService:
    def __init__(self) -> None:
        self.interview_repo = InterviewRepository()
        self.insight_repo = InsightRepository()

    async def get_clustered_themes(self, user_id: UUID) -> List[ClusteredTheme]:
        """
        Retrieves top themes clustered across user's interviews.
        Uses in-memory cache if available.
        Falls back to default mock theme cards if database is empty.
        """
        global _cached_themes
        if user_id in _cached_themes:
            logger.info(f"Returning cached theme clusters for user: {user_id}")
            return _cached_themes[user_id]

        logger.info(f"Recalculating theme clusters for user: {user_id}...")
        
        # 1. Fetch interviews belonging to this user
        interviews = []
        if self.interview_repo.client is not None:
            try:
                response = self.interview_repo.client.table("interviews").select("id, title, user_id").eq("user_id", str(user_id)).execute()
                interviews = response.data or []
            except Exception as e:
                logger.error(f"Supabase select user interviews failed: {e}")
        
        # Merge with mock db to ensure fallbacks are counted
        from app.db.repositories.interview_repository import _mock_interviews_db
        mock_interviews = [
            {"id": str(k), "title": v.title, "user_id": str(v.user_id)} for k, v in _mock_interviews_db.items()
            if v.user_id == user_id
        ]
        
        # De-duplicate interviews by ID
        seen_ids = set()
        all_interviews = []
        for i in (interviews + mock_interviews):
            if i["id"] not in seen_ids:
                seen_ids.add(i["id"])
                all_interviews.append(i)

        if not all_interviews:
            logger.info(f"No interviews found for user {user_id}. Returning default benchmark mock themes.")
            # Default mock themes for initial empty state display
            mock_defaults = [
                ClusteredTheme(
                    name="Synthesis Bottlenecks",
                    frequency=8,
                    representative_quote="Finding the exact moments where users struggled with a specific feature is like finding a needle in a haystack.",
                    supporting_interview_ids=[]
                ),
                ClusteredTheme(
                    name="Discovery Workflows",
                    frequency=6,
                    representative_quote="Zoom recordings are solid, but manual transcript tags coding is tedious.",
                    supporting_interview_ids=[]
                ),
                ClusteredTheme(
                    name="Jira Integration",
                    frequency=5,
                    representative_quote="I spend hours pushing bug tickets to engineering trackers manually.",
                    supporting_interview_ids=[]
                ),
                ClusteredTheme(
                    name="Thematic Tagging",
                    frequency=4,
                    representative_quote="I wish tag recommendations were conceptually automated.",
                    supporting_interview_ids=[]
                )
            ]
            return mock_defaults

        # 2. Map themes conceptually
        theme_groups: Dict[str, List[UUID]] = {}
        theme_quotes: Dict[str, List[str]] = {}

        for item in all_interviews:
            interview_uuid = UUID(item["id"])
            insight = await self.insight_repo.get_by_interview_id(interview_uuid)
            
            if insight and insight.data:
                # Group by normalized theme titles (case-insensitive, normalized spaces)
                for raw_theme in insight.data.themes:
                    normalized = raw_theme.strip().title()
                    
                    if normalized not in theme_groups:
                        theme_groups[normalized] = []
                    if interview_uuid not in theme_groups[normalized]:
                        theme_groups[normalized].append(interview_uuid)

                    # Gather quotes from this interview to select a representative one
                    if insight.data.key_quotes:
                        for q in insight.data.key_quotes:
                            if normalized not in theme_quotes:
                                theme_quotes[normalized] = []
                            theme_quotes[normalized].append(q.quote)

        # 3. Assemble clusters
        clustered_themes = []
        for theme_name, interview_ids in theme_groups.items():
            # Get representative quote (default to first quote, or fall back to description)
            quotes = theme_quotes.get(theme_name, [])
            rep_quote = quotes[0] if quotes else "Identified qualitative theme during transcript coding."
            
            clustered_themes.append(
                ClusteredTheme(
                    name=theme_name,
                    frequency=len(interview_ids),
                    representative_quote=rep_quote,
                    supporting_interview_ids=interview_ids
                )
            )

        # Sort themes by frequency descending
        clustered_themes.sort(key=lambda x: x.frequency, reverse=True)
        _cached_themes[user_id] = clustered_themes
        return clustered_themes
