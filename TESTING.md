# Testing Guide

This document provides comprehensive testing guidelines for the Vault project, covering unit tests, integration tests, end-to-end tests, and continuous integration.

## Overview

Our testing strategy includes:
- **Unit Tests**: Testing individual functions and components in isolation
- **Integration Tests**: Testing API endpoints and service interactions
- **End-to-End Tests**: Testing complete user workflows across the full application
- **Security Tests**: Validating security controls and configurations
- **Performance Tests**: Ensuring application performance meets requirements

## Testing Stack

### Frontend Testing
- **Vitest**: Unit testing framework with TypeScript support
- **React Testing Library**: Component testing utilities
- **Playwright**: End-to-end browser testing
- **@vitest/coverage-v8**: Code coverage reporting

### Backend Testing
- **Vitest**: Unit and integration testing
- **Supertest**: HTTP endpoint testing
- **MongoDB Memory Server**: In-memory database for testing
- **@vitest/coverage-v8**: Code coverage reporting

## Test Organization

### Directory Structure
```
client/
├── test/
│   ├── crypto/           # Crypto utility tests
│   │   ├── files.test.ts
│   │   └── index.test.ts
│   └── setup.ts          # Test setup and configuration
├── e2e/
│   ├── complete-workflow.spec.ts  # Full user journey tests
│   ├── test-helpers.ts           # E2E test utilities
│   ├── global-setup.ts           # Global test setup
│   └── global-teardown.ts        # Global test cleanup
└── playwright.config.ts          # Playwright configuration

server/
├── test/
│   ├── routes/          # API route tests
│   │   ├── routes.test.ts
│   │   └── files.test.ts
│   └── setup.ts         # Test setup and configuration
└── vitest.config.ts     # Vitest configuration
```

## Running Tests

### Client Tests

#### Unit Tests
```bash
# Run all unit tests
npm run test:unit

# Run unit tests in watch mode
npm run test:unit:watch

# Run unit tests with coverage
npm run test:coverage

# Run specific test file
npm run test crypto/files.test.ts
```

#### End-to-End Tests
```bash
# Run all e2e tests
npm run test:e2e

# Run e2e tests in headed mode (with browser UI)
npm run test:e2e:headed

# Run e2e tests in debug mode
npm run test:e2e:debug

# Run specific e2e test
npm run test:e2e complete-workflow.spec.ts
```

#### All Tests
```bash
# Run all client tests (unit + e2e)
npm run test:all
```

### Server Tests

#### Unit Tests
```bash
# Run all unit tests
npm run test:unit

# Run unit tests in watch mode
npm run test:unit:watch

# Run unit tests with coverage
npm run test:coverage
```

#### Integration Tests
```bash
# Run integration tests
npm run test:integration
```

#### All Tests
```bash
# Run all server tests
npm run test:all
```

### Security Tests
```bash
# Validate security configuration
npm run security:validate

# Run security audit
npm run security:audit

# Run all security checks
npm run security:check
```

## Test Categories

### 1. Unit Tests

#### Crypto Utilities (`client/test/crypto/`)
- **File Encryption/Decryption**: Tests for secure file handling
- **Key Generation**: Tests for cryptographic key operations
- **Data Validation**: Tests for input validation and error handling

#### API Routes (`server/test/routes/`)
- **Authentication**: Login, registration, 2FA verification
- **Notes Management**: CRUD operations with encryption
- **File Operations**: Upload, download, encryption/decryption
- **Error Handling**: Validation and security error responses

### 2. Integration Tests
- **Database Operations**: MongoDB interactions and data persistence
- **External Services**: S3/R2 and Cloudinary integrations
- **Authentication Flow**: JWT token management and session handling
- **API Workflows**: Multi-step operations across endpoints

### 3. End-to-End Tests
- **Complete User Journey**: Register → Login → 2FA → Notes → Files → Export
- **Authentication Flows**: Login, logout, session management
- **File Management**: Upload, download, encryption, deletion
- **Error Scenarios**: Network failures, validation errors, security violations

## Test Writing Guidelines

### Unit Test Best Practices

1. **Test Structure**: Use Arrange-Act-Assert pattern
```typescript
describe('encryptFileName', () => {
  it('should encrypt and decrypt file names correctly', async () => {
    // Arrange
    const originalName = 'test-file.pdf'
    const password = 'test-password'
    
    // Act
    const encrypted = await encryptFileName(originalName, password)
    const decrypted = await decryptFileName(encrypted, password)
    
    // Assert
    expect(decrypted).toBe(originalName)
  })
})
```

2. **Mocking**: Mock external dependencies
```typescript
vi.mock('../lib/api', () => ({
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
}))
```

3. **Error Testing**: Test error conditions
```typescript
it('should throw error for invalid base64', async () => {
  await expect(decryptFileName('invalid-base64', 'password'))
    .rejects.toThrow('Invalid encrypted name: not valid base64 format')
})
```

### E2E Test Best Practices

1. **Page Object Pattern**: Use helper classes for page interactions
```typescript
class AuthHelper {
  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email)
    await this.page.fill('[data-testid="password"]', password)
    await this.page.click('[data-testid="login-button"]')
  }
}
```

2. **Test Data Management**: Use consistent test data
```typescript
const testUser = {
  email: 'test@example.com',
  password: 'SecurePassword123!',
  name: 'Test User'
}
```

3. **Assertions**: Use specific and meaningful assertions
```typescript
await expect(page.locator('[data-testid="success-message"]'))
  .toContainText('File uploaded successfully')
```

## Coverage Requirements

### Coverage Thresholds

#### Client
- **Global**: 80% coverage (branches, functions, lines, statements)
- **Crypto modules**: 95% coverage (critical security functions)
- **Utilities**: 85% coverage (helper functions)

#### Server
- **Global**: 85% coverage (branches, functions, lines, statements)
- **Routes**: 90% coverage (API endpoints)
- **Utils**: 95% coverage (utility functions)
- **Middleware**: 90% coverage (security middleware)

### Viewing Coverage Reports
```bash
# Generate and open HTML coverage report
npm run test:coverage
open coverage/index.html  # macOS
start coverage/index.html # Windows
```

## Continuous Integration

### GitHub Actions Workflow

Our CI pipeline includes:

1. **Unit Tests**: Run all unit tests with coverage reporting
2. **Integration Tests**: Test API endpoints and database operations
3. **E2E Tests**: Full browser testing across multiple browsers
4. **Security Tests**: Validate security configurations and audit dependencies
5. **Performance Tests**: Ensure application performance benchmarks
6. **Deployment**: Automated deployment on successful tests

### Running CI Locally
```bash
# Install act (GitHub Actions local runner)
npm install -g @nektos/act

# Run workflow locally
act -P ubuntu-latest=nektos/act-environments-ubuntu:18.04
```

## Debugging Tests

### Unit Test Debugging
```bash
# Run tests in debug mode
npm run test:unit -- --reporter=verbose

# Run specific test with debugging
npm run test crypto/files.test.ts -- --reporter=verbose
```

### E2E Test Debugging
```bash
# Run with browser UI visible
npm run test:e2e:headed

# Run in debug mode with DevTools
npm run test:e2e:debug

# Trace test execution
npm run test:e2e -- --trace on
```

### Common Issues

#### Test Timeouts
- Increase timeout in test configuration
- Check for unresolved promises
- Verify mock implementations return expected values

#### Browser Tests Failing
- Check browser compatibility in `playwright.config.ts`
- Verify test data cleanup between tests
- Check for race conditions in async operations

#### Coverage Issues
- Ensure all branches are tested
- Add tests for error conditions
- Verify mock implementations don't skip code paths

## Best Practices

### Test Organization
1. **Group related tests** in describe blocks
2. **Use descriptive test names** that explain expected behavior
3. **Keep tests independent** - each test should be able to run in isolation
4. **Clean up after tests** - reset state and clear mocks

### Performance
1. **Minimize test setup time** - use beforeAll for expensive operations
2. **Use parallel execution** where possible
3. **Mock external services** to avoid network dependencies
4. **Keep test data minimal** - only create what's needed for the test

### Maintenance
1. **Update tests when APIs change**
2. **Remove obsolete tests** when features are removed
3. **Refactor test helpers** to reduce duplication
4. **Document complex test scenarios**

## Troubleshooting

### Common Test Failures

#### Authentication Tests
- Verify JWT secret configuration in test environment
- Check TOTP secret generation and validation
- Ensure proper session cleanup between tests

#### File Upload Tests
- Mock S3/Cloudinary services properly
- Verify file encryption/decryption in test environment
- Check file size limits and validation

#### Database Tests
- Ensure MongoDB Memory Server is properly initialized
- Verify database cleanup between tests
- Check for proper connection handling

### Getting Help

1. **Check test logs** for detailed error information
2. **Review CI pipeline output** for environment-specific issues
3. **Verify test dependencies** are properly installed
4. **Check mock implementations** match actual service interfaces

## Contributing

When adding new features:

1. **Write tests first** (TDD approach)
2. **Ensure adequate coverage** meets project thresholds
3. **Test error conditions** and edge cases
4. **Update documentation** as needed
5. **Run full test suite** before submitting PR

For questions or issues with testing, please refer to the project documentation or create an issue in the repository.
