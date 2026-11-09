# Project X

A quick card game for 2-6 friends, in beta. Everyone calls an element, which can be a lie, then plays a card at the same time. Last player standing wins. Full rules are in [RULES.md](RULES.md).

**Play:** https://samiebelal.github.io/project-x/

## Playing with friends

1. One person enters a name and selects **Create room**.
2. They share the 4-letter code or the invite link.
3. Everyone chooses a sub-element, and the host starts the game. A game needs at least 2 players, and bots can fill empty seats.

The host's browser runs the game, so:

- The host should stay on that tab until the game ends, ideally on a computer. If the host closes it, the game ends for everyone.
- Anyone else can refresh or briefly lose connection and get their seat back. While they're gone, the game plays for them.
- Some networks block direct connections. If someone can't join, they should try mobile data.

## Working on it

There's no build step and nothing to install.

- `index.html` is the game. Serve the folder or open the file directly.
- `node --test` runs the rules and room tests.
- `node sim.js` runs the balance simulator.
- `dev.html` is the effects playground: every card hit and power is one click away, with slow motion. `dev.html?play=seismic` plays one as soon as the page opens.
- `index.html` loads every file with a `?v=` tag. Change it on every release so browsers don't mix old and new files.
- `index.html?dev` starts practice games with everyone at full charge and bots always using their power. `?dev=seismic` gives every bot that power.

| File | What it does |
|---|---|
| `engine.js` | The rules |
| `bots.js` | Bot players |
| `host.js` | Runs a room, and decides what each player can see |
| `net.js` | Connects browsers with [PeerJS](https://peerjs.com/) |
| `ui.js`, `art.js`, `style.css` | The screens and placeholder card art |
| `help.js`, `help.css` | The how-to-play walkthrough |
| `fx.js` | Hit and power animations |
| `dev.html`, `dev.js`, `dev.css` | The effects playground |
| `mock-*.html` | Design mocks for each tutorial page. `mock-tutorial.html` plays the picked designs in order |
| `music.js` | Background music, with the volume set at the top of the file |
| `sim.js` | Balance simulator |

Project X is a working name. It's a fan-made beta, not affiliated with Avatar: The Last Airbender or Club Penguin.
