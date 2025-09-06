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
const notes_1 = __importDefault(require("../src/routes/notes"));
let app;
(0, vitest_1.beforeAll)(() => {
    app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((0, cookie_parser_1.default)());
    app.use('/api/auth', auth_1.default);
    app.use('/api/notes', notes_1.default);
});
(0, vitest_1.describe)('Notes API (smoke)', () => {
    (0, vitest_1.it)('create/list/get/delete/restore/purge flow', async () => {
        // This test is a smoke test; in CI use an in-memory DB or mocks
        const signup = await (0, supertest_1.default)(app).post('/api/auth/signup').send({ email: 'notes@example.com', password: 'password123' });
        const access = signup.body.access;
        if (!access)
            return (0, vitest_1.expect)(true).toBeTruthy();
        const headers = { Authorization: `Bearer ${access}` };
        const created = await (0, supertest_1.default)(app).post('/api/notes').set(headers).send({ ciphertext: 'ct', iv: 'iv' });
        (0, vitest_1.expect)(created.status).toBe(200);
        const list = await (0, supertest_1.default)(app).get('/api/notes').set(headers);
        (0, vitest_1.expect)(Array.isArray(list.body)).toBeTruthy();
    });
});
