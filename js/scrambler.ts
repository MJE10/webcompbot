const { execSync } = require("child_process");

module.exports = class Scrambler {
    constructor() {}

    generateScramble(typeIn="three") {
        // generate scramble
        let type = typeIn;
        if (type === "apple") type = "three";
        console.log('scramble generated!');

        const tnoodlePath = process.env.tnoodlePath;
        const imagesPath = process.env.imagesPath;

        const scramble = execSync(tnoodlePath + " scramble -p "+type).toString().trim();
        console.log(scramble);

        // generate image

        execSync(tnoodlePath + ' draw -o "' + imagesPath + scramble + '.svg" -p ' + type + ' -s "'+ scramble);
        console.log('image generated!');

        return scramble;
    }
}