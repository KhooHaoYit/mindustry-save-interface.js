const SaveIO = require('./SaveIO.js');
var save = new SaveIO();

const fs = require('fs');
const zlib = require('zlib');

const defaultCallback = _ => {
    try{
        const evaled = eval(_.toString('ascii'));
        console.log(require('util').inspect(evaled, option));
    }
    catch(err){
        console.log(err);
    }
}
var callback = () => {};
var option = {
    depth: 2,
    maxArrayLength: 4,
    colors: true
}
const help = "\
Functions:\n\
load(filePath)\tLoads save file into `info`\n\
\tload('/path/to/saveFile.msav')\n\
Variable:\n\
saveFilePath\tSave file path\n\
info\tThe save file info\n\
save\tThe save io\n\
option\tThe log option\
";

var info;
var saveFilePath = process.env.APPDATA + '\\Mindustry\\saves\\';
var saves = [];

const load = filePath => {
    const buffer = zlib.inflateSync(fs.readFileSync(filePath));
    info = save.decode(buffer);
    ++option.depth;
    console.log(require('util').inspect({ info }, option));
    --option.depth;
}

//Index save files
try{
    fs.readdirSync(saveFilePath).forEach(file => {
        if(fs.lstatSync(saveFilePath + file).isFile())
            saves.push(file);
    });
}
catch(err){}


if(!saves.length){
    //If no save files detected
    console.log(`There is no save file in ${saveFilePath}`);
    console.log(help);
    callback = defaultCallback;
}
else{
    //Log saves
    for(const key in saves){
        console.log(`${key}:\t${saves[key]}`);
    }
    //Choose which to load
    console.log('Please enter the index that will be loaded');
    callback = _ => {
        const index = Number(_.toString('utf8'));
        if(!saves[index]) return console.log(`${index}:\tInvalid index`);
        load(saveFilePath + saves[index]);
        console.log(help);
        callback = defaultCallback;
    }
}

process.stdin.on('data', (...args) => callback(...args));
