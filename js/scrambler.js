"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { execSync } = require("child_process");
function generateScramble(type) {
    // generate scramble
    if (type === "apple")
        type = "three";
    const tnoodlePath = process.env.TNOODLE_PATH || "tnoodle";
    const imagesPath = "./public/images/";
    // generate scramble
    const scramble = execSync(tnoodlePath + " scramble -p " + type).toString().trim();
    // generate image
    execSync(`${tnoodlePath} draw -o "${imagesPath}${scramble}.png" -p ${type} -s "${scramble}"`);
    return scramble;
}
exports.default = generateScramble;
