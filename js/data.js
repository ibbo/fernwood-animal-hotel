// Everything the game knows about: comforts, snacks, things to build,
// animals, the friends to rescue, and the goals for each star.

export const HOUR_SECONDS = 24;      // real seconds in one game hour
export const FULL = 5;               // comfort points that fill one "love"

export const ASPECTS = {
  shade: { icon: '🌳', name: 'Shade', color: '#4f9d5d' },
  water: { icon: '💧', name: 'Water', color: '#3f9ad6' },
  bloom: { icon: '🌸', name: 'Flowers', color: '#e87aa4' },
  sun: { icon: '☀️', name: 'Sunshine', color: '#e9a23b' },
  glow: { icon: '🏮', name: 'Glow', color: '#d9703f' },
  play: { icon: '🎈', name: 'Play', color: '#8a6fd8' },
};

export const ITEMS = {
  berries: { icon: '🫐', name: 'berries', from: 'a Berry Bush', sell: 2, snack: true },
  carrot: { icon: '🥕', name: 'carrots', from: 'a Carrot Patch', sell: 2, snack: true },
  apple: { icon: '🍎', name: 'apples', from: 'an Apple Tree', sell: 3, snack: true },
  fish: { icon: '🐟', name: 'fish', from: 'the fishing spot on the pier', sell: 3, snack: true },
  honey: { icon: '🍯', name: 'honey', from: 'a Beehive', sell: 7, snack: true },
  bamboo: { icon: '🎋', name: 'bamboo', from: 'a Bamboo Grove', sell: 3, snack: true },
  cake: { icon: '🍰', name: 'cake', from: 'the market in Port Marlow', sell: 5, note: 'Any guest will take cake instead of a snack.' },
  shell: { icon: '🐚', name: 'shells', sell: 3, why: 'is making a necklace' },
  wood: { icon: '🪵', name: 'driftwood', sell: 2, why: 'is mending a boat' },
  feather: { icon: '🪶', name: 'feathers', sell: 3, why: 'is stuffing a pillow' },
  mushroom: { icon: '🍄', name: 'mushrooms', sell: 4, why: 'is cooking soup' },
  clover: { icon: '🍀', name: 'lucky clovers', sell: 4, why: 'needs some good luck' },
  pearl: { icon: '🦪', name: 'pearl oysters', sell: 9, why: 'is making a crown' },
  crystal: { icon: '💎', name: 'crystals', sell: 12, why: 'is mending the town clock' },
  star: { icon: '🌟', name: 'star shards', sell: 7, why: 'is saving up wishes' },
};
const SNACK_WHY = { berries: 'is baking a pie', carrot: 'is making a stew', apple: 'is pressing juice', fish: 'is frying supper', honey: 'has a sore throat', bamboo: 'is building a kite' };
for (const k in SNACK_WHY) ITEMS[k].why = SNACK_WHY[k];

// Things lying about to pick up. `item` goes in the bag, `leaves` is money.
export const FIND = {
  shell: { icon: '🐚', item: 'shell', shore: true },
  wood: { icon: '🪵', item: 'wood', shore: true },
  feather: { icon: '🪶', item: 'feather' },
  wildberry: { icon: '🫐', item: 'berries' },
  mushroom: { icon: '🍄', item: 'mushroom' },
  clover: { icon: '🍀', item: 'clover' },
  pearl: { icon: '🦪', item: 'pearl', shore: true },
  crystal: { icon: '💎', item: 'crystal' },
  coin: { icon: '🪙', leaves: 3 },
  star: { icon: '🌟', item: 'star' },
};
// What turns up in each region (kind, weight) and how many at once.
export const FINDS = {
  cove: { cap: 7, kinds: [['shell', 3], ['wood', 2], ['wildberry', 2], ['feather', 2]] },
  town: { cap: 3, kinds: [['coin', 1]] },
  woods: { cap: 5, kinds: [['mushroom', 3], ['feather', 2], ['wildberry', 2]] },
  meadow: { cap: 5, kinds: [['clover', 3], ['feather', 2], ['wildberry', 1]] },
  lagoon: { cap: 5, kinds: [['pearl', 2], ['shell', 2], ['wood', 2], ['mushroom', 1]] },
  highrock: { cap: 5, kinds: [['crystal', 2], ['feather', 2], ['mushroom', 1]] },
};

// The people of Port Marlow.
export const NPCS = {
  market: { name: 'Marigold', species: 'duck', icon: '🛒', title: 'Marigold\'s Market' },
  post: { name: 'Quill', species: 'owl', icon: '📮', title: 'Port Marlow Post Office' },
  captain: { name: 'Captain Finn', species: 'penguin', icon: '⚓', title: 'The Lighthouse' },
};
export const LOCALS = [
  { name: 'Pip', species: 'rabbit' }, { name: 'Tilly', species: 'fox' }, { name: 'Gus', species: 'bear' },
  { name: 'Nell', species: 'hedgehog' }, { name: 'Barnaby', species: 'tortoise' }, { name: 'Winnie', species: 'deer' },
];
export const LOCAL_CHAT = [
  'Lovely day for it!', 'Water your plants and they grow in no time.', 'Click the float when a fish bites and you land two.',
  'The notice board always has jobs going.', 'Marigold buys anything you find on the beach.', 'Visitors in the square love an invitation to Fernwood.',
  'Star shards fall on the island at night.', 'Have you been up the lighthouse? Captain Finn knows the weather.',
];

// Things the keeper can build. `gives` are comfort points for rooms nearby
// (full value next door, half value two tiles away). `bonus` is comfort a
// room gives itself. `grows` makes it a snack plant.
export const BUILD = {
  burrow: { cat: 'home', icon: '🏡', name: 'Cosy Burrow', cost: 30, star: 0, room: true, bonus: {}, desc: 'A snug round home under a grassy roof.' },
  nook: { cat: 'home', icon: '🛖', name: 'Tree Nook', cost: 45, star: 1, room: true, bonus: { shade: 2 }, desc: 'A little house in a leafy tree. Comes with shade.' },
  den: { cat: 'home', icon: '⛺', name: 'Sun Den', cost: 50, star: 2, room: true, bonus: { sun: 2 }, desc: 'A warm stone den that soaks up sunshine.' },
  lodge: { cat: 'home', icon: '🛶', name: 'Pond Lodge', cost: 55, star: 3, room: true, bonus: { water: 2 }, desc: 'A reed-roofed lodge with its own paddling pool.' },
  cabin: { cat: 'home', icon: '🏔️', name: 'Sky Cabin', cost: 85, star: 4, room: true, bonus: { shade: 1, sun: 1, glow: 1, play: 1 }, desc: 'A grand cabin with a bit of everything.' },

  berrybush: { cat: 'garden', icon: '🫐', name: 'Berry Bush', cost: 12, star: 0, grows: 'berries', hours: 5, yield: 3, gives: { bloom: 1 }, desc: 'Grows berries to pick.' },
  carrots: { cat: 'garden', icon: '🥕', name: 'Carrot Patch', cost: 12, star: 0, grows: 'carrot', hours: 6, yield: 3, gives: {}, desc: 'Grows crunchy carrots.' },
  appletree: { cat: 'garden', icon: '🍎', name: 'Apple Tree', cost: 25, star: 1, grows: 'apple', hours: 8, yield: 3, gives: { shade: 2 }, desc: 'Apples, and shade too.' },
  hive: { cat: 'garden', icon: '🍯', name: 'Beehive', cost: 30, star: 2, grows: 'honey', hours: 9, yield: 2, gives: {}, needs: 'bloom', desc: 'Bees make honey when flowers are close by.' },
  bamboo: { cat: 'garden', icon: '🎋', name: 'Bamboo Grove', cost: 30, star: 4, grows: 'bamboo', hours: 8, yield: 3, gives: { shade: 1 }, desc: 'Tall, quick-growing bamboo.' },

  sapling: { cat: 'cosy', icon: '🌳', name: 'Shady Tree', cost: 10, star: 0, gives: { shade: 2 }, desc: 'Cool shade for a nap.' },
  flowerbed: { cat: 'cosy', icon: '🌸', name: 'Flower Bed', cost: 8, star: 0, gives: { bloom: 2 }, walk: true, desc: 'Bright flowers. Bees like them too.' },
  lantern: { cat: 'cosy', icon: '🏮', name: 'Lantern', cost: 12, star: 0, gives: { glow: 2 }, desc: 'Glows warm when night falls.' },
  ball: { cat: 'cosy', icon: '🎈', name: 'Bouncy Ball', cost: 14, star: 0, gives: { play: 2 }, desc: 'Boing! Something to play with.' },
  pond: { cat: 'cosy', icon: '💧', name: 'Lily Pond', cost: 18, star: 1, gives: { water: 2 }, desc: 'A cool pond with lily pads.' },
  sunstone: { cat: 'cosy', icon: '☀️', name: 'Sunning Rocks', cost: 12, star: 1, gives: { sun: 2 }, desc: 'Flat warm rocks for basking.' },
  swing: { cat: 'cosy', icon: '🎠', name: 'Tyre Swing', cost: 28, star: 2, gives: { play: 3 }, desc: 'Wheee! Lots of play.' },
  fountain: { cat: 'cosy', icon: '⛲', name: 'Fountain', cost: 36, star: 3, gives: { water: 2, bloom: 1, play: 1 }, desc: 'Splashy, pretty and fun.' },
  mushrooms: { cat: 'cosy', icon: '🍄', name: 'Glowcap Ring', cost: 20, star: 3, gives: { glow: 2, shade: 1 }, walk: true, desc: 'Mushrooms that shine softly at night.' },
};
Object.assign(BUILD, {
  bench: { cat: 'town', icon: '🪑', name: 'Park Bench', cost: 16, star: 0, rep: 1, gives: { sun: 1, play: 1 }, desc: 'A sunny spot to sit and swing your legs.' },
  gaslamp: { cat: 'town', icon: '💡', name: 'Street Lamp', cost: 26, star: 0, rep: 2, gives: { glow: 3 }, desc: 'A tall town lamp. Very glowy.' },
  birdbath: { cat: 'town', icon: '🐦', name: 'Bird Bath', cost: 24, star: 0, rep: 4, gives: { water: 2, bloom: 1 }, desc: 'Splash! With a ring of daisies.' },
  kite: { cat: 'town', icon: '🪁', name: 'Kite Post', cost: 28, star: 0, rep: 6, gives: { play: 2, sun: 2 }, desc: 'A bright kite dancing on the wind.' },
  flowercart: { cat: 'town', icon: '💐', name: 'Flower Cart', cost: 34, star: 0, rep: 9, gives: { bloom: 3, shade: 1 }, desc: 'A market cart piled with blooms.' },
  bandstand: { cat: 'town', icon: '🎪', name: 'Bandstand', cost: 80, star: 0, rep: 14, gives: { play: 3, glow: 2 }, desc: 'Music and fairy lights for everyone.' },
});
BUILD.fishspot = { cat: null, icon: '🎣', name: 'Fishing Spot', cost: 0, star: 0, fish: true, gives: {}, walk: true, fixed: true, desc: 'Cast a line any time. Click when the float dips!' };
export const BUILD_CATS = { home: 'Homes', garden: 'Snack garden', cosy: 'Cosy things', town: 'Town goods' };

// Comfort from wild things that are already on the island.
export const NATURAL = {
  oak: { shade: 1.5 }, pine: { shade: 1.5 }, willow: { shade: 1.5, water: 0.5 }, palm: { shade: 1, sun: 0.5 },
  rock: { sun: 1 }, flowers: { bloom: 1 }, reeds: { water: 1 }, shroom: { glow: 1 },
};
export const TILE_GIVES = { water: { water: 0.75 }, sand: { sun: 0.5 }, snow: { play: 0.5 } };

export const SPECIES = {
  rabbit: { name: 'rabbit', star: 0, loves: ['bloom', 'play'], foods: ['carrot', 'berries'], pay: 0 },
  duck: { name: 'duck', star: 0, loves: ['water', 'bloom'], foods: ['berries', 'carrot'], pay: 0 },
  hedgehog: { name: 'hedgehog', star: 0, loves: ['shade', 'glow'], foods: ['berries', 'apple'], pay: 0 },
  fox: { name: 'fox', star: 1, loves: ['shade', 'play'], foods: ['berries', 'apple', 'fish'], pay: 1 },
  deer: { name: 'deer', star: 1, loves: ['bloom', 'shade'], foods: ['apple', 'carrot'], pay: 1 },
  owl: { name: 'owl', star: 1, loves: ['shade', 'glow'], foods: ['berries', 'fish'], pay: 1 },
  bear: { name: 'bear', star: 2, loves: ['water', 'bloom'], foods: ['honey', 'fish', 'berries'], pay: 2 },
  tortoise: { name: 'tortoise', star: 2, loves: ['sun', 'bloom'], foods: ['carrot', 'apple'], pay: 2 },
  otter: { name: 'otter', star: 3, loves: ['water', 'play'], foods: ['fish'], pay: 3 },
  frog: { name: 'frog', star: 3, loves: ['water', 'glow'], foods: ['berries', 'fish'], pay: 3 },
  panda: { name: 'panda', star: 4, loves: ['shade', 'water'], foods: ['bamboo', 'apple'], pay: 4 },
  penguin: { name: 'penguin', star: 4, loves: ['water', 'play'], foods: ['fish'], pay: 4 },
};

export const GUEST_NAMES = ['Biscuit', 'Maple', 'Pepper', 'Juniper', 'Moss', 'Tansy', 'Nutmeg', 'Hazel', 'Pebble', 'Willow', 'Figgy', 'Sorrel',
  'Dumpling', 'Mango', 'Acorn', 'Posy', 'Tumble', 'Sunny', 'Bean', 'Clementine', 'Rusty', 'Pudding', 'Fern', 'Otis', 'Mabel', 'Kiwi', 'Bramley', 'Dot'];

// Wild animals that need a friend. Each lives in one region and wants gifts.
export const WILD = {
  bramble: { name: 'Bramble', species: 'hedgehog', region: 'cove', needs: { berries: 2 },
    story: 'A small hedgehog is curled up under a bush. Its tummy rumbles.', hint: 'Bramble is hiding in the cove, not far from the lodge.' },
  ember: { name: 'Ember', species: 'fox', region: 'woods', needs: { apple: 2, berries: 2 },
    story: 'A fox kit peeks out from behind a log. She is all alone and very hungry.', hint: 'Ember is somewhere in the Whispering Woods.' },
  hoot: { name: 'Hoot', species: 'owl', region: 'woods', needs: { berries: 3 }, when: 'night',
    story: 'An owlet fell out of his nest. He only dares to come out after dark.', hint: 'Something hoots in the Whispering Woods after dark.' },
  clover: { name: 'Clover', species: 'rabbit', region: 'meadow', needs: { carrot: 3 },
    story: 'A shy rabbit keeps darting between the flowers. Carrots might win her over.', hint: 'Clover is hopping about in Sunny Meadow.' },
  honeypaw: { name: 'Honeypaw', species: 'bear', region: 'meadow', needs: { honey: 2, berries: 2 },
    story: 'A bear cub is sniffing the flowers sadly. He has lost his way home.', hint: 'Honeypaw is at the far edge of Sunny Meadow.' },
  lily: { name: 'Lily', species: 'frog', region: 'lagoon', needs: { berries: 3 }, when: 'rain',
    story: 'A little frog hops out to sing in the rain. She has nowhere dry to sleep.', hint: 'Lily only comes out in Misty Lagoon when it rains.' },
  ripple: { name: 'Ripple', species: 'otter', region: 'lagoon', needs: { fish: 3 },
    story: 'An otter pup is too tired to fish. He squeaks hopefully at you.', hint: 'Ripple is by the water in Misty Lagoon.' },
  bao: { name: 'Bao', species: 'panda', region: 'highrock', needs: { bamboo: 3, apple: 2 },
    story: 'A panda sits in the snow with no bamboo anywhere in sight.', hint: 'Bao is high up on Highrock.' },
};

export const REGIONS = {
  cove: { name: 'Home Cove', star: 0 },
  town: { name: 'Port Marlow', star: 0 },
  woods: { name: 'Whispering Woods', star: 1 },
  meadow: { name: 'Sunny Meadow', star: 2 },
  lagoon: { name: 'Misty Lagoon', star: 3 },
  highrock: { name: 'Highrock', star: 4 },
};

const count = (s, type) => s.builds.filter((b) => b.type === type).length;
const rooms = (s) => s.builds.filter((b) => BUILD[b.type].room).length;
const saved = (s, id) => !!(s.wild[id] && s.wild[id].rescued);

// Goals for each star. `n` gives [now, target] for a progress count.
export const STARS = [
  { title: 'Open the doors', reward: 'Whispering Woods', goals: [
    { text: 'Build a Cosy Burrow', hint: 'Open Build and put a Cosy Burrow on the grass.', n: (s) => [Math.min(1, rooms(s)), 1] },
    { text: 'Show a guest to a room', hint: 'Click the guest waiting by the pier, then click a room.', n: (s) => [Math.min(1, s.stats.welcomed), 1] },
    { text: 'Pick 4 snacks', hint: 'Plant a Berry Bush or Carrot Patch. Click it to water it, and again when it is ripe.', n: (s) => [Math.min(4, s.stats.harvested), 4] },
    { text: 'Grant 3 wishes', hint: 'When a guest shows a bubble, click them to help.', n: (s) => [Math.min(3, s.stats.wishes), 3] },
    { text: 'Cross the bridge to Port Marlow', hint: 'The bridge is on the east side of the cove. The town always has jobs and a market.', n: (s) => [Math.min(1, s.stats.town), 1] },
    { text: 'Make friends with Bramble', hint: 'Find the paw bubble in the cove and bring berries.', n: (s) => [saved(s, 'bramble') ? 1 : 0, 1] },
  ] },
  { title: 'Word gets around', reward: 'Sunny Meadow', goals: [
    { text: 'Have 3 homes', hint: 'Build more homes so more guests can stay.', n: (s) => [Math.min(3, rooms(s)), 3] },
    { text: 'Give a guest a home they love', hint: 'Put the things a guest loves near their home until both loves are full.', n: (s) => [Math.min(1, s.stats.lovedRoom), 1] },
    { text: 'Wave off 3 happy guests (4 hearts or more)', hint: 'Cosy homes and granted wishes make happy guests.', n: (s) => [Math.min(3, s.stats.happy), 3] },
    { text: 'Finish 2 town jobs', hint: 'Read the notice board in the town square, then bring what is asked for.', n: (s) => [Math.min(2, s.stats.jobs), 2] },
    { text: 'Make friends with Ember', hint: 'Look for a paw bubble in the Whispering Woods.', n: (s) => [saved(s, 'ember') ? 1 : 0, 1] },
    { text: 'Find out who hoots at night', hint: 'Visit the Whispering Woods after dark.', n: (s) => [saved(s, 'hoot') ? 1 : 0, 1] },
  ] },
  { title: 'Sunny days', reward: 'Misty Lagoon', goals: [
    { text: 'Have 5 homes', hint: 'Sun Dens are new. Tortoises love them.', n: (s) => [Math.min(5, rooms(s)), 5] },
    { text: 'Invite a visitor from Port Marlow', hint: 'Visitors with a suitcase wait in the town square. Click one when you have a free home.', n: (s) => [Math.min(1, s.stats.invited), 1] },
    { text: 'Collect honey', hint: 'Put a Beehive near flowers.', n: (s) => [Math.min(1, s.stats.honey), 1] },
    { text: 'Make friends with Clover', hint: 'Look in Sunny Meadow.', n: (s) => [saved(s, 'clover') ? 1 : 0, 1] },
    { text: 'Make friends with Honeypaw', hint: 'Look at the far edge of Sunny Meadow.', n: (s) => [saved(s, 'honeypaw') ? 1 : 0, 1] },
    { text: 'Get 2 five-heart reviews', hint: 'Fill both of a guest\'s loves and grant their wishes.', n: (s) => [Math.min(2, s.stats.five), 2] },
  ] },
  { title: 'Rain or shine', reward: 'Highrock', goals: [
    { text: 'Make friends with Ripple', hint: 'Catch fish at the pier, then look in Misty Lagoon.', n: (s) => [saved(s, 'ripple') ? 1 : 0, 1] },
    { text: 'Make friends with Lily', hint: 'Go to Misty Lagoon on a rainy day.', n: (s) => [saved(s, 'lily') ? 1 : 0, 1] },
    { text: 'Deliver 3 parcels', hint: 'Quill at the post office always has a parcel to carry.', n: (s) => [Math.min(3, s.stats.parcels), 3] },
    { text: 'Light 6 lanterns', hint: 'Lanterns are in Build, under Cosy things.', n: (s) => [Math.min(6, count(s, 'lantern')), 6] },
    { text: 'Wave off 10 happy guests', hint: 'Keep those hearts high.', n: (s) => [Math.min(10, s.stats.happy), 10] },
    { text: 'Earn 600 leaves altogether', hint: 'Guests pay leaves when they go home.', n: (s) => [Math.min(600, s.stats.earned), 600] },
  ] },
  { title: 'Five-star sanctuary', reward: 'the Lantern Festival', goals: [
    { text: 'Make friends with Bao', hint: 'Grow bamboo, then climb Highrock.', n: (s) => [saved(s, 'bao') ? 1 : 0, 1] },
    { text: 'Give all 8 wild friends a home', hint: 'The Friends book shows who is still out there.', n: (s) => [Object.keys(WILD).filter((id) => saved(s, id)).length, 8] },
    { text: 'Finish 12 town jobs', hint: 'The notice board in Port Marlow.', n: (s) => [Math.min(12, s.stats.jobs), 12] },
    { text: 'Have 8 homes full at once', hint: 'Residents and guests both count.', n: (s) => [Math.min(8, s.stats.fullNow), 8] },
    { text: 'Have 3 animals at five hearts together', hint: 'Check the Friends book for who needs a little more.', n: (s) => [Math.min(3, s.stats.fiveNow), 3] },
  ] },
];

export const NEW_STATS = { town: 0, jobs: 0, invited: 0, parcels: 0, sold: 0, found: 0, watered: 0, fished: 0 };

export function newState(name) {
  return {
    v: 1, name: name || 'Keeper', clock: 7.2, rainFrom: -1, rainTo: -1, nextRain: 1,
    stars: 0, leaves: 70, inv: {}, builds: [], guests: [], wild: {}, nextId: 1,
    stats: { welcomed: 0, harvested: 0, wishes: 0, happy: 0, five: 0, earned: 0, honey: 0, lovedRoom: 0, fullNow: 0, fiveNow: 0, checkouts: 0, ...NEW_STATS },
    seen: {}, finale: false, tips: {}, finds: [], jobs: [], rep: 0, parcel: null, tourists: [], nextTourist: 0,
  };
}
