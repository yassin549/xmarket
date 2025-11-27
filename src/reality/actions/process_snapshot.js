"use strict";
/**
 * Process Snapshot Executor
 *
 * Core Reality Engine logic:
 * 1. Fetch snapshot content from Blob storage
 * 2. Generate embeddings via Batcher
 * 3. Extract event data via LLM
 * 4. Store as candidate_event
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
exports.ProcessSnapshotExecutor = void 0;
var pool_1 = require("../../infra/db/pool");
var batcher_1 = require("../embeddings/batcher");
var hf_client_1 = require("../../infra/llm/hf_client");
var crypto_1 = __importDefault(require("crypto"));
var ProcessSnapshotExecutor = /** @class */ (function () {
    function ProcessSnapshotExecutor() {
        this.batcher = new batcher_1.EmbeddingBatcher();
        this.hfClient = new hf_client_1.HuggingFaceClient();
        // Runtime check for query function
        if (!pool_1.query) {
            console.error('FATAL: query is undefined in ProcessSnapshotExecutor');
            try {
                var poolModule = require('../../infra/db/pool');
                console.error('Pool Module keys:', Object.keys(poolModule));
            }
            catch (e) {
                console.error('Failed to require pool module:', e);
            }
        }
    }
    ProcessSnapshotExecutor.prototype.execute = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var snapshot_id, url, title, snapshotResult, objectStorePath, contentText, extraction, error_1, dedupeHash, existing, insertResult, candidateId;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log('ProcessSnapshotExecutor.execute called');
                        console.log('Query function type:', typeof pool_1.query);
                        snapshot_id = payload.snapshot_id, url = payload.url, title = payload.title;
                        if (!snapshot_id) {
                            throw new Error('snapshot_id is required');
                        }
                        console.log("Processing snapshot: ".concat(snapshot_id, " (").concat(url, ")"));
                        return [4 /*yield*/, (0, pool_1.query)("SELECT object_store_path FROM snapshots WHERE snapshot_id = $1", [snapshot_id])];
                    case 1:
                        snapshotResult = _b.sent();
                        if (snapshotResult.rows.length === 0) {
                            throw new Error("Snapshot not found: ".concat(snapshot_id));
                        }
                        objectStorePath = snapshotResult.rows[0].object_store_path;
                        contentText = "Title: ".concat(title, "\nURL: ").concat(url);
                        // 2. Generate Embeddings (Async Batch)
                        console.log('Batcher:', this.batcher);
                        console.log('Batcher.initialize:', (_a = this.batcher) === null || _a === void 0 ? void 0 : _a.initialize);
                        return [4 /*yield*/, this.batcher.initialize()];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, this.batcher.enqueue({
                                text: contentText,
                                metadata: {
                                    ingest_id: payload.ingest_id || 'unknown',
                                    snapshot_id: snapshot_id,
                                    url: url,
                                    fetched_at: new Date().toISOString()
                                }
                            })];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        _b.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, this.hfClient.generateStructured("Extract the main event from this content:\n\n".concat(contentText), [snapshot_id])];
                    case 5:
                        extraction = _b.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        error_1 = _b.sent();
                        console.error('LLM Extraction failed:', error_1);
                        return [2 /*return*/, { status: 'extraction_failed', error: String(error_1) }];
                    case 7:
                        dedupeHash = crypto_1.default
                            .createHash('sha256')
                            .update(extraction.summary + snapshot_id)
                            .digest('hex');
                        return [4 /*yield*/, (0, pool_1.query)("SELECT candidate_id FROM candidate_events WHERE dedupe_hash = $1", [dedupeHash])];
                    case 8:
                        existing = _b.sent();
                        if (existing.rows.length > 0) {
                            console.log("Duplicate candidate event skipped: ".concat(dedupeHash));
                            return [2 /*return*/, { status: 'skipped_duplicate', candidate_id: existing.rows[0].candidate_id }];
                        }
                        return [4 /*yield*/, (0, pool_1.query)("INSERT INTO candidate_events \n       (snapshot_id, summary, confidence, metadata, dedupe_hash, status)\n       VALUES ($1, $2, $3, $4, $5, 'pending')\n       RETURNING candidate_id", [
                                snapshot_id,
                                extraction.summary,
                                extraction.confidence,
                                JSON.stringify({
                                    sources: extraction.sources,
                                    llm_version: extraction.schema_version
                                }),
                                dedupeHash
                            ])];
                    case 9:
                        insertResult = _b.sent();
                        candidateId = insertResult.rows[0].candidate_id;
                        console.log("Created candidate event: ".concat(candidateId));
                        return [2 /*return*/, {
                                status: 'success',
                                candidate_id: candidateId,
                                summary: extraction.summary
                            }];
                }
            });
        });
    };
    return ProcessSnapshotExecutor;
}());
exports.ProcessSnapshotExecutor = ProcessSnapshotExecutor;
exports.default = ProcessSnapshotExecutor;
