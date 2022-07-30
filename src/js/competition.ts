/**
 * file: competition.ts
 * author: Michael Elia, michaeljelia@gmail.com
 * date: 2022/07/20
 * ---
 * Handles data and methods directly related to competing with a Rubik's Cube
 */

import fs from 'fs';
import DiscordClient, {DiscordClientData} from "./discordClient";
import WebServer from "./server";
import generateScramble from "./scrambler";
import {CompBotUser, CompBotUuid, CompBotEvent, CompBotType} from "./definitions";
import {WebServerData} from "./server";

// statuses that any person could have, regardless of their type
type STATUS_PERSON_COMMON = "dead";

// statuses that can only apply to a specific kind of person
type STATUS_SCRAMBLE = STATUS_PERSON_COMMON | "scrambling" | "waiting";
type STATUS_RUN = STATUS_PERSON_COMMON | "running" | "waiting";
type STATUS_JUDGE = STATUS_PERSON_COMMON | "judging" | "judgeEnterPenalty" | "judgeAwaitingConfirmation" | "waiting";
type STATUS_COMPETE = STATUS_PERSON_COMMON | "chooseCup" | "choosePuzzle" | "competing" | "competitorFinished" | "competitorContinued";
type STATUS_SELF_SERVE = STATUS_PERSON_COMMON | "self_choosePuzzle" | "self_scramble" | "self_solving" | "self_enterPenalty";

// statuses that cna only apply to a solve, not a person
type STATUS_SOLVE = "awaitingScramble" | "awaitingRunner" | "awaitingJudge" | "solveJudging" | "awaitingConfirmation" | "complete" | "solveIsSelfServe";

// combined possible person status list
type STATUS_PERSON = "roleSelect" | "waiting" | "dead" | STATUS_SCRAMBLE | STATUS_RUN | STATUS_JUDGE | STATUS_COMPETE | STATUS_SELF_SERVE;
// combined total possible status list
export type STATUS = "roleSelect" | "waiting" | "dead" | STATUS_SCRAMBLE | STATUS_RUN | STATUS_JUDGE | STATUS_COMPETE | STATUS_SELF_SERVE | STATUS_SOLVE;

// possible penalty values
type PENALTY = "none" | "dnf" | "+2"

// CupId begins at 0 and increments for each cup created, though cups may be deleted, so continuity is not guaranteed
type CupId = number;
// SolveId begins at 0 and increments for each solve created
type SolveId = number;
type PersonId = CompBotUuid;
export type Scramble = string;

export interface Solve {
    id: SolveId,
    cup: CupId | null,
    event: CompBotEvent,
    competitor: CompBotUuid,
    status: STATUS_SOLVE,
    scramble: Scramble,
    result: number,
    penalty: PENALTY,
}

export interface Cup {
    id: CupId,
    name: string
}

export interface BasicPerson {
    id: PersonId,
    discordUser: CompBotUser,
    displayName: string,
    discordTag: string,
    continueLink: string | undefined,
    temp_cup: CupId | undefined,
    action: {
        type: any,
        message: string,
        link?: string,
        buttons?: Array<{
            text: string,
            value: string,
        }>,
        images?: string[],
    }
}

export interface NewPerson extends BasicPerson {
    type: "NEW",
    status: "roleSelect" | "dead"
}

export interface OrganizerChosenPerson extends BasicPerson {
    type: "organizer_chosen",
    status: "roleSelect" | "dead"
}

export interface Competitor extends BasicPerson {
    type: "compete",
    status: STATUS_COMPETE,
    solve: SolveId
}

export interface Scrambler extends BasicPerson {
    type: "scramble",
    status: STATUS_SCRAMBLE,
    solve: SolveId | null
}

export interface Judge extends BasicPerson {
    type: "judge",
    status: STATUS_JUDGE
    solve: SolveId | null
}

export interface Runner extends BasicPerson {
    type: "run",
    status: STATUS_RUN
    solve: SolveId | null
}

export interface SelfServePerson extends BasicPerson {
    type: "self_serve",
    status: STATUS_SELF_SERVE,
    solve: SolveId
}

export type Person = Scrambler | Competitor | Judge | Runner | SelfServePerson | NewPerson | OrganizerChosenPerson

export interface CompetitionData {
    competitionId: number,
    competitionName: string,
    solvesPerAverage: number,
    people: { [key: CompBotUuid]: Person },
    solves: { [key: SolveId]: Solve },
    cups: { [key: CupId]: Cup },
    settings: {
        roleSelect: Array<CompBotType>,
        events: Array<CompBotEvent>,
        cupNumbers: "chosen" | "assigned",
        runnerEnabled: boolean,
        volunteersUnited: boolean,
        showDead: boolean,
        partnerMode: boolean,
        confirmTimes: boolean,
        showCompetitorAsCupName: boolean,
        autoCupSelect: boolean,
    },
    serverData: WebServerData,
    discordData: DiscordClientData,
}

/**
 * Handles data and methods directly related to competing with a Rubik's Cube
 */
export default class Competition {

    comp: CompetitionData;
    discordClient: DiscordClient | null = null;
    webServer: WebServer | undefined;

    /**
     * Creates a new Competition; loads the last competition automatically
     */
    constructor() {
        if (fs.existsSync("competitions/default.json")) {
            this.comp = JSON.parse(fs.readFileSync("competitions/default.json").toString());
        } else {
            this.comp = {} as CompetitionData;
            this.newComp("New Competition");
        }
    }

    /**
     * Creates a DiscordClient with the appropriate methods bound to methods in the Competition class
     * @returns {DiscordClient}
     */
    makeDiscordClient(): DiscordClient {
        this.discordClient = new DiscordClient(this.comp.discordData);
        this.discordClient.onDataChanged = this.saveDiscordData.bind(this);
        return this.discordClient;
    }

    /**
     * Creates a WebServer with the appropriate methods bound to methods in the Competition class
     * @param discordClient {DiscordClient}
     * @returns {WebServer}
     */
    makeWebServer(discordClient: DiscordClient): WebServer {
        this.webServer = new WebServer(this, discordClient, this.comp.serverData);
        this.webServer.onDataChanged = this.saveServerData.bind(this);
        this.webServer.onUidGenerated = this.onUidGenerated.bind(this);
        return this.webServer;
    }

    /**
     * Saves all of the Competition's data in the json file
     */
    save() {
        try {
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
        } catch (e) {
            console.error(e);
            console.error("Error saving competition");
        }
    }

    /**
     * Called by the WebServer when its data changes so that it can be saved to file
     * @param serverData {WebServerData} the new server data
     */
    saveServerData(serverData: WebServerData) {
        this.comp.serverData = serverData;
        this.save();
    }

    /**
     * Called by the DiscordClient when its data changes so that it can be saved to file
     * @param discordData {DiscordClientData} the new discord data
     */
    saveDiscordData(discordData: DiscordClientData) {
        this.comp.discordData = discordData;
        this.save();
    }

    /**
     * Called by WebServer when the admin wants to load a different competition; opens the file and copies the data
     * returns whether the operation was successful
     * @param id {string} the id of the competition to load
     * @returns {boolean}
     */
    loadById(id: string): boolean {
        const path = "competitions/comp" + id + ".json"
        if (!fs.existsSync(path)) return false;
        this.comp = JSON.parse(fs.readFileSync(path).toString());
        if (this.webServer !== undefined) this.webServer.resetWith(this.comp.serverData);
        return true;
    }

    /**
     * Deprecated; Called by WebServer when the admin wants to load a different competition; opens the file and copies the data
     * @param name {string} the name of the competition to load
     * @returns {boolean}
     * @deprecated
     */
    loadByName(name: string): boolean {
        const directory = JSON.parse(fs.readFileSync("competitions/directory.json").toString());
        let matches = [];
        for (const index in directory) if (directory[index] === name) matches.push(index);
        if (matches.length === 0) return false;
        if (matches.length === 1) return this.loadById(matches[0]);
        // this should ask which game you want
        return this.loadById(matches[0]);
    }

    /**
     * Sets the name of the current competition
     * Returns whether the operation was successful
     * @param x {string} the new competition name
     */
    setName(x: string): boolean {
        const directory = JSON.parse(fs.readFileSync("competitions/directory.json").toString());
        for (const index in directory) if (directory[index] === x) return false;
        directory[this.comp.competitionId] = x;
        fs.writeFileSync("competitions/directory.json", JSON.stringify(directory));
        this.comp.competitionName = x;
        this.save();
        return true;
    }

    /**
     * Sets the number of solves needed to complete an 'average'; usually 5
     * @param x {number} the number of solves needed to complete an 'average'
     */
    setSolvesPerAverage(x: number) {
        if (x > 0) this.comp.solvesPerAverage = x;
        this.save();
    }

    /**
     * Called by the WebServer after it has generated a Uuid for a new person; adds the new person to the saved data
     * @param uid {CompBotUuid} the new uuid
     * @param user {CompBotUser} the user for whom the uuid was created
     * @param displayName {string} the display name for the new user
     * @param username {string} the username for the new user
     */
    onUidGenerated(uid: CompBotUuid, user: CompBotUser, displayName: string, username: string) {
        this.comp.people[uid] = {
            id: uid,
            type: "NEW",
            discordUser: user,
            displayName: displayName,
            discordTag: username,
            status: "roleSelect",
            continueLink: undefined,
            temp_cup: undefined,
            action: {
                type: "message",
                message: "Loading...",
            }
        }
        this.regenerateActions();
    }

    /**
     * Considers the state of the Competition and generates UI prompts for each user and admin that reflect possible
     * actions
     */
    regenerateActions() {

        let possibleVolunteerSolves: { [key: string]: SolveId[] } = {
            'scramble': [],
            'run': [],
            'judge': [],
        }

        for (const solveIndexStr in this.comp.solves) {
            try {
                const solveIndex = parseInt(solveIndexStr);
                if (this.comp.solves[solveIndex].status === "awaitingScramble") possibleVolunteerSolves['scramble'].push(solveIndex);
                if (this.comp.solves[solveIndex].status === "awaitingRunner") possibleVolunteerSolves['run'].push(solveIndex);
                if (this.comp.solves[solveIndex].status === "awaitingJudge") possibleVolunteerSolves['judge'].push(solveIndex);
            } catch (e) {
                console.error(e);
                console.error("Error parsing solve index");
            }
        }

        for (const personIndex in this.comp.people) {
            let repeat = true;
            while (repeat) {
                repeat = false;
                const person = this.comp.people[personIndex];
                const uid = personIndex;
                if (person.status === "dead") {
                    this.comp.people[uid].action = {
                        type: "newLink",
                        message: "Loading...",
                        link: this.comp.serverData.url,
                    }
                } else if (person.type === "NEW") {
                    if (person.status === "roleSelect") {
                        if (this.comp.settings.roleSelect.length === 1 && this.comp.settings.roleSelect[0] === 'organizer_chosen') {
                            this.comp.people[uid].action = {
                                type: "buttons",
                                message: "Waiting for organizer...",
                                buttons: [{ text: "Quit", value: "quit" }]
                            }
                        } else if (this.comp.settings.roleSelect.length === 1) {
                            if (this.comp.people[uid].type !== this.comp.settings.roleSelect[0]) {
                                this.click(uid, {value:this.comp.settings.roleSelect[0]});
                            }
                        } else {
                            let buttons = [];
                            for (const optionIndex in this.comp.settings.roleSelect) {
                                const option = this.comp.settings.roleSelect[optionIndex];
                                if (option === 'scramble') buttons.push({text: "Scrambler", value: "scramble"});
                                if (option === 'run') buttons.push({text: "Runner", value: "run"});
                                if (option === 'judge') buttons.push({text: "Judge", value: "judge"});
                                if (option === 'compete') buttons.push({text: "Compete", value: "compete"});
                                if (option === 'self_serve') buttons.push({text: "Self serve", value: "self_serve"});
                                if (option === 'organizer_chosen') buttons.push({text: "Organizer choice", value: "organizer_chosen"});
                            }
                            buttons.push({ text: "Quit", value: "quit" });
                            this.comp.people[uid].action = {
                                type: "buttons",
                                message: "Please choose which role you would like:",
                                buttons: buttons,
                            }
                        }
                    }
                } else if (person.type === 'self_serve') {
                    if (person.status === "self_choosePuzzle") {
                        let eventButtons = [];
                        for (let event = 0; event < this.comp.settings.events.length; event++) {
                            let name;
                            switch (this.comp.settings.events[event]) {
                                case "three":
                                    name = "3x3";
                                    break;
                                case "two":
                                    name = "2x2";
                                    break;
                                case "four":
                                    name = "4x4";
                                    break;
                                case "pyra":
                                    name = "pyraminx";
                                    break;
                                case "apple":
                                    name = "apple";
                                    break;
                            }
                            eventButtons.push({ text: name, value: this.comp.settings.events[event] });
                        }
                        if (eventButtons.length === 1) {
                            this.click(uid, {value: eventButtons[0].value});
                            repeat = true;
                        } else {
                            this.comp.people[uid].action = {
                                type: "buttons",
                                message: "Please choose the event",
                                buttons: eventButtons
                            }
                        }
                    } else if (person.status === "self_scramble" && person.solve) {
                        const scramble = this.comp.solves[person.solve].scramble;
                        this.comp.people[uid].action = {
                            type: "imagesAndButtons",
                            message: "Scramble: " + scramble,
                            // images: ['http://cube.rider.biz/visualcube.png?fmt=png&size=300&alg=x2' + scramble,
                            //     'http://cube.rider.biz/visualcube.png?fmt=png&size=300&alg=x2' + scramble + 'z2y'],
                            images: ['images/'+scramble+'.svg'],
                            buttons: [
                                { text: "Done", value: "done" },
                                { text: "Quit", value: "quit" },
                            ]
                        }
                    } else if (person.status === "self_solving") {
                        let message = "Please conduct the solve, and type the result (in seconds) into the box below.";
                        this.comp.people[uid].action = {
                            type: "numberBoxAndButtons",
                            message: message,
                            buttons: [
                                { text: "Done", value: "done" },
                                { text: "Quit", value: "quit" },
                            ]
                        }
                    } else if (person.status === "self_enterPenalty") {
                        this.comp.people[uid].action = {
                            type: "buttons",
                            message: "Enter the penalty for the solve.",
                            buttons: [
                                { text: "None", value: "none" },
                                { text: "+2", value: "+2" },
                                { text: "DNF", value: "dnf" },
                                { text: "Quit", value: "quit" },
                            ]
                        }
                    }
                } else if (person.type === 'organizer_chosen') {
                    if ((this.comp.settings.roleSelect.length === 1 && this.comp.settings.roleSelect[0] !== 'organizer_chosen')
                        || (!this.comp.settings.roleSelect.includes('organizer_chosen'))) {
                        this.comp.people[uid].type = "NEW";
                        this.comp.people[uid].status = "roleSelect";
                        repeat = true;
                    } else {
                        this.comp.people[uid].action = {
                            type: "message",
                            message: "Waiting for organizer...",
                        }
                    }
                } else if (person.type === 'compete') {
                    if (person.status === "chooseCup") {
                        if (this.comp.settings.cupNumbers === 'chosen') {
                            let buttons = [];
                            for (const cupIdStr in this.comp.cups) {
                                try {
                                    const cupId = parseInt(cupIdStr);
                                    let cupIsUsed = false;
                                    for (const solveId in this.comp.solves) if (this.comp.solves[solveId].status !== "complete"
                                        && this.comp.solves[solveId].cup === cupId)
                                        cupIsUsed = true;
                                    if (!cupIsUsed) buttons.push({text: this.comp.cups[cupId].name, value: cupId.toString()});
                                } catch (e) {
                                    console.error(e);
                                    console.error("Error parsing cup id");
                                }
                            }
                            let message = "Please choose which cup you are going to use:";
                            if (buttons.length === 0) message = "Waiting for organizer to add cups...";
                            buttons.push({ text: "Cancel", value: "cancel" });
                            this.comp.people[uid].action = {
                                type: "buttons",
                                message: message,
                                buttons: buttons,
                            }
                        } else {
                            if (this.comp.settings.autoCupSelect) {
                                // try to find an empty cup
                                for (const cupIndexStr in this.comp["cups"]) {
                                    const cupIndex = parseInt(cupIndexStr);
                                    let cup = this.comp["cups"][cupIndex];
                                    let cupTaken = false;
                                    for (const solveIndex in this.comp["solves"]) if (this.comp["solves"][solveIndex].status !== 'complete'
                                        && this.comp["solves"][solveIndex].cup === cupIndex)
                                        cupTaken = true;
                                    if (!cupTaken) {
                                        this.click(uid, {value: cupIndex.toString()});
                                        repeat = true;
                                        break;
                                    }
                                }
                            }
                            this.comp.people[uid].action = {
                                type: "buttons",
                                message: "Please wait for organizer to assign you a cup...",
                                buttons: [{ text: "Cancel", value: "cancel" }]
                            }
                        }
                    } else if (person.status === "choosePuzzle") {
                        let eventButtons = [];
                        for (let event = 0; event < this.comp.settings.events.length; event++) {
                            let name;
                            switch (this.comp.settings.events[event]) {
                                case "three":
                                    name = "3x3";
                                    break;
                                case "two":
                                    name = "2x2";
                                    break;
                                case "four":
                                    name = "4x4";
                                    break;
                                case "pyra":
                                    name = "pyraminx";
                                    break;
                                case "apple":
                                    name = "apple";
                                    break;
                            }
                            eventButtons.push({ text: name, value: this.comp.settings.events[event] });
                        }
                        this.comp.people[uid].action = {
                            type: "buttons",
                            message: "Please choose the event",
                            buttons: eventButtons
                        }
                    } else if (person.status === "competing" && person.solve) {
                        const solve = this.comp.solves[person.solve];
                        if (solve.status === "awaitingScramble") {
                            this.comp.people[uid].action = {
                                type: "message",
                                message: "Your cube is waiting to be scrambled.",
                            }
                        } else if (solve.status === "awaitingRunner") {
                            this.comp.people[uid].action = {
                                type: "message",
                                message: "Your cube is waiting to be delivered to a judge. Please wait.",
                            }
                        } else if (solve.status === "awaitingJudge") {
                            this.comp.people[uid].action = {
                                type: "message",
                                message: "Your judge is getting ready. Please wait.",
                            }
                        } else if (solve.status === "solveJudging") {
                            let message = "Your judge is ready! Please report to ";
                            for (const judgeId in this.comp.people) {
                                let possibleJudge = this.comp.people[judgeId];
                                if ((possibleJudge.status === "judging"
                                    || possibleJudge.status === "judgeEnterPenalty")) {
                                    if (possibleJudge.solve !== null && possibleJudge.solve.toString() === person.solve.toString()) {
                                        message += possibleJudge.displayName;
                                    }
                                }
                            }
                            this.comp.people[uid].action = {
                                type: "message",
                                message: message
                            }
                        } else if (solve.status === "awaitingConfirmation") {
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
                    } else if (person.status === "competitorFinished") {
                        let message = "You finished your average!<br>";
                        // const average = this.getPersonAverage(person.id);
                        // message += "Average: " + average.average;
                        // message += "<br>";
                        // for (const solveId in average.solves) message += "<br>" + average.solves[solveId].displayText;
                        let event = "three";
                        for (const solveId in this.comp.solves) if (this.comp.solves[solveId].competitor === uid) event = this.comp.solves[solveId].event;
                        this.comp.people[uid].action = {
                            type: "viewAndButtons",
                            link: this.comp.serverData.url + '/results/average?a=' + person.id + '&e=' + event,
                            message: message,
                            buttons: [
                                { text: "Continue", value: "continue" },
                                { text: "Quit", value: "quit" }
                            ]
                        }
                    } else if (person.status === "competitorContinued") {
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
                } else if (person.status === "waiting") {
                    let buttons: Array<{"text": string, "value": string}> = [];
                    if (this.comp.settings.volunteersUnited) {
                        const types = ['scramble', 'judge', 'run'];
                        const gerunds = ['to scramble', 'to judge', 'to run'];
                        for (const typeIndex in types)
                            for (const solveIndex in possibleVolunteerSolves[types[typeIndex]]) {
                                if (this.comp.cups[this.comp.solves[possibleVolunteerSolves[types[typeIndex]][solveIndex]].cup as CupId]) {
                                    let text = this.comp.cups[this.comp.solves[possibleVolunteerSolves[types[typeIndex]][solveIndex]].cup as CupId].name;
                                    if (this.comp.settings.showCompetitorAsCupName) {
                                        text = this.comp.people[this.comp.solves[possibleVolunteerSolves[types[typeIndex]][solveIndex]].competitor].displayName;
                                    }
                                    if (this.comp.settings.volunteersUnited) text += " (" + gerunds[typeIndex] + ")";
                                    buttons.push({ text: text,
                                        value: possibleVolunteerSolves[types[typeIndex]][solveIndex].toString() });
                                }
                            }
                    } else {
                        for (const solveIndex in possibleVolunteerSolves[person.type])
                            buttons.push({ text:this.comp.cups[this.comp.solves[possibleVolunteerSolves[person.type][solveIndex]].cup as CupId].name,
                                value: possibleVolunteerSolves[person.type][solveIndex].toString() });
                    }
                    if (buttons.length === 0) {
                        this.comp.people[uid].action = {
                            type: "buttons",
                            message: "No cubes are waiting right now. This page will update when new ones are available.",
                            buttons: [{ text: "Home", value: "home" }]
                        }
                    } else {
                        buttons.push({ text: "Home", value: "home" });
                        this.comp.people[uid].action = {
                            type: "buttons",
                            message: "Please choose which cup you want to do:",
                            buttons: buttons,
                        }
                    }
                } else if (person.status === "scrambling" && person.solve) {
                    const scramble = this.comp.solves[person.solve].scramble;
                    this.comp.people[uid].action = {
                        type: "imagesAndButtons",
                        message: "Scramble for " + this.comp.cups[this.comp.solves[person.solve].cup as CupId].name + "&#10;&#13;" + scramble,
                        // images: ['http://cube.rider.biz/visualcube.png?fmt=png&size=300&alg=x2' + scramble,
                        //     'http://cube.rider.biz/visualcube.png?fmt=png&size=300&alg=x2' + scramble + 'z2y'],
                        images: ['images/'+scramble+'.svg'],
                        buttons: [
                            { text: "Done", value: "done" },
                            { text: "Cancel", value: "cancel" }
                        ]
                    }
                } else if (person.status === "running" && person.solve) {
                    let message = "Please run the cube to ";
                    if (this.comp.solves[person.solve].result === undefined) message += "a judging station.";
                    else message += "the scrambling station.";
                    this.comp.people[uid].action = {
                        type: "buttons",
                        message: message,
                        buttons: [
                            { text: "Done", value: "done" },
                            { text: "Cancel", value: "cancel" }
                        ]
                    }
                } else if (person.status === "judging") {
                    let message = "Please conduct the solve, and type the result (in seconds) into the box below.";
                    this.comp.people[uid].action = {
                        type: "numberBoxAndButtons",
                        message: message,
                        buttons: [
                            { text: "Done", value: "done" },
                            { text: "Cancel", value: "cancel" }
                        ]
                    }
                } else if (person.status === "judgeEnterPenalty") {
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
                } else if (person.status === "judgeAwaitingConfirmation") {
                    this.comp.people[uid].action = {
                        type: "message",
                        message: "Waiting for the competitor to confirm their result..."
                    }
                } else {
                    this.comp.people[uid].action = {
                        type: "message",
                        message: "Invalid state, I'm not sure what happened here",
                    }
                }
            }
        }
        this.save();
    }

    /**
     * Called by the WebServer when a user makes a choice; Considers the state of the Competition and the status of
     * the user, and takes appropriate action
     * @param uid {CompBotUuid} the user
     * @param value {{value: string}} the choice the user made
     */
    click(uid: CompBotUuid, value: {value: string}) {
        let person = this.comp.people[uid];
        if (person.type === "NEW") {
            if (person.status === "roleSelect") {
                if (value.value === 'quit') {
                    person.status = "dead";
                }
                else {
                    const role = value.value;
                    if (['scramble', 'run', 'judge', 'compete', 'self_serve'].includes(role)) {
                        this.choosePersonTypeHelper(uid, role as CompBotType);
                    }
                }
            }
        } else if (person.type === 'self_serve') {
            if (value.value === 'quit') {
                this.comp.solves[person.solve].status = "complete";
                this.comp.solves[person.solve].result = 0;
                this.comp.solves[person.solve].penalty = 'dnf';
                person.status = "dead";
            } else {
                if (person.status === "self_choosePuzzle") {
                    if (value.value === 'cancel') {
                        person = person as unknown as NewPerson;
                        person.type = "NEW";
                        person.status = "roleSelect";
                    } else if (this.comp.settings.events.includes(value.value as CompBotEvent)) {
                        this.choosePersonCupHelper(uid, null, value.value as CompBotEvent);
                        person.status = "self_scramble";
                        this.comp.solves[person.solve].status = "solveIsSelfServe";
                    }
                } else if (person.status === "self_scramble" && value.value === 'done') {
                    person.status = "self_solving";
                } else if (person.status === "self_solving" && !isNaN(parseInt(value.value))) {
                    this.comp.solves[person.solve].result = parseFloat(value.value);
                    person.status = "self_enterPenalty";
                } else if (person.status === "self_enterPenalty") {
                    if (value.value === "none" || value.value === "+2" || value.value === "dnf") {
                        this.comp.solves[person.solve].penalty = value.value;

                        this.comp.solves[person.solve].status = "complete";
                        person.status = "self_choosePuzzle";
                    }
                } else if (person.status === "dead") {
                    person.action = {
                        type: "newLink",
                        message: "Loading...",
                        link: this.comp.serverData.url,
                    }
                }
            }
        } else if (person.type === 'compete') {
            if (person.status === "chooseCup") {
                if (value.value === 'cancel') {
                    person = person as unknown as NewPerson;
                    person.type = "NEW";
                    person.status = "roleSelect";
                }
                else {
                    person.temp_cup = parseFloat(value.value);
                    person.status = "choosePuzzle";
                }
            } else if (person.status === "choosePuzzle") {
                if (value.value === 'cancel') {
                    person = person as unknown as NewPerson;
                    person.type = "NEW";
                    person.status = "roleSelect";
                }
                if (this.comp.settings.events.includes(value.value as CompBotEvent)) {
                    this.choosePersonCupHelper(uid, person.temp_cup === undefined ? null : person.temp_cup, value.value as CompBotEvent);
                }
            } else if (this.comp.solves[person.solve].status === "awaitingConfirmation") {
                if (value.value === "yes") {
                    this.comp.solves[person.solve].status = "complete";
                    let partnerId = null;
                    for (const judgeId in this.comp.people) {
                        let possibleJudge = this.comp.people[judgeId];
                        if (possibleJudge.status === "judgeAwaitingConfirmation"
                            && (possibleJudge.solve as SolveId).toString() === person.solve.toString()) {
                            possibleJudge.status = "waiting";
                            partnerId = judgeId;
                        }
                    }
                    // count the solves they've already done
                    let solveCount = 0;
                    for (const solveId in this.comp.solves) if (this.comp.solves[solveId].competitor === uid) solveCount++;
                    if (solveCount < this.comp.solvesPerAverage) {
                        this.choosePersonCupHelper(uid, this.comp.solves[person.solve].cup, this.comp.solves[person.solve].event);
                        if (partnerId == null) {
                            console.log("Missing partner!");
                        } else {
                            if (this.comp.settings.partnerMode) this.click(partnerId, {value: person.solve.toString()});
                        }
                    } else {
                        person.status = "competing";
                    }
                } else if (value.value === "no") {
                    this.comp.solves[person.solve].status = "solveJudging";
                    for (const judgeId in this.comp.people) {
                        let possibleJudge = this.comp.people[judgeId];
                        if (possibleJudge.status === "judgeAwaitingConfirmation"
                            && (possibleJudge.solve as SolveId).toString() === person.solve.toString()) {
                            this.comp.people[judgeId].status = "judging";
                        }
                    }
                }
            } else if (person.status === "competitorFinished") {
                if (value.value === "quit") {
                    person.status = "dead";
                } else if (value.value === "continue") {
                    if (this.webServer) {
                        const oldFunction = this.webServer.onUserLinkGenerated;
                        this.webServer.onUserLinkGenerated = (user: CompBotUuid, url: string) => {
                            person.status = "competitorContinued";
                            person.continueLink = url;
                        };
                        this.webServer.onNewUsers([person.discordUser], () => {});
                        this.webServer.onUserLinkGenerated = oldFunction;
                    }
                }
            }
        } else if (person.status === "waiting") {
            if (value.value === 'home') {
                person = person as unknown as NewPerson;
                person.type = "NEW";
                person.status = "roleSelect";
            }
            else if (parseInt(value.value) in this.comp.solves) {
                const solve = this.comp.solves[parseInt(value.value)];
                if (this.comp.settings.volunteersUnited || person.type === 'scramble') {
                    if (solve.status === "awaitingScramble") {
                        person.status = "scrambling";
                        (person as Scrambler).solve = parseInt(value.value);
                    }
                }
                if (this.comp.settings.volunteersUnited || person.type === 'run') {
                    if (solve.status === "awaitingRunner") {
                        person.status = "running";
                        (person as Runner).solve = parseInt(value.value);
                    }
                }
                if (this.comp.settings.volunteersUnited || person.type === 'judge') {
                    if (solve.status === "awaitingJudge") {
                        person.status = "judging";
                        (person as Judge).solve = parseInt(value.value);
                        solve.status = "solveJudging";
                    }
                }
            }
        } else if (person.status === "scrambling") {
            if (person.solve !== null && value.value === "done") {
                if (this.comp.settings.runnerEnabled) {
                    this.comp.solves[person.solve].status = "awaitingRunner";
                } else {
                    this.comp.solves[person.solve].status = "awaitingJudge";
                }
                person.status = "waiting";
                let oldSolve = person.solve;
                person.solve = null;
                if (this.comp.settings.partnerMode) {
                    console.log('clicked');
                    this.click(uid, {value: oldSolve.toString()});
                }
            } else if (person.solve !== null && value.value === "cancel") {
                person.status = "waiting";
                person.solve = null;
            }
        } else if (person.status === "running") {
            if (person.solve !== null && value.value === "done") {
                this.comp.solves[person.solve].status = "awaitingJudge";
                person.status = "waiting";
                person.solve = null;
            } else if (person.solve !== null && value.value === "cancel") {
                person.status = "waiting";
                person.solve = null;
            }
        } else if (person.status === "judging") {
            if (person.solve !== null && !isNaN(parseInt(value.value))) {
                this.comp.solves[person.solve].result = parseFloat(value.value);
                person.status = "judgeEnterPenalty";
            } else if (person.solve !== null && value.value === "cancel") {
                this.comp.solves[person.solve].status = "awaitingJudge";
                person.status = "waiting";
                person.solve = null;
            }
        } else if (person.status === "judgeEnterPenalty") {
            person.solve = person.solve as SolveId;
            if (value.value === "none" || value.value === "+2" || value.value === "dnf") {
                this.comp.solves[person.solve].penalty = value.value;
                this.comp.solves[person.solve].status = "awaitingConfirmation";
                person.status = "judgeAwaitingConfirmation";
                if (!this.comp.settings.confirmTimes) {
                    for (const otherUid in this.comp.people) {
                        const otherPerson = this.comp.people[otherUid];
                        if (otherPerson.status === "competing" && otherPerson.solve && otherPerson.solve.toString() === person.solve.toString()) {
                            this.click(otherUid, {value:'yes'});
                        }
                    }
                }
            } else if (value.value === "cancel") {
                this.comp.solves[person.solve].status = "awaitingJudge";
                this.comp.solves[person.solve].result = 0;
                person.status = "waiting";
                person.solve = null;
            }
        }
        this.regenerateActions();
        this.save();
    }

    /**
     * Returns the UI prompt for the given user
     * @param uid {CompBotUuid} the user
     */
    getActionForUID(uid: CompBotUuid): any {
        return this.comp.people[uid].action;
    }

    /**
     * Returns all the data associated with the Competition; usually only visible to admins since it contains
     * scrambles
     * @returns {CompetitionData}
     */
    getGameUpdate(): CompetitionData {
        return this.comp;
    }

    /**
     * Creates a new, blank competition with the given name
     * @param name {string} the name of the new competition
     */
    newComp(name: string) {
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
                events: ["three"], // ["three", "two", "four", "pyra", "apple"]
                cupNumbers: "chosen",
                runnerEnabled: false,
                volunteersUnited: true,
                showDead: false,
                partnerMode: false,
                confirmTimes: true,
                showCompetitorAsCupName: false,
                autoCupSelect: false,
            },
            serverData: {
                url: process.env.URL || "http://localhost:3000",
                port: process.env.PORT || "3000",
                UIDs: {},
                tokens: {},
                relogTokens: {},
                socketCount: {
                    "control": 0,
                    "other": {}
                },
            },
            discordData: {
                userLinkChannels: {},
            }
        };
        if (this.webServer !== undefined) this.webServer.resetWith(this.comp.serverData);
        this.save();
    }

    /**
     * Returns the list of names of competitions available
     */
    getSavedCompNames() {
        return JSON.parse(fs.readFileSync("competitions/directory.json").toString());
    }

    /**
     * Changes a setting related to the competition
     * @param setting the setting to change
     * @param value the value to change the setting to
     */
    editSetting(setting: "showDead" | "partnerMode" | "confirmTimes" | "showCompetitorAsCupName" | "autoCupSelect", value: any) {
        this.comp.settings[setting] = value;
        this.regenerateActions();
        this.save();
    }

    /**
     * Called by the WebServer when an admin forcefully chooses someone's type; can only be done if the user has
     * voluntarily selected 'organizer chosen' or if they have not chosen anything and 'organizer chosen' is an option
     * @param uid {CompBotUuid} the user whose type to change
     * @param type {CompBotType} the type to assign to the user
     */
    choosePersonType(uid: CompBotUuid, type: CompBotType) {
        const person = this.comp.people[uid];
        if (person.type === 'organizer_chosen' || (person.type === 'NEW' && this.comp.settings.roleSelect.includes('organizer_chosen'))) {
            this.choosePersonTypeHelper(uid, type);
        }
    }

    /**
     * Assigns a type to a person and gives them their initial status - generally private behavior
     * @param uid {CompBotUuid} the user whose type to change
     * @param type {CompBotType} the type to assign to the user
     */
    choosePersonTypeHelper(uid: CompBotUuid, type: CompBotType) {
        this.comp.people[uid].type = type;
        const person = this.comp.people[uid];
        if (person.type === 'compete') {
            this.comp.people[uid].status = "chooseCup";
        } else if (person.type === 'self_serve') {
            this.comp.people[uid].status = "self_choosePuzzle";
        } else {
            this.comp.people[uid].status = "waiting";
        }
        this.regenerateActions();
        this.save();
    }

    /**
     * Called when an admin wishes to forcibly assign a cup to a competitor; assumes the event is 3x3
     *
     * deprecated; instead, use choosePersonCupHelper and also specify the event
     * @param uid {CompBotUuid} the competitor to whom we should assign the cup
     * @param cup {CupId} the cup to assign to the competitor
     * @deprecated
     */
    choosePersonCup(uid: CompBotUuid, cup: CupId) {
        if (this.comp.people[uid].type === 'compete') this.choosePersonCupHelper(uid, cup, "three");
    }

    /**
     * Assigns a cup to a competitor and creates a 'Solve' with the specified event
     * @param uid {CompBotUuid} the competitor who needs a cup and a solve
     * @param cup {CupId} the id of the cup to use
     * @param event {CompBotEvent} the event that the competitor will compete in
     */
    choosePersonCupHelper(uid: CompBotUuid, cup: CupId | null, event: CompBotEvent) {
        let person = this.comp.people[uid];
        if (person.type === "compete") {
            let maxSolveId = 0;
            for (const solveIndex in this.comp.solves) if (this.comp.solves[solveIndex].id > maxSolveId)
                maxSolveId = this.comp.solves[solveIndex].id;
            let nextSolveId = maxSolveId + 1;
            this.comp.solves[nextSolveId] = {
                penalty: "none",
                result: 0,
                id: nextSolveId,
                cup: cup,
                event: event,
                competitor: uid,
                status: "awaitingScramble",
                scramble: generateScramble(event)
            }
            person.solve = nextSolveId;
            person.status = "competing";
        }
        this.save();
        this.regenerateActions();
    }

    /**
     * Changes the display name of the given user
     * @param uid {CompBotUuid} the user whose display name to change
     * @param name {string} the name to assign to the user
     */
    personChangeDisplayName(uid: CompBotUuid, name: string) {
        this.comp.people[uid].displayName = name;
        this.regenerateActions();
        this.save();
    }

    /**
     * Forcefully terminate a user from the competition and clean up the results
     * @param uid {CompBotUuid} the user to remove
     */
    personDie(uid: CompBotUuid) {
        console.log(uid);
        const person = this.comp.people[uid];
        if (person.type === 'compete') {
            // we need to take care of their average
            for (const otherUid in this.comp.people) {
                const otherPerson = this.comp.people[otherUid];
                if (!(otherPerson.type === "judge" || otherPerson.type === "scramble" || otherPerson.type === "run"))
                    continue;
                if (otherPerson.solve && otherPerson.solve.toString() === person.solve.toString() && otherUid.toString() !== uid.toString()) {
                    console.log('yes');
                    otherPerson.status = "waiting";
                    otherPerson.solve = null;
                }
            }

            this.comp.solves[person.solve].status = "complete";
            this.comp.solves[person.solve].result = 0;
            this.comp.solves[person.solve].penalty = 'dnf';

            let solveCount = 0;
            for (const solveId in this.comp.solves) if (this.comp.solves[solveId].competitor === uid) solveCount++;
            while (solveCount < this.comp.solvesPerAverage) {
                this.choosePersonCupHelper(uid, this.comp.solves[person.solve].cup, this.comp.solves[person.solve].event);
                this.comp.solves[person.solve].status = "complete";
                this.comp.solves[person.solve].result = 0;
                this.comp.solves[person.solve].penalty = 'dnf';
                solveCount++;
            }
            this.comp.people[uid].status = "dead";
        } else if (person.type === 'self_serve') {
            this.comp.solves[person.solve].status = "complete";
            this.comp.solves[person.solve].result = 0;
            this.comp.solves[person.solve].penalty = 'dnf';
            this.comp.people[uid].status = "dead";
        } else {
            // just clean them up and get them off the control screen
            if (person.status === "judging"
                || person.status === "judgeAwaitingConfirmation"
                || person.status === "judgeEnterPenalty") {
                if ('solve' in person && person.solve != null) {
                    // if this kind of judge leaves, he will leave the competitor stranded - we need to detach
                    // solve and revert it back to waiting for judge
                    this.comp.solves[person.solve].status = "awaitingJudge";
                    this.comp.solves[person.solve].result = 0;
                }
            }
            this.comp.people[uid].status = "dead";
        }

        this.regenerateActions();
        this.save();
    }

    /**
     * Create a new cup with the specified name and a unique id
     * @param name {string} the name of the new cup
     */
    newCup(name: string) {
        let maxCupId = 0;
        for (const cupId in this.comp.cups) if (parseInt(cupId) > maxCupId) maxCupId = parseInt(cupId);
        this.comp.cups[maxCupId + 1] = {
            id: maxCupId + 1,
            name: name,
        };
        this.save();
        this.regenerateActions();
    }

    /**
     * Returns all the completed solves
     * @returns {{[key: string]: Solve}} the results
     */
    getAllResults(): {[key: string]: Solve} {
        let results: {[key: string]: Solve} = {};
        for (const solveId in this.comp.solves) if (this.comp.solves[solveId].status === "complete") {
            results[solveId] = this.comp.solves[solveId];
        }
        return results;
    }

    /**
     * Returns the results for a given solve id if that solve is completed
     * @param id {SolveId} the solve whose results to return
     * @returns {Solve | {}}
     */
    getSolveResults(id: SolveId): Solve | {} {
        if (this.comp.solves[id] && this.comp.solves[id].status === "complete") return this.comp.solves[id];
        else return {};
    }

    /**
     * Returns the results for every solve for a specified competitor; competitors' ids change between averages, so this
     * will only return one average. If the average is not complete, it will only return whichever solves are complete.
     * @param id {CompBotUuid} the id of the competitor whose average to retrieve
     * @returns {{ [key:string]: Solve }}
     */
    getAverageResults(id: CompBotUuid): { [key:string]: Solve } {
        let average: { [key:string]: Solve } = {};
        for (const solveId in this.comp.solves) if (this.comp.solves[solveId].status === "complete") {
            if (this.comp.solves[solveId].competitor === id) {
                average[solveId] = this.comp.solves[solveId];
            }
        }
        return average;
    }

    /**
     * Get all solve results for the specified Discord user
     * @param id {string} the discord ID of the user
     * @returns { [key:string]: Solve }
     */
    getUserResults(id: CompBotUuid) {
        let solves: { [key:string]: Solve } = {};
        for (const solveId in this.comp.solves) if (this.comp.solves[solveId].status === "complete") {
            if (this.comp.people[this.comp.solves[solveId].competitor].discordUser === id) {
                solves[solveId] = this.comp.solves[solveId];
            }
        }
        return solves;
    }

    /**
     * Calculate the official average results for a user
     * @param uid {CompBotUuid} the user whose average to calculate
     * @param event {CompBotEvent} the event whose average to calculate
     * @returns {{
     *             mean: string,
     *             average: string,
     *             solves: { [key: number]: {
     *                     id: SolveId,
     *                     result: number,
     *                     penalty: PENALTY,
     *                     displayText: string,
     *                     competitor: CompBotUuid,
     *                 } },
     *         } = {
     *             mean: '0',
     *             average: '0',
     *             solves: {},
     *         }}
     */
    getPersonAverage(uid: CompBotUuid, event: CompBotEvent) {
        let sum = 0;
        let max = 0;
        let min = 999999999999999999999999;
        let counter = 1;
        let nonDnfCounter = 0;
        let dnfCount = 0;
        let retAverage: {
            mean: string,
            average: string,
            solves: { [key: number]: {
                    id: SolveId,
                    result: number,
                    penalty: PENALTY,
                    displayText: string,
                    competitor: CompBotUuid,
                } },
        } = {
            mean: '0',
            average: '0',
            solves: {},
        };
        for (const solveId in this.comp.solves) if (this.comp.solves[solveId].competitor === uid) {
            if (this.comp.solves[solveId].event === event) {
                if (this.comp.solves[solveId].result !== undefined) {
                    const result = this.comp.solves[solveId].result;
                    if (this.comp.solves[solveId].penalty === 'dnf') {
                        const solve = this.comp.solves[solveId];
                        retAverage.solves[solveId] = {
                            id: parseInt(solveId),
                            result: solve.result,
                            penalty: solve.penalty,
                            displayText: "#" + counter++ + ") DNF",
                            competitor: solve.competitor,
                        }
                        dnfCount++;
                        // message += ;
                    } else {
                        sum += result;
                        const solve = this.comp.solves[solveId];
                        retAverage.solves[solveId] = {
                            id: parseInt(solveId),
                            result: solve.result,
                            penalty: solve.penalty,
                            displayText: "#" + counter++ + ") " + result.toFixed(2)
                                + (this.comp.solves[solveId].penalty === 'none' ? '' : " ("
                                    + this.comp.solves[solveId].penalty + ")"),
                            competitor: solve.competitor,
                        }
                        nonDnfCounter++;
                        max = Math.max(max, result);
                        min = Math.min(min, result);
                    }
                }
            }
        }
        if (sum !== 0) {
            let average = ((sum - max - min) / (counter - 3)).toFixed(2);
            // console.log(sum);
            // console.log(min);
            if (counter < 1 + this.comp.solvesPerAverage) {
                average = 'TBD (' + (counter-1) + '/' + this.comp.solvesPerAverage + ')';
                retAverage.mean = 'TBD';
            } else {
                if (dnfCount === 1) average = ((sum - min) / (counter - 3)).toFixed(2);
                else if (dnfCount >= 2) {
                    if (this.comp.people[uid].type !== 'self_serve') average = 'DNF';
                    else average = ((sum - min) / (counter - 3 - (dnfCount - 1))).toFixed(2);
                }
                retAverage.mean = (sum / nonDnfCounter).toFixed(2);
            }
            retAverage.average = average;
            // message += "<br><br>Average: " + average;
            // message += "<br>Mean: " + ;
        }
        return retAverage;
    }

    /**
     * Forcefully change the result of a solve (in case it was entered incorrectly)
     * @param id {SolveId} the id of the solve to change
     * @param result {number} the result to change to
     */
    changeSolveResult(id: SolveId, result: number) {
        this.comp.solves[id].result = result;
    }

    /**
     * Forcefully change the penalty of a solve (in case it was entered incorrectly)
     * @param id {SolveId} the id of the solve to change
     * @param penalty {PENALTY} the penalty to change to
     */
    changeSolvePenalty(id: SolveId, penalty: string) {
        if (penalty === 'none' || penalty === '+2' || penalty === 'dnf') this.comp.solves[id].penalty = penalty;
    }
}