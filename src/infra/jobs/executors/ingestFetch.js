"use strict";
/**
 * Ingest Fetch Executor (Updated)
 *
 * Fetches content from a URL using the Playwright runner service
 * and creates a snapshot with deterministic ID.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestFetchExecutor = void 0;
var IngestFetchExecutor = /** @class */ (function () {
    function IngestFetchExecutor() {
        this.playwrightRunnerUrl = process.env.PLAYWRIGHT_RUNNER_URL || 'http://localhost:3001';
    }
    IngestFetchExecutor.prototype.execute = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var url, _a, metadata, _b, max_size, response, error, result, db, chainError_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        url = payload.url, _a = payload.metadata, metadata = _a === void 0 ? {} : _a, _b = payload.max_size, max_size = _b === void 0 ? 10 * 1024 * 1024 : _b;
                        if (!url) {
                            throw new Error('URL is required in payload');
                        }
                        console.log("Calling Playwright runner for: ".concat(url));
                        return [4 /*yield*/, fetch("".concat(this.playwrightRunnerUrl, "/fetch"), {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    url: url,
                                    idempotency_key: payload.idempotency_key || Math.random().toString(36),
                                }),
                            })];
                    case 1:
                        response = _c.sent();
                        if (!!response.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, response.json().catch(function () { return ({ error: 'Unknown error' }); })];
                    case 2:
                        error = _c.sent();
                        throw new Error("Playwright runner failed: ".concat(error.error || response.statusText));
                    case 3: return [4 /*yield*/, response.json()];
                    case 4:
                        result = _c.sent();
                        if (!result.snapshot_id) return [3 /*break*/, 8];
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        db = require('../../db/pool').default;
                        return [4 /*yield*/, db.query("INSERT INTO jobs (type, payload, idempotency_key)\n           VALUES ($1, $2, $3)", [
                                'process_snapshot',
                                JSON.stringify({
                                    snapshot_id: result.snapshot_id,
                                    url: result.metadata.final_url || url,
                                    title: result.metadata.title,
                                    ingest_id: payload.idempotency_key // Track lineage
                                }),
                                "process-".concat(result.snapshot_id) // Idempotent per snapshot
                            ])];
                    case 6:
                        _c.sent();
                        console.log("Chained process_snapshot job for ".concat(result.snapshot_id));
                        return [3 /*break*/, 8];
                    case 7:
                        chainError_1 = _c.sent();
                        console.error('Failed to chain process_snapshot job:', chainError_1);
                        return [3 /*break*/, 8];
                    case 8: 
                    // Result contains: { snapshot_id, metadata: { title, url, final_url, status_code, fetched_at } }
                    return [2 /*return*/, {
                            snapshot_id: result.snapshot_id,
                            url: url,
                            final_url: result.metadata.final_url,
                            title: result.metadata.title,
                            status_code: result.metadata.status_code,
                            fetched_at: result.metadata.fetched_at,
                            metadata: result.metadata,
                        }];
                }
            });
        });
    };
    return IngestFetchExecutor;
}());
exports.IngestFetchExecutor = IngestFetchExecutor;
/**
 * Default export
 */
exports.default = IngestFetchExecutor;
