"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
// Simple auth route for testing
const simpleAuthRoutes = express_1.default.Router();
simpleAuthRoutes.post('/signup', (req, res) => {
    const { email, password } = req.body;
    // Simple validation
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    // Mock successful signup
    const access = 'mock-jwt-token-' + Date.now();
    const refresh = 'mock-refresh-token-' + Date.now();
    res.cookie('pv_sess', refresh, { httpOnly: true });
    res.json({ access });
});
let app;
(0, vitest_1.beforeAll)(() => {
    app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((0, cookie_parser_1.default)());
    app.use('/api/auth', simpleAuthRoutes);
});
(0, vitest_1.describe)('Simple Auth Test', () => {
    (0, vitest_1.it)('Test 1: signup returns access and sets cookie', async () => {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';
        const res = await (0, supertest_1.default)(app).post('/api/auth/signup').send({ email, password });
        console.log('Test 1 - Status:', res.status);
        console.log('Test 1 - Body:', res.body);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(typeof res.body.access).toBe('string');
        (0, vitest_1.expect)(res.headers['set-cookie']).toBeTruthy();
    });
    (0, vitest_1.it)('Test 2: signup returns access and sets cookie', async () => {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';
        const res = await (0, supertest_1.default)(app).post('/api/auth/signup').send({ email, password });
        console.log('Test 2 - Status:', res.status);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(typeof res.body.access).toBe('string');
        (0, vitest_1.expect)(res.headers['set-cookie']).toBeTruthy();
    });
    (0, vitest_1.it)('Test 3: signup returns access and sets cookie', async () => {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';
        const res = await (0, supertest_1.default)(app).post('/api/auth/signup').send({ email, password });
        console.log('Test 3 - Status:', res.status);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(typeof res.body.access).toBe('string');
        (0, vitest_1.expect)(res.headers['set-cookie']).toBeTruthy();
    });
    (0, vitest_1.it)('Test 4: signup returns access and sets cookie', async () => {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';
        const res = await (0, supertest_1.default)(app).post('/api/auth/signup').send({ email, password });
        console.log('Test 4 - Status:', res.status);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(typeof res.body.access).toBe('string');
        (0, vitest_1.expect)(res.headers['set-cookie']).toBeTruthy();
    });
    (0, vitest_1.it)('Test 5: signup returns access and sets cookie', async () => {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';
        const res = await (0, supertest_1.default)(app).post('/api/auth/signup').send({ email, password });
        console.log('Test 5 - Status:', res.status);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(typeof res.body.access).toBe('string');
        (0, vitest_1.expect)(res.headers['set-cookie']).toBeTruthy();
    });
});
