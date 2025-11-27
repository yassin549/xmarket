/**
 * Hugging Face Client
 * 
 * Unified client for Hugging Face Inference API.
 * Supports text generation, embeddings, and structured output with schema validation.
 * Enforces provenance requirements (snapshot_ids) and logs all raw outputs.
 */

import crypto from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

export interface LLMOutput {
    summary: string;
    snapshot_ids: string[];
    sources: string[];
    confidence: number;
    schema_version: string;
}

export interface GenerationConfig {
    max_new_tokens?: number;
    temperature?: number;
    top_p?: number;
    return_full_text?: boolean;
}

export class HuggingFaceClient {
    private apiKey: string;
    private apiUrl: string;
    private model: string;
    private llmRawDir: string;
    private embeddingModel: string;

    constructor(model?: string) {
        this.apiKey = process.env.HUGGINGFACE_API_KEY!;
        this.apiUrl = process.env.HUGGINGFACE_API_URL!;
        this.model = model || process.env.LLM_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';
        this.embeddingModel = process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
        this.llmRawDir = path.join(process.cwd(), 'llm_raw');

        if (!this.apiKey) {
            throw new Error('HUGGINGFACE_API_KEY not configured');
        }
    }

    /**
     * Generate text using HF Inference API
     */
    async generate(
        prompt: string,
        config: GenerationConfig = {}
    ): Promise<string> {
        const url = `${this.apiUrl}${this.model}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_new_tokens: config.max_new_tokens || 512,
                    temperature: config.temperature || 0.7,
                    top_p: config.top_p || 0.9,
                    return_full_text: config.return_full_text || false,
                },
                options: {
                    wait_for_model: true,
                    use_cache: false,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`HF generation failed: ${response.status} - ${error}`);
        }

        const result = await response.json() as Array<{ generated_text: string }>;
        return result[0]?.generated_text || '';
    }

    /**
     * Generate structured output with schema validation
     */
    async generateStructured(
        prompt: string,
        snapshot_ids: string[]
    ): Promise<LLMOutput> {
        if (!snapshot_ids || snapshot_ids.length === 0) {
            throw new Error('snapshot_ids are required for structured generation');
        }

        const call_id = crypto.randomUUID();

        const structuredPrompt = `${prompt}

You MUST respond with valid JSON matching this schema:
{
  "summary": "Brief summary of the content",
  "snapshot_ids": ["${snapshot_ids.join('", "')}"],
  "sources": ["URL or snapshot reference"],
  "confidence": 0.0-1.0,
  "schema_version": "v1"
}

CRITICAL: Include ALL provided snapshot_ids in your response.
Respond with ONLY the JSON, no other text.`;

        const rawOutput = await this.generate(structuredPrompt, {
            max_new_tokens: 1024,
            temperature: 0.3,
        });

        await this.storeRawOutput(call_id, {
            prompt: structuredPrompt,
            raw_output: rawOutput,
            snapshot_ids,
            timestamp: new Date().toISOString(),
            model: this.model,
        });

        let parsed: LLMOutput;
        try {
            const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            parsed = JSON.parse(jsonMatch[0]);
        } catch (error) {
            throw new Error(`Failed to parse LLM output as JSON: ${error}`);
        }

        this.validateOutput(parsed, snapshot_ids);
        return parsed;
    }

    /**
     * Generate embeddings using HF Inference API
     */
    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        const url = `${this.apiUrl}${this.embeddingModel}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: texts,
                options: { wait_for_model: true },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`HF embedding failed: ${response.status} - ${error}`);
        }

        return await response.json() as number[][];
    }

    /**
     * Validate LLM output matches schema and provenance requirements
     */
    private validateOutput(output: any, requiredSnapshots: string[]): void {
        if (!output.summary || typeof output.summary !== 'string') {
            throw new Error('Invalid schema: missing or invalid summary');
        }

        if (!Array.isArray(output.snapshot_ids)) {
            throw new Error('Invalid schema: snapshot_ids must be array');
        }

        if (output.snapshot_ids.length === 0) {
            throw new Error('Invalid schema: snapshot_ids cannot be empty');
        }

        if (!Array.isArray(output.sources)) {
            throw new Error('Invalid schema: sources must be array');
        }

        if (
            typeof output.confidence !== 'number' ||
            output.confidence < 0 ||
            output.confidence > 1
        ) {
            throw new Error('Invalid schema: confidence must be 0.0-1.0');
        }

        if (output.schema_version !== 'v1') {
            throw new Error('Invalid schema: schema_version must be "v1"');
        }

        for (const required of requiredSnapshots) {
            if (!output.snapshot_ids.includes(required)) {
                throw new Error(
                    `Provenance violation: missing required snapshot_id ${required}`
                );
            }
        }

        for (const sid of output.snapshot_ids) {
            if (!/^[a-f0-9]{64}$/.test(sid)) {
                throw new Error(`Invalid snapshot_id format: ${sid}`);
            }
        }
    }

    /**
     * Store raw LLM output for audit trail
     */
    private async storeRawOutput(call_id: string, data: any): Promise<void> {
        await mkdir(this.llmRawDir, { recursive: true });

        const filePath = path.join(this.llmRawDir, `${call_id}.json`);
        await writeFile(filePath, JSON.stringify(data, null, 2));

        console.log(`Stored raw LLM output: ${call_id}`);
    }

    /**
     * Get current model configuration
     */
    getConfig() {
        return {
            model: this.model,
            embeddingModel: this.embeddingModel,
            apiUrl: this.apiUrl,
        };
    }
}

export default HuggingFaceClient;
