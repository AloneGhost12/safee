"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
(0, vitest_1.test)('simple test to check vitest is working', () => {
    (0, vitest_1.expect)(1 + 1).toBe(2);
    console.log('Simple test passed!');
});
(0, vitest_1.test)('another simple test', async () => {
    const promise = Promise.resolve('hello');
    const result = await promise;
    (0, vitest_1.expect)(result).toBe('hello');
    console.log('Async test passed!');
});
