const fs = require('fs');
const DiscordClient = require("./discordClient");
const WebServer = require("./server");

module.exports = class Competition {
    constructor() {
        if (fs.existsSync("competitions/default.json")) {
            this.comp = JSON.parse(fs.readFileSync("competitions/default.json").toString());
        } else {
            this.comp = {
                competitionId: 1,
                competitionName: "My First Competition",
                solvesPerAverage: 5,
                people: {},
                solves: {},
                cups: {},
                serverData: {
                    UIDs: {},
                    tokens: {},
                },
                discordData: {
                    userLinkChannels: {},
                }
            };
        }
    }

    makeDiscordClient() {
        this.discordClient = new DiscordClient(this.comp.discordData);
        this.discordClient.onDataChanged = this.saveDiscordData.bind(this);
        return this.discordClient;
    }

    makeWebServer(discordClient) {
        if (discordClient !== null) this.webServer = new WebServer(this, discordClient, this.comp.serverData);
        else this.webServer = new WebServer(this, this.discordClient, this.comp.serverData);
        this.webServer.onDataChanged = this.saveServerData.bind(this);
        return this.webServer;
    }

    save() {
        if (this.comp.id !== undefined) {
            const path = "competitions/comp" + this.comp.id + ".json"
            if (!fs.existsSync(path)) {
                let directory = JSON.parse(fs.readFileSync("competitions/directory.json").toString());
                directory[this.comp.id] = this.comp.name;
                fs.writeFileSync("competitions/directory.json", JSON.stringify(directory));
            }
            fs.writeFileSync(path, JSON.stringify(this.comp));
        }
        fs.writeFileSync("competitions/default.json", JSON.stringify(this.comp));
    }

    saveServerData(serverData) {
        this.comp.serverData = serverData;
        this.save();
    }

    saveDiscordData(discordData) {
        this.comp.discordData = discordData;
        this.save();
    }

    loadById(id) {
        const path = "competitions/comp" + id + ".json"
        if (!fs.existsSync(path)) return false;
        this.comp = JSON.parse(fs.readFileSync(path).toString());
        return true;
    }

    loadByName(name) {
        const directory = JSON.parse(fs.readFileSync("competitions/directory.json").toString());
        let matches = [];
        for (const index in directory) if (directory[index] === name) matches.push(index);
        if (matches.length === 0) return false;
        if (matches.length === 1) return this.loadById(matches[0]);
        // this should ask which game you want
        return this.loadById(matches[0]);
    }

    setName(x) {
        const directory = JSON.parse(fs.readFileSync("competitions/directory.json").toString());
        for (const index in directory) if (directory[index] === name) return false;
        this.comp.competitionName = x;
        this.save();
        return true;
    }

    setSolvesPerAverage(x) {
        if (x > 0) this.comp.solvesPerAverage = x;
        this.save();
    }
}