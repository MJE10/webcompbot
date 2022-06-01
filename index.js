"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// check that all environment variables are set
const envChecker_1 = __importDefault(require("./js/envChecker"));
(0, envChecker_1.default)();
const competition_1 = __importDefault(require("./js/competition"));
const competition = new competition_1.default();
const discordClient = competition.makeDiscordClient();
const webServer = competition.makeWebServer(discordClient);
discordClient.onUsersReact = webServer.onNewUsers.bind(webServer);
webServer.onUserLinkGenerated = discordClient.onUserLinkGenerated.bind(discordClient);
webServer.onUserClickedLink = discordClient.onUserClickedLink.bind(discordClient);
