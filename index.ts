"use strict";

// check that all environment variables are set
import checkEnv from "./js/envChecker";
checkEnv();

import Competition from "./js/competition";

const competition = new Competition();
const discordClient = competition.makeDiscordClient();
const webServer = competition.makeWebServer(discordClient);

discordClient.onUsersReact = webServer.onNewUsers.bind(webServer);
webServer.onUserLinkGenerated = discordClient.onUserLinkGenerated.bind(discordClient);
webServer.onUserClickedLink = discordClient.onUserClickedLink.bind(discordClient);