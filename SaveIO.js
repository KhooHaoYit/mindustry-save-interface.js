/*
 * Interface for saves read & write
 */
'use strict';

const util = require('./util.js');
const IOHelper = require('./IOHelper.js');
const mapHandler = require('./mapHandler.js');

var io = new IOHelper();

/* The following has to be heavily tweaked to be converted as a lib and a test file */

const SaveIO = class SaveIO {

    constructor() {
        this.io = io;
    }

    readStat() {
        const output = [];
        for (let amount = io.readByte(); amount; --amount) {
            const id = io.readByte();
            const time = io.readFloat();
            output.push({ id, time });
        }
        return output;
    }

    writeStat(stat) {
        io.writeByte(stat.length);
        stat.forEach(stat => {
            io.writeByte(stat.id);
            io.writeFloat(stat.time);
        });
    }

    readSave() {
        return {
            team: io.readByte(),
            dead: io.readBoolean(),
            x: io.readFloat(),
            y: io.readFloat(),
            xv: io.readByte() / 8,
            yv: io.readByte() / 8,
            rotation: io.readShort() / 2,
            health: io.readShort(),
            itemId: io.readByte(),
            itemAmount: io.readShort(),
            status: this.readStat()
        }
    }

    writeSave(save) {
        io.writeByte(save.team);
        io.writeBoolean(save.dead);
        io.writeFloat(save.x);
        io.writeFloat(save.y);
        io.writeByte(Math.round(save.xv * 8));
        io.writeByte(Math.round(save.yv * 8));
        io.writeShort(Math.round(save.rotation * 2));
        io.writeShort(save.health);
        io.writeByte(save.itemId);
        io.writeShort(save.itemAmount);
        this.writeStat(save.status);
    }

    readHeader() {
        io.reset();
        return io.readFull(4);
    }

    writeHeader() {
        io.writeFull('MSAV');
    }

    readEntities() {
        const output = [];
        for (let groups = io.readByte(); groups; --groups) {
            for (let amount = io.readInt(); amount; --amount) {
                io.readChunk(() => {
                    const typeId = io.readByte();
                    const version = io.readByte();
                    if (output[typeId] === undefined) output[typeId] = [];
                    output[typeId].push({
                        typeId: typeId,
                        version: version,
                    });
                    const at = output[typeId].length - 1;
                    switch (typeId) {
                        case 0:	//BaseUnit.java
                        case 1:
                        case 2:
                        case 4:
                        case 10:
                            output[typeId][at].trait = {
                                info: this.readSave(),
                                type: io.readByte(),
                                spawner: io.readInt()
                            }
                            break;
                        case 15:	//Fire.java
                            output[typeId][at].trait = {
                                loadedPosition: io.readInt(),
                                lifetime: io.readFloat(),
                                time: io.readFloat()
                            }
                            break;
                        case 16:	//Puddle.java
                            output[typeId][at].trait = {
                                loadedPosition: io.readInt(),
                                x: io.readFloat(),
                                y: io.readFloat(),
                                liquidId: io.readByte(),
                                amount: io.readFloat(),
                                generation: io.readByte()
                            }
                            break;
                        case 17:	//Player.java
                            {
                                const local = io.readBoolean();
                                if (local) {
                                    output[typeId][at].trait = {
                                        local: local,
                                        mechId: io.readByte(),
                                        spawner: io.readInt(),
                                        info: this.readSave()
                                    }
                                }
                                else output[typeId][at].trait = { local };
                            }
                            break;
                        default:
                            throw new Error(`Not implemented yet, SaveVersion.java:247, type: ${typeId}`);
                    }
                }, true);
            }
        }
        return output;
    }

    writeEntities(entities) {
        let groups = 0;
        entities.forEach(value => groups += Array.isArray(value));
        io.writeByte(groups);
        entities.forEach(entities => {
            io.writeInt(entities.length);
            entities.forEach(entity => {
                io.writeChunk(entity => {
                    io.writeByte(entity.typeId);
                    io.writeByte(entity.version);
                    const trait = entity.trait;
                    switch (entity.typeId) {
                        case 0:	//BaseUnit.java
                        case 1:
                        case 2:
                        case 4:
                        case 10:
                            this.writeSave(trait.info);
                            io.writeByte(trait.type);
                            io.writeInt(trait.spawner);
                            break;
                        case 15:	//Fire.java
                            io.writeInt(trait.loadedPosition);
                            io.writeFloat(trait.lifetime);
                            io.writeFloat(trait.time);
                            break;
                        case 16:	//Puddle.java
                            io.writeInt(trait.loadedPosition);
                            io.writeFloat(trait.x);
                            io.writeFloat(trait.y);
                            io.writeByte(trait.liquidId);
                            io.writeFloat(trait.amount);
                            io.writeByte(trait.generation);
                            break;
                        case 17:	//Player.java
                            io.writeBoolean(trait.local);
                            if(trait.local){
                                io.writeByte(trait.mechId);
                                io.writeInt(trait.spawner);
                                this.writeSave(trait.info);
                            }
                            break;
                        default:
                            throw new Error(`Not implemented yet, SaveVersion.java:247, type: ${typeId}`);
                    }
                }, true, entity);
            });
        });
    }

    readEntity(items, power, liquids, consume) {
        const output = {
            version: io.readByte(),
            health: io.readUShort()
        }
        const teamRotation = io.readByte();
        output.team = teamRotation >> 4 & 0xf;
        output.rotation = teamRotation & 0xf;
        if (items) {
            output['items'] = [];
            for (let count = io.readByte(); count; --count) {
                output['items'].push({
                    itemId: io.readByte(),
                    itemAmount: io.readInt()
                });
            }
        }
        if (power) {
            const links = [];
            for (let amount = io.readShort(); amount; --amount) links.push(io.readInt());
            let satisfaction = io.readFloat();
            if (satisfaction === NaN || satisfaction === Infinity) satisfaction = 0;
            output['power'] = { links, satisfaction };
        }
        if (liquids) {
            output['liquids'] = [];
            for (let count = io.readByte(); count; --count) {
                output['liquids'].push({
                    liquidId: io.readByte(),
                    amount: io.readFloat()
                });
            }
        }
        if (consume) output['consume'] = io.readBoolean();
        return output;
    }

    /*
    0	item
    1	block
    2	mech
    3	bullet
    4	liquid
    5	status
    6	unit
    7	weather
    8	effect
    9	zone
    10	loadout
    11	typeid
    */
    readContentHeader() {
        const output = [];
        let mapped = io.readByte();
        for (; mapped; --mapped) {
            const type = io.readByte();
            output[type] = [];
            for (let total = io.readShort(); total; --total) {
                const name = io.readUTF();
                output[type].push(name);
            }
        }
        return output;
    }

    writeContentHeader(value) {
        let mapped = 0;
        value.forEach(value => value === undefined || ++mapped);
        io.writeByte(mapped);
        for(const key in value){
            if(value[key] === undefined) continue;
            io.writeByte(key);
            io.writeShort(value[key].length);
            value[key].forEach(name => io.writeUTF(name));
        }
    }

    readMeta() {
        const output = io.readStringMap();
        output.wave = BigInt(output.wave);
        output.build = BigInt(output.build);
        output.width = BigInt(output.width);
        output.height = BigInt(output.height);
        output.saved = BigInt(output.saved);
        output.playtime = BigInt(output.playtime);
        output.wavetime = parseFloat(output.wavetime);
        output.stats = JSON.parse(
            util.replaceAdvanced(output.stats, /[a-zA-Z\-]+(?=[:,{}])/, found => `"${found}"`)
        );
        output.rules = JSON.parse(
            util.replaceAdvanced(output.rules, /[a-zA-Z\-]+(?=[:,{}])/, found => `"${found}"`, ['true', 'false'])
        );
        if (!output.rules.spawns) output.rules.spawns = [
            { "type": "dagger", "end": 10, "scaling": 2 },
            { "type": "crawler", "begin": 4, "end": 13, "scaling": 1.5, "amount": 2 },
            { "type": "wraith", "begin": 12, "end": 16, "scaling": 1 },
            { "type": "dagger", "begin": 11, "spacing": 2, "scaling": 1.7 },
            { "type": "titan", "begin": 7, "end": 30, "spacing": 3, "scaling": 2 },
            { "type": "dagger", "begin": 8, "spacing": 2, "scaling": 1, "amount": 4 },
            { "type": "titan", "begin": 28, "end": 40, "spacing": 3, "scaling": 1 },
            { "type": "titan", "begin": 45, "spacing": 3, "scaling": 2, "effect": 6 },
            { "type": "titan", "begin": 120, "spacing": 2, "scaling": 3, "amount": 5, "effect": 6 },
            { "type": "wraith", "begin": 16, "spacing": 2, "scaling": 1 },
            { "type": "dagger", "begin": 82, "spacing": 3, "scaling": 3, "amount": 4, "effect": 6 },
            { "type": "dagger", "begin": 41, "spacing": 5, "scaling": 3, "effect": 7 },
            { "type": "fortress", "begin": 40, "spacing": 5, "scaling": 2, "amount": 2 },
            { "type": "dagger", "begin": 35, "end": 60, "spacing": 3, "amount": 4, "effect": 6 },
            { "type": "dagger", "begin": 42, "end": 130, "spacing": 3, "amount": 4, "effect": 6 },
            { "type": "ghoul", "begin": 40, "spacing": 2, "scaling": 2, "amount": 2 },
            { "type": "wraith", "begin": 50, "spacing": 5, "scaling": 3, "amount": 4, "effect": 6 },
            { "type": "revenant", "begin": 50, "spacing": 5, "scaling": 3, "amount": 2 },
            { "type": "ghoul", "begin": 53, "spacing": 4, "scaling": 3, "amount": 2 },
            { "type": "eruptor", "begin": 31, "spacing": 3, "scaling": 1, "amount": 4 },
            { "type": "chaos-array", "begin": 41, "spacing": 30, "scaling": 1 },
            { "type": "eradicator", "begin": 81, "spacing": 40, "scaling": 1 },
            { "type": "lich", "begin": 131, "spacing": 40, "scaling": 1 },
            { "type": "ghoul", "begin": 90, "spacing": 4, "scaling": 3, "amount": 2 }
        ];
        return output;
    }

    writeMeta(value) {
        value.wave = value.wave.toString();
        value.build = value.build.toString();
        value.width = value.width.toString();
        value.height = value.height.toString();
        value.saved = value.saved.toString();
        value.playtime = value.playtime.toString();
        value.wavetime = value.wavetime.toString();
        value.stats = util.replaceAdvanced(
            JSON.stringify(value.stats), /"[a-zA-Z\-]+"/, found => found.substring(1, found.length - 1)
        );
        value.rules = util.replaceAdvanced(
            JSON.stringify(value.rules), /"[a-zA-Z\-]+"/, found => found.substring(1, found.length - 1)
        );

        io.writeStringMap(value);
    }

    decode(buffer = null) {
        console.group('decode');
        console.time('decode');

        io.reset();
        if(Buffer.isBuffer(buffer)) io.bufferSet(buffer);
        const info = {};
        info.header = this.readHeader();
        if (info.header != 'MSAV') throw new Error('Incorrect header');
        info.version = io.readInt();

        console.time('meta');
        info.meta = io.readChunk(this.readMeta.bind(this));
        console.timeEnd('meta');

        console.time('content');
        info.content = io.readChunk(this.readContentHeader.bind(this));
        console.timeEnd('content');

        console.time('map');
        console.group('map');
        info.map = new mapHandler(io);
        io.readChunk(mapper => {
            info.map.decode(mapper);
        }, false, info.content);
        console.groupEnd();
        console.timeEnd('map');

        console.time('entities');
        info.entities = io.readChunk(this.readEntities.bind(this));
        console.timeEnd('entities');

        console.timeEnd('decode');
        console.groupEnd();
        return info;
    }

    encode(info, preAlloc = 0xffffff) {
        console.group('encode');
        console.time('decode');
        io.bufferClear(preAlloc);

        io.reset();
        this.writeHeader();
        io.writeInt(info.version);

        console.time('meta');
        io.writeChunk(this.writeMeta.bind(this), false, info.meta);
        console.timeEnd('meta');

        console.time('content');
        io.writeChunk(this.writeContentHeader.bind(this), false, info.content);
        console.timeEnd('content');

        console.time('map');
        console.group('map');
        io.writeChunk(mapper => {
            info.map.encode(mapper);
        }, false, info.content);
        console.groupEnd();
        console.timeEnd('map');

        console.time('entities');
        io.writeChunk(this.writeEntities.bind(this), false, info.entities);
        console.timeEnd('entities');

        console.timeEnd('decode');
        console.groupEnd();
        return;
    }
}

module.exports = SaveIO;