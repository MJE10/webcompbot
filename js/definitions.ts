import {Snowflake} from "discord.js";

export type event = "three" | "four" | "apple"

export type CompBotUser = Snowflake | string

export type UserLinkChannels = { [key: CompBotUser]: Snowflake };