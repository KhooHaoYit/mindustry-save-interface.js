/*
 * IOHelper Class for Interface
 */
'use strict';
const IOHelper = class IOHelper {

    constructor(buffer = Buffer.alloc(0)) {
        this.buffer = buffer;
        this.counter = 0;
        this.unused = 0;
    }

    reset() {
        this.counter = 0;
    }

    get bufferUsed() {
        return this.buffer.subarray(0, this.buffer.length - this.unused);
    }

    bufferSet(buffer){
        this.unused = 0;
        this.buffer = buffer;
    }

    bufferClear(preAlloc){
        this.unused = preAlloc;
        this.buffer = Buffer.alloc(preAlloc);
    }

    allocate(size) {
        this.unused += size;
        this.buffer = Buffer.concat([this.buffer, Buffer.alloc(size)]);
    }

    readBoolean () {
        const char = this.readByte();
        if(char < 0) throw new Error('EOFException: Originated at DataInputStream:244');
        return char != 0;
    }

    writeBoolean (value) {
        const unused = this.unused;
        if(unused >= 1){
            this.buffer.writeUInt8(value ? true : false, this.buffer.length - unused);
            this.unused -= 1;
        }
        else {
            this.buffer = Buffer.concat([
                this.bufferUsed,
                Buffer.from([value ? true : false])
            ]);
            this.unused = 0;
        }
    }

    readByte () {
        const output = this.buffer.readInt8(this.counter);
        this.counter += 1;
        return output;
    }

    writeByte (value) {
        const unused = this.unused;
        if(unused >= 1){
            this.buffer.writeInt8(value, this.buffer.length - unused);
            this.unused -= 1;
        }
        else{
            if(value > 0x7f)
                throw new Error(`Overflow, expected value below ${0x80}; Actual: ${value}`);
            if(value < -0x7f)
                throw new Error(`Underflow, expected value above ${-0x80}; Actual: ${value}`);
            const temp = new Uint8Array(1);
            temp[0] = value;
            this.buffer = Buffer.concat([
                this.bufferUsed,
                temp
            ]);
            this.unused = 0;
        }
    }

    readUByte () {
        const output = this.buffer.readUInt8(this.counter);
        this.counter += 1;
        return output;
    }

    writeUByte (value) {
        const unused = this.unused;
        if(unused >= 1){
            this.buffer.writeUInt8(value, this.buffer.length - unused);
            this.unused -= 1;
        }
        else{
            if(value > 0xff)
                throw new Error(`Overflow, expected value below ${0x100}; Actual: ${value}`);
            if(value < 0)
                throw new Error(`Underflow, expected value above -1; Actual: ${value}`);
            const temp = new Uint8Array(1);
            temp[0] = value;
            this.buffer = Buffer.concat([
                this.bufferUsed,
                temp
            ]);
            this.unused = 0;
        }
    }

    readShort () {
        const output = this.buffer.readInt16BE(this.counter);
        this.counter += 2;
        return output;
    }

    writeShort (value) {
        const unused = this.unused;
        if(unused >= 2){
            this.buffer.writeInt16BE(value, this.buffer.length - unused);
            this.unused -= 2;
        }
        else{
            if(value > 0x7fffn)
                throw new Error(`Overflow, expected value below ${0x8000n}; Actual: ${value}`);
            if(value < -0x7fffn)
                throw new Error(`Underflow, expected value above ${-0x8000n}; Actual: ${value}`);
            let temp = new Int16Array(1);
            temp[0] = value;
            temp = new Uint8Array(temp.buffer);
            temp.reverse();
            this.buffer = Buffer.concat([
                this.bufferUsed,
                temp
            ]);
            this.unused = 0;
        }
    }

    readUShort () {
        const output = this.buffer.readUInt16BE(this.counter);
        this.counter += 2;
        return output;
    }

    writeUShort (value) {
        const unused = this.unused;
        if(unused >= 2){
            this.buffer.writeUInt16BE(value, this.buffer.length - unused);
            this.unused -= 2;
        }
        else{
            if(value > 0xffffn)
                throw new Error(`Overflow, expected value below ${0x10000n}; Actual: ${value}`);
            if(value < 0)
                throw new Error(`Underflow, expected value above -1; Actual: ${value}`);
            let temp = new Uint16Array(1);
            temp[0] = value;
            temp = new Uint8Array(temp.buffer);
            temp.reverse();
            this.buffer = Buffer.concat([
                this.bufferUsed,
                temp
            ]);
            this.unused = 0;
        }
    }

    readInt () {
        const output = this.buffer.readInt32BE(this.counter);
        this.counter += 4;
        return output;
    }

    writeInt (value) {
        const unused = this.unused;
        if(unused >= 4){
            this.buffer.writeInt32BE(value, this.buffer.length - unused);
            this.unused -= 4;
        }
        else{
            if(value > 0x7fffffffn)
                throw new Error(`Overflow, expected value below ${0x80000000n}; Actual: ${value}`);
            if(value < -0x7fffffffn)
                throw new Error(`Underflow, expected value above ${-0x80000000n}; Actual: ${value}`);
            let temp = new Int32Array(1);
            temp[0] = value;
            temp = new Uint8Array(temp.buffer);
            temp.reverse();
            this.buffer = Buffer.concat([
                this.bufferUsed,
                temp
            ]);
            this.unused = 0;
        }
    }

    readUInt () {
        const output = this.buffer.readUInt32BE(this.counter);
        this.counter += 4;
        return output;
    }

    writeUInt (value) {
        const unused = this.unused;
        if(unused >= 4){
            this.buffer.writeUInt32BE(value, this.buffer.length - unused);
            this.unused -= 4;
        }
        else{
            if(value > 0xffffffffn)
                throw new Error(`Overflow, expected value below ${0x100000000n}; Actual: ${value}`);
            if(value < 0)
                throw new Error(`Underflow, expected value above -1; Actual: ${value}`);
            let temp = new Uint32Array(1);
            temp[0] = value;
            temp = new Uint8Array(temp.buffer);
            temp.reverse();
            this.buffer = Buffer.concat([
                this.bufferUsed,
                temp
            ]);
            this.unused = 0;
        }
    }

    readLong () {
        const output = this.buffer.readBigInt64BE(this.counter);
        this.counter += 8;
        return output;
    }

    writeLong (value) {
        const unused = this.unused;
        if(unused >= 8){
            this.buffer.writeBigInt64BE(value, this.buffer.length - unused);
            this.unused -= 8;
        }
        else {
            if(value > 0x7fffffffffffffffn)
                throw new Error(`Overflow, expected value below ${0x8000000000000000n}; Actual: ${value}`);
            if(value < -0x7fffffffffffffffn)
                throw new Error(`Underflow, expected value above ${-0x8000000000000000n}; Actual: ${value}`);
            let temp = new BigInt64Array(1);
            temp[0] = value;
            temp = new Uint8Array(temp.buffer);
            temp.reverse();
            this.buffer = Buffer.concat([
                this.bufferUsed,
                temp
            ]);
            this.unused = 0;
        }
    }

    readULong () {
        const output = this.buffer.readBigUInt64BE(this.counter);
        this.counter += 8;
        return output;
    }

    writeULong (value) {
        const unused = this.unused;
        if(unused >= 8){
            this.buffer.writeBigUInt64BE(value, this.buffer.length - unused);
            this.unused -= 8;
        }
        else {
            if(value > 0xffffffffffffffffn)
                throw new Error(`Overflow, expected value below ${0x10000000000000000n}; Actual: ${value}`);
            if(value < 0)
                throw new Error(`Underflow, expected value above -1; Actual: ${value}`);
            let temp = new BigUInt64Array(1);
            temp[0] = value;
            temp = new Uint8Array(temp.buffer);
            temp.reverse();
            this.buffer = Buffer.concat([
                this.bufferUsed,
                temp
            ]);
            this.unused = 0;
        }
    }

    readFloat () {
        const output = this.buffer.readFloatBE(this.counter);
        this.counter += 4;
        return output;
    }

    writeFloat (value) {
        const unused = this.unused;
        if(unused >= 4){
            this.buffer.writeFloatBE(value, this.buffer.length - unused);
            this.unused -= 4;
        }
        else {
            let temp = new Float32Array(1);
            temp[0] = value;
            temp = new Uint8Array(temp.buffer);
            temp.reverse();
            this.buffer = Buffer.concat([
                this.bufferUsed,
                temp
            ]);
            this.unused = 0;
        }
    }

    readDouble () {
        const output = this.buffer.readDoubleBE(this.counter);
        this.counter += 8;
        return output;
    }

    writeDouble (value) {
        const unused = this.unused;
        if(unused >= 8){
            this.buffer.writeDoubleBE(value, this.buffer.length - unused);
            this.unused -= 8;
        }
        else {
            let temp = new Float64Array(1);
            temp[0] = value;
            temp = new Uint8Array(temp.buffer);
            temp.reverse();
            this.buffer = Buffer.concat([
                this.bufferUsed,
                temp
            ]);
            this.unused = 0;
        }
    }

    readFull (size) {
        const output = this.buffer.toString('utf8', this.counter, this.counter + size);
        this.counter += size;
        return output;
    }

    writeFull (value) {
        const unused = this.unused;
        if(unused >= value.length){
            this.buffer.write(value, this.buffer.length - unused);
            this.unused -= value.length;
        }
        else{
            this.buffer = Buffer.concat([
                this.bufferUsed,
                Buffer.from(value, 'utf8')
            ]);
            this.unused = 0;
        }
    }

    readUTF () {
        const size = this.readShort();
        const output = this.readFull(size);
        return output;
    }

    writeUTF (value) {
        this.writeShort(value.length);
        this.writeFull(value);
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

    writeStringMap (value) {
        this.writeShort(Object.keys(value).length);
        for(const key in value){
            this.writeUTF(key);
            this.writeUTF(value[key]);
        }
    }

    readChunk (callbacks, isByte = false, ...args) {
        const size = isByte ? this.readUShort() : this.readInt();
        const beforeCounter = this.counter;
        let output = {};

        if(Array.isArray(callbacks))callbacks.forEach(callback => {
            output = {
                ...output,
                ...callback(...args)
            }
        });
        else output = callbacks(...args);

        if(beforeCounter + size != this.counter)
            console.log(new Error(`SaveFileReader.java:29\tError reading region, read length mismatch. Expected: ${size}; Actual: ${this.counter - beforeCounter}`));
        return output;
    }

    writeChunk (callbacks, isByte = false, ...args) {
        const before = this.bufferUsed.length;
        if(isByte) this.writeUShort(0);
        else this.writeInt(0);

        if(Array.isArray(callbacks))callbacks.forEach(callback => callback(...args));
        else callbacks(...args);

        if(isByte) this.buffer.writeUInt16BE(this.bufferUsed.length - before - 2, before);
        else this.buffer.writeInt32BE(this.bufferUsed.length - before - 4, before);
    }

}

module.exports = IOHelper;
