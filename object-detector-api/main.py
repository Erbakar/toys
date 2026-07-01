"""
ObjectTracker API
FastAPI + YOLO11n

POST /detect  — base64 görüntü al, nesneleri döndür
GET  /health  — servis durumu
GET  /docs    — Swagger UI (otomatik)
"""

import base64
import io
import logging
import time
import uuid
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel, Field
from ultralytics import YOLO

from config import settings

# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("api")

# ─── Model yükleme ───────────────────────────────────────────────────────────

_model: YOLO | None = None


def get_model() -> YOLO:
    if _model is None:
        raise HTTPException(status_code=503, detail="Model henüz hazır değil.")
    return _model


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model
    log.info("Model yükleniyor: %s", settings.model_path)
    _model = YOLO(settings.model_path)
    # Warmup — ilk inference yavaş olmasın
    dummy = Image.new("RGB", (64, 64), color=(128, 128, 128))
    _model(dummy, verbose=False)
    log.info("Model hazır. Sınıf sayısı: %d", len(_model.names))
    yield
    _model = None
    log.info("Model bellekten kaldırıldı.")


# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ObjectTracker API",
    description="YOLO11n tabanlı nesne algılama servisi",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request süresi loglama
@app.middleware("http")
async def log_requests(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - t0) * 1000
    log.info("%s %s → %d  (%.0fms)", request.method, request.url.path, response.status_code, ms)
    return response


# ─── Şemalar ─────────────────────────────────────────────────────────────────


class DetectRequest(BaseModel):
    image: str = Field(
        ...,
        description="data URL (data:image/jpeg;base64,...) veya saf base64 string",
        examples=["data:image/jpeg;base64,/9j/4AAQ..."],
    )


class BoundingBox(BaseModel):
    x: float = Field(..., ge=0.0, le=1.0, description="Sol kenar (normalize 0-1)")
    y: float = Field(..., ge=0.0, le=1.0, description="Üst kenar (normalize 0-1)")
    width: float = Field(..., ge=0.0, le=1.0, description="Genişlik (normalize 0-1)")
    height: float = Field(..., ge=0.0, le=1.0, description="Yükseklik (normalize 0-1)")


class DetectedObject(BaseModel):
    id: str = Field(..., description="UUID v4")
    label: str = Field(..., description="COCO sınıf etiketi")
    confidence: float = Field(..., ge=0.0, le=1.0)
    boundingBox: BoundingBox
    featureEmbedding: list[float] = Field(
        default_factory=list,
        description="Normalize renk histogramı (CLIP ile değiştirilebilir)",
    )


class DetectResponse(BaseModel):
    imageId: str = Field(..., description="Bu görüntüye özgü UUID")
    objects: list[DetectedObject]
    inferenceMs: float = Field(..., description="YOLO inference süresi (ms)")


class HealthResponse(BaseModel):
    status: str
    model: str
    classes: int
    conf_threshold: float


# ─── Yardımcılar ─────────────────────────────────────────────────────────────


def parse_image(data: str) -> Image.Image:
    """data URL veya ham base64 → RGB PIL Image."""
    try:
        payload = data.split(",", 1)[1] if data.startswith("data:") else data
        raw = base64.b64decode(payload)
        return Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Görüntü ayrıştırılamadı: {exc}",
        ) from exc


def extract_embedding(crop: np.ndarray) -> list[float]:
    """
    Nesne kırpmasından özellik vektörü çıkarır.

    Şu an: RGB kanallarında 8 bin renk histogramı → 24 boyutlu normalize vektör.
    İleride: CLIP / EfficientNet embedding ile değiştirilebilir —
    fonksiyon imzası değişmez, sadece bu gövde güncellenir.
    """
    if crop.size == 0:
        return []
    hist: list[float] = []
    for ch in range(3):
        h, _ = np.histogram(crop[:, :, ch], bins=8, range=(0, 256), density=True)
        hist.extend(h.tolist())
    arr = np.array(hist, dtype=np.float32)
    norm = float(np.linalg.norm(arr))
    return (arr / norm).tolist() if norm > 0 else arr.tolist()


# ─── Endpoint'ler ─────────────────────────────────────────────────────────────


@app.post(
    "/detect",
    response_model=DetectResponse,
    summary="Görüntüdeki nesneleri algıla",
)
async def detect(req: DetectRequest) -> DetectResponse:
    model = get_model()
    pil_img = parse_image(req.image)
    img_array = np.array(pil_img)
    h, w = img_array.shape[:2]

    t0 = time.perf_counter()
    results = model(
        pil_img,
        conf=settings.confidence_threshold,
        iou=settings.iou_threshold,
        max_det=settings.max_detections,
        verbose=False,
    )[0]
    inference_ms = (time.perf_counter() - t0) * 1000

    objects: list[DetectedObject] = []

    for box in results.boxes:
        x1, y1, x2, y2 = (float(v) for v in box.xyxy[0])
        conf = float(box.conf[0])
        label = model.names[int(box.cls[0])]

        crop = img_array[int(y1):int(y2), int(x1):int(x2)]

        objects.append(
            DetectedObject(
                id=str(uuid.uuid4()),
                label=label,
                confidence=round(conf, 4),
                boundingBox=BoundingBox(
                    x=round(x1 / w, 6),
                    y=round(y1 / h, 6),
                    width=round((x2 - x1) / w, 6),
                    height=round((y2 - y1) / h, 6),
                ),
                featureEmbedding=extract_embedding(crop),
            )
        )

    log.info(
        "Algılama tamamlandı — %d nesne, %.0fms  (görüntü: %dx%d)",
        len(objects), inference_ms, w, h,
    )

    return DetectResponse(
        imageId=str(uuid.uuid4()),
        objects=objects,
        inferenceMs=round(inference_ms, 1),
    )


@app.get("/health", response_model=HealthResponse, summary="Servis durumu")
async def health() -> HealthResponse:
    model = get_model()
    return HealthResponse(
        status="ok",
        model=settings.model_path,
        classes=len(model.names),
        conf_threshold=settings.confidence_threshold,
    )


# ─── Global hata yakalayıcı ───────────────────────────────────────────────────


@app.exception_handler(Exception)
async def global_exception_handler(_: Request, exc: Exception):
    log.exception("Beklenmedik hata: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Sunucu hatası. Lütfen tekrar deneyin."},
    )


# ─── Doğrudan çalıştırma ─────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
