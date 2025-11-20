FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN apt-get update && apt-get install -y build-essential libxml2-dev libxslt-dev libjpeg-dev zlib1g-dev git ffmpeg curl \
    && pip install --upgrade pip \
    && pip install -r requirements.txt \
    && playwright install --with-deps chromium
COPY . .
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
