// Runs before each test file, before any app code is imported
process.env.NODE_ENV = "test";
process.env.DB_PATH = ":memory:"; // a fresh in-memory database per test file
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123456";
process.env.JWT_EXPIRES_SECONDS = "3600";