module.exports = {
  test: {
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html"],
      include: ["src/nicman-rules.js"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
};
