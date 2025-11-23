#!/bin/bash
# Reality Engine start script for Railway

cd /app
python run.py --backend-url $BACKEND_URL --verbose
