# ─── Stage 1: model indir ────────────────────────────────────────────────────
# Modeli ayrı bir katmanda indirip cache'liyoruz.
# Kod değiştiğinde model katmanı yeniden indirilmez.
FROM python:3.11-slim AS model-downloader

WORKDIR /tmp
RUN pip install --no-cache-dir ultralytics==8.2.* && \
    python -c "from ultralytics import YOLO; YOLO('yolo11n.pt')" && \
    cp /root/.config/Ultralytics/yolo11n.pt /tmp/yolo11n.pt 2>/dev/null || \
    find / -name "yolo11n.pt" -exec cp {} /tmp/yolo11n.pt \; 2>/dev/null || true


# ─── Stage 2: runtime ────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Sistem bağımlılıkları (OpenCV için)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Önce requirements (bağımlılık katmanını cache'le)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Modeli önceki stage'den kopyala
COPY --from=model-downloader /tmp/yolo11n.pt ./yolo11n.pt

# Uygulama kodunu kopyala
COPY main.py config.py ./

# Non-root kullanıcı (güvenlik)
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_PATH=yolo11n.pt \
    CONFIDENCE_THRESHOLD=0.25 \
    IOU_THRESHOLD=0.45 \
    MAX_DETECTIONS=100 \
    HOST=0.0.0.0 \
    PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["python", "-m", "uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1", \
     "--log-level", "info"]
