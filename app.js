'use strict';
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

const util = (data, regex, front, back = front, ignore = []) => {
	for(let found = data.match(regex), last = 0; found; ){
		const startAt = data.length - found.index;
		const done = data.length - found.input.length;
		const start = data.substring(0, done + data.length - startAt);
		const mid = front + found[0] + back;
		const end = found.input.substring(found.index + found[0].length);
		if(ignore.indexOf(found[0]) == -1) data = start + mid + end;
		found = end.match(regex);
	}
	return data;
}

const save = {
	readStat: () => {
		const output = [];
		for(let amount = io.readByte(); amount; --amount){
			const id = io.readByte();
			const time = io.readFloat();
			output.push({ id, time });
		}
		return output;
	},
	readSave: () => {
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
			status: save.readStat()
		}
	},
	readHeader: () => {
		io.counterReset();
		return io.readFull(4);
	},
	readEntities: () => {
		const output = [];
		for(let groups = io.readByte(); groups; --groups){
			for(let amount = io.readInt(); amount; --amount){
				io.readChunk(() => {
					const typeId = io.readByte();
					const version = io.readByte();
					if(output[typeId] === undefined) output[typeId] = [];
					switch(typeId){
						case 0:	//BaseUnit.java
						case 1:
						case 2:
						case 4:
							{
								const info = save.readSave();
								const type = io.readByte();
								const spawner = io.readInt();
								output[typeId].push({
									typeId: typeId,
									version: version,
									trait: { info, type, spawner }
								});
							}
							break;
						case 16:	//Puddle.java
							const loadedPosition = io.readInt();
							const x = io.readFloat();
							const y = io.readFloat();
							const liquidId = io.readByte();
							const amount = io.readFloat();
							const generation = io.readByte();
							output[typeId].push({
								typeId: typeId,
								version: version,
								trait: { loadedPosition, x, y, liquidId, amount, generation }
							});
							break;
						case 17:	//Player.java
							const local = io.readBoolean();
							if(local){
								const mechId = io.readByte();
								const spawner = io.readInt();
								const info = save.readSave();
								output[typeId].push({
									typeId: typeId,
									version: version,
									trait: { mechId, spawner, info }
								});
							}
							break;
						default:
							throw new Error(`Not implemented yet, SaveVersion:247, type: ${typeId}`);
					}
				}, true);
			}
		}
		return output;
	},
	readEntity: (items, power, liquids, consume) => {
		const output = {
			version: io.readByte(),
			health: io.readUShort()
		}
		const teamRotation = io.readByte();
		output.team = teamRotation >> 4 & 15;
		output.rotation = teamRotation & 15;
		if(items){
			output['items'] = [];
			for(let count = io.readByte(); count; --count){
				let itemId = io.readByte();
				let itemAmount = io.readInt();
				output['items'].push({ itemId, itemAmount });
			}
		}
		if(power){
			const links = [];
			for(let amount = io.readShort(); amount; --amount) links.push(io.readInt());
			let satisfaction = io.readFloat();
			if(satisfaction === NaN || satisfaction === Infinity) satisfaction = 0;
			output['power'] = { links, satisfaction };
		}
		if(liquids){
			output['liquids'] = [];
			for(let count = io.readByte(); count; --count){
				const liquidId = io.readByte();
				const amount = io.readFloat();
				output['liquids'].push({ liquidId, amount });
			}
		}
		if(consume) output['consume'] = io.readBoolean();
		return output;
	},
	readMap: mapper => {
		let width = io.readUShort();
		let height = io.readUShort();
		const output = [];
		for(let fill = height; fill; output[--fill] = []);
		const size = width * height;
		//read floor and create tiles first
		for(let i = 0; i < size; ++i){
			let x = i % width, y = Math.floor(i / width);
			const floorId = io.readShort();
			const oreId = io.readShort();
			let consecutives = io.readUByte();
			output[x][y] = { floorId, oreId };
			//This loop basically fill x amount of same thing
			for(let j = i + 1; j < i + 1 + consecutives; j++){
				let newx = j % width, newy = Math.floor(j / width);
				output[newx][newy] = { floorId, oreId };
			}
			i += consecutives;
		}
		//read blocks
		for(let i = 0; i < size; ++i){
			let x = i % width, y = Math.floor(i / width);
			const blockId = io.readShort();
			output[x][y].blockId = blockId;
			switch(mapper[1][blockId]){
				case 'build1':
				case 'build2':
				case 'build3':
					{
						const block = io.readChunk(save.readEntity, true, false, false, false, true);
						block.progress = io.readFloat();
						block.pid = io.readShort();
						block.rid = io.readShort();
						let acsize = io.readByte();
						if(acsize != -1){
							const accumulator = [];
							const totalAccumulator = [];
							do{
								accumulator.push(io.readFloat());
								totalAccumulator.push(io.readFloat());
							}while(--acsize);
							block.accumulator = { accumulator, totalAccumulator }
						}
//										BuildBlock.java:348
//						let previous;
//						let cblock;
//						let buildCost;
//						if(pid != -1) previous = mapper[1][pid];
//						if(rid != -1) cblock = mapper[1][rid];
//						if(cblock != null) buildCost = cblock.buildCost * state.rules.buildCostMultiplier;
//						else buildCost = 20;
						output[x][y].block = block;
					}
					break;
				case 'container':
				case 'vault':
				case 'command-center':
				case 'core-shard':
					{
						const block = io.readChunk(save.readEntity, true, true, false, false, true);
						output[x][y].block = block;
					}
					break;
				case 'battery':
				case 'surge-tower':
				case 'battery-large':
					{
						const block = io.readChunk(save.readEntity, true, false, true, false, true);
						output[x][y].block = block;
					}
					break;
				case 'incinerator':
					{
						const block = io.readChunk(save.readEntity, true, false, true, true, true);
						output[x][y].block = block;
					}
					break;
				case 'force-projector':
					{
						const block = io.readChunk(save.readEntity, true, true, true, true, true);
						block.broken = io.readBoolean();
						block.buildup = io.readFloat();
						block.radscl = io.readFloat();
						block.warmup = io.readFloat();
						block.phaseHeat = io.readFloat();
						output[x][y].block = block;
					}
					break;
				case 'phase-conveyor':
					{
						const block = io.readChunk(save.readEntity, true, true, true, false, true);
						block.link = io.readInt();
						block.uptime = io.readFloat();
						const links = [];
						for(let linksAmount = io.readByte(); linksAmount; --linksAmount){
							const add = io.readInt();
							links.push(add);
						}
						block.links = links;
						output[x][y].block = block;
					}
					break;
				case 'mass-driver':
					{
						const block = io.readChunk(save.readEntity, true, true, true, false, true);
						block.link = io.readInt();
						block.rotation = io.readFloat();
						block.stateId = io.readByte();
						output[x][y].block = block;
					}
					break;
				case 'junction':
					{
						const block = io.readChunk(save.readEntity, true, false, false, false, true);
						const indexes = [];
						const buffers = [];
						for(let i = 4; i; --i){
							indexes.push(io.readByte());
							const buffer = [];
							for(let length = io.readByte(); length; --length){
								const value = io.readLong();
								buffer.push(value);
								//DirectionalItemBuffer.java:65
							}
							buffers.push(buffer);
						}
						block.indexes = indexes;
						block.buffers = buffers;
						output[x][y].block = block;
					}
					break;
				case 'overflow-gate':
					{
						const block = io.readChunk(save.readEntity, true, true, false, false, true);
						if(block.version == 1) throw new Error("Haven't implement yet, see OverflowGate.java:135");
						output[x][y].block = block;
					}
					break;
				case 'router':
				case 'distributor':
					{
						const block = io.readChunk(save.readEntity, true, true, false, false, true);
						output[x][y].block = block;
					}
					break;
				case 'sorter':
					{
						const block = io.readChunk(save.readEntity, true, false, false, false, true);
						block.sortItemId = io.readShort();
						if(block.revision == 1) throw new Error("Haven't implement yet, see Sorter.java:155");
						output[x][y].block = block;
					}
					break;
				case 'bridge-conveyor':
					{
						const block = io.readChunk(save.readEntity, true, true, false, false, true);
						block.link = io.readInt();
						block.uptime = io.readFloat();
						const links = [];
						for(let linksAmount = io.readByte(); linksAmount; --linksAmount){
							const add = io.readInt();
							links.push(add);
						}
						block.links = links;
						const index = io.readByte();
						const buffer = [];
						for(let length = io.readByte(); length; --length){
							buffer.push(io.readLong());	//ItemBuffer.java:76
						}
						block.buffer = { index, buffer };
						output[x][y].block = block;
					}
					break;
				case 'titanium-conveyor':
				case 'conveyor':
					{
						const block = io.readChunk(save.readEntity, true, true, false, false, true);
						for(let amount = io.readInt(); amount; --amount){	//Conveyor.java:447
							const data = io.readInt();
							const itemId = data >> 24 & 0xff;
							let x = data >> 16 & 0xff;
							if(x >= 128) x = -(0x100 - x);
							x /= 127;
							let y = data >> 8 & 0xff;
							if(y >= 128) x = -(0x100 - y);
							y = (y + 128) / 255;
							x = Math.ceil(x * 0x7fff);	//TODO: Check it's consistence on the positive line
							y = Math.ceil((y - 1) * 0x7fff);
							block.buffer = { itemId, x, y };
						}
						output[x][y].block = block;
					}
					break;
				case 'phase-weaver':
					{
						const block = io.readChunk(save.readEntity, true, true, true, false, true);
						block.progress = io.readFloat();
						block.warmup = io.readFloat();
						output[x][y].block = block;
					}
					break;
				case 'multi-press':
				case 'cryofluidmixer':
				case 'coal-centrifuge':
				case 'spore-press':
				case 'plastanium-compressor':
					{
						const block = io.readChunk(save.readEntity, true, true, true, true, true);
						block.progress = io.readFloat();
						block.warmup = io.readFloat();
						output[x][y].block = block;
					}
					break;
				case 'alloy-smelter':
				case 'silicon-smelter':
				case 'blast-mixer':
				case 'pyratite-mixer':
				case 'kiln':
					{
						const block = io.readChunk(save.readEntity, true, true, true, false, true);
						block.progress = io.readFloat();
						block.warmup = io.readFloat();
						output[x][y].block = block;
					}
					break;
				case 'cultivator':
					{
						const block = io.readChunk(save.readEntity, true, true, true, true, true);
						block.progress = io.readFloat();
						block.warmup = io.readFloat();
						block.warmup = io.readFloat();	//This is probably a mistake
						output[x][y].block = block;
					}
					break;
				case 'meltdown':
					{
						const block = io.readChunk(save.readEntity, true, false, true, true, true);
						output[x][y].block = block;
					}
					break;
				case 'rtg-generator':
					{
						const block = io.readChunk(save.readEntity, true, true, true, false, true);
						block.productionEfficiency = io.readFloat();
						output[x][y].block = block;
					}
					break;
				case 'differential-generator':
					{
						const block = io.readChunk(save.readEntity, true, true, true, true, true);
						block.productionEfficiency = io.readFloat();
						output[x][y].block = block;
					}
					break;
				case 'solar-panel':
				case 'solar-panel-large':
				case 'thermal-generator':
					{
						const block = io.readChunk(save.readEntity, true, false, true, false, true);
						block.productionEfficiency = io.readFloat();
						output[x][y].block = block;
					}
					break;
				case 'impact-reactor':
					{
						const block = io.readChunk(save.readEntity, true, true, true, true, true);
						block.productionEfficiency = io.readFloat();
						block.warmUp = io.readFloat();
						output[x][y].block = block;
					}
					break;
				case 'power-node-large':
				case 'power-node':
					{
						const block = io.readChunk(save.readEntity, true, false, true, false, true);
						output[x][y].block = block;
					}
					break;
				case 'wave':
					{
						const block = io.readChunk(save.readEntity, true, false, false, true, true);
						output[x][y].block = block;
					}
					break;
				case 'arc':
					{
						const block = io.readChunk(save.readEntity, true, false, true, true, true);
						output[x][y].block = block;
					}
					break;
				case 'salvo':
				case 'duo':
				case 'spectre':
				case 'fuse':
				case 'ripple':
				case 'scorch':
				case 'cyclone':
				case 'swarmer':
					{
						const block = io.readChunk(save.readEntity, true, true, false, true, true);
						const items = [];
						for(let amount = io.readByte(); amount; --amount){
							const itemId = io.readByte();
							const ammo = io.readShort();
							items.push({ itemId, ammo });
						}
						block.items = items;
						output[x][y].block = block;
					}
					break;
				case 'phase-conduit':
					{
						const block = io.readChunk(save.readEntity, true, false, true, true, true);
						block.link = io.readInt();
						block.uptime = io.readFloat();
						const links = [];
						for(let linksAmount = io.readByte(); linksAmount; --linksAmount){
							const add = io.readInt();
							links.push(add);
						}
						block.links = links;
						output[x][y].block = block;
					}
					break;
				case 'bridge-conduit':
					{
						const block = io.readChunk(save.readEntity, true, false, false, true, true);
						block.link = io.readInt();
						block.uptime = io.readFloat();
						const links = [];
						for(let linksAmount = io.readByte(); linksAmount; --linksAmount){
							const add = io.readInt();
							links.push(add);
						}
						block.links = links;
						output[x][y].block = block;
					}
					break;
				case 'liquid-tank':
				case 'liquid-junction':
				case 'mechanical-pump':
				case 'pulse-conduit':
				case 'liquid-router':
					{
						const block = io.readChunk(save.readEntity, true, false, false, true, true);
						output[x][y].block = block;
					}
					break;
				case 'overdrive-projector':
				case 'mender':
				case 'mend-projector':
					{
						const block = io.readChunk(save.readEntity, true, true, true, false, true);
						block.heat = io.readFloat();
						block.phaseHeat = io.readFloat();
						output[x][y].block = block;
					}
					break;
				case 'unloader':
					{
						const block = io.readChunk(save.readEntity, true, true, false, false, true);
						block.itemId = io.readByte();
						output[x][y].block = block;
					}
					break;
				case 'tau-mech-pad':
				case 'omega-mech-pad':
				case 'delta-mech-pad':
				case 'dart-mech-pad':
				
				case 'glaive-ship-pad':
				case 'javelin-ship-pad':
				case 'trident-ship-pad':
					{
						const block = io.readChunk(save.readEntity, true, false, true, false, true);
						block.progress = io.readFloat();
						block.time = io.readFloat();
						block.heat = io.readFloat();
						output[x][y].block = block;
					}
					break;
				case 'revenant-factory':
				case 'draug-factory':
				case 'phantom-factory':
				case 'titan-factory':
				case 'crawler-factory':
				case 'fortress-factory':
				case 'spirit-factory':
					{
						const block = io.readChunk(save.readEntity, true, true, true, false, true);
						block.buildTime = io.readFloat();
						block.spawned = io.readInt();
						output[x][y].block = block;
					}
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
				case 'phase-wall-laarge':
				case 'copper-wall':
				case 'copper-wall-large':
					{
						const block = io.readChunk(save.readEntity, true, false, false, false, true);
						output[x][y].block = block;
					}
					break;
				case 'door':
					{
						const block = io.readChunk(save.readEntity, true, false, false, false, true);
						block.open = io.readBoolean();
						output[x][y].block = block;
					}
					break;
				case 'pneumatic-drill':
				case 'mechanical-drill':
					{
						const block = io.readChunk(save.readEntity, true, true, false, true, true);
						output[x][y].block = block;
					}
					break;
				case 'oil-extractor':
				case 'laser-drill':
				case 'blast-drill':
					{
						const block = io.readChunk(save.readEntity, true, true, true, true, true);
						output[x][y].block = block;
					}
					break;
				case 'water-extractor':
				
				case 'rotary-pump':
				case 'thermal-pump':
					{
						const block = io.readChunk(save.readEntity, true, false, true, true, true);
						output[x][y].block = block;
					}
					break;
				case 'repair-point':
					{
						const block = io.readChunk(save.readEntity, true, false, true, false, true);
						output[x][y].block = block;
					}
					break;
				default:
					throw new Error(`${mapper[1][blockId]} (${blockId}) at ${i} is not mapped!! SaveVersion.java:183`);
				case 'part_-1_-1':	case 'part_-1_0':	case 'part_-1_1':	case 'part_-1_2':
				case 'part_0_-1':						case 'part_0_1':	case 'part_0_2':
				case 'part_1_-1':	case 'part_1_0':	case 'part_1_1':	case 'part_1_2':
				case 'part_2_-1':	case 'part_2_0':	case 'part_2_1':	case 'part_2_2':
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
				case 'air':
					{
						let consecutives = io.readUByte();
						//This loop basically fill x amount of same thing
						for(let j = i + 1; j < i + 1 + consecutives; j++){
							let newx = j % width, newy = Math.floor(j / width);
							output[newx][newy].block = { blockId };
						}
						i += consecutives;
						break;
					}
			}
		}
		return output;
	},
	readContentHeader: () => {
		let mapped = io.readByte();
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
		const output = [];
		while(mapped--){
			let type = io.readByte();
			let total = io.readShort();
			output[type] = [];
			for(let at = 0; at < total; ++at){
				const name = io.readUTF();
				output[type][at] = name;
			}
		}
		return output;
	},
	readMeta: () => {
		const output = io.readStringMap();
		output.wave = BigInt(output.wave);
		output.build = BigInt(output.build);
		output.width = BigInt(output.width);
		output.height = BigInt(output.height);
		output.saved = BigInt(output.saved);
		output.playtime = BigInt(output.playtime);
		output.wavetime = parseFloat(output.wave);
		output.stats = JSON.parse(util(output.stats, /[a-zA-Z\-]+/, '"'));
		output.rules = JSON.parse(util(output.rules, /[a-zA-Z\-]+/, '"', '"', ['true', 'false']));
		if(!output.rules.spawns) output.rules.spawns = [
			{"type":"dagger","end":10,"scaling":2},
			{"type":"crawler","begin":4,"end":13,"scaling":1.5,"amount":2},
			{"type":"wraith","begin":12,"end":16,"scaling":1},
			{"type":"dagger","begin":11,"spacing":2,"scaling":1.7},
			{"type":"titan","begin":7,"end":30,"spacing":3,"scaling":2},
			{"type":"dagger","begin":8,"spacing":2,"scaling":1,"amount":4},
			{"type":"titan","begin":28,"end":40,"spacing":3,"scaling":1},
			{"type":"titan","begin":45,"spacing":3,"scaling":2,"effect":6},
			{"type":"titan","begin":120,"spacing":2,"scaling":3,"amount":5,"effect":6},
			{"type":"wraith","begin":16,"spacing":2,"scaling":1},
			{"type":"dagger","begin":82,"spacing":3,"scaling":3,"amount":4,"effect":6},
			{"type":"dagger","begin":41,"spacing":5,"scaling":3,"effect":7},
			{"type":"fortress","begin":40,"spacing":5,"scaling":2,"amount":2},
			{"type":"dagger","begin":35,"end":60,"spacing":3,"amount":4,"effect":6},
			{"type":"dagger","begin":42,"end":130,"spacing":3,"amount":4,"effect":6},
			{"type":"ghoul","begin":40,"spacing":2,"scaling":2,"amount":2},
			{"type":"wraith","begin":50,"spacing":5,"scaling":3,"amount":4,"effect":6},
			{"type":"revenant","begin":50,"spacing":5,"scaling":3,"amount":2},
			{"type":"ghoul","begin":53,"spacing":4,"scaling":3,"amount":2},
			{"type":"eruptor","begin":31,"spacing":3,"scaling":1,"amount":4},
			{"type":"chaos-array","begin":41,"spacing":30,"scaling":1},
			{"type":"eradicator","begin":81,"spacing":40,"scaling":1},
			{"type":"lich","begin":131,"spacing":40,"scaling":1},
			{"type":"ghoul","begin":90,"spacing":4,"scaling":3,"amount":2}
		];
		return output;
	}, 
}

const fs = require('fs');
const zlib = require('zlib');

const info = {};

const func = async () => {
	info.header = save.readHeader();
	if(info.header != 'MSAV') throw new Error('Incorrect header');
	info.version = io.readInt();
	info.meta = io.readChunk(save.readMeta);
	info.content = io.readChunk(save.readContentHeader);
	info.map = io.readChunk(save.readMap, false, info.content);
	info.entities = io.readChunk(save.readEntities);
	
	console.log(require('util').inspect(info, { depth: 2, maxArrayLength: 4, colors: true }));
//	io.counterReset();
}

zlib.inflate(fs.readFileSync(process.env.APPDATA + '\\Mindustry\\saves\\-1.msav'), (err, buffer) => {
	if(err) return console.log(err);
	io.bufferSet(buffer);
	func();
});

process.stdin.on('data', _ => console.log(eval(_.toString('ascii'))));