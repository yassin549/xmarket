/**
 * Embedding Batcher
 * 
 * Batches text for embedding generation and stores to Pinecone.
 * Implements queue-based processing with configurable batch size.
 */

import { Pinecone } from '@pinecone-database/pinecone';
import HuggingFaceClient from '../../infra/llm/hf_client';

export interface EmbeddingJob {
    text: string;
    metadata: {
        ingest_id: string;
        snapshot_id: string;
        url: string;
        fetched_at: string;
        content_type?: string;
    };
}

export class EmbeddingBatcher {
    private pinecone: Pinecone;
    private index: any;
    private hfClient: HuggingFaceClient;
    private queue: EmbeddingJob[] = [];
    private batchSize: number;
    private processing = false;
    private maxRetries: number;
    private retryDelay: number;

    constructor(config: {
        batchSize?: number;
        maxRetries?: number;
        retryDelay?: number;
    } = {}) {
        this.batchSize = config.batchSize || parseInt(process.env.EMBED_BATCH_SIZE || '32');
        this.maxRetries = config.maxRetries || parseInt(process.env.EMBED_MAX_RETRIES || '3');
        this.retryDelay = config.retryDelay || parseInt(process.env.EMBED_RETRY_DELAY || '5000');

        // Initialize Pinecone
        const apiKey = process.env.PINECONE_API_KEY;
        if (!apiKey) {
            throw new Error('PINECONE_API_KEY not configured');
        }

        this.pinecone = new Pinecone({ apiKey });
        this.hfClient = new HuggingFaceClient();
    }

    /**
     * Initialize Pinecone index connection
     */
    async initialize(): Promise<void> {
        const indexName = process.env.PINECONE_INDEX_NAME || 'xmarket';
        const indexHost = process.env.PINECONE_INDEX_HOST;

        if (!indexHost) {
            throw new Error('PINECONE_INDEX_HOST not configured');
        }

        this.index = this.pinecone.index(indexName, indexHost);
        console.log(`Pinecone index initialized: ${indexName}`);
    }

    /**
     * Add text to embedding queue
     * 
     * Auto-processes when batch is full
     */
    async enqueue(job: EmbeddingJob): Promise<void> {
        this.queue.push(job);

        console.log(`Enqueued embedding job (queue size: ${this.queue.length}/${this.batchSize})`);

        // Auto-process when batch is full
        if (this.queue.length >= this.batchSize && !this.processing) {
            await this.processBatch();
        }
    }

    /**
     * Process batch of embeddings
     * 
     * Extracts batch, generates embeddings via HF, stores to Pinecone
     */
    async processBatch(): Promise<void> {
        if (this.queue.length === 0 || this.processing) {
            return;
        }

        this.processing = true;

        try {
            // Extract batch
            const batch = this.queue.splice(0, this.batchSize);
            console.log(`Processing batch of ${batch.length} embeddings`);

            // Generate embeddings via Hugging Face with retry
            let embeddings: number[][];
            let attempt = 0;

            while (attempt < this.maxRetries) {
                try {
                    embeddings = await this.hfClient.generateEmbeddings(
                        batch.map(j => j.text)
                    );
                    break; // Success
                } catch (error) {
                    attempt++;
                    if (attempt >= this.maxRetries) {
                        throw error; // Give up
                    }

                    console.warn(
                        `Embedding generation failed (attempt ${attempt}/${this.maxRetries}):`,
                        error
                    );

                    // Exponential backoff
                    await this.sleep(this.retryDelay * Math.pow(2, attempt - 1));
                }
            }

            // Prepare vectors for Pinecone
            const vectors = batch.map((job, i) => ({
                id: `${job.metadata.snapshot_id}-${i}-${Date.now()}`,
                values: embeddings![i],
                metadata: {
                    ingest_id: job.metadata.ingest_id,
                    snapshot_id: job.metadata.snapshot_id,
                    url: job.metadata.url,
                    fetched_at: job.metadata.fetched_at,
                    content_type: job.metadata.content_type || 'text/html',
                    text_preview: job.text.substring(0, 500),
                    indexed_at: new Date().toISOString(),
                },
            }));

            // Upsert to Pinecone
            await this.index.upsert(vectors);

            console.log(`✅ Stored ${vectors.length} embeddings to Pinecone`);
        } catch (error) {
            console.error('Batch processing error:', error);
            // Don't throw - we don't want to crash the batcher
            // Jobs will be lost but we log the error
        } finally {
            this.processing = false;
        }
    }

    /**
     * Flush remaining queue
     * 
     * Process all remaining items regardless of batch size
     */
    async flush(): Promise<void> {
        console.log(`Flushing queue (${this.queue.length} items remaining)`);

        while (this.queue.length > 0) {
            await this.processBatch();
        }

        console.log('Queue flushed');
    }

    /**
     * Get queue stats
     */
    getStats() {
        return {
            queueSize: this.queue.length,
            batchSize: this.batchSize,
            processing: this.processing,
        };
    }

    /**
     * Query Pinecone for similar embeddings
     * 
     * @param query Query text
     * @param topK Number of results
     * @param filter Metadata filter
     */
    async query(
        query: string,
        topK: number = 10,
        filter?: Record<string, any>
    ): Promise<any> {
        // Generate embedding for query
        const [queryEmbedding] = await this.hfClient.generateEmbeddings([query]);

        // Query Pinecone
        const result = await this.index.query({
            vector: queryEmbedding,
            topK,
            filter,
            includeMetadata: true,
        });

        return result;
    }

    /**
     * Sleep helper for retry backoff
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Default export
 */
export default EmbeddingBatcher;
