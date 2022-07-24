"use strict";

/**
 * file: index.ts
 * author: Michael Elia, michaeljelia@gmail.com
 * date: 2022/07/20
 * ---
 * This is the root file for the server. It uses three objects to manage competitions:
 * - A Competition object to represent all data and methods relating to competition
 * - A DiscordClient object to communicate with the Discord bot for authentication
 * - A custom WebServer object to handle communications between web clients and the Competition
 *
 * index.ts creates the three objects then links appropriate methods for intercommunication. See internal
 * comments for details on the purpose and implementation for each object.
 */

console.log("[index.ts] Checking environment variables and folder structures...");

import checkEnv from "./js/envChecker";
checkEnv();

console.log("[index.ts] Finished checking environment variables and folder structures. Creating objects...");

import Competition from "./js/competition";

const competition = new Competition();
const discordClient = competition.makeDiscordClient();
const webServer = competition.makeWebServer(discordClient);

discordClient.onUsersReact = webServer.onNewUsers.bind(webServer);
webServer.onUserLinkGenerated = discordClient.onUserLinkGenerated.bind(discordClient);
webServer.onUserClickedLink = discordClient.onUserClickedLink.bind(discordClient);

console.log("[index.ts] Objects created. index.js complete.");