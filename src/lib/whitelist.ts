import path from "path";
import fs from "fs";
import { Runtime } from "src/runtime/main";
import { OmeggaPlayer } from "omegga";

type WhitelistJSON = {
    players: Array<{ username: string; uuid: string }>;
};

export default class WhitelistManager {
    private static getWhitelistPath() {
        return path.join(Runtime.getPluginPath(), "whitelist.json");
    }

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

    public static async validateIncomingUser(username: string, uuid: string): Promise<boolean> {
        let authorized = false;

        let whitelist = this.readWhitelistFile();

        let player: OmeggaPlayer = undefined;
        for (let i = 0; i < 10; i++) {
            await new Promise<void>((res) => {
                setTimeout(() => {
                    player = Runtime.omegga.getPlayer(username);
                    if (player === undefined) {
                        res();
                        return;
                    }
                    if (player.isHost()) authorized = true;
                    res();
                }, 5);
            });
        }

        for (let i = 0; i < whitelist.players.length; i++) {
            const playerInfo = whitelist.players[i];

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
        if (!fs.existsSync(this.getWhitelistPath())) {
            fs.writeFileSync(this.getWhitelistPath(), `{"players":[]}`);
        }
    }

    private static readWhitelistFile(): WhitelistJSON {
        return JSON.parse(fs.readFileSync(this.getWhitelistPath(), "utf-8"));
    }

    private static writeWhitelistFile(whitelist: WhitelistJSON): void {
        return fs.writeFileSync(this.getWhitelistPath(), JSON.stringify(whitelist), { encoding: "utf-8" });
    }
}
