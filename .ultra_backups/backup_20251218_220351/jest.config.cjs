module.exports = {
  testEnvironment: "jsdom",
  transform: { "^.+\\.(js|jsx|ts|tsx)$": "babel-jest" },
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleFileExtensions: ["js","jsx","ts","tsx","json","node"]
};
