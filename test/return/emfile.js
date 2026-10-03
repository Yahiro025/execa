import process from 'node:process';
import test from 'ava';
import {execa} from '../../index.js';

const testLinux = process.platform === 'linux' ? test : test.skip;

testLinux('async EMFILE rejects instead of throwing and crashing', async t => {
	const {exitCode, stdout} = await execa('node', ['test/return/emfile-fixture.js']);
	t.is(exitCode, 0);
	t.is(stdout, 'caught:ExecaError:EMFILE');
});
