import { Runtime } from "src/runtime/main";

export enum TrustLevel {
    "Default",
    "Host",
}

export default class Command {
    private static command_list: string[] = [];

    public name: string;
    public trust_level: TrustLevel;
    public listener: (speaker: string, ...commandArgs: string[]) => void;

    constructor(name: string, trust_level: TrustLevel, listener: (speaker: string, ...commandArgs: string[]) => void) {
        this.name = name;
        this.trust_level = trust_level;
        this.listener = listener;

        if (name.match(/"|'/)) {
            throw new Error(`Command ${name} contains an erroneous character. Commands cannot contain ' or " in its name.`);
        }

        Runtime.omegga.on(`cmd:${name}`, (speaker: string, ...args: string[]) => {
            let player = Runtime.omegga.getPlayer(speaker);

            if (!(player.isHost() || this.trust_level === TrustLevel.Default)) {
                Runtime.omegga.whisper(speaker, "You do not have permission to use this command.");
                return;
            }

            listener(speaker, ...args);
        });
        Command.command_list.push(name);
    }

    public static getList(): string[] {
        return Command.command_list;
    }
}
