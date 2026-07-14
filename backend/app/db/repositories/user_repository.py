from uuid import UUID
from typing import Optional, Dict
from app.models.user import UserModel
from app.db.supabase import supabase_client
import logging

logger = logging.getLogger(__name__)

# Fallback global mock database to simulate state persistence when Supabase is not configured
_mock_users_db: Dict[UUID, UserModel] = {}

class UserRepository:
    def __init__(self) -> None:
        self.client = supabase_client

    async def create(self, user: UserModel) -> UserModel:
        """
        Inserts a user record into the database.
        Falls back to a static in-memory store if Supabase is unconfigured or fails.
        """
        if self.client is None:
            logger.info(f"[Mock DB] Saving user record locally: {user.id}")
            _mock_users_db[user.id] = user
            return user

        try:
            payload = user.model_dump(mode="json")
            self.client.table("users").insert(payload).execute()
            logger.info(f"[Supabase DB] Saved user: {user.id}")
            return user
        except Exception as e:
            logger.error(f"Supabase user insert failed: {e}. Falling back to local in-memory DB.")
            _mock_users_db[user.id] = user
            return user

    async def get(self, user_id: UUID) -> Optional[UserModel]:
        """
        Retrieves a user by its UUID.
        """
        if self.client is None:
            return _mock_users_db.get(user_id)

        try:
            response = self.client.table("users").select("*").eq("id", str(user_id)).execute()
            if not response.data:
                return _mock_users_db.get(user_id)
            return UserModel(**response.data[0])
        except Exception as e:
            logger.error(f"Supabase user select failed: {e}. Checking local mock DB.")
            return _mock_users_db.get(user_id)

    async def get_by_username(self, username: str) -> Optional[UserModel]:
        """
        Retrieves a user by their unique username.
        """
        stripped_u = username.strip().lower()
        if not stripped_u:
            return None

        if self.client is None:
            for user in _mock_users_db.values():
                if user.username.strip().lower() == stripped_u:
                    return user
            return None

        try:
            response = self.client.table("users").select("*").eq("username", stripped_u).execute()
            if not response.data:
                for user in _mock_users_db.values():
                    if user.username.strip().lower() == stripped_u:
                        return user
                return None
            return UserModel(**response.data[0])
        except Exception as e:
            logger.error(f"Supabase query by username failed: {e}. Checking local mock DB.")
            for user in _mock_users_db.values():
                if user.username.strip().lower() == stripped_u:
                    return user
            return None
