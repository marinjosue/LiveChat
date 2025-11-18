module.exports = {
  testEnvironment: "node",
  verbose: true,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  moduleNameMapper: {
    "^bcrypt$": "<rootDir>/__mocks__/bcrypt.js"
  }
};
