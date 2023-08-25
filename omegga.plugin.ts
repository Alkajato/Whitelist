import OmeggaPlugin, { OL, PS, PC, OmeggaPlayer } from 'omegga';
import rd from 'readline';
import fs from 'fs';

const whitelistFile = `./plugins/whitelist/whitelist.txt`;

// Truth table for if a player is considered whitelist.
// If name and ID are in whitelist, included.
// If name included but ID missing, included.
// If ID included but name missing, included.
// If name included but ID is wrong, excluded.
// If ID included but name is wrong, included.

// Returns name if found in input, and id if found in input.
// Each respective item is undefined if not found in input.
function includedPair(inputs: string[], name: string, id: string) {
  // let [foundName, foundID] = inputs.map(line => line.split('\t')).find(split => {
  let both = inputs.map(line => line.split('\t')).find(split => {
    // ID is missing? Check if name passes.
    if (split[1] == undefined) {
      return split[0] === name;
    }
    const bothMatch = split[0] === name && split[1] === id;
    // Cover if a player changed their name, since you can't change ID.
    const onlyID = split[0] != name && split[1] === id;

    bothMatch || onlyID
  });

  return both;
}

type Config = { foo: string };
type Storage = { bar: string };

export default class Plugin implements OmeggaPlugin<Config, Storage> {
  omegga: OL;
  config: PC<Config>;
  store: PS<Storage>;

  constructor(omegga: OL, config: PC<Config>, store: PS<Storage>) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
  }

  /// Returns string colored by role color.
  /// Returns fallback if player is null or undefined.
  decorateName(player: OmeggaPlayer, fallback: string) {
    if (player) {
      return `<b><color=\\"${player.getNameColor()}\\">${player.name}</></b>`; // The two \'s are required?
    } else {
      return fallback;
    }
  }

  // Returns data from whitelist as string
  // Single point of interest to handle how whitelist is retrieved-.
  retrieveWhitelist() {
    return fs.readFileSync(whitelistFile).toString();
  }

  // Return [player, playerID] from line.
  // Return undefined if cannot find it.
  tupleFromLine(line: string) {
    // Whitelist is structured as: name with or without spaces\tID\n
    // Parse by finding end of line, work backwards, encounter \t, that's "ID" string.
    // The rest is then the player name--trim though.


    for (let i = line.length - 1; i > 0; i--) {
      // We found a separating space.
      if (line[i] == '\t') {
        let foundPlayer = line.slice(0, i).trim();
        let userID = line.slice(i).trim();

        return [foundPlayer, userID];
      }
    }

    // Return undefined if we did not early-return with results.
    return undefined;
  }

  // If name and ID are in whitelist, included.

  // If name included but ID missing, included.
  // If ID included but name missing, included.

  // If name included but ID is wrong, excluded.
  // If ID included but name is wrong, included.
  // Check if the name is in whitelist or if the ID is in the whitelist.
  playerIncluded(name: string, id: string) {
    const fileLines = this.retrieveWhitelist().split('\n');

    // False if not a single line passes.
    return fileLines.some(line => {
      const tuple = this.tupleFromLine(line);

      // Can't get both a playerName and ID
      if (tuple == undefined) {
        // The line itself may be a complete name or ID.
        const trimmed = line.trim();
        if (name == trimmed || id == trimmed) {
          // We should repair the whitelist file to include both though.

          this.omegga.broadcast(`Incomplete match for ${name} due to missing data`);
          return true;
        }

        // Tuple is undefined but name or id don't match.
        return false;
      }

      // We found a separating \t.
      const foundPlayer = tuple[0];
      const userID = tuple[1];

      // Complete match.
      if (foundPlayer == name && userID == id) {
        return true;
      }

      // Only ID matched.
      // Allowed since you can't change ID, but you may have changed name.
      if (userID == id) {
        // insert foundPlayer before the ID in whitelist though.
        this.omegga.broadcast(`Incomplete match for ${name} due to changed name`);
        return true;
      }
    });
  }

  async init() {
    // Test command to be removed when release is complete.
    // Swap out what this does when needed.
    this.omegga.on('cmd:test', (player: string, ...args: string[]) => {
      const caller = this.omegga.getPlayer(player);

      switch (args[0]) {
        case "0": {
          const result = this.tupleFromLine(`test\tFFFF`) ?? " ";
          this.omegga.whisper(caller, `Test tupleFromLine: { ${result} }`);
          break;
        };
        case "1": {
          const result = this.playerIncluded(caller.name, caller.id);
          this.omegga.whisper(caller, `Test playerIncluded: { ${result} }`);
          break;
        };
        case "2": {
          const entries = this.retrieveWhitelist().split('\n');
          const pair = includedPair(entries, caller.name, caller.id);

          console.log("Is pair undefined? " + pair == undefined);

          // console.log(`Testing name: ${pair[0]}`);
          // console.log(`Testing id: ${pair[1]}`);
        };
      }
    });

    this.omegga.on('join', player => {
      // Create whitelist file if not present.
      // todo.

      // Check if player is present in whitelist.
      const included = this.playerIncluded(player.name, player.id);
      this.omegga.broadcast(`Is ${player.name} allowed? ${included}.`);
    });


    this.omegga.on('cmd:whitelist', (player: string, ...args: string[]) => {
      const caller = this.omegga.getPlayer(player);

      // No permissions if not server host. No viewing, no help, no adding or removing.
      if (!caller.isHost()) {
        this.omegga.whisper(caller, "You are not allowed to modify the whitelist");
        return;
      }

      // If no args given print help message.
      if (args.length == 0) {
        this.omegga.whisper(caller, "Print whitelist help");
        return;
      }

      // If first arg is "remove" and a name is after, it's a removal.
      // If there's only remove.. the player is named remove?
      const removal = args[0] == "remove" && args.length > 1;
      const splitAt = removal ? 1 : 0;

      const playerArg = args.slice(splitAt).join(' ');
      const foundPlayer = this.omegga.findPlayerByName(playerArg);

      // If foundPlayer, use .name since it has complete name incase user partially typed name.
      const playerName = foundPlayer ? foundPlayer.name : playerArg;
      const decoratedName = this.decorateName(foundPlayer, playerName);
      if (removal) {
        this.omegga.whisper(caller, `Removed "${decoratedName}" from whitelist.`);
        this.omegga.writeln(`Chat.Command /kick "${playerName}" "Whitelist enforced, you are not on the whitelist."`);

        // File system operation to remove playerName and ID from whitelist.txt.
      } else {
        this.omegga.whisper(caller, `Added "${decoratedName}" to whitelist.`);

        // File system operation to add playerName and ID to whitelist.txt, then add newline.
        // If it's not already present it shouldn't be added though, merely repaired.
        fs.appendFileSync(whitelistFile, `${playerName}\t${foundPlayer.id}\n`);
      }
    });

    return { registeredCommands: ['whitelist', 'test'] };
  }

  async stop() {
    // Anything that needs to be cleaned up...
    this.omegga.removeAllListeners('player.join');
  }
}
