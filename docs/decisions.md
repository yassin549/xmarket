# Architecture Decisions Log

This file tracks all major architectural and technical decisions for the Everything Market platform.

## Format
```
### [YYYY-MM-DD] Decision Title
**Context**: Why this decision was needed
**Decision**: What was decided
**Consequences**: Impact and trade-offs
**Owner**: Team/person responsible
**Review Date**: When to revisit
```

---

## Decisions

### [2025-11-25] LLM & Embeddings Models (Phase 5)
**Context**: Need embedding and text generation models for content ingestion pipeline  
**Decision**: 
- Embeddings: `sentence-transformers/all-MiniLM-L6-v2` (384D, HF Inference API)
- Text Generation: `mistralai/Mistral-7B-Instruct-v0.2` (HF Inference API)  
**Rationale**:
- MiniLM: Fast (50ms/batch), proven semantic similarity, free tier friendly
- Mistral: Strong instruction following, good JSON generation, Apache 2.0 license  
**Consequences**: 
- HF free tier limits (30k req/month), upgrade to Pro ($9/mo) if needed
- 384D embeddings = ~1.5KB per vector in Pinecone  
**Owner**: Phase 5 Implementation  
**Review Date**: After 1 month production use

### [2025-11-25] Vector Database Provider
**Context**: Need managed vector storage for embeddings  
**Decision**: Pinecone (already provisioned)  
**Rationale**: Managed, serverless, good free tier, easy API  
**Consequences**: Vendor lock-in, costs scale with usage  
**Owner**: Infrastructure Team  
**Review Date**: Q1 2026

### [Pending] Realtime Provider
**Context**: Need realtime pub/sub with sequence guarantees  
**Decision**: TBD - Ably vs Pusher vs Supabase Realtime  
**Owner**: Backend Team  
**Review Date**: Week 1

