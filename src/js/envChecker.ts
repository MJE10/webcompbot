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
        console.error("No .env file found. Please create a file with the name .env in the root directory.");
        throw new Error("missing file: .env");
    }

    // check that 'competitions' folder exists
    if (!fs.existsSync("competitions")) {
        // if it doesn't exist, then make it
        console.log("creating competitions folder...");
        try {
            fs.mkdirSync("competitions");
        } catch (e) {
            console.error(e);
            console.error("Error creating competitions folder.");
            throw new Error("cannot create competitions folder");
        }
    }

    // check that competitions/directory.json exists
    if (!fs.existsSync("competitions/directory.json")) {
        // if it doesn't exist, then make it, with an empty dictionary
        console.log("creating directory.json...");
        try {
            fs.writeFileSync("competitions/directory.json", "{}");
        } catch (e) {
            console.error(e);
            console.error("Error creating directory.json");
            throw new Error("cannot create directory.json");
        }
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
        } else console.log(`[envChecker.ts] Environment variable ${variable} found.`);
    }
}