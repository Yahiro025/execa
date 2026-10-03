import process from 'node:process';
import test from 'ava';
import {execa} from '../../index.js';

const isLinux = process.platform === 'linux';

// Lowering the limit inside this process would also break the test runner, so the
// reproduction runs in a child that drops its own soft limit after startup.
test('execa() rejects EMFILE instead of crashing on an unhandled error', async t => {
	const indexUrl = new URL('../../index.js', import.meta.url).href;
	const script = `
		import {execFileSync} from 'node:child_process';
		import {execa} from ${JSON.stringify(indexUrl)};
		execFileSync('prlimit', ['--pid=' + process.pid, '--nofile=3:']);
		try {
			await execa('node', ['--version']);
			console.log('RESULT resolved');
		} catch (error) {
			console.log('RESULT ' + error.name + ' ' + error.code);
		}
		await new Promise(resolve => {
			setTimeout(resolve, 50);
		});
		console.log('RESULT still-running');
	`;
	const {stdout, exitCode} = await execa(process.execPath, ['--input-type=module', '-e', script]);
	t.is(exitCode, 0);
	t.true(stdout.includes('RESULT ExecaError EMFILE'));
	t.false(stdout.includes('RESULT resolved'));
	t.true(stdout.includes('RESULT still-running'));
}, {skip: isLinux ? false : 'prlimit is required to reproduce EMFILE'});
