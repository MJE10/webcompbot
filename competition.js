const fs = require('fs');
const DiscordClient = require("./discordClient");
const WebServer = require("./server");
const generateScramble = require("scramble-generator").default;

module.exports = class Competition {

    STATUS = {
        ROLE_SELECT: "roleSelect",
        WAITING: "waiting",
        SCRAMBLE: {
            SCRAMBLING: "scrambling",
        },
        RUN: {
            RUNNING: "running",
        },
        JUDGE: {
            JUDGING: "judging",
            ENTER_PENALTY: "judgeEnterPenalty",
            AWAITING_CONFIRMATION: "judgeAwaitingConfirmation",
        },
        COMPETE: {
            CHOOSE_CUP: "chooseCup",
            COMPETING: "competing",
            COMPLETE: "competitorFinished",
            QUIT: "competitorQuit",
            CONTINUE: "competitorContinued",
        },
        SOLVE: {
            AWAITING_SCRAMBLE: "awaitingScramble",
            AWAITING_RUNNER: "awaitingRunner",
            AWAITING_JUDGE: "awaitingJudge",
            JUDGING: "solveJudging",
            AWAITING_CONFIRMATION: "awaitingConfirmation",
            COMPLETE: "complete",
        }
    }

    constructor() {
        if (fs.existsSync("competitions/default.json")) {
            this.comp = JSON.parse(fs.readFileSync("competitions/default.json").toString());
        } else {
            this.newComp("New Competition");
        }
    }

    makeDiscordClient() {
        this.discordClient = new DiscordClient(this.comp.discordData);
        this.discordClient.onDataChanged = this.saveDiscordData.bind(this);
        return this.discordClient;
    }

    makeWebServer(discordClient) {
        if (discordClient !== undefined) this.webServer = new WebServer(this, discordClient, this.comp.serverData);
        else this.webServer = new WebServer(this, this.discordClient, this.comp.serverData);
        this.webServer.onDataChanged = this.saveServerData.bind(this);
        this.webServer.onUidGenerated = this.onUidGenerated.bind(this);
        return this.webServer;
    }

    save() {
        if (this.comp.competitionId !== undefined) {
            const path = "competitions/comp" + this.comp.competitionId + ".json"
            if (!fs.existsSync(path)) {
                let directory = JSON.parse(fs.readFileSync("competitions/directory.json").toString());
                directory[this.comp.competitionId] = this.comp.competitionName;
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
        if (this.webServer !== undefined) this.webServer.resetWith(this.comp.serverData);
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
        for (const index in directory) if (directory[index] === x) return false;
        directory[this.comp.competitionId] = x;
        fs.writeFileSync("competitions/directory.json", JSON.stringify(directory));
        this.comp.competitionName = x;
        this.save();
        return true;
    }

    setSolvesPerAverage(x) {
        if (x > 0) this.comp.solvesPerAverage = x;
        this.save();
    }

    onUidGenerated(uid, user, displayName, username) {
        this.comp.people[uid] = {
            id: uid,
            discordUser: user,
            displayName: displayName,
            discordTag: username,
            status: this.STATUS.ROLE_SELECT,
            solve: undefined,
            action: {
                type: "message",
                message: "Loading...",
            }
        }
        this.regenerateActions();
    }

    regenerateActions() {

        let possibleVolunteerSolves = {
            'scramble': [],
            'run': [],
            'judge': [],
        }

        for (const solveIndex in this.comp.solves) {
            if (this.comp.solves[solveIndex].status === this.STATUS.SOLVE.AWAITING_SCRAMBLE) possibleVolunteerSolves['scramble'].push(solveIndex);
            if (this.comp.solves[solveIndex].status === this.STATUS.SOLVE.AWAITING_RUNNER) possibleVolunteerSolves['run'].push(solveIndex);
            if (this.comp.solves[solveIndex].status === this.STATUS.SOLVE.AWAITING_JUDGE) possibleVolunteerSolves['judge'].push(solveIndex);
        }

        for (const personIndex in this.comp.people) {
            let repeat = true;
            while (repeat) {
                repeat = false;
                const person = this.comp.people[personIndex];
                const uid = personIndex;
                if (person.type === undefined) {
                    if (person.status === this.STATUS.ROLE_SELECT) {
                        if (this.comp.settings.roleSelect.length === 1 && this.comp.settings.roleSelect[0] === 'organizer_chosen') {
                            this.comp.people[uid].action = {
                                type: "message",
                                message: "Waiting for organizer...",
                            }
                        } else if (this.comp.settings.roleSelect.length === 1) {
                            if (this.comp.people[uid].type !== this.comp.settings.roleSelect[0]) {
                                this.comp.people[uid].type = this.comp.settings.roleSelect[0];
                                repeat = true;
                            }
                        } else {
                            let buttons = [];
                            for (const optionIndex in this.comp.settings.roleSelect) {
                                const option = this.comp.settings.roleSelect[optionIndex];
                                if (option === 'scramble') buttons.push({text: "Scrambler", value: "scramble"});
                                if (option === 'run') buttons.push({text: "Runner", value: "run"});
                                if (option === 'judge') buttons.push({text: "Judge", value: "judge"});
                                if (option === 'compete') buttons.push({text: "Compete", value: "compete"});
                                if (option === 'organizer_chosen') buttons.push({text: "Organizer choice", value: "organizer_chosen"});
                            }
                            this.comp.people[uid].action = {
                                type: "buttons",
                                message: "Please choose which role you would like:",
                                buttons: buttons,
                            }
                        }
                    }
                } else if (person.type === 'organizer_chosen') {
                    if ((this.comp.settings.roleSelect.length === 1 && this.comp.settings.roleSelect[0] !== 'organizer_chosen')
                        || (!this.comp.settings.roleSelect.includes('organizer_chosen'))) {
                        this.comp.people[uid].type = undefined;
                        this.comp.people[uid].status = this.STATUS.ROLE_SELECT;
                        repeat = true;
                    } else {
                        this.comp.people[uid].action = {
                            type: "message",
                            message: "Waiting for organizer...",
                        }
                    }
                } else if (person.type === 'compete') {
                    if (person.status === this.STATUS.COMPETE.CHOOSE_CUP) {
                        if (this.comp.settings.cupNumbers === 'chosen') {
                            let buttons = [];
                            for (const cupId in this.comp.cups) {
                                let cupIsUsed = false;
                                for (const solveId in this.comp.solves) if (this.comp.solves[solveId].status !== this.STATUS.SOLVE.COMPLETE
                                    && this.comp.solves[solveId].cup === cupId)
                                    cupIsUsed = true;
                                if (!cupIsUsed) buttons.push({text: this.comp.cups[cupId].name, value: cupId});
                            }
                            this.comp.people[uid].action = {
                                type: "buttons",
                                message: "Please choose which cup you are going to use:",
                                buttons: buttons,
                            }
                        } else {
                            this.comp.people[uid].action = {
                                type: "message",
                                message: "Please wait for organizer to assign you a cup...",
                            }
                        }
                    } else if (person.status === this.STATUS.COMPETE.COMPETING) {
                        const solve = this.comp.solves[person.solve];
                        if (solve.status === this.STATUS.SOLVE.AWAITING_SCRAMBLE) {
                            this.comp.people[uid].action = {
                                type: "message",
                                message: "Your cube is waiting to be scrambled.",
                            }
                        } else if (solve.status === this.STATUS.SOLVE.AWAITING_RUNNER) {
                            this.comp.people[uid].action = {
                                type: "message",
                                message: "Your cube is waiting to be delivered to a judge. Please wait.",
                            }
                        } else if (solve.status === this.STATUS.SOLVE.AWAITING_JUDGE) {
                            this.comp.people[uid].action = {
                                type: "message",
                                message: "Your judge is getting ready. Please wait.",
                            }
                        } else if (solve.status === this.STATUS.SOLVE.JUDGING) {
                            let message = "Your judge is ready! Please report to ";
                            for (const judgeId in this.comp.people) {
                                if (this.comp.people[judgeId].status === this.STATUS.JUDGE.JUDGING
                                    || this.comp.people[judgeId].status === this.STATUS.JUDGE.ENTER_PENALTY
                                    && this.comp.people[judgeId].solve.toString() === person.solve.toString()) {
                                    message += this.comp.people[judgeId].displayName;
                                }
                            }
                            this.comp.people[uid].action = {
                                type: "message",
                                message: message
                            }
                        } else if (solve.status === this.STATUS.SOLVE.AWAITING_CONFIRMATION) {
                            console.log(solve.result)
                            this.comp.people[uid].action = {
                                type: "buttons",
                                message: "Please confirm your time: " + solve.result + "; Penalty: " + solve.penalty.toUpperCase(),
                                buttons: [
                                    { text: "Correct", value: "yes" },
                                    { text: "Wrong", value: "no" },
                                ]
                            }
                        } else {
                            this.comp.people[uid].action = {
                                type: "message",
                                message: "Please wait...",
                            }
                        }
                    } else if (person.status === this.STATUS.COMPETE.COMPLETE) {
                        let message = "You finished your average!<br>";
                        let sum = 0;
                        let max = 0;
                        let min = 999999999999999999999999;
                        let counter = 1;
                        for (const solveId in this.comp.solves) if (this.comp.solves[solveId].competitor === uid) {
                            const result = parseFloat(this.comp.solves[solveId].result);
                            sum += result;
                            message += "<br>#" + counter++ + ") " + result.toFixed(2) + (this.comp.solves[solveId].penalty === 'none' ? '' : " (" + this.comp.solves[solveId].penalty + ")");
                            max = Math.max(max, result);
                            min = Math.min(min, result);
                        }
                        if (sum !== 0) {
                            message += "<br><br>Average: " + ((sum - max - min) / (counter - 3)).toFixed(2);
                            message += "<br>Mean: " + (sum / (counter - 1)).toFixed(2);
                        }
                        this.comp.people[uid].action = {
                            type: "buttons",
                            message: message,
                            buttons: [
                                { text: "Continue", value: "continue" },
                                { text: "Quit", value: "quit" }
                            ]
                        }
                    } else if (person.status === this.STATUS.COMPETE.QUIT) {
                        this.comp.people[uid].action = {
                            type: "newLink",
                            message: "Loading...",
                            link: this.comp.serverData.url,
                        }
                    } else if (person.status === this.STATUS.COMPETE.CONTINUE) {
                        this.comp.people[uid].action = {
                            type: "newLink",
                            message: "<a href='" + person.continueLink + "'>Click here!</a>",
                            link: person.continueLink,
                        }
                    } else {
                        this.comp.people[uid].action = {
                            type: "message",
                            message: "Please wait...",
                        }
                    }
                } else if (person.status === this.STATUS.WAITING) {
                    let buttons = [];
                    if (this.comp.settings.volunteersUnited === "true") {
                        const types = ['scramble', 'judge', 'run'];
                        const gerunds = ['scrambling', 'judging', 'running'];
                        for (const typeIndex in types)
                            for (const solveIndex in possibleVolunteerSolves[types[typeIndex]]) {
                                if (this.comp.cups[this.comp.solves[possibleVolunteerSolves[types[typeIndex]][solveIndex]].cup]) {
                                    let text = this.comp.cups[this.comp.solves[possibleVolunteerSolves[types[typeIndex]][solveIndex]].cup].name;
                                    if (this.comp.settings.volunteersUnited) text += " (" + gerunds[typeIndex] + ")";
                                    buttons.push({ text: text,
                                        value: possibleVolunteerSolves[types[typeIndex]][solveIndex] });
                                }
                            }
                    } else {
                        for (const solveIndex in possibleVolunteerSolves[person.type])
                            buttons.push({ text:this.comp.cups[this.comp.solves[possibleVolunteerSolves[person.type][solveIndex]].cup].name,
                                value: possibleVolunteerSolves[person.type][solveIndex] });
                    }
                    if (buttons.length === 0) {
                        this.comp.people[uid].action = {
                            type: "message",
                            message: "No cubes are waiting right now. This page will update when new ones are available.",
                        }
                    } else {
                        this.comp.people[uid].action = {
                            type: "buttons",
                            message: "Please choose which cup you want to do:",
                            buttons: buttons,
                        }
                    }
                } else if (person.status === this.STATUS.SCRAMBLE.SCRAMBLING) {
                    const scramble = this.comp.solves[this.comp.people[uid].solve].scramble;
                    this.comp.people[uid].action = {
                        type: "imagesAndButtons",
                        message: "Scramble for " + this.comp.cups[this.comp.solves[this.comp.people[uid].solve].cup].name + "&#10;&#13;" + scramble,
                        images: ['http://cube.rider.biz/visualcube.png?fmt=png&size=300&alg=x2' + scramble,
                            'http://cube.rider.biz/visualcube.png?fmt=png&size=300&alg=x2' + scramble + 'z2y'],
                        buttons: [
                            { text: "Cancel", value: "cancel" },
                            { text: "Done", value: "done" },
                        ]
                    }
                } else if (person.status === this.STATUS.RUN.RUNNING) {
                    let message = "Please run the cube to ";
                    if (this.comp.solves[person.solve].time === undefined) message += "a judging station.";
                    else message += "the scrambling station.";
                    this.comp.people[uid].action = {
                        type: "buttons",
                        message: message,
                        buttons: [
                            { text: "Cancel", value: "cancel" },
                            { text: "Done", value: "done" },
                        ]
                    }
                } else if (person.status === this.STATUS.JUDGE.JUDGING) {
                    let message = "Please conduct the solve, and type the result (in seconds) into the box below.";
                    this.comp.people[uid].action = {
                        type: "numberBoxAndButtons",
                        message: message,
                        buttons: [
                            { text: "Cancel", value: "cancel" },
                            { text: "Done", value: "done" },
                        ]
                    }
                } else if (person.status === this.STATUS.JUDGE.ENTER_PENALTY) {
                    this.comp.people[uid].action = {
                        type: "buttons",
                        message: "Enter the penalty for the solve.",
                        buttons: [
                            { text: "None", value: "none" },
                            { text: "+2", value: "+2" },
                            { text: "DNF", value: "dnf" },
                            { text: "Cancel", value: "cancel" },
                        ]
                    }
                } else if (person.status === this.STATUS.JUDGE.AWAITING_CONFIRMATION) {
                    this.comp.people[uid].action = {
                        type: "message",
                        message: "Waiting for the competitor to confirm their result..."
                    }
                }else {
                    this.comp.people[uid].action = {
                        type: "message",
                        message: "Invalid state, I'm not sure what happened here",
                    }
                }
            }
        }
        this.save();
    }

    click(uid, value) {
        let person = this.comp.people[uid];
        if (person.type === undefined) {
            if (person.status === this.STATUS.ROLE_SELECT) {
                this.choosePersonTypeHelper(uid, value.value);
            }
        } else if (person.type === 'compete') {
            if (person.status === this.STATUS.COMPETE.CHOOSE_CUP) {
                this.choosePersonCupHelper(uid, value.value);
            } else if (this.comp.solves[person.solve].status === this.STATUS.SOLVE.AWAITING_CONFIRMATION) {
                if (value.value === "yes") {
                    this.comp.solves[person.solve].status = this.STATUS.SOLVE.COMPLETE;
                    for (const judgeId in this.comp.people) if (this.comp.people[judgeId].status === this.STATUS.JUDGE.AWAITING_CONFIRMATION
                        && this.comp.people[judgeId].solve.toString() === person.solve.toString()) {
                        this.comp.people[judgeId].status = this.STATUS.WAITING;
                    }
                    // count the solves they've already done
                    let solveCount = 0;
                    for (const solveId in this.comp.solves) if (this.comp.solves[solveId].competitor === uid) solveCount++;
                    if (solveCount < 5) {
                        this.choosePersonCupHelper(uid, this.comp.solves[person.solve].cup);
                    } else {
                        this.comp.people[uid].status = this.STATUS.COMPETE.COMPLETE;
                    }
                } else if (value.value === "no") {
                    this.comp.solves[person.solve].status = this.STATUS.SOLVE.JUDGING;
                    for (const judgeId in this.comp.people) if (this.comp.people[judgeId].status === this.STATUS.JUDGE.AWAITING_CONFIRMATION
                        && this.comp.people[judgeId].solve.toString() === person.solve.toString()) {
                        this.comp.people[judgeId].status = this.STATUS.JUDGE.JUDGING;
                    }
                }
            } else if (person.status === this.STATUS.COMPETE.COMPLETE) {
                if (value.value === "quit") {
                    this.comp.people[uid].status = this.STATUS.COMPETE.QUIT;
                } else if (value.value === "continue") {
                    const oldFunction = this.webServer.onUserLinkGenerated;
                    this.webServer.onUserLinkGenerated = (user, url) => {
                        this.comp.people[uid].status = this.STATUS.COMPETE.CONTINUE;
                        this.comp.people[uid].continueLink = url;
                    };
                    this.webServer.onNewUsers([person.discordUser]);
                    this.webServer.onUserLinkGenerated = oldFunction;
                }
            }
        } else if (person.status === this.STATUS.WAITING) {
            if (this.comp.solves[value.value] !== undefined) {
                if (this.comp.settings.volunteersUnited === "true" || person.type === 'scramble') {
                    if (this.comp.solves[value.value].status === this.STATUS.SOLVE.AWAITING_SCRAMBLE) {
                        this.comp.people[uid].status = this.STATUS.SCRAMBLE.SCRAMBLING;
                        this.comp.people[uid].solve = value.value;
                    }
                }
                if (this.comp.settings.volunteersUnited === "true" || person.type === 'run') {
                    if (this.comp.solves[value.value].status === this.STATUS.SOLVE.AWAITING_RUNNER) {
                        this.comp.people[uid].status = this.STATUS.RUN.RUNNING;
                        this.comp.people[uid].solve = value.value;
                    }
                }
                if (this.comp.settings.volunteersUnited === "true" || person.type === 'judge') {
                    if (this.comp.solves[value.value].status === this.STATUS.SOLVE.AWAITING_JUDGE) {
                        this.comp.people[uid].status = this.STATUS.JUDGE.JUDGING;
                        this.comp.people[uid].solve = value.value;
                        this.comp.solves[value.value].status = this.STATUS.SOLVE.JUDGING;
                    }
                }
            }
        } else if (person.status === this.STATUS.SCRAMBLE.SCRAMBLING) {
            if (person.solve !== undefined && value.value === "done") {
                if (this.comp.settings.runnerEnabled === "true") {
                    this.comp.solves[person.solve].status = this.STATUS.SOLVE.AWAITING_RUNNER;
                } else {
                    this.comp.solves[person.solve].status = this.STATUS.SOLVE.AWAITING_JUDGE;
                }
                this.comp.people[uid].status = this.STATUS.WAITING;
                delete this.comp.people[uid].solve;
            } else if (person.solve !== undefined && value.value === "cancel") {
                this.comp.people[uid].status = this.STATUS.WAITING;
                delete this.comp.people[uid].solve;
            }
        } else if (person.status === this.STATUS.RUN.RUNNING) {
            if (person.solve !== undefined && value.value === "done") {
                this.comp.solves[person.solve].status = this.STATUS.SOLVE.AWAITING_JUDGE;
                this.comp.people[uid].status = this.STATUS.WAITING;
                delete this.comp.people[uid].solve;
            } else if (person.solve !== undefined && value.value === "cancel") {
                this.comp.people[uid].status = this.STATUS.WAITING;
                delete this.comp.people[uid].solve;
            }
        } else if (person.status === this.STATUS.JUDGE.JUDGING) {
            if (person.solve !== undefined && !isNaN(parseInt(value.value))) {
                this.comp.solves[person.solve].result = value.value;
                this.comp.people[uid].status = this.STATUS.JUDGE.ENTER_PENALTY;
            } else if (person.solve !== undefined && value.value === "cancel") {
                this.comp.solves[person.solve].status = this.STATUS.SOLVE.AWAITING_JUDGE;
                this.comp.people[uid].status = this.STATUS.WAITING;
                delete this.comp.people[uid].solve;
            }
        } else if (person.status === this.STATUS.JUDGE.ENTER_PENALTY) {
            if (value.value === "none" || value.value === "+2" || value.value === "dnf") {
                this.comp.solves[person.solve].penalty = value.value;
                this.comp.solves[person.solve].status = this.STATUS.SOLVE.AWAITING_CONFIRMATION;
                this.comp.people[uid].status = this.STATUS.JUDGE.AWAITING_CONFIRMATION;
            } else if (value.value === "cancel") {
                this.comp.solves[person.solve].status = this.STATUS.SOLVE.AWAITING_JUDGE;
                delete this.comp.solves[person.solve].result;
                this.comp.people[uid].status = this.STATUS.WAITING;
                delete this.comp.people[uid].solve;
            }
        }
        this.regenerateActions();
        this.save();
    }

    getActionForUID(uid) {
        return this.comp.people[uid].action;
    }

    getGameUpdate() {
        return this.comp;
    }

    newComp(name) {
        const directory = JSON.parse(fs.readFileSync("competitions/directory.json").toString());
        let highestNumber = -1;
        for (const index in directory) if (parseInt(index) > highestNumber) highestNumber = parseInt(index);
        this.comp = {
            competitionId: highestNumber + 1,
            competitionName: name,
            solvesPerAverage: 5,
            people: {},
            solves: {},
            cups: {},
            settings: {
                roleSelect: ["organizer_chosen"],
                cupNumbers: "assigned",
                runnerEnabled: "false",
                volunteersUnited: "true",
            },
            serverData: {
                url: "http://eliaspectre.student.rit.edu",
                port: 80,
                UIDs: {},
                tokens: {},
                socketCount: {},
            },
            discordData: {
                userLinkChannels: {},
            }
        };
        if (this.webServer !== undefined) this.webServer.resetWith(this.comp.serverData);
        this.save();
    }

    getSavedCompNames() {
        return JSON.parse(fs.readFileSync("competitions/directory.json").toString());
    }

    editSetting(setting, value) {
        this.comp.settings[setting] = value;
        this.regenerateActions();
        this.save();
    }

    choosePersonType(uid, type) {
        const person = this.comp.people[uid];
        if (person.type === 'organizer_chosen' || (person.type === undefined && this.comp.settings.roleSelect.includes('organizer_chosen'))) {
            this.choosePersonTypeHelper(uid, type);
        }
    }

    choosePersonTypeHelper(uid, type) {
        this.comp.people[uid].type = type;
        const person = this.comp.people[uid];
        if (person.type === 'compete') {
            this.comp.people[uid].status = this.STATUS.COMPETE.CHOOSE_CUP;
        } else {
            this.comp.people[uid].status = this.STATUS.WAITING;
        }
        this.regenerateActions();
        this.save();
    }

    choosePersonCup(uid, cup) {
        if (this.comp.people[uid].type === 'compete') this.choosePersonCupHelper(uid, cup);
    }

    choosePersonCupHelper(uid, cup) {
        let maxSolveId = 0;
        for (const solveIndex in this.comp.solves) if (parseInt(this.comp.solves[solveIndex].id) > maxSolveId)
            maxSolveId = parseInt(this.comp.solves[solveIndex].id);
        let nextSolveId = maxSolveId + 1;
        this.comp.solves[nextSolveId] = {
            id: nextSolveId,
            cup: cup,
            competitor: uid,
            status: this.STATUS.SOLVE.AWAITING_SCRAMBLE,
            scramble: generateScramble(),
        }
        this.comp.people[uid].solve = nextSolveId;
        this.comp.people[uid].status = this.STATUS.COMPETE.COMPETING;
        this.save();
        this.regenerateActions();
    }

    personChangeDisplayName(uid, name) {
        this.comp.people[uid].displayName = name;
        this.regenerateActions();
        this.save();
    }

    newCup(name) {
        let maxCupId = 0;
        for (const cupId in this.comp.cups) if (parseInt(cupId) > maxCupId) maxCupId = parseInt(cupId);
        this.comp.cups[maxCupId + 1] = {
            id: maxCupId + 1,
            name: name,
        };
        this.save();
        this.regenerateActions();
    }
}