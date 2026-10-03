import {once} from 'node:events';
import {ChildProcess} from 'node:child_process';
import {
	PassThrough,
	Readable,
	Writable,
	Duplex,
} from 'node:stream';
import {cleanupCustomStreams} from '../stdio/handle.js';
import {makeEarlyError} from './result.js';
import {handleResult} from './reject.js';

// When the subprocess fails to spawn.
// We ensure the returned error is always both a promise and a subprocess.
export const handleEarlyError = ({error, command, escapedCommand, fileDescriptors, options, startTime, verboseInfo}) => {
	cleanupCustomStreams(fileDescriptors);

	const subprocess = new ChildProcess();
	const all = createDummyStreams(subprocess, fileDescriptors);

	const earlyError = makeEarlyError({
		error,
		command,
		escapedCommand,
		fileDescriptors,
		options,
		startTime,
		isSync: false,
	});
	const promise = handleDummyPromise(earlyError, verboseInfo, options);
	return failedSpawnReturn({
		subprocess,
		promise,
		all,
		options,
	});
};

// `child_process.spawn()` can return before the failure is known. EMFILE and
// ENFILE leave `subprocess.stdio` undefined and emit `error` on the next tick.
// Spreading `stdio` throws first, and the real error is then unhandled.
export const handleStdioLessSpawn = ({subprocess, command, escapedCommand, fileDescriptors, options, startTime, verboseInfo}) => {
	cleanupCustomStreams(fileDescriptors);

	const returned = new ChildProcess();
	const all = createDummyStreams(returned, fileDescriptors);
	const promise = once(subprocess, 'error').then(([error]) => {
		const earlyError = makeEarlyError({
			error,
			command,
			escapedCommand,
			fileDescriptors,
			options,
			startTime,
			isSync: false,
		});
		return handleResult(earlyError, verboseInfo, options);
	});
	return failedSpawnReturn({
		subprocess: returned,
		promise,
		all,
		options,
	});
};

const failedSpawnReturn = ({subprocess, promise, all, options}) => ({
	subprocess,
	promise,
	all: options.all ? all : undefined,
	convertedStreams: {
		readable,
		writable,
		duplex,
		readableStream,
		writableStream,
		transformStream,
		iterable,
		[Symbol.asyncIterator]: iterable,
	},
});

const createDummyStreams = (subprocess, fileDescriptors) => {
	const stdin = createDummyStream();
	const stdout = createDummyStream();
	const stderr = createDummyStream();
	const extraStdio = Array.from({length: fileDescriptors.length - 3}, createDummyStream);
	const all = createDummyStream();
	const stdio = [stdin, stdout, stderr, ...extraStdio];
	Object.assign(subprocess, {
		stdin,
		stdout,
		stderr,
		stdio,
	});
	return all;
};

const createDummyStream = () => {
	const stream = new PassThrough();
	stream.end();
	return stream;
};

const readable = () => new Readable({read() {}});
const writable = () => new Writable({write() {}});
const duplex = () => new Duplex({read() {}, write() {}});
const readableStream = () => Readable.toWeb(readable());
const writableStream = () => Writable.toWeb(writable());
const transformStream = () => Duplex.toWeb(duplex());
const iterable = async function * () {};

const handleDummyPromise = async (error, verboseInfo, options) => handleResult(error, verboseInfo, options);
