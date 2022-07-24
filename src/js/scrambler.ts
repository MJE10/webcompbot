/**
 * file: scrambler.ts
 * author: Michael Elia, michaeljelia@gmail.com
 * date: 2022/07/20
 * ---
 * scrambler exports a single function which takes an event and creates a scramble and an image for that event
 * using the official tnoodle scrambler. It returns the scramble and saves the image to the public 'images' folder.
 */

import {CompBotEvent} from "./definitions";
const { execSync } = require("child_process");

/**
 * Takes an event and creates a scramble and an image for that event using the official tnoodle scrambler.
 * It returns the scramble and saves the image to the public 'images' folder.
 * @param type {CompBotEvent} the event to scramble for, see definitions.ts
 */
export default function generateScramble(type:CompBotEvent) {
    // apple cube uses a 3x3 scramble
    if (type === "apple") type = "three";

    const tnoodlePath: string = process.env.TNOODLE_PATH || "tnoodle";
    const imagesPath = "./src/public/images/";

    let scramble = "";

    try {
        // generate scramble
        scramble = execSync(tnoodlePath + " scramble -p " + type).toString().trim();
    } catch (e) {
        console.error(e);
        console.error(`Error generating scramble for ${type}`);
        throw new Error("scramble error");
    }

    try {
        // generate image
        execSync(`${tnoodlePath} draw -o "${imagesPath}${scramble}.png" -p ${type} -s "${scramble}"`);
    } catch (e) {
        console.error(e);
        console.error(`Error generating scramble image for ${type} for ${scramble}`);
        throw new Error("scramble image error");
    }

    return scramble;
}