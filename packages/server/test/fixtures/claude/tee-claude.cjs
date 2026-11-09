// For real-claude.test.ts only: runs the real `claude` with the given arguments and also copies its output to a file,
// so the test can report usage. usage: node tee-claude.cjs <capture-file> <claude args...>
const spawn = require('cross-spawn');
const fs = require('fs');

const [file, ...args] = process.argv.slice(2);
fs.writeFileSync(`${file}.pid`, String(process.pid));
const log = fs.createWriteStream(file);
const child = spawn('claude', args, { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true });
const done = (code) => log.end(() => process.exit(code ?? 1));
child.stdout.on('data', (d) => {
  log.write(d);
  process.stdout.write(d);
});
child.on('error', () => done(127));
child.on('exit', (code) => setTimeout(() => done(code), 2000).unref());
child.on('close', done);
