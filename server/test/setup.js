"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const mongodb_1 = require("mongodb");
// Mock the database connection for tests
vitest_1.vi.mock('../src/db', () => ({
    connect: vitest_1.vi.fn().mockResolvedValue(undefined),
    disconnect: vitest_1.vi.fn().mockResolvedValue(undefined),
    getDb: vitest_1.vi.fn().mockReturnValue({
        collection: vitest_1.vi.fn().mockReturnValue({
            findOne: vitest_1.vi.fn().mockResolvedValue(null), // Default to no user found
            insertOne: vitest_1.vi.fn().mockResolvedValue({
                insertedId: new mongodb_1.ObjectId(),
                acknowledged: true
            }),
            updateOne: vitest_1.vi.fn().mockResolvedValue({
                matchedCount: 1,
                modifiedCount: 1,
                acknowledged: true
            }),
            deleteOne: vitest_1.vi.fn().mockResolvedValue({
                deletedCount: 1,
                acknowledged: true
            }),
        })
    })
}));
(0, vitest_1.beforeAll)(async () => {
    // Set required environment variables for tests
    process.env.MONGO_URI = 'mongodb://localhost:27017/test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    process.env.SESSION_COOKIE_NAME = 'pv_sess';
});
(0, vitest_1.afterAll)(async () => {
    // Clean up test environment variables
    delete process.env.MONGO_URI;
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.SESSION_COOKIE_NAME;
});
