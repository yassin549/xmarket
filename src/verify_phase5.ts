
import { HuggingFaceClient } from './infra/llm/hf_client';
import { EmbeddingBatcher } from './reality/embeddings/batcher';
import * as dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: './frontend/.env.local' });

async function runVerification() {
    console.log('🚀 Starting Phase 5 Verification...\n');

    // 1. Test HF Client Configuration
    console.log('1️⃣  Testing Hugging Face Client...');
    const hfClient = new HuggingFaceClient();
    const config = hfClient.getConfig();
    console.log('   Config:', config);

    if (!process.env.HUGGINGFACE_API_KEY) {
        console.error('   ❌ HUGGINGFACE_API_KEY missing');
        process.exit(1);
    }

    // 2. Test Text Generation
    console.log('\n2️⃣  Testing Text Generation...');
    try {
        const summary = await hfClient.generate(
            'Summarize in one sentence: The quick brown fox jumps over the lazy dog.',
            { max_new_tokens: 50 }
        );
        console.log('   ✅ Generated:', summary.trim());
    } catch (error) {
        console.error('   ❌ Generation failed:', error);
    }

    // 3. Test Structured Output & Provenance
    console.log('\n3️⃣  Testing Structured Output & Provenance...');
    const testSnapshotId = 'f56c358fa8c797cedb88f0a7a932a42ed9f38a121679a6db8b11aef889e7103a';
    try {
        const structured = await hfClient.generateStructured(
            'Extract event: Apple released the iPhone 15 today.',
            [testSnapshotId]
        );
        console.log('   ✅ Structured Output:', JSON.stringify(structured, null, 2));

        if (structured.snapshot_ids.includes(testSnapshotId)) {
            console.log('   ✅ Provenance Verified: Input snapshot_id found in output');
        } else {
            console.error('   ❌ Provenance Failed: Input snapshot_id missing');
        }
    } catch (error) {
        console.error('   ❌ Structured generation failed:', error);
    }

    // 4. Test Embedding Generation
    console.log('\n4️⃣  Testing Embeddings...');
    try {
        const embeddings = await hfClient.generateEmbeddings(['Hello world']);
        console.log(`   ✅ Generated embedding with dimensions: ${embeddings[0]?.length}`);
    } catch (error) {
        console.error('   ❌ Embedding generation failed:', error);
    }

    // 5. Test Embedding Batcher (Dry Run - no Pinecone write to avoid pollution if not needed, or write test)
    console.log('\n5️⃣  Testing Embedding Batcher Queue...');
    const batcher = new EmbeddingBatcher({ batchSize: 2 });
    // Mocking pinecone for safety if key not set, or we can try real if set
    if (process.env.PINECONE_API_KEY) {
        try {
            // We won't actually init/upsert to avoid needing a real index 'xmarket' to exist yet if user hasn't created it
            // But we can verify the class loads and methods exist
            console.log('   ✅ Batcher initialized successfully');
            console.log('   (Skipping actual Pinecone upsert to avoid index errors if not created)');
        } catch (e) {
            console.error('   ❌ Batcher init failed:', e);
        }
    } else {
        console.log('   ⚠️ PINECONE_API_KEY not set, skipping Batcher init');
    }

    console.log('\n✅ Verification Complete');
}

runVerification().catch(console.error);
