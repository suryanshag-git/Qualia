from typing import List, Union
import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Qualia Backend"
    API_V1_STR: str = "/api/v1"
    
    # CORS Origins - supports comma-separated list or JSON array string
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            try:
                if isinstance(v, str):
                    return json.loads(v)
                return v
            except Exception:
                raise ValueError(f"Could not parse CORS origins list: {v}")
        return v

    # Supabase configurations (placeholders for future use)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # Google Gemini API configuration (placeholder for future use)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"



    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
