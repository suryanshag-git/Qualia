from typing import Optional
from supabase import create_client, Client
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

supabase_client: Optional[Client] = None

def init_supabase() -> Optional[Client]:
    """
    Initializes the Supabase client using environment configurations.
    Falls back to mock database operations if credentials are missing or placeholders.
    """
    global supabase_client
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_KEY

    is_placeholder = (
        not url
        or not key
        or "your-supabase" in url
        or "your-supabase" in key
        or url == ""
        or key == ""
    )

    if is_placeholder:
        logger.warning(
            "Supabase URL or Key is missing or a placeholder. "
            "Database integration will run in mock in-memory mode."
        )
        supabase_client = None
    else:
        try:
            supabase_client = create_client(url, key)
            logger.info("Supabase client successfully initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}. Falling back to mock mode.")
            supabase_client = None

    return supabase_client

# Trigger initialization on module load
init_supabase()
