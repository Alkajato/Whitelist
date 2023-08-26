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

        new Command("whitelist_add", TrustLevel.Host, (speaker: string, desired_username: string) => {
            WhitelistManager.addUser(desired_username);
            this.omegga.whisper(speaker, `User ''${desired_username}'' has been added to the whitelist!`);
        });

        new Command("whitelist_remove", TrustLevel.Host, (speaker: string, desired_username: string) => {
            WhitelistManager.removeUser(desired_username);
            this.omegga.whisper(speaker, `User ''${desired_username}'' has been removed to the whitelist!`);
        });

        WhitelistManager.createWhitelistJson();

        Runtime.omegga.on("join", (player: { name: string; id: string; state: string; controller: string }) => {
            const authorized = WhitelistManager.validateIncomingUser(player.name, player.id);
            this.omegga.broadcast(`Is ${player.name} allowed? ${authorized}.`);
            if (!authorized) {
                // kick the player, lol!
                //this.omegga.writeln(`Chat.Command /kick "${player.name}" "Whitelist enforced, you are not on the whitelist."`);
            }
        });

        return { registeredCommands: Command.getList() };
    }
}
