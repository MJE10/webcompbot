/**
 * file: envChecker.ts
 * author: Michael Elia, michaeljelia@gmail.com
 * date: 2022/07/20
 * ---
 * envChecker exports a single method with no arguments and no return value, though a possible thrown error,
 * that checks to make sure that all necessary environment variables are set. If this file is not imported,
 * environment variables may need to be loaded separately.
 */

/**
 * Checks to make sure all appropriate environment variables are set.
 * @throws Error if one or more variables are missing
 */

const fs = require("fs");
// environment variables
require("dotenv").config();

export default function checkEnv() {
    // check that .env file exists
    if (!fs.existsSync(".env")) {
        throw new Error("No .env file found!");
    }

    // check that 'competitions' folder exists
    if (!fs.existsSync("competitions")) {
        // if it doesn't exist, then make it
        fs.mkdirSync("competitions");
    }

    // check that competitions/directory.json exists
    if (!fs.existsSync("competitions/directory.json")) {
        // if it doesn't exist, then make it, with an empty dictionary
        fs.writeFileSync("competitions/directory.json", "{}");
    }

    // check that all required variables are set
    const requiredVariables = [
        "TOKEN",
        "URL",
        "PORT",
        "TNOODLE_PATH"
    ];

    for (const variable of requiredVariables) {
        if (!process.env[variable]) {
            throw new Error(`${variable} not set in .env file!`);
        }
    }
}