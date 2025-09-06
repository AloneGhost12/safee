"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const express_1 = __importDefault(require("express"));
const health_1 = __importDefault(require("../src/routes/health"));
let app;
(0, vitest_1.beforeAll)(() => {
    app = (0, express_1.default)();
    app.use('/api', health_1.default);
});
(0, vitest_1.describe)('GET /api/health', () => {
    (0, vitest_1.it)('returns 200 and status ok', async () => {
        const res = await (0, supertest_1.default)(app).get('/api/health');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.status).toBe('ok');
    });
});
