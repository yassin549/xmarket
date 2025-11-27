"use strict";
/**
 * Hugging Face Client
 *
 * Unified client for Hugging Face Inference API.
 * Supports text generation, embeddings, and structured output with schema validation.
 * Enforces provenance requirements (snapshot_ids) and logs all raw outputs.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HuggingFaceClient = void 0;
var crypto_1 = __importDefault(require("crypto"));
var promises_1 = require("fs/promises");
var path_1 = __importDefault(require("path"));
var HuggingFaceClient = /** @class */ (function () {
    function HuggingFaceClient(model) {
        this.apiKey = process.env.HUGGINGFACE_API_KEY;
        this.apiUrl = process.env.HUGGINGFACE_API_URL;
        this.model = model || process.env.LLM_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';
        this.embeddingModel = process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
        this.llmRawDir = path_1.default.join(process.cwd(), 'llm_raw');
        if (!this.apiKey) {
            throw new Error('HUGGINGFACE_API_KEY not configured');
        }
    }
    /**
     * Generate text using HF Inference API
     */
    HuggingFaceClient.prototype.generate = function (prompt_1) {
        return __awaiter(this, arguments, void 0, function (prompt, config) {
            var url, response, error, result;
            var _a;
            if (config === void 0) { config = {}; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        url = "".concat(this.apiUrl).concat(this.model);
                        return [4 /*yield*/, fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Authorization': "Bearer ".concat(this.apiKey),
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
                            })];
                    case 1:
                        response = _b.sent();
                        if (!!response.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, response.text()];
                    case 2:
                        error = _b.sent();
                        throw new Error("HF generation failed: ".concat(response.status, " - ").concat(error));
                    case 3: return [4 /*yield*/, response.json()];
                    case 4:
                        result = _b.sent();
                        return [2 /*return*/, ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.generated_text) || ''];
                }
            });
        });
    };
    /**
     * Generate structured output with schema validation
     */
    HuggingFaceClient.prototype.generateStructured = function (prompt, snapshot_ids) {
        return __awaiter(this, void 0, void 0, function () {
            var call_id, structuredPrompt, rawOutput, parsed, jsonMatch;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!snapshot_ids || snapshot_ids.length === 0) {
                            throw new Error('snapshot_ids are required for structured generation');
                        }
                        call_id = crypto_1.default.randomUUID();
                        structuredPrompt = "".concat(prompt, "\n\nYou MUST respond with valid JSON matching this schema:\n{\n  \"summary\": \"Brief summary of the content\",\n  \"snapshot_ids\": [\"").concat(snapshot_ids.join('", "'), "\"],\n  \"sources\": [\"URL or snapshot reference\"],\n  \"confidence\": 0.0-1.0,\n  \"schema_version\": \"v1\"\n}\n\nCRITICAL: Include ALL provided snapshot_ids in your response.\nRespond with ONLY the JSON, no other text.");
                        return [4 /*yield*/, this.generate(structuredPrompt, {
                                max_new_tokens: 1024,
                                temperature: 0.3,
                            })];
                    case 1:
                        rawOutput = _a.sent();
                        return [4 /*yield*/, this.storeRawOutput(call_id, {
                                prompt: structuredPrompt,
                                raw_output: rawOutput,
                                snapshot_ids: snapshot_ids,
                                timestamp: new Date().toISOString(),
                                model: this.model,
                            })];
                    case 2:
                        _a.sent();
                        try {
                            jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
                            if (!jsonMatch) {
                                throw new Error('No JSON found in response');
                            }
                            parsed = JSON.parse(jsonMatch[0]);
                        }
                        catch (error) {
                            throw new Error("Failed to parse LLM output as JSON: ".concat(error));
                        }
                        this.validateOutput(parsed, snapshot_ids);
                        return [2 /*return*/, parsed];
                }
            });
        });
    };
    /**
     * Generate embeddings using HF Inference API
     */
    HuggingFaceClient.prototype.generateEmbeddings = function (texts) {
        return __awaiter(this, void 0, void 0, function () {
            var url, response, error;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = "".concat(this.apiUrl).concat(this.embeddingModel);
                        return [4 /*yield*/, fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Authorization': "Bearer ".concat(this.apiKey),
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    inputs: texts,
                                    options: { wait_for_model: true },
                                }),
                            })];
                    case 1:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, response.text()];
                    case 2:
                        error = _a.sent();
                        throw new Error("HF embedding failed: ".concat(response.status, " - ").concat(error));
                    case 3: return [4 /*yield*/, response.json()];
                    case 4: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Validate LLM output matches schema and provenance requirements
     */
    HuggingFaceClient.prototype.validateOutput = function (output, requiredSnapshots) {
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
        if (typeof output.confidence !== 'number' ||
            output.confidence < 0 ||
            output.confidence > 1) {
            throw new Error('Invalid schema: confidence must be 0.0-1.0');
        }
        if (output.schema_version !== 'v1') {
            throw new Error('Invalid schema: schema_version must be "v1"');
        }
        for (var _i = 0, requiredSnapshots_1 = requiredSnapshots; _i < requiredSnapshots_1.length; _i++) {
            var required = requiredSnapshots_1[_i];
            if (!output.snapshot_ids.includes(required)) {
                throw new Error("Provenance violation: missing required snapshot_id ".concat(required));
            }
        }
        for (var _a = 0, _b = output.snapshot_ids; _a < _b.length; _a++) {
            var sid = _b[_a];
            if (!/^[a-f0-9]{64}$/.test(sid)) {
                throw new Error("Invalid snapshot_id format: ".concat(sid));
            }
        }
    };
    /**
     * Store raw LLM output for audit trail
     */
    HuggingFaceClient.prototype.storeRawOutput = function (call_id, data) {
        return __awaiter(this, void 0, void 0, function () {
            var filePath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.mkdir)(this.llmRawDir, { recursive: true })];
                    case 1:
                        _a.sent();
                        filePath = path_1.default.join(this.llmRawDir, "".concat(call_id, ".json"));
                        return [4 /*yield*/, (0, promises_1.writeFile)(filePath, JSON.stringify(data, null, 2))];
                    case 2:
                        _a.sent();
                        console.log("Stored raw LLM output: ".concat(call_id));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get current model configuration
     */
    HuggingFaceClient.prototype.getConfig = function () {
        return {
            model: this.model,
            embeddingModel: this.embeddingModel,
            apiUrl: this.apiUrl,
        };
    };
    return HuggingFaceClient;
}());
exports.HuggingFaceClient = HuggingFaceClient;
exports.default = HuggingFaceClient;
