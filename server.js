const express = require('express');
const { v4: uuidv4 } = require('uuid');

module.exports = class WebServer {
    constructor(competition, discordClient, dataInput) {

        this.data = dataInput;
        this.sockets = {'control':[],'action':[]};

        // ---------------------------- Web Services -------------------------------

        const app = express()
        const port = this.data.port;
        this.url = this.data.url;
        this.competition = competition;
        this.discordClient = discordClient;

        app.use(express.static('public'));

        const server = app.listen(port, () => { console.log(`Example app listening at ${this.url}`) });

        const Server = require('ws').Server;

        const wss = new Server({server: server});

        wss.on('connection', function connection(ws) {
            // console.log('Connected!');
            ws.on('message', async function incoming(message) {
                try {
                    const data = JSON.parse(message);
                    // console.log(data);
                    // console.log(this.data.UIDs);

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
                                let uid = uuidv4();
                                while (uid in this.data.UIDs) uid = uuidv4();
                                this.data.UIDs[uid] = user;
                                this.sockets[uid] = ws;
                                // register with competition
                                const guild = await this.discordClient.client.guilds.fetch(this.discordClient.constants.GUILD_ID);
                                const discordUser = await guild.members.fetch(user);
                                this.onUidGenerated(uid, user, discordUser.displayName, discordUser.user.tag);
                                // send to socket
                                ws.send(JSON.stringify({uid: uid, message: "Login successful!"}));
                            }
                            if (!userFound) ws.send(JSON.stringify({message: "Token expired, please try again."}));

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
                                this.competition.editSetting(data.setting, data.value);
                            }
                        }
                        if (data.eType === 'choosePersonType') {
                            if (isAdmin) {
                                this.competition.choosePersonType(data.id, data.type);
                            }
                        }
                        if (data.eType === 'choosePersonCup') {
                            if (isAdmin) {
                                this.competition.choosePersonCup(data.id, data.cup);
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
                        if (data.eType === 'newCup') {
                            if (isAdmin) {
                                this.competition.newCup(data.name);
                            }
                        }

                        this.updateAllSockets();
                    } else ws.send(JSON.stringify({message: "Token expired, please try again."}));
                } catch (e) {
                    console.log('error: '+e);
                    throw e;
                }
            }.bind(this));
            ws.on('close', function onclose() {
                this.cleanSocketList();
            }.bind(this));
            this.cleanSocketList();
        }.bind(this));
    }

    onNewUsers(users) {
        // the function is given a list of Discord snowflakes that want to generate a new page
        // for each of them
        for (const userIndex in users) {
            const user = users[userIndex];
            // generate a token linked to their discord
            let token = Math.floor(Math.random()*899999 + 100000);
            while (token in this.data.tokens) token = Math.floor(Math.random()*899999 + 100000);

            // register the token
            this.data.tokens[user] = token.toString();
            this.onDataChanged(this.data);

            // send the user the new link via a new channel
            this.onUserLinkGenerated(user, this.url + '?t=' + token);
        }
    }

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

    async resetWith(data) {
        this.data = data;
        for (const controlSocketIndex in this.sockets['control']) {
            // let uid = uuidv4();
            // while (uid in this.data.UIDs) uid = uuidv4();
            // this.data.UIDs[uid] = this.discordClient.constants.MJE10_SNOWFLAKE;
            // const guild = await this.discordClient.client.guilds.fetch(this.discordClient.constants.GUILD_ID);
            // const discordUser = await guild.members.fetch(this.discordClient.constants.MJE10_SNOWFLAKE);
            // this.onUidGenerated(uid, this.discordClient.constants.MJE10_SNOWFLAKE, discordUser.displayName, discordUser.user.tag);
            // this.sockets['control'][controlSocketIndex].send(JSON.stringify({eType:'new link',link:this.url + "?uid=" + uid}));
            this.sockets['control'][controlSocketIndex].close();
            // this.onDataChanged(this.data);
        }
        for (const socketIndex in this.sockets['action']) {
            this.sockets['action'][socketIndex]['socket'].close();
        }
        this.sockets = {'control':[],'action':[]};
    }

    cleanSocketList() {
        this.data.socketCount = {'control':0};
        for (const controlSocketIndex in this.sockets['control']) {
            if (this.sockets['control'][controlSocketIndex].readyState === 3) delete this.sockets['control'][controlSocketIndex];
            else this.data.socketCount['control']++;
        }
        for (const socketIndex in this.sockets['action']) {
            if (this.sockets['action'][socketIndex]['socket'].readyState === 3) delete this.sockets['action'][socketIndex];
            else {
                if (!(this.sockets['action'][socketIndex]['uid'] in this.data.socketCount)) this.data.socketCount[this.sockets['action'][socketIndex]['uid']] = 1;
                else this.data.socketCount[this.sockets['action'][socketIndex]['uid']]++;
            }
        }
        this.onDataChanged(this.data);
    }

    onUserLinkGenerated = () => {};
    onUserClickedLink = () => {};
    onDataChanged = () => {};
    onUidGenerated = () => {};
}