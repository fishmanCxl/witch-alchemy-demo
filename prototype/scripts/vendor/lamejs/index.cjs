const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'dist', 'lamejs.iife.js'), 'utf8');
module.exports = Function(`${source}\nreturn lamejs;`)();
