# LLM Service Deployment Guide

## 🚀 Quick Start

### **You DON'T need to download the model locally!**

The model will be automatically downloaded when you deploy to Railway.

---

## 📦 What Happens on Railway

1. **Build Phase**: Railway builds the Docker image
2. **First Startup** (~10-15 minutes):
   - LLM service starts
   - Automatically downloads Mistral-7B (~14GB)
   - Caches model in `/app/cache`
3. **Subsequent Restarts** (~30 seconds):
   - Uses cached model
   - Fast startup!

---

## 🧪 Testing Locally (Optional)

If you want to test the LLM service locally before deploying:

### **Option 1: Heuristic Mode (No Model Needed)**
```bash
# In backend directory
export LLM_MODE=heuristic
python app/scraper/poller.py
```

This uses zero-cost heuristic summaries - perfect for testing!

### **Option 2: Full LLM Service (Downloads Model)**
```bash
# Terminal 1: Start LLM service
cd backend/llm-service
pip install -r requirements-llm.txt
python llm_server.py
# First run downloads ~14GB model (one-time)

# Terminal 2: Start backend
cd backend
export LLM_MODE=railway
export LLM_SERVICE_URL=http://localhost:8001
python app/scraper/poller.py
```

---

## 🌐 Railway Deployment

### **Step 1: Create Railway Project**
```bash
railway login
railway init
```

### **Step 2: Add LLM Service**
1. Go to Railway dashboard
2. Click "New Service"
3. Select your GitHub repo
4. Set root directory: `backend/llm-service`
5. Add environment variables:
   ```
   MODEL_NAME=mistralai/Mistral-7B-Instruct-v0.2
   PORT=8001
   USE_4BIT=true
   ```

### **Step 3: Configure Backend**
Add to backend service environment:
```
LLM_MODE=railway
LLM_SERVICE_URL=http://llm-service.railway.internal:8001
```

### **Step 4: Deploy**
Railway auto-deploys on git push!

---

## 💰 Cost Estimate

- **LLM Service**: ~$30/month (8GB RAM, 4 vCPU)
- **First startup**: 10-15 minutes (one-time)
- **Model size**: ~4GB (with quantization)

---

## ✅ Recommended Approach

1. **Week 1**: Use `LLM_MODE=heuristic` (free, instant)
2. **Week 2**: Deploy to Railway, test quality
3. **Production**: Keep Railway LLM or switch to API based on results

No local download needed! 🎉
