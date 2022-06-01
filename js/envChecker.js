"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
// environment variables
require("dotenv").config();
function checkEnv() {
    // check that .env file exists
    if (!fs.existsSync(".env")) {
        throw new Error("No .env file found!");
    }
    // check that 'competitions' folder exists
    if (!fs.existsSync("competitions")) {
        // make it
        fs.mkdirSync("competitions");
    }
    // check that competitions/directory.json exists
    if (!fs.existsSync("competitions/directory.json")) {
        // make it
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
exports.default = checkEnv;
