"use strict";
const fs = require("fs");
// environment variables
require("dotenv").config();
module.exports = class EnvChecker {
    constructor() {
        // check that .env file exists
        if (!fs.existsSync(".env")) {
            throw new Error("No .env file found!");
        }
        // check that competitions folder exists
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
            "token",
            "URL",
            "PORT",
            "tnoodlePath",
            "imagesPath"
        ];
        for (const variable of requiredVariables) {
            if (!process.env[variable]) {
                throw new Error(`${variable} not set in .env file!`);
            }
        }
    }
};
