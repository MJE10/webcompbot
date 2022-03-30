// noinspection JSCheckFunctionSignatures
const fs = require('fs');

const discord_js = require('discord.js');
const { Client, Intents } = discord_js;

require('dotenv').config();

module.exports = class DiscordClient {

    constructor(dataInput) {

        this.data = dataInput;

        this.client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS] });

        this.client.once('ready', async () => {
            console.log('Ready!');
            await (await this.client.channels.fetch(this.constants.CHANNEL_HOME)).messages.fetch(this.constants.MESSAGE_HOME);
        });

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
        }

        this.waitingUsers = [];

        this.client.on('messageReactionAdd', async reaction => {
            const users = (await reaction.users.fetch()).keys();
            // console.log(users);
            let first = users.next().value;
            if (first !== this.constants.CLIENT_SNOWFLAKE) await reaction.remove();
            while (first !== undefined) {
                if (first !== this.constants.CLIENT_SNOWFLAKE) this.waitingUsers.push(first);
                first = users.next().value;
            }
            this.onUsersReact(this.waitingUsers);
            this.waitingUsers = [];
            await reaction.message.react("👍");
        });

        this.client.login(process.env.token).then();
    }

    async onUserLinkGenerated(user, link) {
        let discordUser = await this.client.users.fetch(user);

        if (user in this.data.userLinkChannels) {
            const guild = await this.client.guilds.fetch(this.constants.GUILD_ID);
            const channel = await guild.channels.fetch(this.data.userLinkChannels[user]);
            await channel.delete();
            delete this.data.userLinkChannels[user];
        }

        const guild = await this.client.guilds.fetch(this.constants.GUILD_ID);
        const new_channel = await guild.channels.create(discordUser.username, {parent: this.constants.CATEGORY_COMPETITIONS});

        this.data.userLinkChannels[user] = new_channel.id;
        this.onDataChanged(this.data);

        await new_channel.permissionOverwrites.create(user, {'VIEW_CHANNEL': true, 'SEND_MESSAGES': true});
        await new_channel.send('<@' + user + '> Click this link to go to your page: ' + link);
    }

    async onUserClickedLink(user) {
        if (user in this.data.userLinkChannels) {
            const guild = await this.client.guilds.fetch(this.constants.GUILD_ID);
            const channel = await guild.channels.fetch(this.data.userLinkChannels[user]);
            await channel.delete();
            delete this.data.userLinkChannels[user];
            this.onDataChanged(this.data);
        }
    }

    isAdmin(id) {
        return id === this.constants.MJE10_SNOWFLAKE;
    }

    onUsersReact = () => {};
    onDataChanged = () => {};
}