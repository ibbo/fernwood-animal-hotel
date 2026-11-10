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

Then open **http://localhost:8793**. There is nothing to install. The game
saves in the browser by itself.

## How to play

| | |
|---|---|
| Walk | click the ground, or `W A S D` |
| Help an animal, water or pick a plant, pick something up, talk to someone | click it |
| Slide the view | drag |
| Turn the view | right-drag, or `Q` / `E` |
| Zoom | scroll |
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
- It is a one-player game with one save in the browser. There are no shared
  family hotels and no server-side saves in this edition.

## For developers

```bash
npm run test:v2
```

This runs a robot keeper through the whole game with no screen, to check that
all five stars can be earned, and checks that a save loads back.

- `js/world.js` makes the island. `js/data.js` holds every animal, build and goal.
- `js/game.js` is the rules. `js/ui.js` is everything drawn over the world.
- `js/gfx/` is the drawing: light and post-processing (`core.js`), land and
  sea (`terrain.js`), models (`props.js`), the town (`town.js`), animals
  (`critters.js`), effects (`fx.js`).
