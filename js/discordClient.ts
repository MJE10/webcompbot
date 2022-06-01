// noinspection JSCheckFunctionSignatures
import {
    Client,
    TextChannel,
    Intents,
    Snowflake
} from "discord.js";
import {CompBotUser, UserLinkChannels} from "./definitions";

require('dotenv').config();

interface DiscordClientData {
    userLinkChannels: UserLinkChannels;
}

export default class DiscordClient {
    private readonly data: DiscordClientData;

    client: Client;
    constants: {
        CHANNEL_HOME: Snowflake,
        CHANNEL_RESULTS: Snowflake,
        MESSAGE_RESULTS: Snowflake,
        MESSAGE_HOME: Snowflake,
        USER_CLIENT: Snowflake,
        USER_MJE10: Snowflake
        ROLE_MODERATOR: Snowflake,
        CATEGORY_COMPETITIONS: Snowflake,
        GUILD_ID: Snowflake,
    }
    private waitingUsers: Snowflake[];

    public onUsersReact = (users: string[]): void => {};
    public onDataChanged = (data: DiscordClientData): void => {};

    constructor(dataInput: DiscordClientData) {

        this.data = dataInput;

        this.client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS] });

        this.client.once('ready', async () => {
            console.log('Ready!');
            const channel = await this.client.channels.fetch(this.constants.CHANNEL_HOME);
            if (channel) {
                await (channel as TextChannel).messages.fetch(this.constants.MESSAGE_HOME);
            }
        });

        this.constants = {
            GUILD_ID: '881234639736414279',
            CHANNEL_HOME: '921977324101046302',
            CATEGORY_COMPETITIONS: '886085837241085963',
            CHANNEL_RESULTS: '893985464955072573',
            MESSAGE_RESULTS: '893986058377785364',
            ROLE_MODERATOR: '886246346779144252',
            MESSAGE_HOME: '921977727093973073',
            USER_CLIENT: '886086206444687393',
            USER_MJE10: '159045740457361409'
        }

        this.waitingUsers = [];

        this.client.on('messageReactionAdd', async reaction => {
            const users = (await reaction.users.fetch()).keys();
            // console.log(users);
            let first: Snowflake | undefined = users.next().value;
            if (first !== this.constants.USER_CLIENT) await reaction.remove();
            while (first !== undefined) {
                if (first !== this.constants.USER_CLIENT) this.waitingUsers.push(first);
                first = users.next().value;
            }
            this.onUsersReact(this.waitingUsers);
            this.waitingUsers = [];
            await reaction.message.react("👍");
        });

        this.client.login(process.env.TOKEN).then();
    }

    async onUserLinkGenerated(user: CompBotUser, link: string) {
        let discordUser = await this.client.users.fetch(user);

        const channel = await this.getUserChannel(user);
        if (channel != null) {
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

    async onUserClickedLink(user: CompBotUser) {
        const channel = await this.getUserChannel(user);
        if (channel != null) {
            await channel.delete();
            delete this.data.userLinkChannels[user];
            this.onDataChanged(this.data);
        }
    }

    async getUserChannel(user: CompBotUser): Promise<TextChannel | null> {
        if (!(user in this.data.userLinkChannels)) return null;

        const guild = await this.client.guilds.fetch(this.constants.GUILD_ID);
        const channel = await guild.channels.fetch(this.data.userLinkChannels[user]);
        if (channel instanceof TextChannel)
            return channel;

        console.error(`Channel ${this.data.userLinkChannels[user]} is not a text channel`);
        return null;
    }

    isAdmin(id: Snowflake): boolean {
        return id === this.constants.USER_MJE10;
    }
}