# Documentation Corrections Applied

## Date: 2025-11-24

### Summary
This document tracks the ambiguities identified in the original project documentation and the corrections applied to resolve them.

---

## Ambiguities Identified

### 1. Missing `/src/reality/` Directory
**Issue**: The `checklist.txt` file (Phase 6, item 19) references `src/reality/worker.ts`, but the Phase 0 directory structure did not include `/src/reality/`.

**Impact**: Structural inconsistency between implementation steps and initial repository setup.

### 2. Finalizer Service Location Unclear
**Issue**: Referenced as "Finalizer service" in checklist.txt:20 without specifying whether it's a separate deployable unit or a logical component within another service.

**Impact**: Potential confusion during implementation about service boundaries.

### 3. Missing File/Directory References
**Issue**: Files mentioned in later phases but not in initial structure:
- `docs/legal.md` (mentioned in Phase 12)
- `/src/reality/` directory structure

---

## Corrections Applied

###  Repository Structure (checklist.txt)
**File**: `checklist.txt`  
**Lines**: 11-25 (Phase 0, item 1)

**Change**: Added `/src/reality/` to the initial directory structure

```diff
      /src/backend/
      /src/frontend/
      /src/orderbook/
+     /src/reality/
      /src/infra/
```

### ✅ Finalizer Service Clarification (checklist.txt)
**File**: `checklist.txt`  
**Lines**: 158-164 (Phase 6, item 20)

**Change**: Clarified that the Finalizer is a logical component within `src/backend/workers/`

```diff
-    * Finalizer service picks approved `candidate_event` and writes `final_event` with `audit_event`.
+    * Finalizer logic (within `src/backend/workers/finalizer.ts`) picks approved `candidate_event` and writes `final_event` with `audit_event`.
```

**Rationale**: Makes it clear this is not a separate deployable microservice but rather a worker process within the backend.

### ⚠️ Repository Layout (plan.txt) - NOT APPLIED
**File**: `plan.txt`  
**Section**: #13 — File / Repo layout (minimal)

**Intended Change**: Add `/src/reality/ (worker + embeddings + blender)` after `/src/playwright-runner/`

**Status**: **NOT APPLIED** due to file corruption issues during editing.  
**Recommendation**: Human should manually add the following line to plan.txt after line 243:
```
/src/reality/ (worker + embeddings + blender)
```

---

## Remaining Actions Required

### Manual Correction Needed
**File**: `plan.txt`  
**Line**: After line 243 (in section #13)  
**Action**: Insert: `/src/reality/ (worker + embeddings + blender)`

The updated section should look like:
```
/src/orderbook/ (service + wal + tests)
/src/playwright-runner/ (service + dockerfile)
/src/reality/ (worker + embeddings + blender)
/src/backend/ (vercel functions)
/src/frontend/ (nextjs app with typed components)
```

---

##Verification Checklist

- [x] `checklist.txt` updated with `/src/reality/` in Phase 0
- [x] `checklist.txt` clarified Finalizer service location
- [ ] `plan.txt` updated with `/src/reality/` in file layout (MANUAL ACTION REQUIRED)

---

## Notes
All corrections maintain consistency with the project's guiding principles:
- Determinism & Reproducibility
- Human-in-the-loop for sensitive operations
- Clear service boundaries and responsibilities
