from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    MINIO_ENDPOINT: str
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str
    MINIO_BUCKET: str
    SECRET_KEY: str
    API_PORT: int = 8000

    class Config:
        env_file = "../../.env"

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        url = self.DATABASE_URL
        if url and url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        if url and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        # Remove query parameters that asyncpg doesn't accept in URL
        # (we'll pass them as connect_args instead)
        if "?" in url:
            base_url = url.split("?")[0]
            return base_url
        return url

settings = Settings()
