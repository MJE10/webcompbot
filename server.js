const express = require('express');
const { v4: uuidv4 } = require('uuid');

module.exports = class WebServer {
    constructor(competition, discordClient, dataInput) {

        this.data = dataInput;

        // ---------------------------- Web Services -------------------------------

        const app = express()
        const port = this.data.port;
        this.url = this.data.url;

        app.use(express.static('public'));

        const server = app.listen(port, () => { console.log(`Example app listening at ${this.url}`) });

        const Server = require('ws').Server;

        const wss = new Server({server: server});

        wss.on('connection', function connection(ws) {
            // console.log('Connected!');
            ws.on('message', function incoming(message) {
                try {
                    const data = JSON.parse(message);

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
                                // send to socket
                                ws.send(JSON.stringify({uid: uid, message: "Login successful!"}));
                            }
                            if (!userFound) ws.send(JSON.stringify({message: "Token expired, please try again."}));

                            this.onDataChanged(this.data);
                        }
                    } else if (data.uid in this.data.UIDs) {
                        if (data.eType === 'ping uid') ws.send(JSON.stringify({uid: data.uid, body: 'pong uid'}));
                    } else ws.send(JSON.stringify({message: "Token expired, please try again."}));
                } catch (e) {}
            }.bind(this));
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

    onUserLinkGenerated = () => {};
    onUserClickedLink = () => {};
    onDataChanged = () => {};
}