import {Snowflake} from "discord.js";

export type event = "three" | "four" | "apple"

export type CompBotUser = Snowflake | string

export type CompBotToken = string

export type CompBotUuid = string

export type UserLinkChannels = { [key: CompBotUser]: Snowflake };

export type CompBotWebSocketMessageEventType =
    "ping uid" | "click" | "action subscribe" | "control subscribe" | "saveComp" | "renameComp" |
    "setSolvesPerAverage" | "setShowDead" | "togglePartner" | "setConfirmTimes" | "setShowCompetitorAsCupName" |
    "autoCupSelect" | "newComp" | "loadComp" | "editSetting" | "solveChangeResult" | "solveChangePenalty" |
    "choosePersonType" | "choosePersonCup" | "regenerateActions" | "personChangeDisplayName" | "personDie" |
    "newCup" | "newToken";

type MessageBase = {
    uid: string,
    token: string,
    eType: CompBotWebSocketMessageEventType,
}

type SimpleMessage = MessageBase & {
    eType: "ping uid" | "action subscribe" | "saveComp" | "setShowDead" | "togglePartner" | "setConfirmTimes" |
        "setShowCompetitorAsCupName" | "autoCupSelect" | "regenerateActions" | "control subscribe";
}

type NameMessage = MessageBase & {
    eType: "renameComp" | "newComp" | "newCup",
    name: string,
}

type NumberMessage = MessageBase & {
    eType: "setSolvesPerAverage",
    number: number,
}

type IdMessage = MessageBase & {
    eType: "loadComp" | "personDie",
    id: string,
}

type SettingMessage = MessageBase & {
    eType: "editSetting",
    setting: string,
    value: string,
}

type SolveChangeMessage = MessageBase & {
    eType: "solveChangeResult",
    id: string,
    result: string,
}

type PenaltyChangeMessage = MessageBase & {
    eType: "solveChangePenalty",
    id: string,
    penalty: string,
}

type PersonCupChangeMessage = MessageBase & {
    eType: "choosePersonCup",
    id: string,
    cup: string,
}

type PersonNameChangeMessage = MessageBase & {
    eType: "personChangeDisplayName",
    id: string,
    name: string,
}

type ChoosePersonTypeMessage = MessageBase & {
    eType: "choosePersonType",
    id: string,
    type: string,
}

type NewTokenMessage = MessageBase & {
    eType: "newToken",
    user: string,
}

type ClickMessage = MessageBase & {
    eType: "click",
    click: string,
}

export type CompBotWebSocketMessage = SimpleMessage | NameMessage | NumberMessage | IdMessage | SettingMessage |
    SolveChangeMessage | PenaltyChangeMessage | PersonCupChangeMessage |
    PersonNameChangeMessage | NewTokenMessage | ChoosePersonTypeMessage | ClickMessage;