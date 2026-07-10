from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.core.config import settings
from app.schemas.interview import InterviewCreate, InterviewResponse
from app.schemas.insight import InsightResponse
from app.services.interview_service import InterviewProcessingService

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="Evidence-backed AI tool for qualitative research (interview transcript analysis)."
)

# CORS middleware configuration
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

class InterviewProcessingResultSchema(BaseModel):
    interview: InterviewResponse
    insight: InsightResponse

@app.get("/health", tags=["Health Check"])
def health_check():
    """
    Simple health check endpoint to verify backend service status.
    """
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "api_version": settings.API_V1_STR
    }

@app.post(
    f"{settings.API_V1_STR}/interviews",
    response_model=InterviewProcessingResultSchema,
    tags=["Interviews"],
    status_code=201
)
async def process_new_interview(payload: InterviewCreate):
    """
    Accepts an interview transcript, saves it to Supabase database, triggers
    AI qualitative insight extraction (with fallback), and returns the results.
    """
    try:
        service = InterviewProcessingService()
        interview, insight = await service.process_interview(payload)
        return {
            "interview": interview,
            "insight": insight
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process interview: {str(e)}")

