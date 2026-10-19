const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const jdk = path.join(process.env.LOCALAPPDATA || '', 'unite-build', 'jdk-21.0.12.1+1');
const sdk = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const java = path.join(jdk, 'bin', 'java.exe');

if (!fs.existsSync(java)) {
  console.error('JDK 21 was not found at ' + jdk);
  process.exit(1);
}

const env = Object.assign({}, process.env, {
  JAVA_HOME: jdk,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk
});

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status || 1);
}

run('node', ['scripts/sync-web.js'], root);
run('npx', ['cap', 'sync', 'android'], root);
run('gradlew.bat', ['assembleDebug', '--no-daemon'], path.join(root, 'android'));

const apk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
console.log('Debug APK: ' + apk);
