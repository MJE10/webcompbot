import Competition from "./competition";
import DiscordClient from "./discordClient";

import express = require('express');
import { v4 as uuid_v4 } from 'uuid';

import { Server as WssServer, WebSocket } from 'ws';
import {
    CompBotWebSocketMessage,
    CompBotUuid,
    CompBotUser,
    CompBotToken,
    CompBotEvent,
    CompBotType
} from "./definitions";

/**
 * file: server.ts
 * author: Michael Elia, michaeljelia@gmail.com
 * date: 2022/07/20
 * ---
 * server.ts handles all interactions between web clients (both admin and regular) and the Competition
 */

/**
 * Holds information about the current state of the WebServer
 */
export interface WebServerData {
    url: string
    port: string
    tokens: { [key: CompBotUser]: CompBotToken }
    relogTokens: { [key: CompBotUser]: CompBotToken }
    UIDs: { [key: CompBotUuid]: CompBotUser }
    socketCount: {
        "control": number
        "other": { [key: CompBotUuid]: number }
    }
}

/**
 * handles all interactions between web clients (both admin and regular) and the Competition
 */
export default class WebServer {

    data: WebServerData;

    // named lists for control/admin connections, regular action connections, and 'other' which keeps track of the
    // current connection count for each Uuid
    sockets: {
        'control': Array<WebSocket>,
        'action': Array<{socket: WebSocket, uid: CompBotUuid}>
        'other': {[key: CompBotUuid]: WebSocket}
    } = {'control': [],'action': [], other: {}};

    competition: Competition;
    discordClient: DiscordClient;

    // called by the WebServer to let DiscordClient know about new invite links so that DiscordClient can send
    // the links to the appropriate users
    onUserLinkGenerated: (user: CompBotUser, link: string) => void = () => {};
    // called by the WebServer to let DiscordClient know that a link/channel can be deleted
    onUserClickedLink: (user: CompBotUser) => void = () => {};
    // called by the WebServer to let Competition know that its save data has changed, so that Competition
    // can write the new data to the json file
    onDataChanged: (data: WebServerData) => void = () => {};
    // called by the WebServer to let Competition know about new Uuids so that it can create saved profiles
    onUidGenerated: (uid: CompBotUuid, user: CompBotUser, displayName: string, tag: string) => void = () => {};

    /**
     * Creates a new WebServer
     * @param competition {Competition} the global Competition object
     * @param discordClient {DiscordClient} the global DiscordClient object
     * @param dataInput {WebServerData} saved data about its current state
     */
    constructor(competition: Competition, discordClient: DiscordClient, dataInput: WebServerData) {

        this.data = dataInput;

        // ---------------------------- Web Services -------------------------------

        const app = express()
        this.competition = competition;
        this.discordClient = discordClient;

        // host files in the public folder
        app.use(express.static('public'));

        app.get('/joinGame', (req: express.Request, res: express.Response) => {
            let param = req.url.split('?name=');
            if (param.length === 2) {
                // create a new link for this person and send it back
                this.onNewUsers([decodeURIComponent(param[1])], (user: CompBotUser, link: string) => {
                    res.send({link:link});
                })
            } else res.send('ok');
        });

        app.get('/allResults', (req: express.Request, res: express.Response) => {
            res.send(JSON.stringify(this.competition.getAllResults()));
        });

        app.get('/solveResults', (req: express.Request, res: express.Response) => {
            res.send(JSON.stringify(this.competition.getSolveResults(parseInt(req.url.split('?s=')[1]))));
        });

        app.get('/avgResults', (req: express.Request, res: express.Response) => {
            const ev = req.url.split('?p=')[1].split('&e=')[1];
            if (['scramble', 'run', 'judge', 'compete', 'self_serve'].includes(ev)) {
                res.send(JSON.stringify(this.competition.getPersonAverage(req.url.split('?p=')[1].split('&e=')[0], ev as CompBotEvent)));
            }
        });

        app.get('/userResults', (req: express.Request, res: express.Response) => {
            res.send(JSON.stringify(this.competition.getUserResults(decodeURIComponent(req.url.split('?p=')[1]))));
        });

        app.get('/people', (req: express.Request, res: express.Response) => {
            res.send(JSON.stringify(this.competition.comp.people));
        });

        // basic web server for static files
        const server = app.listen(this.data.port, () => { console.log(`Example app listening at ${this.data.url}, port ${this.data.port}`) });
        // websocket server for intercommunication
        const wss = new WssServer({server: server});

        wss.on('connection', function connection(this: WebServer, ws: WebSocket) {
            // console.log('Connected!');
            ws.on('message', async function incoming(this: WebServer, message: string) {
                try {
                    const data: CompBotWebSocketMessage = JSON.parse(message);

                    // ------------------------------ Socket Logic -------------------------------

                    if (data.uid === undefined) {
                        if (data.token !== undefined) {
                            let userFound = false;
                            for (const user in this.data.tokens) if (this.data.tokens[user] === data.token) {
                                userFound = true;
                                delete this.data.tokens[user];
                                this.onUserClickedLink(user);

                                // the socket doesn't have its uid yet, we should generate one for it
                                // make sure the uid is unique
                                let uid = uuid_v4();
                                while (uid in this.data.UIDs) uid = uuid_v4();
                                this.data.UIDs[uid] = user;
                                this.sockets['other'][uid] = ws;
                                // register with competition
                                const guild = await this.discordClient.client.guilds.fetch(this.discordClient.constants.GUILD_ID);
                                try {
                                    const discordUser = await guild.members.fetch(user);
                                    this.onUidGenerated(uid, user, discordUser.displayName, discordUser.user.tag);
                                } catch (DiscordAPIError) {
                                    this.onUidGenerated(uid, user, user, user);
                                }
                                // send to socket
                                ws.send(JSON.stringify({uid: uid, message: "Login successful!"}));
                            }
                            for (const user in this.data.relogTokens) if (this.data.relogTokens[user] === data.token) {
                                userFound = true;
                                delete this.data.relogTokens[user];
                                this.onUserClickedLink(user);

                                this.sockets['other'][user] = ws;
                                // send to socket
                                ws.send(JSON.stringify({uid: user, message: "Login successful!"}));
                            }
                            if (!userFound) ws.send(JSON.stringify({
                                message: "Token expired, please try again.<br><br><button onclick='window.location.href=\"/\"'><h1>Home</h1></button>"
                            }));

                            this.onDataChanged(this.data);
                        } else {
                        }
                    } else if (data.uid in this.data.UIDs) {
                        const discId = this.data.UIDs[data.uid];
                        const isAdmin = discordClient.isAdmin(discId);
                        if (data.eType === 'ping uid') ws.send(JSON.stringify({uid: data.uid, eType: 'pong uid'}));
                        if (data.eType === 'click') {
                            competition.click(data.uid, data.click);
                        }
                        if (data.eType === 'action subscribe') {
                            this.sockets['action'].push({
                                'socket': ws,
                                'uid': data.uid,
                            });
                        }
                        if (data.eType === 'control subscribe') {
                            if (isAdmin) this.sockets['control'].push(ws);
                        }
                        if (data.eType === 'saveComp') {
                            if (isAdmin) competition.save();
                        }
                        if (data.eType === 'renameComp') {
                            if (isAdmin) competition.setName(data.name);
                        }
                        if (data.eType === 'setSolvesPerAverage') {
                            if (isAdmin) competition.setSolvesPerAverage(data.number);
                        }
                        if (data.eType === 'setShowDead') {
                            if (isAdmin) competition.editSetting('showDead', !competition.comp.settings.showDead)
                        }
                        if (data.eType === 'togglePartner') {
                            if (isAdmin) competition.editSetting('partnerMode', !competition.comp.settings.partnerMode)
                        }
                        if (data.eType === 'setConfirmTimes') {
                            if (isAdmin) competition.editSetting('confirmTimes', !competition.comp.settings.confirmTimes)
                        }
                        if (data.eType === 'setShowCompetitorAsCupName') {
                            if (isAdmin) competition.editSetting('showCompetitorAsCupName', !competition.comp.settings.showCompetitorAsCupName)
                        }
                        if (data.eType === 'autoCupSelect') {
                            if (isAdmin) competition.editSetting('autoCupSelect', !competition.comp.settings.autoCupSelect)
                        }
                        if (data.eType === 'newComp') {
                            if (isAdmin) competition.newComp(data.name);
                        }
                        if (data.eType === 'loadComp') {
                            if (data.id === undefined) {
                                if (isAdmin) ws.send(JSON.stringify({uid:data.uid,eType:'loadComp',names:competition.getSavedCompNames()}));
                            } else {
                                if (isAdmin) competition.loadById(data.id);
                            }
                        }
                        if (data.eType === 'editSetting') {
                            if (isAdmin) {
                                // if (data.setting === '') {
                                //     this.competition.editSetting(data.setting, data.value);
                                // }
                            }
                        }
                        if (data.eType === 'solveChangeResult') {
                            if (isAdmin) {
                                this.competition.changeSolveResult(parseInt(data.id), parseFloat(data.result));
                            }
                        }
                        if (data.eType === 'solveChangePenalty') {
                            if (isAdmin) {
                                this.competition.changeSolvePenalty(parseInt(data.id), data.penalty);
                            }
                        }
                        if (data.eType === 'choosePersonType') {
                            if (isAdmin) {
                                if (['scramble', 'run', 'judge', 'compete', 'self_serve'].includes(data.type)) {
                                    this.competition.choosePersonType(data.id, data.type as CompBotType);
                                }
                            }
                        }
                        if (data.eType === 'choosePersonCup') {
                            if (isAdmin) {
                                // deprecated
                                this.competition.choosePersonCup(data.id, parseInt(data.cup));
                            }
                        }
                        if (data.eType === 'regenerateActions') {
                            if (isAdmin) {
                                this.competition.regenerateActions();
                            }
                        }
                        if (data.eType === 'personChangeDisplayName') {
                            if (isAdmin) {
                                this.competition.personChangeDisplayName(data.id, data.name);
                            }
                        }
                        if (data.eType === 'personDie') {
                            if (isAdmin) {
                                this.competition.personDie(data.id);
                            }
                        }
                        if (data.eType === 'newCup') {
                            if (isAdmin) {
                                this.competition.newCup(data.name);
                            }
                        }
                        if (data.eType === 'newToken') {
                            if (isAdmin) {
                                let token = Math.floor(Math.random()*899999 + 100000);
                                while (token in this.data.tokens || token in this.data.relogTokens) token = Math.floor(Math.random()*899999 + 100000);

                                if (data.user) this.data.relogTokens[data.user] = token.toString();
                                this.onDataChanged(this.data);

                                ws.send(JSON.stringify({eType: 'alert', message: token.toString()}));
                            }
                        }

                        this.updateAllSockets();
                    } else ws.send(JSON.stringify({message: "Token expired, please try again.<br><br><button onclick='window.location.href=\"/\"'><h1>Home</h1></button>"}));
                } catch (e) {
                    console.log('error: '+e);
                    throw e;
                }
            }.bind(this));
            ws.on('close', function onclose(this: WebServer) {
                this.cleanSocketList();
            }.bind(this));
            this.cleanSocketList();
        }.bind(this));
    }

    /**
     * given a list of Discord snowflakes that want to generate a new page, calls its callback with urls to their
     * invite pages
     * @param users {CompBotUser[]} the users that want to generate a new link
     * @param callback {(user: CompBotUser, link: string) => void} a function that accepts a user and a link
     */
    onNewUsers(users: CompBotUser[], callback: (user: CompBotUser, link: string) => void) {
        for (const userIndex in users) {
            const user = users[userIndex];
            // generate a token linked to their discord
            let token = Math.floor(Math.random()*899999 + 100000);
            while (token in this.data.tokens || token in this.data.relogTokens) token = Math.floor(Math.random()*899999 + 100000);

            // register the token
            this.data.tokens[user] = token.toString();
            this.onDataChanged(this.data);

            if (!callback) {
                // send the user the new link via a new channel
                this.onUserLinkGenerated(user, this.data.url + '?t=' + token);
            } else {
                callback(user, this.data.url + '?t=' + token);
            }
        }
    }

    /**
     * Sends a message to all active sockets with updated game info
     */
    updateAllSockets() {
        for (const controlSocketIndex in this.sockets['control']) {
            this.sockets['control'][controlSocketIndex].send(JSON.stringify({uid:null,
                eType:"update",gameUpdate: this.competition.getGameUpdate()}));
        }
        for (const socketIndex in this.sockets['action']) {
            this.sockets['action'][socketIndex]['socket'].send(JSON.stringify({
                uid: this.sockets['action'][socketIndex]['uid'],
                eType: 'action',
                action: this.competition.getActionForUID(this.sockets['action'][socketIndex]['uid'])
            }));
        }
    }

    /**
     * Resets the WebServer object with the given data
     * @param data {WebServerData} the data to reset the object with
     */
    async resetWith(data: WebServerData) {
        this.data = data;
        for (const controlSocketIndex in this.sockets['control']) {
            this.sockets['control'][controlSocketIndex].close();
        }
        for (const socketIndex in this.sockets['action']) {
            this.sockets['action'][socketIndex]['socket'].close();
        }
        this.sockets = {'control': [],'action': [], 'other': {}};
    }

    /**
     * Remove any dead sockets, count the number of remaining sockets
     */
    cleanSocketList() {
        this.data.socketCount = {'control':0, 'other': {}};
        for (const controlSocketIndex in this.sockets['control']) {
            if (this.sockets['control'][controlSocketIndex].readyState === 3) delete this.sockets['control'][controlSocketIndex];
            else this.data.socketCount['control']++;
        }
        for (const socketIndex in this.sockets['action']) {
            if (this.sockets['action'][socketIndex]['socket'].readyState === 3) delete this.sockets['action'][socketIndex];
            else {
                if (!(this.sockets['action'][socketIndex]['uid'] in this.data.socketCount)) this.data.socketCount['other'][this.sockets['action'][socketIndex]['uid']] = 1;
                else this.data.socketCount['other'][this.sockets['action'][socketIndex]['uid']]++;
            }
        }
        this.onDataChanged(this.data);
    }
}