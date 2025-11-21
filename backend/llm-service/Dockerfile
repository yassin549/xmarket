FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements-llm.txt .
RUN pip install --no-cache-dir -r requirements-llm.txt

# Copy application code
COPY llm_server.py .
COPY download_model.py .
COPY config.py .

# Create cache directory
RUN mkdir -p /app/cache

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s \
  CMD python -c "import requests; requests.get('http://localhost:8001/health', timeout=5)"

# Start server
CMD ["python", "llm_server.py"]
