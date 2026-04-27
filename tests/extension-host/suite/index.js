async function run() {
  const { runExtensionHostSmoke } = require('./extension.integration.test');
  await runExtensionHostSmoke();
}

module.exports = {
  run
};
