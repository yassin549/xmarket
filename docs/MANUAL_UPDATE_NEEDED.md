# Manual Update Required for plan.txt

## Location
File: `plan.txt`  
Section: #13 — File / Repo layout (minimal)  
Line: After line 243

## Current Content (lines 242-245)
```
/src/orderbook/ (service + wal + tests)
/src/playwright-runner/ (service + dockerfile)
/src/backend/ (vercel functions)
/src/frontend/ (nextjs app with typed components)
```

## Required Update
Insert the following line after `/src/playwright-runner/`:
```
/src/reality/ (worker + embeddings + blender)
```

## Expected Result (lines 242-246)
```
/src/orderbook/ (service + wal + tests)
/src/playwright-runner/ (service + dockerfile)
/src/reality/ (worker + embeddings + blender)
/src/backend/ (vercel functions)
/src/frontend/ (nextjs app with typed components)
```

## Reason
Automated editing caused file corruption due to line ending issues.
This single-line insertion is safer to perform manually.

## Status
🔴 **NOT YET APPLIED** - Awaiting human approval
