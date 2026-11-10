# Fernwood Animal Hotel (new edition)

A brand new take on Fernwood. You look down on a small hex-tile island like a
model on a table. Guests arrive on the morning ferry, you make each one a cosy
home, grant their wishes, and befriend the wild animals hiding in the mist.

The first Fernwood game is untouched. It still lives in `public/`, `server/`
and `shared/`.

## Play

You need [Node.js](https://nodejs.org) 20 or newer. From the project folder:

```bash
npm run v2
```

Then open **http://localhost:8793**. There is nothing to install. A hotel you
play on your own saves in the browser by itself.

## Play with friends

On the title screen choose **Play with friends**, then **Start a shared hotel**.
You get a five-letter code. Friends open the game, choose **Play with friends**,
type the code and join the same island. You can also bring a hotel you have
already been playing on your own.

Everyone in a shared hotel has their own keeper and shares the leaves, the bag
and the animals. The night only flies by once every keeper is in bed. Press
`H` to wave. There is no chat. The hotel is kept on the server, and waits
safely when nobody is playing.

Click the round picture next to your name to choose your keeper's hair,
clothes, hat and skin.

## How to play

| | |
|---|---|
| Walk | click the ground, or `W A S D` |
| Help an animal, water or pick a plant, pick something up, talk to someone | click it |
| Slide the view | drag |
| Turn the view | right-drag, or `Q` / `E` |
| Zoom | scroll |
| See through your keeper's eyes | `V`, or zoom all the way in. Click to look around with the mouse, `Esc` to let go of it |
| Wave to friends | `H` |
| Build | `B` |
| Friends book | `F` |
| Find your keeper | `Space` |
| Menu | `Esc` |

**Cosy homes.** Every animal loves two things near its home: 🌳 shade,
💧 water, 🌸 flowers, ☀️ sunshine, 🏮 glow or 🎈 play. Anything within two tiles
of a home counts, and next door counts double. The sea, sand, wild trees and
flowers count too, so where you build matters. Click a home to see its bars.

**Wishes.** Guests show a bubble when they want a snack, a cuddle, a game or a
bubble bath. Snacks grow in your garden and at the fishing spot on the pier.

**Hearts.** Cosy homes and granted wishes fill a guest's hearts. More hearts
mean a better review and more 🍃 leaves when they go home.

**Wild friends.** Eight wild animals are waiting to be found. Bring the snacks
they ask for and they follow you home for good. One only comes out after dark,
and one only in the rain.

**Stars.** Each star has a short list of goals and opens a new part of the
island: Whispering Woods, Sunny Meadow, Misty Lagoon and Highrock. The fifth
star ends with fireworks.

Sleep at the lodge after 7 in the evening to skip the night.

## Always something to do

Nothing in the game makes you sit and wait.

- **💧 Water plants.** Click a growing plant to water it and it shoots up.
  It is thirsty again a few moments later.
- **🎣 Fish.** Click the fishing spot on the pier at any time. Click again
  when the float dips to land two fish.
- **🐚 Pick things up.** Shells, driftwood, feathers and wild berries turn up
  all over the island, with rarer finds in each new region and star shards at
  night. Walk over one to pick it up.
- **🏙️ Port Marlow.** Cross the stone bridge east of the cove to the harbour
  town. Marigold's market buys everything and sells snacks and cake. The
  notice board always has three jobs. Quill at the post office always has a
  parcel to carry. Visitors with a suitcase in the square will come and stay
  if you invite them, so you need not wait for the ferry.
- **Town goods.** Helping the town unlocks six more things to build, from a
  park bench to a bandstand.

## What is different from the first game

- The view is a tilt-and-turn diorama, not first or third person.
- Building is about *where* things go (comfort from neighbours), not blocks
  and tools.
- Animals, plants and buildings are all drawn from code. There are no image or
  model files, and all sound is made on the spot.
- You can play on your own (saved in the browser) or with friends in a shared
  hotel (kept on the server).

## For developers

```bash
npm run test:v2
```

This runs a robot keeper through the whole game with no screen, to check that
all five stars can be earned, and checks that a save loads back. A second test
puts two robots in one shared hotel and checks that a copy of the world, kept
only from the server's messages, stays in step.

`serve.mjs` hands out the game's files and runs the shared hotels over a
WebSocket at `/ws`. The rules in `js/game.js` are the same code in both cases:
alone they run in the browser, in a shared hotel they run in `server/room.mjs`
and each browser (`js/net.js`) shows what the server tells it. Shared hotels
are saved as JSON under `data/worlds/`. Bump `VERSION` in `js/data.js` when
the rules or the map change, so old pages are told to reload.

The public copy of the page is on GitHub Pages and connects to the server at
`wss://games.tomibbotson.com/fernwood/ws`. To point a page at another server,
set `localStorage['fernwood2.server']` to its `ws://` or `wss://` address.

- `js/world.js` makes the island. `js/data.js` holds every animal, build and goal.
- `js/game.js` is the rules. `js/ui.js` is everything drawn over the world.
- `js/net.js` is a player's side of a shared hotel; `server/` is the server's.
- `js/gfx/` is the drawing: light and post-processing (`core.js`), land and
  sea (`terrain.js`), models (`props.js`), the town (`town.js`), animals
  (`critters.js`), effects (`fx.js`).
