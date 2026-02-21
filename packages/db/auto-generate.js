const { spawn } = require('child_process');

const p = spawn('npm', ['run', 'generate'], {
    cwd: '/Users/slichti/GitHub/studio-platform-dev/packages/db',
    stdio: ['pipe', 'pipe', 'pipe']
});

p.stdout.on('data', (d) => {
    const str = d.toString();
    process.stdout.write(str);
    if (str.includes('Is') && str.includes('created or renamed')) {
        setTimeout(() => {
            p.stdin.write('\r\n');
        }, 500);
    }
});

p.stderr.on('data', (d) => {
    process.stderr.write(d);
});

p.on('close', (code) => {
    process.exit(code);
});
