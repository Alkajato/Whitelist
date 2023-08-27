import { OmeggaLike, OmeggaPlayer, PC, PS } from "omegga";
import { Config, Storage } from "omegga.plugin";
import path from "path";
import fs from "fs";

import Command, { TrustLevel } from "src/lib/commands";
import WhitelistManager from "src/lib/whitelist";

export class Runtime {
    public static omegga: OmeggaLike;
    public static config: PC<Config>;
    public static store: PS<Storage>;

    public static getPluginPath() {
        return `${path.dirname(path.dirname(__filename))}`;
    }

    // Remove all active players on server who are unwhitelisted.
    private static kickMessage = "Whitelist enforced, you are not on the whitelist."
    private static async kickUnwhitelisted() {
        const players = Runtime.omegga.getPlayers();
        for (const player of players) {
            const kick = await WhitelistManager.validateIncomingUser(player.name, player.id) == false
            if (kick)
                Runtime.omegga.writeln(`Chat.Command /kick "${player.name}" ${Runtime.kickMessage}`);
        }
    }

    // Returns status of if whitelist kicking is enabled.
    private static enableDisableCheck() {
        const unpassworded = fs.readFileSync(path.join(Runtime.omegga.configPath, "../Config/LinuxServer/ServerSettings.ini"), "utf-8").match(/ServerPassword=.+/) ===
            null;

        if (unpassworded) {
            const host = this.omegga.getPlayers().find(player => this.omegga.findPlayerByName(player.name).isHost())
            const message = "Unethical use of whitelist, enforce a password to use whitelist."

            // Leave annoying console.log spam with or without host present if server returned disabled-whitelist status.
            console.log(message);
            if (host) {
                this.omegga.whisper(host.name, message);
            }
        }

        return !unpassworded;
    }

    public static async main(omegga: OmeggaLike, config: PC<Config>, store: PS<Storage>): Promise<{ registeredCommands: string[] }> {
        this.omegga = omegga;
        this.config = config;
        this.store = store;

        setInterval(() => {
            if (Runtime.enableDisableCheck())
                Runtime.kickUnwhitelisted()
        }, 60000);

        WhitelistManager.createWhitelistJson();

        new Command("whitelist", TrustLevel.Host, (speaker: string, ...desired_username_or_uuid: string[]) => {
            if (desired_username_or_uuid[0].length === 36) {
                WhitelistManager.addUser(undefined, desired_username_or_uuid[0]);
            } else {
                WhitelistManager.addUser(desired_username_or_uuid.join().replace(",", " "), undefined);
            }

            this.omegga.whisper(speaker, `User ''${desired_username_or_uuid.join().replace(",", " ")}'' has been added to the whitelist!`);
        });

        new Command("unwhitelist", TrustLevel.Host, (speaker: string, ...desired_username_or_uuid: string[]) => {
            if (desired_username_or_uuid[0].length === 36) {
                WhitelistManager.removeUser(undefined, desired_username_or_uuid[0]);
            } else {
                const userName = desired_username_or_uuid.join().replace(",", " ")

                WhitelistManager.removeUser(userName, undefined)
                if (Runtime.enableDisableCheck())
                    this.omegga.writeln(`Chat.Command /kick "${userName}" ${Runtime.kickMessage}`);
            }
            this.omegga.whisper(speaker, `User ''${desired_username_or_uuid.join().replace(",", " ")}'' has been removed to the whitelist!`);
        });

        Runtime.omegga.on("join", async (player: { name: string; id: string; state: string; controller: string }) => {
            if (Runtime.enableDisableCheck()) {
                const authorized = await WhitelistManager.validateIncomingUser(player.name, player.id);
                if (!authorized) {
                    // kick the player, lol!
                    this.omegga.writeln(`Chat.Command /kick "${player.name}" ${Runtime.kickMessage}`);
                }
            }
        });

        return { registeredCommands: Command.getList() };
    }
}
