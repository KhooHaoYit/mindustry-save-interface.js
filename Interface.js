const SaveIO = require('./SaveIO.js');
var save = new SaveIO();

const fs = require('fs');
const zlib = require('zlib');

var info;
var option = {
    depth: 2,
    maxArrayLength: 4,
    colors: true
}

zlib.inflate(fs.readFileSync(process.env.APPDATA + '\\Mindustry\\saves\\4.msav'), (err, buffer) => {
    if (err) return console.log(err);
    info = save.decode(buffer);
    console.log(require('util').inspect(info, option));
});

process.stdin.on('data', _ => console.log(require('util').inspect(eval(_.toString('ascii')), option)));
