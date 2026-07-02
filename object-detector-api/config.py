from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Model
    model_path: str = "yolo11n.pt"
    confidence_threshold: float = 0.25
    iou_threshold: float = 0.45
    max_detections: int = 100

    # Optional OpenAI vision comparison
    openai_api_key: str | None = None
    openai_vision_model: str = "gpt-4.1-mini"
    enable_openai_vision: bool = True

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # CORS — birden fazla origin için virgülle ayır
    # Örn: CORS_ORIGINS=http://localhost:5173,https://myapp.com
    cors_origins: str = "*"

    @property
    def cors_origins_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
