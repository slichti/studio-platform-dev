import { execSync } from 'child_process';

const command = `npx wrangler d1 execute studio-platform-db --remote --command "SELECT id, email FROM users LIMIT 3"`;
const output = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

console.log('=== RAW OUTPUT ===');
console.log(output);
console.log('\n=== LINES ===');
output.split('\n').forEach((line, idx) => {
    console.log(`${idx}: ${JSON.stringify(line)}`);
});
