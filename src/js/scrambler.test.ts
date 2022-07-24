import generateScramble from "./scrambler";

test('tnoodle exists', () => {
    expect(() => {
        const { execSync } = require("child_process");
        execSync(process.env.TNOODLE_PATH + " -h");
    }).not.toThrow();
})