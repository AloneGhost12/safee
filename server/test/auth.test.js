"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_1 = __importDefault(require("../src/routes/auth"));
const errors_1 = require("../src/middleware/errors");
let app;
(0, vitest_1.beforeAll)(() => {
    app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((0, cookie_parser_1.default)());
    app.use('/api/auth', auth_1.default);
    app.use(errors_1.errorHandler);
});
(0, vitest_1.describe)('Auth endpoints (smoke)', () => {
    (0, vitest_1.it)('signup returns access and sets cookie', async () => {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';
        const res = await (0, supertest_1.default)(app).post('/api/auth/signup').send({ email, password });
        console.log('Signup response status:', res.status);
        console.log('Signup response body:', res.body);
        console.log('Signup response headers:', res.headers);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(typeof res.body.access).toBe('string');
        (0, vitest_1.expect)(res.headers['set-cookie']).toBeTruthy();
    });
    // Run the same test multiple times as requested
    (0, vitest_1.it)('signup returns access and sets cookie - run 2', async () => {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';
        const res = await (0, supertest_1.default)(app).post('/api/auth/signup').send({ email, password });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(typeof res.body.access).toBe('string');
        (0, vitest_1.expect)(res.headers['set-cookie']).toBeTruthy();
    });
    (0, vitest_1.it)('signup returns access and sets cookie - run 3', async () => {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';
        const res = await (0, supertest_1.default)(app).post('/api/auth/signup').send({ email, password });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(typeof res.body.access).toBe('string');
        (0, vitest_1.expect)(res.headers['set-cookie']).toBeTruthy();
    });
    (0, vitest_1.it)('signup returns access and sets cookie - run 4', async () => {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';
        const res = await (0, supertest_1.default)(app).post('/api/auth/signup').send({ email, password });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(typeof res.body.access).toBe('string');
        (0, vitest_1.expect)(res.headers['set-cookie']).toBeTruthy();
    });
    (0, vitest_1.it)('signup returns access and sets cookie - run 5', async () => {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';
        const res = await (0, supertest_1.default)(app).post('/api/auth/signup').send({ email, password });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(typeof res.body.access).toBe('string');
        (0, vitest_1.expect)(res.headers['set-cookie']).toBeTruthy();
    });
});
