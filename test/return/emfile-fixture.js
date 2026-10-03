import {execFileSync} from 'node:child_process';
import process from 'node:process';
import {execa} from '../../index.js';

// Drop the soft limit below the descriptors this process already holds so the
// next spawn fails with EMFILE. Imports run first, while the limit is still high.
execFileSync('prlimit', [`--pid=${process.pid}`, '--nofile=3:']);

const timer = setTimeout(() => {}, 1000);
try {
	await execa(process.execPath, ['--version']);
	console.log('UNEXPECTED_SUCCESS');
	process.exitCode = 2;
} catch (error) {
	const code = error.code ?? error.cause?.code;
	console.log(`caught:${error.name}:${code}`);
	if (error.name !== 'ExecaError' || code !== 'EMFILE') {
		process.exitCode = 3;
	}
} finally {
	clearTimeout(timer);
}
