import { OmeggaLike, OmeggaPlayer, PC, PS } from "omegga";
import { Config, Storage } from "omegga.plugin";
import path from "path";

import Command, { TrustLevel } from "src/lib/commands";
import WhitelistManager from "src/lib/whitelist";

export class Runtime {
    public static omegga: OmeggaLike;
    public static config: PC<Config>;
    public static store: PS<Storage>;

    public static getPluginPath() {
        return `${path.dirname(path.dirname(__filename))}`;
    }

    public static async main(omegga: OmeggaLike, config: PC<Config>, store: PS<Storage>): Promise<{ registeredCommands: string[] }> {
        this.omegga = omegga;
        this.config = config;
        this.store = store;

        //TODO: read server settings to detect if there's a password, if there isn't a password, disable the plugin

        new Command("whitelist_add", TrustLevel.Host, (speaker: string, ...desired_username_or_uuid: string[]) => {
            if (desired_username_or_uuid[0].length === 36) {
                WhitelistManager.addUser(undefined, desired_username_or_uuid[0]);
            } else {
                WhitelistManager.addUser(desired_username_or_uuid.join().replace(",", " "), undefined);
            }

            this.omegga.whisper(speaker, `User ''${desired_username_or_uuid.join().replace(",", " ")}'' has been added to the whitelist!`);
        });

        new Command("whitelist_remove", TrustLevel.Host, (speaker: string, ...desired_username_or_uuid: string[]) => {
            if (desired_username_or_uuid[0].length === 36) {
                WhitelistManager.removeUser(undefined, desired_username_or_uuid[0]);
            } else {
                WhitelistManager.removeUser(desired_username_or_uuid.join().replace(",", " "), undefined);
            }
            this.omegga.whisper(speaker, `User ''${desired_username_or_uuid.join().replace(",", " ")}'' has been removed to the whitelist!`);
        });

        WhitelistManager.createWhitelistJson();

        Runtime.omegga.on("join", async (player: { name: string; id: string; state: string; controller: string }) => {
            const authorized = await WhitelistManager.validateIncomingUser(player.name, player.id);
            if (!authorized) {
                // kick the player, lol!
                this.omegga.writeln(`Chat.Command /kick "${player.name}" "Whitelist enforced, you are not on the whitelist."`);
            }
        });

        return { registeredCommands: Command.getList() };
    }
}
