# Web Comp Bot
### A Discord Bot + Web Application for running Rubik's Cube competitions
### Created by Michael Elia
### michaeljelia@gmail.com

---

## Prerequisites

A physical web server or other computer, with a public URL

[NodeJs](https://nodejs.org/en/download/)

[Typescript compiler](https://www.typescriptlang.org/download)

[Tnoodle CLI](https://github.com/SpeedcuberOSS/tnoodle-cli)

---

## Installation

1. Clone the repository
2. Install dependencies with `npm install`
3. Compile typescript with `tsc` in the top level directory
4. Create .env file in the top level directory with the following variables:

```
token=
URL=
PORT=
tnoodlePath=
```

`token` is the bot token from Discord

`URL` is the public URL of the web server

`PORT` is the port of the web server

`tnoodlePath` is the path to the tnoodle executable

5. Run the bot with `node .`
