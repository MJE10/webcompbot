"use strict";

// check that all environment variables are set
const EnvChecker = require("./js/envChecker");
new EnvChecker();

import Competition from "./js/competition";
import DiscordClient from "./js/discordClient";

const competition = new Competition();
const discordClient = competition.makeDiscordClient();
const webServer = competition.makeWebServer(discordClient);

discordClient.onUsersReact = webServer.onNewUsers.bind(webServer);
webServer.onUserLinkGenerated = discordClient.onUserLinkGenerated.bind(discordClient);
webServer.onUserClickedLink = discordClient.onUserClickedLink.bind(discordClient);