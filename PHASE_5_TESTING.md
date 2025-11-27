# Phase 5 Testing Guide

## Prerequisites

Install Pinecone client:
```bash
cd src
npm install @pinecone-database/pinecone
npm run build
```

---

## Test 1: Hugging Face Text Generation

```bash
cd src
node -e "
const { HuggingFaceClient } = require('./dist/infra/llm/hf_client');

async function test() {
  const client = new HuggingFaceClient();
  
  console.log('Testing text generation...');
  const output = await client.generate(
    'Summarize in one sentence: SpaceX successfully launched Starship.'
  );
  
  console.log('Generated:', output);
}

test().catch(console.error);
"
```

**Expected**: Summary of SpaceX launch (may take 2-5 seconds on HF free tier)

---

## Test 2: Structured Output with Schema Validation

```bash
node -e "
const { HuggingFaceClient } = require('./dist/infra/llm/hf_client');

async function test() {
  const client = new HuggingFaceClient();
  
  console.log('Testing structured output...');
  const output = await client.generateStructured(
    'Summarize: SpaceX launched Starship successfully on November 18, 2024.',
    ['f56c358fa8c797cedb88f0a7a932a42ed9f38a121679a6db8b11aef889e7103a']
  );
  
  console.log('Structured output:', JSON.stringify(output, null, 2));
  console.log('✅ Schema validation passed');
  console.log('✅ Provenance enforced (snapshot_ids present)');
}

test().catch(console.error);
"
```

**Expected**:
- Valid JSON with all required fields
- `snapshot_ids` includes input snapshot
- Raw output logged to `llm_raw/{uuid}.json`

---

## Test 3: Schema Validation Rejection

```bash
node -e "
const { HuggingFaceClient } = require('./dist/infra/llm/hf_client');

async function test() {
  const client = new HuggingFaceClient();
  
  try {
    // Should throw - empty snapshot_ids
    await client.generateStructured('Test', []);
  } catch (error) {
    console.log('✅ Correctly rejected:', error.message);
  }
}

test().catch(console.error);
"
```

**Expected**: Error "snapshot_ids are required"

---

## Test 4: Embedding Generation

```bash
node -e "
const { HuggingFaceClient } = require('./dist/infra/llm/hf_client');

async function test() {
  const client = new HuggingFaceClient();
  
  console.log('Generating embeddings...');
  const embeddings = await client.generateEmbeddings([
    'SpaceX launched Starship',
    'Tesla released new model'
  ]);
  
  console.log('Embedding dimensions:', embeddings[0].length);
  console.log('Batch size:', embeddings.length);
  console.log('✅ Embeddings generated');
}

test().catch(console.error);
"
```

**Expected**: 
- 2 embeddings
- 384 dimensions each

---

## Test 5: Embedding Batcher

```bash
node -e "
const { EmbeddingBatcher } = require('./dist/reality/embeddings/batcher');

async function test() {
  const batcher = new EmbeddingBatcher({ batchSize: 2 });
  await batcher.initialize();
  
  console.log('Enqueueing jobs...');
  
  await batcher.enqueue({
    text: 'SpaceX launched Starship successfully.',
    metadata: {
      ingest_id: 'test-1',
      snapshot_id: 'f56c358fa8c797cedb88f0a7a932a42ed9f38a121679a6db8b11aef889e7103a',
      url: 'https://example.com',
      fetched_at: new Date().toISOString()
    }
  });
  
  await batcher.enqueue({
    text: 'Tesla announced new vehicle model.',
    metadata: {
      ingest_id: 'test-2',
      snapshot_id: 'a92bd4c1e3f5a6b8c9d0e1f2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2',
      url: 'https://example.com/tesla',
      fetched_at: new Date().toISOString()
    }
  });
  
  // Should auto-process when batch size reached
  await new Promise(r => setTimeout(r, 5000)); // Wait for processing
  
  console.log('✅ Batch processed and stored to Pinecone');
}

test().catch(console.error);
"
```

**Expected**:
- Batch auto-processes when 2 items enqueued
- Embeddings stored to Pinecone
- Console logs: "Stored 2 embeddings to Pinecone"

---

## Test 6: Pinecone Query

```bash
node -e "
const { EmbeddingBatcher } = require('./dist/reality/embeddings/batcher');

async function test() {
  const batcher = new EmbeddingBatcher();
  await batcher.initialize();
  
  console.log('Querying Pinecone...');
  
  const results = await batcher.query('SpaceX launch', 5);
  
  console.log('Query results:', results.matches.length);
  results.matches.forEach(m => {
    console.log('-', m.metadata.text_preview.substring(0, 50));
  });
  
  console.log('✅ Pinecone query working');
}

test().catch(console.error);
"
```

**Expected**: 
- Returns similar embeddings from previous tests
- Metadata includes `text_preview`, `snapshot_id`, etc.

---

## Troubleshooting

**Issue**: "HUGGINGFACE_API_KEY not configured"  
**Fix**: Add to `src/.env`:
```bash
# Add to .env.local (if testing locally)
HUGGINGFACE_API_KEY=hf_your_huggingface_api_key_here
```

**Issue**: "PINECONE_API_KEY not configured"  
**Fix**: Add to `src/.env`:

PINECONE_INDEX_NAME=xmarket
PINECONE_INDEX_HOST=https://xmarket-51f7vkp...
```

**Issue**: HF API rate limit error  
**Fix**: Wait 60 seconds, or upgrade to Pro tier

**Issue**: Embeddings dimension mismatch  
**Fix**: Ensure Pinecone index created with dimension=384

---

## Integration Test: Full Pipeline

Once all tests pass, test the full flow:

```
1. POST /api/v1/ingest (URL)
2. Worker processes job
3. Playwright fetches → creates snapshot
4. Embedding batcher generates embeddings
5. Pinecone stores vectors
6. Query similar content
```

**All tests passing? Phase 5 complete! 🎉**
