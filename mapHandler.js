/*
 * Map handler
 */
'use strict';

var io;

const mapHandler = class mapHandler {

    constructor(IO){
        this.map = null;
        io = IO;
    }

    ioSet(IO){
        io = IO;
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

    decode(mapper){
        const width = io.readUShort();
        const height = io.readUShort();
        const output = [];
        for (let fill = height; fill; output[--fill] = []);
        const size = width * height;

        console.time('map.tile.floor');
        //Read floor
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
        console.timeEnd('map.tile.floor');

        console.time('map.tile.block');
        //Read blocks
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
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
                        }
                    ], true, false, false, false, true);
                    break;
                case 'overflow-gate':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            if (block.version == 1) throw new Error("Haven't implement yet, see OverflowGate.java:135");
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
                        }
                    ], true, true, true, false, true);
                    break;
                case 'cultivator':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.progress = io.readFloat();
                            block.warmup1 = io.readFloat(); //Warmup for something else??
                            block.warmup2 = io.readFloat();
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
                        }
                    ], true, false, true, false, true);
                    break;
                case 'impact-reactor':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.productionEfficiency = io.readFloat();
                            block.warmup = io.readFloat();
                            return { extra: block };
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
                            return { extra: block };
                        }
                    ], true, true, false, true, true, i == 31548);
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
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
                        }
                    ], true, true, true, false, true);
                    break;
                case 'unloader':
                    output[x][y].block = io.readChunk([
                        this.readEntity,
                        () => {
                            const block = {};
                            block.itemId = io.readByte();
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
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
                            return { extra: block };
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
        console.timeEnd('map.tile.block');

        this.map = output;
    }

    encode(mapper){
        const value = this.map;
        const width = value.length;
        const height = value.length;
        const size = width * height;
        io.writeUShort(width);
        io.writeUShort(height);

        console.time('map.tile.floor');
        //Write floors
        for (let i = 0; i < size; ++i) {
            const x = i % width, y = Math.floor(i / width);
            const tile = value[x][y];
            io.writeShort(tile.floorId);
            io.writeShort(tile.oreId);
            //Write amount of same floor
            let consecutives = 0;
            for(let j = i + 1; j < size && consecutives <= 255; ++j, ++consecutives){
                const nextTile = value[j % width][Math.floor(j / width)];
                if(nextTile.floorId != tile.floorId || nextTile.oreId != tile.oreId) break;
            }
            io.writeUByte(consecutives);
            i += consecutives;
        }
        console.timeEnd('map.tile.floor');

        console.time('map.tile.block');
        //Write blocks
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
                            const extra = block.extra;
                            io.writeFloat(extra.progress);
                            io.writeShort(extra.pid);
                            io.writeShort(extra.rid);
                            if(extra.accumulator){
                                io.writeByte(extra.accumulator.accumulator.length);
                                for(let loop = 0, limit = extra.accumulator.accumulator.length; loop < limit; ++loop){
                                    io.writeFloat(extra.accumulator.accumulator[loop]);
                                    io.writeFloat(extra.accumulator.totalAccumulator[loop]);
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
                            const extra = block.extra;
                            io.writeBoolean(extra.broken);
                            io.writeFloat(extra.buildup);
                            io.writeFloat(extra.radscl);
                            io.writeFloat(extra.warmup);
                            io.writeFloat(extra.phaseHeat);
                        }
                    ], true, block);
                    break;
                case 'phase-conveyor':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            const extra = block.extra;
                            io.writeInt(extra.link);
                            io.writeFloat(extra.uptime);
                            io.writeByte(extra.links.length);
                            extra.links.forEach(link => io.writeInt(link));
                        }
                    ], true, block);
                    break;
                case 'mass-driver':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            const extra = block.extra;
                            io.writeInt(extra.link);
                            io.writeFloat(extra.rotationDriver);
                            io.writeByte(extra.stateId);
                        }
                    ], true, block);
                    break;
                case 'junction':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            const extra = block.extra;
                            for (let i = 0; i < 4; ++i) {
                                io.writeByte(extra.indexes[i]);
                                io.writeByte(extra.buffers[i].length);
                                extra.buffers[i].forEach(buffer => io.writeLong(buffer));
                            }
                        }
                    ], true, block);
                    break;
                case 'sorter':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            const extra = block.extra;
                            if (block.revision == 1) throw new Error("Haven't implement yet, see Sorter.java:155");
                            io.writeShort(extra.sortItemId);
                        }
                    ], true, block);
                    break;
                case 'bridge-conveyor':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            const extra = block.extra;
                            io.writeInt(extra.link);
                            io.writeFloat(extra.uptime);
                            io.writeByte(extra.links.length);
                            extra.links.forEach(link => io.writeInt(link));
                            io.writeByte(extra.buffer.index);
                            io.writeByte(extra.buffer.buffer.length);
                            extra.buffer.buffer.forEach(buffer => io.writeLong(buffer));
                        }
                    ], true, block);
                    break;
                case 'titanium-conveyor':
                case 'conveyor':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            const extra = block.extra;
                            io.writeInt(extra.buffer.length);
                            extra.buffer.forEach(buffer => io.writeUInt(buffer));
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
                            const extra = block.extra;
                            io.writeFloat(extra.progress);
                            io.writeFloat(extra.warmup);
                        }
                    ], true, block);
                    break;
                case 'cultivator':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            const extra = block.extra;
                            io.writeFloat(extra.progress);
                            io.writeFloat(extra.warmup1);	//TODO: Warmup for something else??
                            io.writeFloat(extra.warmup2);
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
                            const extra = block.extra;
                            io.writeFloat(extra.productionEfficiency);
                        }
                    ], true, block);
                    break;
                case 'impact-reactor':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            const extra = block.extra;
                            io.writeFloat(extra.productionEfficiency);
                            io.writeFloat(extra.warmup);
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
                            const extra = block.extra;
                            io.writeByte(extra.items.length);
                            extra.items.forEach(item => {
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
                            const extra = block.extra;
                            io.writeInt(extra.link);
                            io.writeFloat(extra.uptime);
                            io.writeByte(extra.links.length);
                            extra.links.forEach(link => io.writeInt(link));
                        }
                    ], true, block);
                    break;
                case 'overdrive-projector':
                case 'mender':
                case 'mend-projector':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            const extra = block.extra;
                            io.writeFloat(extra.heat);
                            io.writeFloat(extra.phaseHeat);
                        }
                    ], true, block);
                    break;
                case 'unloader':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            const extra = block.extra;
                            io.writeByte(extra.itemId);
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
                            const extra = block.extra;
                            io.writeFloat(extra.progress);
                            io.writeFloat(extra.time);
                            io.writeFloat(extra.heat);
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
                            const extra = block.extra;
                            io.writeFloat(extra.buildTime);
                            io.writeInt(extra.spawned);
                        }
                    ], true, block);
                    break;
                case 'door':
                    io.writeChunk([
                        this.writeEntity,
                        block => {
                            const extra = block.extra;
                            io.writeBoolean(extra.open);
                        }
                    ], true, block);
                    break;
                default:
                    throw new Error(`${mapper[1][blockId]} (${blockId}) is not mapped!! SaveVersion.java:183`);
                case 'part_-1_-1': case 'part_-1_0': case 'part_-1_1': case 'part_-1_2':
                case 'part_0_-1':  case 'part_0_1':  case 'part_0_2':
                case 'part_1_-1':  case 'part_1_0':  case 'part_1_1':  case 'part_1_2':
                case 'part_2_-1':  case 'part_2_0':  case 'part_2_1':  case 'part_2_2':
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

}

module.exports = mapHandler;