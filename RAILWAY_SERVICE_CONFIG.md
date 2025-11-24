# Railway Service Configuration
# Place this in each service's Settings > Deploy section

# BACKEND SERVICE
# ===============
# In Railway Dashboard:
# 1. Service Settings > Build
#    - Builder: Dockerfile
#    - Dockerfile Path: Dockerfile.backend
#    - Build Command: (leave empty - Docker handles it)
#
# 2. Service Settings > Deploy  
#    - Start Command: (leave empty - Docker CMD handles it)
#    - Root Directory: (leave empty)
#
# 3. Alternatively, if Railway isn't detecting Dockerfile:
#    - Delete and recreate the service
#    - When creating, select "Deploy from Dockerfile"
#    - Point to Dockerfile.backend

# ORDERBOOK SERVICE
# =================
# In Railway Dashboard:
# 1. Service Settings > Build
#    - Builder: Dockerfile
#    - Dockerfile Path: Dockerfile.orderbook
#
# 2. Service Settings > Deploy
#    - Start Command: (leave empty)
#    - Root Directory: (leave empty)

# REALITY ENGINE SERVICE
# =======================
# In Railway Dashboard:
# 1. Service Settings > Build
#    - Builder: Dockerfile
#    - Dockerfile Path: Dockerfile.reality-engine
#
# 2. Service Settings > Deploy
#    - Start Command: (leave empty)
#    - Root Directory: (leave empty)

# IMPORTANT: Railway may cache the auto-detection
# If services still fail after updating settings:
# 1. Delete the failing service
# 2. Create new service
# 3. Select "Deploy from Dockerfile" option
# 4. Point to the correct Dockerfile path
