const Competition = require("./competition");

const competition = new Competition();
const discordClient = competition.makeDiscordClient();
const webServer = competition.makeWebServer();

discordClient.onUsersReact = webServer.onNewUsers.bind(webServer);
webServer.onUserLinkGenerated = discordClient.onUserLinkGenerated.bind(discordClient);
webServer.onUserClickedLink = discordClient.onUserClickedLink.bind(discordClient);