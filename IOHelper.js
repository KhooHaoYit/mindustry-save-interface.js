/*
 * IOHelper Class for Interface
 */
const IOHelper = class IOHelper {

	constructor(buffer = Buffer) {
		this.buffer = buffer;
		this.counter = 0;
	}

	reset() {
		this.counter = 0;
    }

    readBoolean () {
		const char = this.readByte();
		if(char < 0) throw new Error('EOFException: Originated at DataInputStream:244');
		return char != 0;
    }
    
	readFloat () {
		const output = this.buffer.readFloatBE(this.counter);
		this.counter += 4;
		return output;
    }
    
	readLong () {
		const output = this.buffer.readBigInt64BE(this.counter);
		this.counter += 8;
		return output;
    }
    
	readFull (size) {
		const output = this.buffer.toString('ascii', this.counter, this.counter + size);
		this.counter += size;
		return output;
    }
    
	readByte () {
		const output = this.buffer.readInt8(this.counter);
		this.counter += 1;
		return output;
    }
    
	readUByte () {
		const output = this.buffer.readUInt8(this.counter);
		this.counter += 1;
		return output;
    }
    
	readInt () {
		const output = this.buffer.readInt32BE(this.counter);
		this.counter += 4;
		return output;
    }
    
	readShort () {
		const output = this.buffer.readInt16BE(this.counter);
		this.counter += 2;
		return output;
    }
    
	readUShort () {
		const output = this.buffer.readUInt16BE(this.counter);
		this.counter += 2;
		return output;
    }
    
	readUTF () {
		const size = this.readShort();
		const output = this.buffer.toString('utf8', this.counter, this.counter + size);
		this.counter += size;
		return output;
    }
    
	readStringMap () {
		const output = {};
		for(let size = this.readShort(); size; --size){
			const key = this.readUTF();
			const value = this.readUTF();
			output[key] = value;
		}		
		return output;
	}
    
    readChunk (callback, isByte = false, ...args) {
		const output = isByte ? this.readUShort() : this.readInt();
		/* Output is kinda useless (returns the length of the data) */
		return callback(...args);
    }

}

module.exports = IOHelper;
