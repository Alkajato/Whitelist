import path from "path";
import fs from "fs";
import { Runtime } from "src/runtime/main";

type WhitelistJSON = {
    players: Array<{ username: string; uuid: string }>;
};

export default class WhitelistManager {
    private static whitelistPath = path.join(Runtime.pluginPath, "whitelist.json");

    public static addUser(username?: string, uuid?: string) {
        let whitelist = this.readWhitelistFile();

        if (username !== undefined) {
            const player = Runtime.omegga.getPlayer(username);

            if (player === undefined) {
                whitelist.players = whitelist.players.filter((v) => v.username !== username);
                whitelist.players.push({ username: username, uuid: null });
            } else {
                whitelist.players = whitelist.players.filter((v) => v.username !== player.name && v.uuid !== player.id);
                whitelist.players.push({ username: player.name, uuid: player.id });
            }
        }

        if (uuid !== undefined) {
            const player = Runtime.omegga.getPlayer(username);

            if (player === undefined) {
                whitelist.players = whitelist.players.filter((v) => v.uuid !== uuid);
                whitelist.players.push({ username: null, uuid: uuid });
            } else {
                whitelist.players = whitelist.players.filter((v) => v.username !== player.name && v.uuid !== player.id);
                whitelist.players.push({ username: player.name, uuid: player.id });
            }
        }

        this.writeWhitelistFile(whitelist);
    }

    public static removeUser(username?: string, uuid?: string) {
        let whitelist = this.readWhitelistFile();

        if (username !== undefined) {
            const player = Runtime.omegga.getPlayer(username);

            if (player === undefined) {
                whitelist.players = whitelist.players.filter((v) => v.username !== username);
            } else {
                whitelist.players = whitelist.players.filter((v) => v.username !== player.name && v.uuid !== player.id);
            }
        }

        if (uuid !== undefined) {
            const player = Runtime.omegga.getPlayer(username);

            if (player === undefined) {
                whitelist.players = whitelist.players.filter((v) => v.uuid !== uuid);
            } else {
                whitelist.players = whitelist.players.filter((v) => v.username !== player.name && v.uuid !== player.id);
            }
        }

        this.writeWhitelistFile(whitelist);
    }

    public static validateIncomingUser(username: string, uuid: string): boolean {
        let authorized = false;

        let whitelist = this.readWhitelistFile();
        for (let i = 0; i < whitelist.players.length; i++) {
            const playerInfo = whitelist.players[i];

            if (Runtime.omegga.getPlayer(username).isHost()) authorized = true;

            // exclusion cases
            if (playerInfo.username === username && playerInfo.uuid !== uuid && playerInfo.uuid != undefined) break;

            // inclusion cases
            if (playerInfo.username === username && playerInfo.uuid === uuid) authorized = true;
            // inclusion cases with updates
            if (playerInfo.username === username && playerInfo.uuid == undefined) {
                authorized = true;
                this.addUser(username);
            }
            if (playerInfo.username == undefined && playerInfo.uuid === uuid) {
                authorized = true;
                this.addUser(uuid);
            }
            if (playerInfo.username !== username && playerInfo.uuid === uuid) {
                authorized = true;
                this.addUser(uuid);
            }
        }

        return authorized;
    }

    public static createWhitelistJson() {
        if (!fs.existsSync(this.whitelistPath)) {
            fs.writeFileSync(this.whitelistPath, "");
        }
    }

    private static readWhitelistFile(): WhitelistJSON {
        return JSON.parse(fs.readFileSync(this.whitelistPath, "utf-8"));
    }

    private static writeWhitelistFile(whitelist: WhitelistJSON): void {
        return fs.writeFileSync(this.whitelistPath, JSON.stringify(whitelist), { encoding: "utf-8" });
    }
}
