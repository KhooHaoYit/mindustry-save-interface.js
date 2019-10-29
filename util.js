'use strict';
module.exports.replaceAdvanced = (data, regex, callback, ignore = []) => {
    for (let found = data.match(regex), last = 0; found;) {
        const end = found.input.substring(found.index + found[0].length);
        if (ignore.indexOf(found[0]) == -1) {
            const startAt = data.length - found.index;
            const done = data.length - found.input.length;
            const start = data.substring(0, done + data.length - startAt);
            const mid = callback(found[0]);
            data = start + mid + end;
        }
        found = end.match(regex);
    }
    return data;
}