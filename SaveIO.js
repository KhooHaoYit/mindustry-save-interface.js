/*
 * Interface for saves read & write
 */
'use strict';

const util = require('./util.js');
const IOHelper = require('./IOHelper.js');

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
        entities.forEach(value => value === undefined || ++groups);
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

    writeEntity(entity) {
        io.writeByte(entity.version);
        io.writeUShort(entity.health);
        io.writeByte(entity.team << 4 | entity.rotation);
        if(entity.items !== undefined){
            io.writeByte(entity.items.length);
            entity.items.forEach(item => {
                io.writeByte(item.itemId);
                io.writeInt(item.itemAmount);
            });
        }
        if(entity.power !== undefined){
            io.writeShort(entity.power.links.length);
            entity.power.links.forEach(link => io.writeInt(link));
            io.writeFloat(entity.power.satisfaction);
        }
        if(entity.liquids !== undefined){
            io.writeByte(entity.liquids.length);
            entity.liquids.forEach(liquid => {
                io.writeByte(liquid.liquidId);
                io.writeFloat(liquid.amount);
            });
        }
        if(entity.consume !== undefined) io.writeBoolean(entity.consume);
    }

    readMap(mapper) {
        const width = io.readUShort();
        const height = io.readUShort();
        const output = [];
        for (let fill = height; fill; output[--fill] = []);
        const size = width * height;
        //read floor and create tiles first
        for (let i = 0; i < size; ++i) {
            const x = i % width, y = Math.floor(i / width);
            const floorId = io.readShort();
            const oreId = io.readShort();
            let consecutives = io.readUByte();
            output[x][y] = { floorId, oreId };
            //This loop basically fill x amount of same thing
            for (let j = i + 1; j < i + 1 + consecutives; j++) {
                let newx = j % width, newy = Math.floor(j / width);
                output[newx][newy] = { floorId, oreId };
            }
            i += consecutives;
        }
        
        //read blocks
        for (let i = 0; i < size; ++i) {
            const x = i % width, y = Math.floor(i / width);
            const blockId = io.readShort();
            output[x][y].blockId = blockId;
            switch (mapper[1][blockId]) {
                case 'build1':
                case 'build2':
                case 'build3':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.progress = io.readFloat();
                            block.pid = io.readShort();
                            block.rid = io.readShort();
                            let acsize = io.readByte();
                            if (acsize != -1) {
                                const accumulator = [];
                                const totalAccumulator = [];
                                do {
                                    accumulator.push(io.readFloat());
                                    totalAccumulator.push(io.readFloat());
                                } while (--acsize);
                                block.accumulator = { accumulator, totalAccumulator }
                            }
                            //  BuildBlock.java:348
                            //let previous;
                            //let cblock;
                            //let buildCost;
                            //if(pid != -1) previous = mapper[1][pid];
                            //if(rid != -1) cblock = mapper[1][rid];
                            //if(cblock != null) buildCost = cblock.buildCost * state.rules.buildCostMultiplier;
                            //else buildCost = 20;
                            return block;
                        }
                    ], true, false, false, false, true);
                    break;
                case 'container':
                case 'vault':
                case 'command-center':
                case 'core-shard':
                    output[x][y].block = io.readChunk(this.readEntity, true, true, false, false, true);
                    break;
                case 'battery':
                case 'surge-tower':
                case 'battery-large':
                    output[x][y].block = io.readChunk(this.readEntity, true, false, true, false, true);
                    break;
                case 'incinerator':
                    output[x][y].block = io.readChunk(this.readEntity, true, false, true, true, true);
                    break;
                case 'force-projector':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.broken = io.readBoolean();
                            block.buildup = io.readFloat();
                            block.radscl = io.readFloat();
                            block.warmup = io.readFloat();
                            block.phaseHeat = io.readFloat();
                            return block;
                        }
                    ], true, true, true, true, true);
                    break;
                case 'phase-conveyor':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.link = io.readInt();
                            block.uptime = io.readFloat();
                            const links = [];
                            for (let linksAmount = io.readByte(); linksAmount; --linksAmount) {
                                const add = io.readInt();
                                links.push(add);
                            }
                            block.links = links;
                            return block;
                        }
                    ], true, true, true, false, true);
                    break;
                case 'mass-driver':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.link = io.readInt();
                            block.rotationDriver = io.readFloat();
                            block.stateId = io.readByte();
                            return block;
                        }
                    ], true, true, true, false, true);
                    break;
                case 'junction':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            const indexes = [];
                            const buffers = [];
                            for (let i = 4; i; --i) {
                                const index = io.readByte();
                                indexes.push(index);
                                const buffer = [];
                                for (let length = io.readByte(); length; --length) {
                                    const value = io.readLong();
                                    buffer.push(value);
                                    //DirectionalItemBuffer.java:65
                                }
                                buffers.push(buffer);
                            }
                            block.indexes = indexes;
                            block.buffers = buffers;
                            return block;
                        }
                    ], true, false, false, false, true);
                    break;
                case 'overflow-gate':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            if (block.version == 1) throw new Error("Haven't implement yet, see OverflowGate.java:135");
                            return block;
                        }
                    ], true, true, false, false, true);
                    break;
                case 'router':
                case 'distributor':
                    output[x][y].block = io.readChunk(this.readEntity, true, true, false, false, true);
                    break;
                case 'sorter':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.sortItemId = io.readShort();
                            if (block.revision == 1) throw new Error("Haven't implement yet, see Sorter.java:155");
                            return block;
                        }
                    ], true, false, false, false, true);
                    break;
                case 'bridge-conveyor':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.link = io.readInt();
                            block.uptime = io.readFloat();
                            const links = [];
                            for (let linksAmount = io.readByte(); linksAmount; --linksAmount) {
                                const add = io.readInt();
                                links.push(add);
                            }
                            block.links = links;
                            const index = io.readByte();
                            const buffer = [];
                            for (let length = io.readByte(); length; --length) {
                                buffer.push(io.readLong());	//ItemBuffer.java:76
                            }
                            block.buffer = { index, buffer };
                            return block;
                        }
                    ], true, true, false, false, true);
                    break;
                case 'titanium-conveyor':
                case 'conveyor':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            const buffer = [];
                            for (let amount = io.readInt(); amount; --amount) {
                                const data = io.readUInt();
                                //Conveyor.java:447
                                //TODO: Check what it does
                                buffer.push(data);
                            }
                            block.buffer = buffer;
                            return block;
                        }
                    ], true, true, false, false, true);
                    break;
                case 'phase-weaver':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.progress = io.readFloat();
                            block.warmup = io.readFloat();
                            return block;
                        }
                    ], true, true, true, false, true);
                    break;
                case 'multi-press':
                case 'cryofluidmixer':
                case 'coal-centrifuge':
                case 'spore-press':
                case 'plastanium-compressor':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.progress = io.readFloat();
                            block.warmup = io.readFloat();
                            return block;
                        }
                    ], true, true, true, true, true);
                    break;
                case 'graphite-press':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.progress = io.readFloat();
                            block.warmup = io.readFloat();
                            return block;
                        }
                    ], true, true, false, false, true);
                    break;
                case 'alloy-smelter':
                case 'silicon-smelter':
                case 'blast-mixer':
                case 'pyratite-mixer':
                case 'kiln':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.progress = io.readFloat();
                            block.warmup = io.readFloat();
                            return block;
                        }
                    ], true, true, true, false, true);
                    break;
                case 'cultivator':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.progress = io.readFloat();
                            block.warmup = io.readFloat();
                            block.warmup = io.readFloat();	//This is probably a mistake
                            return block;
                        }
                    ], true, true, true, true, true);
                    break;
                case 'meltdown':
                    output[x][y].block = io.readChunk(this.readEntity, true, false, true, true, true);
                    break;
                case 'rtg-generator':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.productionEfficiency = io.readFloat();
                            return block;
                        }
                    ], true, true, true, false, true);
                    break;
                case 'turbine-generator':
                case 'differential-generator':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.productionEfficiency = io.readFloat();
                            return block;
                        }
                    ], true, true, true, true, true);
                    break;
                case 'solar-panel':
                case 'solar-panel-large':
                case 'thermal-generator':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.productionEfficiency = io.readFloat();
                            return block;
                        }
                    ], true, false, true, false, true);
                    break;
                case 'impact-reactor':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.productionEfficiency = io.readFloat();
                            block.warmUp = io.readFloat();
                            return block;
                        }
                    ], true, true, true, true, true);
                    break;
                case 'power-node-large':
                case 'power-node':
                    output[x][y].block = io.readChunk(this.readEntity, true, false, true, false, true);
                    break;
                case 'wave':
                    output[x][y].block = io.readChunk(this.readEntity, true, false, false, true, true);
                    break;
                case 'arc':
                case 'lancer':
                    output[x][y].block = io.readChunk(this.readEntity, true, false, true, true, true);
                    break;
                case 'salvo':
                case 'duo':
                case 'spectre':
                case 'fuse':
                case 'ripple':
                case 'scorch':
                case 'cyclone':
                case 'swarmer':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            const items = [];
                            for (let amount = io.readByte(); amount; --amount) {
                                const itemId = io.readByte();
                                const ammo = io.readShort();
                                items.push({ itemId, ammo });
                            }
                            block.items = items;
                            return block;
                        }
                    ], true, true, false, true, true);
                    break;
                case 'phase-conduit':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.link = io.readInt();
                            block.uptime = io.readFloat();
                            const links = [];
                            for (let linksAmount = io.readByte(); linksAmount; --linksAmount) {
                                const add = io.readInt();
                                links.push(add);
                            }
                            block.links = links;
                            return block;
                        }
                    ], true, false, true, true, true);
                    break;
                case 'bridge-conduit':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.link = io.readInt();
                            block.uptime = io.readFloat();
                            const links = [];
                            for (let linksAmount = io.readByte(); linksAmount; --linksAmount) {
                                const add = io.readInt();
                                links.push(add);
                            }
                            block.links = links;
                            return block;
                        }
                    ], true, false, false, true, true);
                    break;
                case 'liquid-tank':
                case 'liquid-junction':
                case 'mechanical-pump':
                case 'pulse-conduit':
                case 'liquid-router':
                    output[x][y].block = io.readChunk(this.readEntity, true, false, false, true, true);
                    break;
                case 'overdrive-projector':
                case 'mender':
                case 'mend-projector':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.heat = io.readFloat();
                            block.phaseHeat = io.readFloat();
                            return block;
                        }
                    ], true, true, true, false, true);
                    break;
                case 'unloader':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.itemId = io.readByte();
                            return block;
                        }
                    ], true, true, false, false, true);
                    break;
                case 'tau-mech-pad':
                case 'omega-mech-pad':
                case 'delta-mech-pad':
                case 'dart-mech-pad':

                case 'glaive-ship-pad':
                case 'javelin-ship-pad':
                case 'trident-ship-pad':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.progress = io.readFloat();
                            block.time = io.readFloat();
                            block.heat = io.readFloat();
                            return block;
                        }
                    ], true, false, true, false, true);
                    break;
                case 'revenant-factory':
                case 'draug-factory':
                case 'phantom-factory':
                case 'titan-factory':
                case 'wraith-factory':
                case 'crawler-factory':
                case 'fortress-factory':
                case 'spirit-factory':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.buildTime = io.readFloat();
                            block.spawned = io.readInt();
                            return block;
                        }
                    ], true, true, true, false, true);
                    break;
                case 'shock-mine':

                case 'scrap-wall':
                case 'scrap-wall-large':
                case 'thorium-wall':
                case 'thorium-wall-large':
                case 'surge-wall':
                case 'surge-wall-large':
                case 'titanium-wall':
                case 'titanium-wall-large':
                case 'phase-wall':
                case 'phase-wall-large':
                case 'copper-wall':
                case 'copper-wall-large':
                    output[x][y].block = io.readChunk(this.readEntity, true, false, false, false, true);
                    break;
                case 'door':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.open = io.readBoolean();
                            return block;
                        }
                    ], true, false, false, false, true);
                    break;
                case 'pneumatic-drill':
                case 'mechanical-drill':
                    output[x][y].block = io.readChunk(this.readEntity, true, true, false, true, true);
                    break;
                case 'oil-extractor':
                case 'laser-drill':
                case 'blast-drill':
                    output[x][y].block = io.readChunk(this.readEntity, true, true, true, true, true);
                    break;
                case 'water-extractor':

                case 'rotary-pump':
                case 'thermal-pump':
                    output[x][y].block = io.readChunk(this.readEntity, true, false, true, true, true);
                    break;
                case 'repair-point':
                    output[x][y].block = io.readChunk(this.readEntity, true, false, true, false, true);
                    break;
                default:
                    throw new Error(`${mapper[1][blockId]} (${blockId}) at ${i} is not mapped!! SaveVersion.java:183`);
                case 'part_-1_-1': case 'part_-1_0': case 'part_-1_1': case 'part_-1_2':
                case 'part_0_-1': case 'part_0_1': case 'part_0_2':
                case 'part_1_-1': case 'part_1_0': case 'part_1_1': case 'part_1_2':
                case 'part_2_-1': case 'part_2_0': case 'part_2_1': case 'part_2_2':
                case 'part_-3_-2':
                case 'part_4_4':
                case 'cliffs':
                case 'sand-boulder':
                case 'sandrocks':
                case 'snowrocks':
                case 'icerocks':
                case 'dunerocks':
                case 'rocks':
                case 'rock':
                case 'snowrock':
                case 'pine':
                case 'snow-pine':
                case 'shrubs':
                case 'air':
                    {
                        let consecutives = io.readUByte();
                        //This loop basically fill x amount of same thing
                        for (let j = i + 1; j < i + 1 + consecutives; j++) {
                            let newx = j % width, newy = Math.floor(j / width);
                            output[newx][newy].blockId = blockId;
                        }
                        i += consecutives;
                        break;
                    }
            }
        }
        return output;
    }

    writeMap(value, mapper) {
        const width = value.length;
        const height = value.length;
        const size = width * height;
        io.writeUShort(width);
        io.writeUShort(height);

        console.time('map.tile.floor');
        for (let i = 0; i < size; ++i) {
            const x = i % width, y = Math.floor(i / width);
            const tile = value[x][y];
            
            io.writeShort(tile.floorId);
            io.writeShort(tile.oreId);
            
            let consecutives = 0;
            for(let j = i + 1; j < size && consecutives <= 255; ++j, ++consecutives){
                const nextTile = value[j % width][Math.floor(j / width)];
                if(nextTile.floorId != tile.blockId || nextTile.oreId != tile.oreId) break;
            }
            io.writeUByte(consecutives);
            i += consecutives;
        }
        console.timeEnd('map.tile.floor');

        console.time('map.tile.block');
        for (let i = 0; i < size; ++i) {
            const x = i % width, y = Math.floor(i / width);
            const tile = value[x][y];
            const block = tile.block;
            const blockId = tile.blockId;
            io.writeShort(blockId);
            switch (mapper[1][blockId]) {
                case 'overflow-gate':
                    if (block.version == 1) throw new Error("Haven't implement yet, see OverflowGate.java:135");
                case 'router':
                case 'distributor':
                case 'incinerator':
                case 'battery':
                case 'surge-tower':
                case 'battery-large':
                case 'container':
                case 'vault':
                case 'command-center':
                case 'core-shard':
                case 'shock-mine':
                case 'scrap-wall':
                case 'scrap-wall-large':
                case 'thorium-wall':
                case 'thorium-wall-large':
                case 'surge-wall':
                case 'surge-wall-large':
                case 'titanium-wall':
                case 'titanium-wall-large':
                case 'phase-wall':
                case 'phase-wall-large':
                case 'copper-wall':
                case 'copper-wall-large':
                case 'pneumatic-drill':
                case 'mechanical-drill':
                case 'oil-extractor':
                case 'laser-drill':
                case 'blast-drill':
                case 'water-extractor':
                case 'rotary-pump':
                case 'thermal-pump':
                case 'repair-point':
                case 'power-node-large':
                case 'power-node':
                case 'meltdown':
                case 'wave':
                case 'arc':
                case 'lancer':
                case 'liquid-tank':
                case 'liquid-junction':
                case 'mechanical-pump':
                case 'pulse-conduit':
                case 'liquid-router':
                    io.writeChunk(this.writeEntity, true, block);
                    break;
                case 'build1':
                case 'build2':
                case 'build3':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeFloat(block.progress);
                            io.writeShort(block.pid);
                            io.writeShort(block.rid);
                            if(block.accumulator){
                                io.writeByte(block.accumulator.accumulator.length);
                                for(let loop = 0, limit = block.accumulator.accumulator.length; loop < limit; ++loop){
                                    io.writeFloat(block.accumulator.accumulator[loop]);
                                    io.writeFloat(block.accumulator.totalAccumulator[loop]);
                                }
                            }
                            else io.writeByte(-1);
                        }
                    ], true, block);
                    break;
                case 'force-projector':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeBoolean(block.broken);
                            io.writeFloat(block.buildup);
                            io.writeFloat(block.radscl);
                            io.writeFloat(block.warmup);
                            io.writeFloat(block.phaseHeat);
                        }
                    ], true, block);
                    break;
                case 'phase-conveyor':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeInt(block.link);
                            io.writeFloat(block.uptime);
                            io.writeByte(block.links.length);
                            block.links.forEach(link => io.writeInt(link));
                        }
                    ], true, block);
                    break;
                case 'mass-driver':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeInt(block.link);
                            io.writeFloat(block.rotationDriver);
                            io.writeByte(block.stateId);
                        }
                    ], true, block);
                    break;
                case 'junction':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            for (let i = 0; i < 4; ++i) {
                                io.writeByte(block.indexes[i]);
                                io.writeByte(block.buffers[i].length);
                                block.buffers[i].forEach(buffer => io.writeLong(buffer));
                            }
                        }
                    ], true, block);
                    break;
                case 'sorter':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            if (block.revision == 1) throw new Error("Haven't implement yet, see Sorter.java:155");
                            io.writeShort(block.sortItemId);
                        }
                    ], true, block);
                    break;
                case 'bridge-conveyor':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeInt(block.link);
                            io.writeFloat(block.uptime);
                            io.writeByte(block.links.length);
                            block.links.forEach(link => io.writeInt(link));
                            io.writeByte(block.buffer.index);
                            io.writeByte(block.buffer.buffer.length);
                            block.buffer.buffer.forEach(buffer => io.writeLong(buffer));
                        }
                    ], true, block);
                    break;
                case 'titanium-conveyor':
                case 'conveyor':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeInt(block.buffer.length);
                            block.buffer.forEach(buffer => io.writeUInt(buffer));
                        }
                    ], true, block);
                    break;
                case 'alloy-smelter':
                case 'silicon-smelter':
                case 'blast-mixer':
                case 'pyratite-mixer':
                case 'kiln':
                case 'graphite-press':
                case 'multi-press':
                case 'cryofluidmixer':
                case 'coal-centrifuge':
                case 'spore-press':
                case 'plastanium-compressor':
                case 'phase-weaver':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeFloat(block.progress);
                            io.writeFloat(block.warmup);
                        }
                    ], true, block);
                    break;
                case 'cultivator':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeFloat(block.progress);
                            io.writeFloat(block.warmup);
                            io.writeFloat(block.warmup);	//This is probably a mistake
                        }
                    ], true, block);
                    break;
                case 'solar-panel':
                case 'solar-panel-large':
                case 'thermal-generator':
                case 'turbine-generator':
                case 'differential-generator':
                case 'rtg-generator':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeFloat(block.productionEfficiency);
                        }
                    ], true, block);
                    break;
                case 'impact-reactor':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeFloat(block.productionEfficiency);
                            io.writeFloat(block.warmup);
                        }
                    ], true, block);
                    break;
                case 'salvo':
                case 'duo':
                case 'spectre':
                case 'fuse':
                case 'ripple':
                case 'scorch':
                case 'cyclone':
                case 'swarmer':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeByte(block.items.length);
                            block.items.forEach(item => {
                                io.writeByte(item.itemId);
                                io.writeShort(item.ammo);
                            });
                        }
                    ], true, block);
                    break;
                case 'bridge-conduit':
                case 'phase-conduit':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeInt(block.link);
                            io.writeFloat(block.uptime);
                            io.writeByte(block.links.length);
                            block.links.forEach(link => io.writeInt(link));
                        }
                    ], true, block);
                    break;
                case 'overdrive-projector':
                case 'mender':
                case 'mend-projector':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeFloat(block.heat);
                            io.writeFloat(block.phaseHeat);
                        }
                    ], true, block);
                    break;
                case 'unloader':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeByte(block.itemId);
                        }
                    ], true, block);
                    break;
                case 'tau-mech-pad':
                case 'omega-mech-pad':
                case 'delta-mech-pad':
                case 'dart-mech-pad':
    
                case 'glaive-ship-pad':
                case 'javelin-ship-pad':
                case 'trident-ship-pad':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeFloat(block.progress);
                            io.writeFloat(block.time);
                            io.writeFloat(block.heat);
                        }
                    ], true, block);
                    break;
                case 'revenant-factory':
                case 'draug-factory':
                case 'phantom-factory':
                case 'titan-factory':
                case 'wraith-factory':
                case 'crawler-factory':
                case 'fortress-factory':
                case 'spirit-factory':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeFloat(block.buildTime);
                            io.writeInt(block.spawned);
                        }
                    ], true, block);
                    break;
                case 'door':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            io.writeBoolean(block.open);
                        }
                    ], true, block);
                    break;
                default:
                    throw new Error(`${mapper[1][blockId]} (${blockId}) is not mapped!! SaveVersion.java:183`);
                case 'part_-1_-1': case 'part_-1_0': case 'part_-1_1': case 'part_-1_2':
                case 'part_0_-1': case 'part_0_1': case 'part_0_2':
                case 'part_1_-1': case 'part_1_0': case 'part_1_1': case 'part_1_2':
                case 'part_2_-1': case 'part_2_0': case 'part_2_1': case 'part_2_2':
                case 'part_-3_-2':
                case 'part_4_4':
                case 'cliffs':
                case 'sand-boulder':
                case 'sandrocks':
                case 'snowrocks':
                case 'icerocks':
                case 'dunerocks':
                case 'rocks':
                case 'rock':
                case 'snowrock':
                case 'pine':
                case 'snow-pine':
                case 'shrubs':
                case 'air':
                    {
                        let consecutives = 0;
                        for(let j = i + 1; j < size && consecutives < 255; ++j, ++consecutives){
                            if(value[j % width][Math.floor(j / width)].blockId != blockId) break;
                        }
                        io.writeUByte(consecutives);
                        i += consecutives;
                    }
            }
        }
        console.timeEnd('map.tile.block');
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
            let total = io.readShort()
            for (; total; --total) {
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
            value[key].forEach(value => io.writeUTF(value));
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
        output.wavetime = parseFloat(output.wave);
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

    decode(buffer) {
        io.reset();
        io.bufferSet(buffer);
        const info = {};

        info.header = this.readHeader();
        if (info.header != 'MSAV') throw new Error('Incorrect header');
        info.version = io.readInt();
        info.meta = io.readChunk(this.readMeta.bind(this));
        info.content = io.readChunk(this.readContentHeader.bind(this));
        info.map = io.readChunk(this.readMap.bind(this), false, info.content);
        info.entities = io.readChunk(this.readEntities.bind(this));

        return info;
    }

    encode(info, preAlloc = 0xffffff) {
        io.bufferClear(preAlloc);
        console.group('encode');
        
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
        io.writeChunk(this.writeMap.bind(this), false, info.map, info.content);
        console.groupEnd();
        console.timeEnd('map');

        console.time('entities');
        io.writeChunk(this.writeEntities.bind(this), false, info.entities);
        console.timeEnd('entities');
        
        console.groupEnd();
        return;
    }

    test() {
        console.group('decode');
        
        io.reset();
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
        info.map = io.readChunk(this.readMap.bind(this), false, info.content);
        console.timeEnd('map');
        
        console.time('entities');
        info.entities = io.readChunk(this.readEntities.bind(this));
        console.timeEnd('entities');
        
        console.groupEnd();
        return info;
    }
}

module.exports = SaveIO;