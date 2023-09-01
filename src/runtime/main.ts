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

    public static enabled: boolean;

    // Enable or disable whitelist based off if passworded or not.
    private static enableDisableCheck() {
        const unpassworded =
            fs.readFileSync(path.join(Runtime.omegga.configPath, "../Config/LinuxServer/ServerSettings.ini"), "utf-8").match(/ServerPassword=.+/) ===
            null;

        if (unpassworded) {
            Runtime.enabled = false;

            const host = this.omegga.getPlayers().find((player) => this.omegga.findPlayerByName(player.name).isHost());
            const message = "Unethical use of whitelist, enforce a password to use whitelist.";

            // Leave annoying console.log spam with or without host present if server returned disabled-whitelist status.
            console.log(message);
            if (host) {
                this.omegga.whisper(host.name, message);
            }
        } else {
            Runtime.enabled = true;
        }
    }

    public static async main(omegga: OmeggaLike, config: PC<Config>, store: PS<Storage>): Promise<{ registeredCommands: string[] }> {
        this.omegga = omegga;
        this.config = config;
        this.store = store;

        Runtime.enableDisableCheck();
        setInterval(() => Runtime.enableDisableCheck(), 60000);

        WhitelistManager.createWhitelistJson();

        new Command("whitelist", TrustLevel.Host, (speaker: string, ...desired_username_or_uuid: string[]) => {
            if (desired_username_or_uuid[0].length === 36) {
                WhitelistManager.addUser(undefined, desired_username_or_uuid[0]);
            } else {
                WhitelistManager.addUser(desired_username_or_uuid.join(" "), undefined);
            }

            this.omegga.whisper(speaker, `User ''${desired_username_or_uuid.join(" ")}'' has been added to the whitelist!`);
        });

        new Command("unwhitelist", TrustLevel.Host, (speaker: string, ...desired_username_or_uuid: string[]) => {
            if (desired_username_or_uuid[0].length === 36) {
                WhitelistManager.removeUser(undefined, desired_username_or_uuid[0]);
            } else {
                const userName = desired_username_or_uuid.join(" ");

                WhitelistManager.removeUser(userName, undefined);

                Runtime.enableDisableCheck();
                if (Runtime.enabled) this.omegga.writeln(`Chat.Command /kick "${userName}" "Whitelist enforced, you are not on the whitelist."`);
            }
            this.omegga.whisper(speaker, `User ''${desired_username_or_uuid.join(" ")}'' has been removed to the whitelist!`);
        });

        Runtime.omegga.on("join", async (player: { name: string; id: string; state: string; controller: string }) => {
            if (!Runtime.enabled) return;

            const authorized = await WhitelistManager.validateIncomingUser(player.name, player.id);
            if (!authorized) {
                // kick the player, lol!
                this.omegga.writeln(`Chat.Command /kick "${player.name}" "Whitelist enforced, you are not on the whitelist."`);
            }
        });

        return { registeredCommands: Command.getList() };
    }
}
