"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
var dotenv = __importStar(require("dotenv"));
// Load env vars FIRST
dotenv.config({ path: './frontend/.env.local' });
console.log('Env loaded. DB URL exists:', !!process.env.NEON_DATABASE_URL);
var pool_1 = __importDefault(require("./infra/db/pool"));
var ingestFetch_1 = require("./infra/jobs/executors/ingestFetch");
var process_snapshot_1 = require("./reality/actions/process_snapshot");
// MOCKING for Verification
// Ensure we don't crash if keys are missing for this logic test
if (!process.env.PINECONE_API_KEY)
    process.env.PINECONE_API_KEY = 'mock-key';
if (!process.env.PINECONE_INDEX_HOST)
    process.env.PINECONE_INDEX_HOST = 'mock-host';
if (!process.env.HUGGINGFACE_API_KEY)
    process.env.HUGGINGFACE_API_KEY = 'mock-key';
var batcher_1 = require("./reality/embeddings/batcher");
// Mock Batcher methods to avoid external calls
batcher_1.EmbeddingBatcher.prototype.initialize = function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    console.log('   (Mock) Batcher initialized');
    return [2 /*return*/];
}); }); };
batcher_1.EmbeddingBatcher.prototype.enqueue = function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    console.log('   (Mock) Job enqueued');
    return [2 /*return*/];
}); }); };
var hf_client_1 = require("./infra/llm/hf_client");
// Mock HF Client to avoid external calls and auth errors
hf_client_1.HuggingFaceClient.prototype.generateStructured = function (prompt, snapshot_ids) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, ({
                summary: 'Mock Event Summary: Phase 6 Verification',
                confidence: 0.95,
                snapshot_ids: snapshot_ids,
                sources: ['mock-source-url'],
                schema_version: 'v1'
            })];
    });
}); };
function runVerification() {
    return __awaiter(this, void 0, void 0, function () {
        var latency, e_1, ingestExecutor, ingestPayload, snapshotId, processExecutor, processResult, e_2, candidateId, candidateRes, candidate, marketId, marketRes, mRes, userId, auditRes, newMarket, eventRes, eventId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🚀 Starting Phase 6 Verification (Reality Loop)...\n');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, pool_1.default.testConnection()];
                case 2:
                    latency = _a.sent();
                    console.log("   \u2705 DB Connection verified (".concat(latency, "ms)"));
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    console.error('   ❌ DB Connection FAILED:', e_1);
                    process.exit(1);
                    return [3 /*break*/, 4];
                case 4:
                    // 1. Simulate Ingest Job Execution
                    console.log('1️⃣  Simulating Ingest Job...');
                    ingestExecutor = new ingestFetch_1.IngestFetchExecutor();
                    ingestPayload = {
                        url: 'https://example.com/phase6-test',
                        idempotency_key: "verify-phase6-".concat(Date.now()),
                        metadata: { title: 'Phase 6 Verification Test' }
                    };
                    snapshotId = require('crypto').createHash('sha256').update(ingestPayload.url + Date.now()).digest('hex');
                    return [4 /*yield*/, pool_1.default.query("INSERT INTO snapshots (snapshot_id, url, fetched_at, object_store_path, content_type)\n     VALUES ($1, $2, NOW(), $3, 'text/html')\n     ON CONFLICT (snapshot_id) DO NOTHING", [snapshotId, ingestPayload.url, 'mock/path/to/blob'])];
                case 5:
                    _a.sent();
                    console.log("   \u2705 Mock Snapshot created: ".concat(snapshotId));
                    // 2. Run Process Snapshot Executor
                    console.log('\n2️⃣  Running Process Snapshot Executor...');
                    processExecutor = new process_snapshot_1.ProcessSnapshotExecutor();
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, processExecutor.execute({
                            snapshot_id: snapshotId,
                            url: ingestPayload.url,
                            title: ingestPayload.metadata.title,
                            ingest_id: ingestPayload.idempotency_key
                        })];
                case 7:
                    processResult = _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    e_2 = _a.sent();
                    console.error('FATAL ERROR in processExecutor.execute:');
                    console.error(e_2);
                    throw e_2;
                case 9:
                    if (processResult.status !== 'success') {
                        throw new Error("Process Snapshot failed: ".concat(JSON.stringify(processResult)));
                    }
                    candidateId = processResult.candidate_id;
                    console.log("   \u2705 Candidate Event created: ".concat(candidateId));
                    console.log("      Summary: ".concat(processResult.summary));
                    return [4 /*yield*/, pool_1.default.query("SELECT * FROM candidate_events WHERE candidate_id = $1", [candidateId])];
                case 10:
                    candidateRes = _a.sent();
                    candidate = candidateRes.rows[0];
                    if (candidate.status !== 'pending') {
                        throw new Error("Expected status 'pending', got '".concat(candidate.status, "'"));
                    }
                    console.log('   ✅ Candidate status verified: pending');
                    // 4. Simulate Admin Approval
                    console.log('\n3️⃣  Simulating Admin Approval...');
                    return [4 /*yield*/, pool_1.default.query("UPDATE candidate_events SET status = 'approved' WHERE candidate_id = $1", [candidateId])];
                case 11:
                    _a.sent();
                    console.log('   ✅ Candidate approved');
                    // 5. Run Finalizer (Single Pass)
                    console.log('\n4️⃣  Running Finalizer...');
                    return [4 /*yield*/, pool_1.default.query("SELECT market_id FROM markets LIMIT 1")];
                case 12:
                    marketRes = _a.sent();
                    if (!(marketRes.rows.length === 0)) return [3 /*break*/, 19];
                    return [4 /*yield*/, pool_1.default.query("\n        INSERT INTO users (email, password_hash, role) VALUES ('system@test.com', 'hash', 'admin') ON CONFLICT DO NOTHING RETURNING user_id\n      ")];
                case 13:
                    mRes = _a.sent();
                    userId = void 0;
                    if (!(mRes.rows.length > 0)) return [3 /*break*/, 14];
                    userId = mRes.rows[0].user_id;
                    return [3 /*break*/, 16];
                case 14: return [4 /*yield*/, pool_1.default.query("SELECT user_id FROM users LIMIT 1")];
                case 15:
                    userId = (_a.sent()).rows[0].user_id;
                    _a.label = 16;
                case 16: return [4 /*yield*/, pool_1.default.query("\n        INSERT INTO audit_event (action, actor_type, actor_id) VALUES ('create_market', 'system', $1) RETURNING audit_id\n      ", [userId])];
                case 17:
                    auditRes = _a.sent();
                    return [4 /*yield*/, pool_1.default.query("\n        INSERT INTO markets (symbol, type, created_by, human_approval_audit_id, title)\n        VALUES ('TEST-MKT', 'technology', $1, $2, 'Test Market')\n        RETURNING market_id\n      ", [userId, auditRes.rows[0].audit_id])];
                case 18:
                    newMarket = _a.sent();
                    marketId = newMarket.rows[0].market_id;
                    return [3 /*break*/, 20];
                case 19:
                    marketId = marketRes.rows[0].market_id;
                    _a.label = 20;
                case 20: return [4 /*yield*/, pool_1.default.query("INSERT INTO events (market_id, summary, confidence, snapshot_ids, event_type)\n       VALUES ($1, $2, $3, $4, 'news') RETURNING event_id", [marketId, candidate.summary, candidate.confidence, [candidate.snapshot_id]])];
                case 21:
                    eventRes = _a.sent();
                    eventId = eventRes.rows[0].event_id;
                    console.log("   \u2705 Final Event created: ".concat(eventId));
                    // Update Candidate
                    return [4 /*yield*/, pool_1.default.query("UPDATE candidate_events SET status = 'processed' WHERE candidate_id = $1", [candidateId])];
                case 22:
                    // Update Candidate
                    _a.sent();
                    console.log('   ✅ Candidate marked processed');
                    console.log('\n✅ Phase 6 Verification Complete');
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    });
}
runVerification().catch(function (e) {
    console.error(e);
    process.exit(1);
});
