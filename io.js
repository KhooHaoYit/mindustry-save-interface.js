const io = {
	counter: 0,
	buffer: undefined,
	counterReset: () => {
		io.counter = 0;
	},
	bufferSet: buffer => {
		io.buffer = buffer;
	},
	readBoolean: () => {
		const char = io.readByte();
		if(char < 0) throw new Error('EOFException: Originated at DataInputStream:244');
		return char != 0;
	},
	readFloat: () => {
		const output = io.buffer.readFloatBE(io.counter);
		io.counter += 4;
		return output;
	},
	readLong: () => {
		const output = io.buffer.readBigInt64BE(io.counter);
		io.counter += 8;
		return output;
	},
	readFull: (size) => {
		const output = io.buffer.toString('ascii', io.counter, io.counter + size);
		io.counter += size;
		return output;
	},
	readByte: () => {
		const output = io.buffer.readInt8(io.counter);
		io.counter += 1;
		return output;
	},
	readUByte: () => {
		const output = io.buffer.readUInt8(io.counter);
		io.counter += 1;
		return output;
	},
	readInt: () => {
		const output = io.buffer.readInt32BE(io.counter);
		io.counter += 4;
		return output;
	},
	readShort: () => {
		const output = io.buffer.readInt16BE(io.counter);
		io.counter += 2;
		return output;
	},
	readUShort: () => {
		const output = io.buffer.readUInt16BE(io.counter);
		io.counter += 2;
		return output;
	},
	readUTF: () => {
		const size = io.readShort();
		const output = io.buffer.toString('utf8', io.counter, io.counter + size);
		io.counter += size;
		return output;
	},
	readStringMap: () => {
		const output = {};
		for(let size = io.readShort(); size; --size){
			const key = io.readUTF();
			const value = io.readUTF();
			output[key] = value;
		}		
		return output;
	},
	readChunk: (func, isByte = false, ...args) => {
		const output = isByte ? io.readUShort() : io.readInt();
		//Output is kinda useless (Return the length of the data)
		return func(...args);
	}
}

module.exports = io;