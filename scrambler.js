const { execSync } = require("child_process");

module.exports = class Scrambler {
    constructor() {}

    generateScramble(typeIn="three") {
        // generate scramble
        let type = typeIn;
        if (type === "apple") type = "three";
        console.log('scramble generated!');

        const scramble = execSync("C:\\Users\\micha\\OneDrive\\Desktop\\Programs\\tnoodle-cli-1.0.0-win_x64\\tnoodle-cli-win_x64\\bin\\tnoodle scramble -p "+type).toString().trim();
        console.log(scramble);

        // generate image

        execSync('C:\\Users\\micha\\OneDrive\\Desktop\\Programs\\tnoodle-cli-1.0.0-win_x64\\tnoodle-cli-win_x64\\bin\\tnoodle draw -o "C:\\Users\\micha\\WebstormProjects\\webcompbot\\public\\images\\' + scramble + '.svg" -p ' + type + ' -s "'+ scramble);
        console.log('image generated!');

        return scramble;
    }
}