"use strict";
/**
 * Database Connection Pool
 *
 * Implements connection pooling strategy for serverless environment.
 * See: docs/specs/db_pooling.md
 *
 * Key features:
 * - Environment-specific pool sizes (dev: 10, production: 5)
 * - Singleton pattern to prevent multiple pools
 * - Query logging in development
 * - Health metrics for monitoring
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.closePool = exports.testConnection = exports.getPoolMetrics = exports.getClient = exports.query = exports.getPool = void 0;
var pg_1 = require("pg");
/**
 * Get pool configuration based on environment
 */
var getPoolConfig = function () {
    var env = process.env.NODE_ENV || 'development';
    if (!process.env.NEON_DATABASE_URL) {
        throw new Error('NEON_DATABASE_URL environment variable is not set');
    }
    var baseConfig = {
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: env !== 'test' ? { rejectUnauthorized: false } : undefined,
    };
    // Environment-specific configurations
    // See: docs/specs/db_pooling.md for rationale
    var envConfigs = {
        development: {
            max: 10, // More connections for local testing
            idleTimeoutMillis: 60000, // 60s
            connectionTimeoutMillis: 5000, // 5s
        },
        staging: {
            max: 5,
            idleTimeoutMillis: 30000, // 30s
            connectionTimeoutMillis: 3000, // 3s
        },
        production: {
            max: 5, // CRITICAL: Keep low for serverless
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 3000,
        },
        test: {
            max: 2,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 2000,
        },
    };
    return __assign(__assign({}, baseConfig), envConfigs[env]);
};
/**
 * Singleton pool instance
 */
var pool = null;
/**
 * Get or create the database connection pool
 */
var getPool = function () {
    if (!pool) {
        var config = getPoolConfig();
        pool = new pg_1.Pool(config);
        // Error handler - log unexpected errors
        pool.on('error', function (err) {
            console.error('Unexpected pool error:', err);
            // Don't exit process here - let the app recover
        });
        // Connection logging (development only)
        if (process.env.NODE_ENV === 'development') {
            pool.on('connect', function (client) {
                console.log('New database connection established');
            });
            pool.on('remove', function () {
                console.log('Database connection removed from pool');
            });
        }
        console.log("Database pool initialized (env: ".concat(process.env.NODE_ENV, ", max: ").concat(config.max, ")"));
    }
    return pool;
};
exports.getPool = getPool;
/**
 * Execute a query with automatic connection management
 *
 * @param text SQL query text
 * @param params Query parameters
 * @returns Query result
 */
var query = function (text, params) { return __awaiter(void 0, void 0, void 0, function () {
    var pool, start, result, duration, error_1, duration;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                pool = (0, exports.getPool)();
                start = Date.now();
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, pool.query(text, params)];
            case 2:
                result = _a.sent();
                duration = Date.now() - start;
                // Log queries in development
                if (process.env.NODE_ENV === 'development') {
                    console.log('Query executed:', {
                        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                        duration: "".concat(duration, "ms"),
                        rows: result.rowCount,
                    });
                }
                return [2 /*return*/, result];
            case 3:
                error_1 = _a.sent();
                duration = Date.now() - start;
                console.error('Query error:', {
                    text: text.substring(0, 100),
                    duration: "".concat(duration, "ms"),
                    error: error_1 instanceof Error ? error_1.message : 'Unknown error',
                });
                throw error_1;
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.query = query;
/**
 * Get a client from the pool for transactions
 * IMPORTANT: Must call client.release() when done
 *
 * @example
 * const client = await getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('INSERT INTO ...');
 *   await client.query('COMMIT');
 * } catch (e) {
 *   await client.query('ROLLBACK');
 *   throw e;
 * } finally {
 *   client.release();
 * }
 */
var getClient = function () { return __awaiter(void 0, void 0, void 0, function () {
    var pool;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                pool = (0, exports.getPool)();
                return [4 /*yield*/, pool.connect()];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.getClient = getClient;
var getPoolMetrics = function () {
    var pool = (0, exports.getPool)();
    return {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
    };
};
exports.getPoolMetrics = getPoolMetrics;
/**
 * Test database connectivity
 * Returns latency in milliseconds
 */
var testConnection = function () { return __awaiter(void 0, void 0, void 0, function () {
    var start;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                start = Date.now();
                return [4 /*yield*/, (0, exports.query)('SELECT 1 as test')];
            case 1:
                _a.sent();
                return [2 /*return*/, Date.now() - start];
        }
    });
}); };
exports.testConnection = testConnection;
/**
 * Graceful shutdown - close all connections
 * Call this when shutting down the application
 */
var closePool = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!pool) return [3 /*break*/, 2];
                return [4 /*yield*/, pool.end()];
            case 1:
                _a.sent();
                pool = null;
                console.log('Database pool closed');
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); };
exports.closePool = closePool;
/**
 * Default export for convenience
 */
exports.default = {
    getPool: exports.getPool,
    query: exports.query,
    getClient: exports.getClient,
    getPoolMetrics: exports.getPoolMetrics,
    testConnection: exports.testConnection,
    closePool: exports.closePool,
};
