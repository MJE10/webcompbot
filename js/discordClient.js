"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// noinspection JSCheckFunctionSignatures
const discord_js_1 = require("discord.js");
const fs = require('fs');
const discord_js = require('discord.js');
const { Intents } = discord_js;
require('dotenv').config();
class DiscordClient {
    constructor(dataInput) {
        this.onUsersReact = (users) => { };
        this.onDataChanged = (data) => { };
        this.data = dataInput;
        this.client = new discord_js_1.Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS] });
        this.client.once('ready', () => __awaiter(this, void 0, void 0, function* () {
            console.log('Ready!');
            const channel = yield this.client.channels.fetch(this.constants.CHANNEL_HOME);
            if (channel) {
                yield channel.messages.fetch(this.constants.MESSAGE_HOME);
            }
        }));
        this.constants = {
            GUILD_ID: '881234639736414279',
            CHANNEL_HOME: '921977324101046302',
            CATEGORY_COMPETITIONS: '886085837241085963',
            CHANNEL_RESULTS: '893985464955072573',
            RESULTS_MESSAGE: '893986058377785364',
            ROLE_MODERATOR: '886246346779144252',
            MESSAGE_HOME: '921977727093973073',
            CLIENT_SNOWFLAKE: '886086206444687393',
            MJE10_SNOWFLAKE: '159045740457361409'
        };
        this.waitingUsers = [];
        this.client.on('messageReactionAdd', (reaction) => __awaiter(this, void 0, void 0, function* () {
            const users = (yield reaction.users.fetch()).keys();
            // console.log(users);
            let first = users.next().value;
            if (first !== this.constants.CLIENT_SNOWFLAKE)
                yield reaction.remove();
            while (first !== undefined) {
                if (first !== this.constants.CLIENT_SNOWFLAKE)
                    this.waitingUsers.push(first);
                first = users.next().value;
            }
            this.onUsersReact(this.waitingUsers);
            this.waitingUsers = [];
            yield reaction.message.react("👍");
        }));
        this.client.login(process.env.token).then();
    }
    onUserLinkGenerated(user, link) {
        return __awaiter(this, void 0, void 0, function* () {
            let discordUser = yield this.client.users.fetch(user);
            if (user in this.data.userLinkChannels) {
                const guild = yield this.client.guilds.fetch(this.constants.GUILD_ID);
                const channel = yield guild.channels.fetch(this.data.userLinkChannels[user]);
                yield channel.delete();
                delete this.data.userLinkChannels[user];
            }
            const guild = yield this.client.guilds.fetch(this.constants.GUILD_ID);
            const new_channel = yield guild.channels.create(discordUser.username, { parent: this.constants.CATEGORY_COMPETITIONS });
            this.data.userLinkChannels[user] = new_channel.id;
            this.onDataChanged(this.data);
            yield new_channel.permissionOverwrites.create(user, { 'VIEW_CHANNEL': true, 'SEND_MESSAGES': true });
            yield new_channel.send('<@' + user + '> Click this link to go to your page: ' + link);
        });
    }
    onUserClickedLink(user) {
        return __awaiter(this, void 0, void 0, function* () {
            if (user in this.data.userLinkChannels) {
                const guild = yield this.client.guilds.fetch(this.constants.GUILD_ID);
                const channel = yield guild.channels.fetch(this.data.userLinkChannels[user]);
                yield channel.delete();
                delete this.data.userLinkChannels[user];
                this.onDataChanged(this.data);
            }
        });
    }
    isAdmin(id) {
        return id === this.constants.MJE10_SNOWFLAKE;
    }
}
exports.default = DiscordClient;
