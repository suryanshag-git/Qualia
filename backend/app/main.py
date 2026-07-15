from fastapi import FastAPI, HTTPException, Request, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
from collections import defaultdict
from typing import Optional
from uuid import UUID, uuid4

from app.core.config import settings
from app.schemas.interview import InterviewCreate, InterviewResponse
from app.schemas.insight import InsightResponse
from app.services.interview_service import InterviewProcessingService
from app.schemas.auth import UserSignup, UserLogin, AuthResponse
from app.db.repositories.user_repository import UserRepository
from app.db.repositories.interview_repository import InterviewRepository
from app.db.repositories.insight_repository import InsightRepository
from app.models.user import UserModel
from app.ai.embeddings import generate_embedding

class RateLimiter:
    def __init__(self, requests_limit: int, window_seconds: int):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        # key -> list of timestamps
        self.history = defaultdict(list)
        
    def check_rate_limit(self, key: str) -> None:
        now = time.time()
        # Filter history to only keep timestamps within the current window
        self.history[key] = [t for t in self.history[key] if now - t < self.window_seconds]
        if len(self.history[key]) >= self.requests_limit:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please slow down and try again later."
            )
        self.history[key].append(now)

# Instantiate rate limiters (per-user hourly quotas)
upload_rate_limiter = RateLimiter(requests_limit=10, window_seconds=3600)
search_rate_limiter = RateLimiter(requests_limit=60, window_seconds=3600)

async def get_current_user_id(authorization: Optional[str] = Header(None)) -> UUID:
    """
    Dependency helper to extract and validate the user ID from the Bearer token authorization header.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header. Form format: Bearer <token>"
        )
    token = authorization.replace("Bearer ", "").strip()
    try:
        user_id = UUID(token)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token format. Token must be a valid user ID."
        )
    
    # Verify user exists in database
    user_repo = UserRepository()
    user = await user_repo.get(user_id)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found or session expired. Please sign up or log in again."
        )
    return user_id

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="Evidence-backed AI tool for qualitative research (interview transcript analysis)."
)

# CORS middleware configuration
import os
allowed_origins = list(settings.BACKEND_CORS_ORIGINS)
allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    # Supports comma-separated list of origins
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

# Force-allow production Vercel origins to prevent configuration issues on Railway env variables
production_origins = [
    "https://run-autosight.vercel.app",
    "https://run-myapp.vercel.app"
]
for origin in production_origins:
    if origin not in allowed_origins:
        allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class InterviewProcessingResultSchema(BaseModel):
    interview: InterviewResponse
    insight: InsightResponse

@app.get("/health", tags=["Health Check"])
async def health_check():
    """
    Production health check endpoint verifying backend, database connection, and mock mode status.
    """
    from app.db.supabase import supabase_client
    
    db_status = "unconfigured"
    mock_mode = True
    
    if supabase_client is not None:
        try:
            # Quick select to verify database connectivity
            supabase_client.table("users").select("id").limit(1).execute()
            db_status = "connected"
            mock_mode = False
        except Exception as e:
            db_status = f"error: {str(e)}"
            mock_mode = True

    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "api_version": settings.API_V1_STR,
        "database": {
            "status": db_status,
            "provider": "Supabase"
        },
        "mock_mode": mock_mode,
        "gemini_api": {
            "configured": bool(settings.GEMINI_API_KEY),
            "model": settings.GEMINI_MODEL
        }
    }

# Auth endpoints
@app.post(
    f"{settings.API_V1_STR}/auth/signup",
    response_model=AuthResponse,
    tags=["Auth"]
)
async def auth_signup(payload: UserSignup):
    """
    Registers a new username and returns a secure user ID session token.
    """
    try:
        user_repo = UserRepository()
        existing = await user_repo.get_by_username(payload.username)
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Username already registered. Please login or select a different handle."
            )
        user_id = uuid4()
        user_model = UserModel(
            id=user_id,
            username=payload.username
        )
        created_user = await user_repo.create(user_model)
        return AuthResponse(
            user_id=created_user.id,
            token=str(created_user.id),
            username=created_user.username
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")

@app.post(
    f"{settings.API_V1_STR}/auth/login",
    response_model=AuthResponse,
    tags=["Auth"]
)
async def auth_login(payload: UserLogin):
    """
    Authenticates an existing username and returns the session token.
    """
    try:
        user_repo = UserRepository()
        user = await user_repo.get_by_username(payload.username)
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found. Please register an account first."
            )
        return AuthResponse(
            user_id=user.id,
            token=str(user.id),
            username=user.username
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


@app.get(
    f"{settings.API_V1_STR}/interviews",
    response_model=list[InterviewProcessingResultSchema],
    tags=["Interviews"]
)
async def get_user_interviews(authorization: Optional[str] = Header(None)):
    """
    Retrieves all interviews and qualitative insights owned by the authenticated user.
    """
    user_id = await get_current_user_id(authorization)
    try:
        interview_repo = InterviewRepository()
        insight_repo = InsightRepository()
        interviews = await interview_repo.list_by_user(user_id)
        
        results = []
        for interview in interviews:
            insight = await insight_repo.get_by_interview_id(interview.id)
            results.append({
                "interview": interview,
                "insight": insight
            })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve interviews: {str(e)}")


@app.post(
    f"{settings.API_V1_STR}/interviews",
    response_model=InterviewProcessingResultSchema,
    tags=["Interviews"],
    status_code=201
)
async def process_new_interview(payload: InterviewCreate, request: Request, authorization: Optional[str] = Header(None)):
    """
    Accepts an interview transcript, saves it to database, triggers
    AI qualitative insight extraction, and returns the results.
    """
    user_id = await get_current_user_id(authorization)
    try:
        # Enforce rate limiting per user ID
        upload_rate_limiter.check_rate_limit(str(user_id))
        
        service = InterviewProcessingService()
        interview, insight = await service.process_interview(payload, user_id)
        return {
            "interview": interview,
            "insight": insight
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process interview: {str(e)}")


@app.delete(
    f"{settings.API_V1_STR}/interviews/{{interview_id}}",
    tags=["Interviews"]
)
async def delete_interview(interview_id: UUID, authorization: Optional[str] = Header(None)):
    """
    Deletes the specified interview session owned by the user.
    """
    user_id = await get_current_user_id(authorization)
    try:
        interview_repo = InterviewRepository()
        success = await interview_repo.delete(interview_id, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Interview not found or unauthorized.")
        return {"status": "deleted", "id": interview_id}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete interview: {str(e)}")


class SearchRequest(BaseModel):
    query: str
    limit: int = 5
    threshold: float = 0.3

class SearchResultItem(BaseModel):
    interview: InterviewResponse
    similarity: float
    user_persona: str
    summary: str
    themes: list[str]
    key_quotes: list[dict]

@app.post(
    f"{settings.API_V1_STR}/search",
    response_model=list[SearchResultItem],
    tags=["Search"]
)
async def search_interviews(payload: SearchRequest, request: Request, authorization: Optional[str] = Header(None)):
    """
    Performs semantic vector search across interview transcripts.
    Generates embedding for query, runs similarity check, and returns highlights.
    """
    user_id = await get_current_user_id(authorization)
    try:
        # Enforce rate limiting per user ID
        search_rate_limiter.check_rate_limit(str(user_id))
        
        # Generate query embedding (incorporating 10-minute cache)
        query_embedding = await generate_embedding(payload.query, is_query=True)
        
        # Query repository
        interview_repo = InterviewRepository()
        matching_interviews = await interview_repo.search_similarity(
            query_embedding=query_embedding,
            user_id=user_id,
            limit=payload.limit,
            threshold=payload.threshold
        )
        
        insight_repo = InsightRepository()
        results = []
        
        for item in matching_interviews:
            item_id = UUID(item["id"])
            # Load associated insights
            insight = await insight_repo.get_by_interview_id(item_id)
            
            # Format interview response
            interview_res = InterviewResponse(
                id=item_id,
                user_id=user_id,
                title=item["title"],
                transcript=item["transcript"],
                participant_info=item["participant_info"],
                date=item["date"],
                metadata=item["metadata"],
                created_at=item["created_at"],
                updated_at=item["updated_at"]
            )

            # If insights found, populate fields
            user_persona = ""
            summary = ""
            themes = []
            key_quotes = []
            
            if insight and insight.data:
                user_persona = insight.data.user_persona
                summary = insight.data.summary
                themes = insight.data.themes
                key_quotes = [q.model_dump() for q in insight.data.key_quotes]
                
            results.append(SearchResultItem(
                interview=interview_res,
                similarity=item["similarity"],
                user_persona=user_persona,
                summary=summary,
                themes=themes,
                key_quotes=key_quotes
            ))
            
        return results
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

from app.ai.clustering import ThemeClusteringService, ClusteredTheme

@app.get(
    f"{settings.API_V1_STR}/themes",
    response_model=list[ClusteredTheme],
    tags=["Themes"]
)
async def get_clustered_themes(authorization: Optional[str] = Header(None)):
    """
    Exposes theme clusters computed across user's uploaded interview transcripts.
    Uses in-memory cache to guarantee sub-millisecond response latency.
    """
    user_id = await get_current_user_id(authorization)
    try:
        service = ThemeClusteringService()
        themes = await service.get_clustered_themes(user_id)
        return themes
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Theme clustering failed: {str(e)}")



