import checkEnv from "./envChecker";
const fs = require('fs');

test('envChecker notices when a variable is missing', () => {
    delete process.env.PORT;

    expect(() => checkEnv()).toThrow(/PORT/);
})

test('envChecker passes when all variables are present', () => {
    process.env = {
        'TOKEN': 'x',
        'PORT': 'x',
        'URL': 'x',
        'TNOODLE_PATH': 'x'
    };

    expect(() => checkEnv()).not.toThrow();
})

test('when competitions directory does not exist, it is created', () => {
    if (fs.existsSync('./competitions/')) {
        fs.rmSync('./competitions/', {recursive: true});
    }

    checkEnv();

    expect(fs.existsSync('./competitions/')).toBe(true);
    expect(fs.existsSync('./competitions/directory.json')).toBe(true);
})