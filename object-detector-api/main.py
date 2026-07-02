"""
ObjectTracker API
FastAPI + YOLO11n

POST /detect  — base64 görüntü al, nesneleri döndür
GET  /health  — servis durumu
GET  /docs    — Swagger UI (otomatik)
"""

import base64
import io
import json
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
    dominantColor: str | None = Field(default=None, description="Baskın renk adı")
    featureEmbedding: list[float] = Field(
        default_factory=list,
        description="Normalize renk histogramı (CLIP ile değiştirilebilir)",
    )


class DetectResponse(BaseModel):
    imageId: str = Field(..., description="Bu görüntüye özgü UUID")
    objects: list[DetectedObject]
    inferenceMs: float = Field(..., description="YOLO inference süresi (ms)")


class CompareRequest(BaseModel):
    referenceImage: str = Field(..., description="Referans görüntü data URL/base64")
    currentImage: str = Field(..., description="Kontrol görüntüsü data URL/base64")


class ObjectMatch(BaseModel):
    referenceId: str
    currentId: str
    score: float = Field(..., ge=0.0, le=1.0)
    visualSimilarity: float = Field(..., ge=0.0, le=1.0)
    sizeSimilarity: float = Field(..., ge=0.0, le=1.0)


class ModifiedObject(BaseModel):
    reference: DetectedObject
    current: DetectedObject
    reason: str
    score: float = Field(..., ge=0.0, le=1.0)
    visualSimilarity: float = Field(..., ge=0.0, le=1.0)
    sizeSimilarity: float = Field(..., ge=0.0, le=1.0)


class AiFinding(BaseModel):
    type: str = Field(..., description="missing_part | missing_object | added_object | changed_object | uncertain")
    title: str
    detail: str
    confidence: float = Field(..., ge=0.0, le=1.0)


class CompareResponse(BaseModel):
    reference: DetectResponse
    current: DetectResponse
    added: list[DetectedObject]
    removed: list[DetectedObject]
    unchanged: list[DetectedObject]
    modified: list[ModifiedObject]
    matches: list[ObjectMatch]
    aiFindings: list[AiFinding] = Field(default_factory=list)


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


def ensure_data_url(data: str, mime: str = "image/jpeg") -> str:
    if data.startswith("data:"):
        return data
    return f"data:{mime};base64,{data}"


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


def dominant_color_name(crop: np.ndarray) -> str | None:
    if crop.size == 0:
        return None

    pixels = crop.reshape(-1, 3).astype(np.float32)
    brightness = pixels.mean(axis=1)
    saturated = pixels[(brightness > 35) & (brightness < 235)]
    sample = saturated if len(saturated) > 0 else pixels
    rgb = sample.mean(axis=0)

    palette = {
        "black": np.array([20, 20, 20], dtype=np.float32),
        "white": np.array([235, 235, 235], dtype=np.float32),
        "gray": np.array([128, 128, 128], dtype=np.float32),
        "red": np.array([210, 45, 45], dtype=np.float32),
        "orange": np.array([230, 130, 35], dtype=np.float32),
        "yellow": np.array([225, 205, 45], dtype=np.float32),
        "green": np.array([60, 165, 75], dtype=np.float32),
        "blue": np.array([55, 105, 215], dtype=np.float32),
        "purple": np.array([135, 75, 180], dtype=np.float32),
        "pink": np.array([225, 105, 170], dtype=np.float32),
        "brown": np.array([125, 80, 45], dtype=np.float32),
    }

    return min(palette, key=lambda name: float(np.linalg.norm(rgb - palette[name])))


def parse_ai_findings(raw: str) -> list[AiFinding]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("OpenAI vision JSON ayrıştırılamadı: %s", raw[:300])
        return []

    findings = data.get("findings", []) if isinstance(data, dict) else []
    parsed: list[AiFinding] = []
    for item in findings:
        if not isinstance(item, dict):
            continue
        try:
            parsed.append(
                AiFinding(
                    type=str(item.get("type", "uncertain")),
                    title=str(item.get("title", "Görsel fark")),
                    detail=str(item.get("detail", "")),
                    confidence=float(item.get("confidence", 0.5)),
                )
            )
        except Exception:
            continue
    return parsed[:8]


def analyze_with_openai_vision(reference_image: str, current_image: str) -> list[AiFinding]:
    if not settings.enable_openai_vision or not settings.openai_api_key:
        return []

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        response = client.responses.create(
            model=settings.openai_vision_model,
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "Compare these two toy/table scene images. "
                                "The first image is the reference; the second is the current state. "
                                "Find concrete visual differences such as a missing toy, a specific colored object missing, "
                                "a toy part missing, a doll/figure limb missing, or a new object. "
                                "Return ONLY valid JSON with this exact shape: "
                                "{\"findings\":[{\"type\":\"missing_part|missing_object|added_object|changed_object|uncertain\","
                                "\"title\":\"short Turkish title\","
                                "\"detail\":\"specific Turkish explanation\","
                                "\"confidence\":0.0}]}. "
                                "Be conservative: if unsure, use type uncertain and lower confidence. "
                                "Prefer specific color/object descriptions like 'kırmızı oyuncak araba eksik'."
                            ),
                        },
                        {"type": "input_image", "image_url": ensure_data_url(reference_image)},
                        {"type": "input_image", "image_url": ensure_data_url(current_image)},
                    ],
                }
            ],
        )
        return parse_ai_findings(response.output_text)
    except Exception as exc:
        log.warning("OpenAI vision analizi atlandı: %s", exc)
        return []


def bbox_iou(a: BoundingBox, b: BoundingBox) -> float:
    ax2 = a.x + a.width
    ay2 = a.y + a.height
    bx2 = b.x + b.width
    by2 = b.y + b.height

    ix1 = max(a.x, b.x)
    iy1 = max(a.y, b.y)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    intersection = iw * ih

    area_a = a.width * a.height
    area_b = b.width * b.height
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def center_distance(a: BoundingBox, b: BoundingBox) -> float:
    acx = a.x + a.width / 2
    acy = a.y + a.height / 2
    bcx = b.x + b.width / 2
    bcy = b.y + b.height / 2
    return float(np.hypot(acx - bcx, acy - bcy))


def size_similarity(a: BoundingBox, b: BoundingBox) -> float:
    area_a = a.width * a.height
    area_b = b.width * b.height
    largest = max(area_a, area_b)
    if largest <= 0:
        return 0.0
    return max(0.0, 1.0 - abs(area_a - area_b) / largest)


def embedding_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.5
    av = np.array(a, dtype=np.float32)
    bv = np.array(b, dtype=np.float32)
    denom = float(np.linalg.norm(av) * np.linalg.norm(bv))
    if denom <= 0:
        return 0.5
    return float(np.clip(np.dot(av, bv) / denom, 0.0, 1.0))


def match_score(reference: DetectedObject, current: DetectedObject) -> float:
    if reference.label != current.label:
        return 0.0
    if (
        reference.dominantColor
        and current.dominantColor
        and reference.dominantColor != current.dominantColor
    ):
        return 0.0

    dist = center_distance(reference.boundingBox, current.boundingBox)
    position = max(0.0, 1.0 - min(dist / 0.5, 1.0))
    iou = bbox_iou(reference.boundingBox, current.boundingBox)
    size = size_similarity(reference.boundingBox, current.boundingBox)
    visual = embedding_similarity(reference.featureEmbedding, current.featureEmbedding)
    color_bonus = 1.0 if reference.dominantColor == current.dominantColor else 0.0

    score = 0.35 * position + 0.22 * iou + 0.2 * visual + 0.15 * size + 0.08 * color_bonus
    return round(float(score), 4)


def modification_reason(
    obj: DetectedObject,
    visual_similarity: float,
    obj_size_similarity: float,
) -> str | None:
    label = obj.label.lower()
    part_sensitive = any(
        token in label
        for token in ("person", "bear", "doll", "figure", "teddy")
    )

    if part_sensitive and (visual_similarity < 0.78 or obj_size_similarity < 0.72):
        return "Görünümü değişmiş; parça veya uzuv eksik olabilir."
    if visual_similarity < 0.68:
        return "Renk veya yüzey görünümü belirgin değişmiş."
    if obj_size_similarity < 0.62:
        return "Boyutu/kapladığı alan belirgin değişmiş."
    return None


def compare_objects(
    reference_objects: list[DetectedObject],
    current_objects: list[DetectedObject],
) -> tuple[
    list[DetectedObject],
    list[DetectedObject],
    list[DetectedObject],
    list[ModifiedObject],
    list[ObjectMatch],
]:
    min_score = 0.48
    candidates: list[tuple[float, DetectedObject, DetectedObject]] = []

    for ref in reference_objects:
        for cur in current_objects:
            score = match_score(ref, cur)
            if score >= min_score:
                candidates.append((score, ref, cur))

    candidates.sort(key=lambda item: item[0], reverse=True)

    matched_ref: set[str] = set()
    matched_cur: set[str] = set()
    unchanged: list[DetectedObject] = []
    modified: list[ModifiedObject] = []
    matches: list[ObjectMatch] = []

    for score, ref, cur in candidates:
        if ref.id in matched_ref or cur.id in matched_cur:
            continue
        matched_ref.add(ref.id)
        matched_cur.add(cur.id)
        visual = embedding_similarity(ref.featureEmbedding, cur.featureEmbedding)
        size = size_similarity(ref.boundingBox, cur.boundingBox)
        reason = modification_reason(ref, visual, size)
        if reason:
            modified.append(
                ModifiedObject(
                    reference=ref,
                    current=cur,
                    reason=reason,
                    score=score,
                    visualSimilarity=round(visual, 4),
                    sizeSimilarity=round(size, 4),
                )
            )
        else:
            unchanged.append(cur)
        matches.append(
            ObjectMatch(
                referenceId=ref.id,
                currentId=cur.id,
                score=score,
                visualSimilarity=round(visual, 4),
                sizeSimilarity=round(size, 4),
            )
        )

    added = [obj for obj in current_objects if obj.id not in matched_cur]
    removed = [obj for obj in reference_objects if obj.id not in matched_ref]
    return added, removed, unchanged, modified, matches


def detect_objects(pil_img: Image.Image) -> tuple[list[DetectedObject], float, int, int]:
    model = get_model()
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
                dominantColor=dominant_color_name(crop),
                featureEmbedding=extract_embedding(crop),
            )
        )

    return objects, inference_ms, w, h


# ─── Endpoint'ler ─────────────────────────────────────────────────────────────


@app.post(
    "/detect",
    response_model=DetectResponse,
    summary="Görüntüdeki nesneleri algıla",
)
async def detect(req: DetectRequest) -> DetectResponse:
    pil_img = parse_image(req.image)
    objects, inference_ms, w, h = detect_objects(pil_img)

    log.info(
        "Algılama tamamlandı — %d nesne, %.0fms  (görüntü: %dx%d)",
        len(objects), inference_ms, w, h,
    )

    return DetectResponse(
        imageId=str(uuid.uuid4()),
        objects=objects,
        inferenceMs=round(inference_ms, 1),
    )


@app.post(
    "/compare",
    response_model=CompareResponse,
    summary="İki görüntüyü algıla ve nesne değişimlerini karşılaştır",
)
async def compare(req: CompareRequest) -> CompareResponse:
    ref_img = parse_image(req.referenceImage)
    cur_img = parse_image(req.currentImage)

    ref_objects, ref_ms, ref_w, ref_h = detect_objects(ref_img)
    cur_objects, cur_ms, cur_w, cur_h = detect_objects(cur_img)
    added, removed, unchanged, modified, matches = compare_objects(ref_objects, cur_objects)
    ai_findings = analyze_with_openai_vision(req.referenceImage, req.currentImage)

    log.info(
        "Karşılaştırma tamamlandı — ref=%d, cur=%d, added=%d, removed=%d, modified=%d, matches=%d, ai=%d",
        len(ref_objects), len(cur_objects), len(added), len(removed), len(modified), len(matches), len(ai_findings),
    )
    log.info(
        "Görüntüler — ref: %dx%d %.0fms, cur: %dx%d %.0fms",
        ref_w, ref_h, ref_ms, cur_w, cur_h, cur_ms,
    )

    return CompareResponse(
        reference=DetectResponse(
            imageId=str(uuid.uuid4()),
            objects=ref_objects,
            inferenceMs=round(ref_ms, 1),
        ),
        current=DetectResponse(
            imageId=str(uuid.uuid4()),
            objects=cur_objects,
            inferenceMs=round(cur_ms, 1),
        ),
        added=added,
        removed=removed,
        unchanged=unchanged,
        modified=modified,
        matches=matches,
        aiFindings=ai_findings,
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
