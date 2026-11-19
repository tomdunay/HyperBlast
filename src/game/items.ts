// Shop item catalogue and the per-player loadout / state.
export type ItemId =
  | 'power' | 'laser' | 'cannon' | 'spread' | 'side' | 'rear' | 'wing' | 'homing' | 'electro' | 'mines' | 'flamer' | 'drone'
  | 'twister' | 'autofire' | 'speed' | 'halfshield' | 'fullshield' | 'life' | 'dive' | 'zapper' | 'armour' | 'magnet' | 'rapid' | 'regen';

export interface ItemDef {
  id: ItemId; name: string; price: number; max: number; unlock: number; desc: string;
  kind: 'weapon' | 'utility' | 'instant' | 'charge';
}

// unlock = index of the first shop it is offered in (shop index = level*2 + (end ? 1 : 0))
export const ITEMS: ItemDef[] = [
  { id: 'power', name: 'POWER UP', price: 350, max: 5, unlock: 0, kind: 'weapon', desc: 'MORE AND FATTER BLASTER BOLTS. STACKS TO FIVE.' },
  { id: 'spread', name: 'SPREAD SHOT', price: 700, max: 3, unlock: 0, kind: 'weapon', desc: 'ANGLED SIDE BOLTS FROM WING FINS.' },
  { id: 'side', name: 'SIDE SHOT', price: 550, max: 3, unlock: 0, kind: 'weapon', desc: 'FIRES LEFT AND RIGHT. GREAT IN TUNNELS.' },
  { id: 'rear', name: 'REAR SHOT', price: 500, max: 3, unlock: 0, kind: 'weapon', desc: 'COVERS YOUR BACKSIDE.' },
  { id: 'speed', name: 'SPEED UP', price: 400, max: 3, unlock: 0, kind: 'utility', desc: 'BIGGER ENGINES. FASTER SHIP.' },
  { id: 'halfshield', name: 'HALF SHIELD', price: 350, max: 0, unlock: 0, kind: 'instant', desc: 'RESTORES HALF YOUR SHIELD.' },
  { id: 'fullshield', name: 'FULL SHIELD', price: 650, max: 0, unlock: 0, kind: 'instant', desc: 'RESTORES ALL OF YOUR SHIELD.' },
  { id: 'zapper', name: 'ZAPPER', price: 700, max: 5, unlock: 0, kind: 'charge', desc: 'SMART BOMB. HITS EVERYTHING ON SCREEN. KEY X.' },
  { id: 'cannon', name: 'CANNON', price: 1000, max: 3, unlock: 1, kind: 'weapon', desc: 'SLOW HEAVY SLUGS THAT PUNCH THROUGH SMALL FRY.' },
  { id: 'dive', name: 'DIVE', price: 600, max: 5, unlock: 1, kind: 'charge', desc: 'DUCK UNDER THE SCENERY FOR A FEW SECONDS. KEY C.' },
  { id: 'magnet', name: 'CASH MAGNET', price: 750, max: 2, unlock: 1, kind: 'utility', desc: 'PULLS HARD CASH TOWARDS YOU.' },
  { id: 'laser', name: 'LASER', price: 1300, max: 3, unlock: 2, kind: 'weapon', desc: 'PIERCING BEAM. UPGRADES ADD LENGTH AND WIDTH.' },
  { id: 'homing', name: 'HOMING MISSILE', price: 1800, max: 3, unlock: 2, kind: 'weapon', desc: 'SEEKS OUT THE NEAREST NASTY.' },
  { id: 'armour', name: 'ARMOUR', price: 1500, max: 3, unlock: 2, kind: 'utility', desc: 'RAISES MAXIMUM SHIELD BY A QUARTER.' },
  { id: 'wing', name: 'WING CANNON', price: 1400, max: 2, unlock: 3, kind: 'weapon', desc: 'DIAGONAL CANNONS ON THE WING TIPS.' },
  { id: 'mines', name: 'MINES', price: 900, max: 2, unlock: 3, kind: 'weapon', desc: 'DROPPED BEHIND YOU. BIG BANG.' },
  { id: 'autofire', name: 'AUTO FIRE', price: 1500, max: 1, unlock: 3, kind: 'utility', desc: 'HOLD FIRE FOR FULL RATE. SAVES YOUR WRISTS.' },
  { id: 'electro', name: 'ELECTRO BALL', price: 1800, max: 2, unlock: 4, kind: 'weapon', desc: 'ORBITING SPARK BALLS. HURT ON CONTACT, EAT BULLETS.' },
  { id: 'flamer', name: 'FLAMETHROWER', price: 1600, max: 2, unlock: 4, kind: 'weapon', desc: 'SHORT RANGE INFERNO. MIND THE PILOT LIGHT.' },
  { id: 'rapid', name: 'RAPID FIRE', price: 1600, max: 2, unlock: 5, kind: 'utility', desc: 'FASTER TRIGGER FOR EVERY GUN.' },
  { id: 'drone', name: 'DRONE', price: 2400, max: 2, unlock: 6, kind: 'weapon', desc: 'SATELLITE THAT SHOOTS AND BLOCKS BULLETS.' },
  { id: 'regen', name: 'REGENERATOR', price: 2200, max: 2, unlock: 6, kind: 'utility', desc: 'SLOWLY REPAIRS YOUR SHIELD.' },
  { id: 'twister', name: 'TWISTER', price: 2600, max: 2, unlock: 7, kind: 'weapon', desc: 'SPINNING SHOTS IN ALL DIRECTIONS.' },
  { id: 'life', name: 'EXTRA LIFE', price: 5000, max: 0, unlock: 0, kind: 'instant', desc: 'ONE MORE GO. GORBO TAKES NO RESPONSIBILITY.' },
];
export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<ItemId, ItemDef>;

/** price of buying the next level when you currently own `lvl` */
export function buyPrice(it: ItemDef, lvl: number) {
  if (it.kind === 'instant' || it.kind === 'charge') return it.price;
  const base = it.id === 'power' ? Math.max(0, lvl - 1) : lvl;
  return Math.round((it.price * (1 + 0.5 * base)) / 10) * 10;
}
export function sellPrice(it: ItemDef, lvl: number) {
  if (it.kind === 'instant') return 0;
  if (it.kind === 'charge') return Math.floor(it.price / 2);
  return Math.floor(buyPrice(it, lvl - 1) / 2);
}

export type Loadout = Record<ItemId, number>;
export function emptyLoadout(): Loadout {
  const l = Object.fromEntries(ITEMS.map((i) => [i.id, 0])) as Loadout;
  l.power = 1;
  return l;
}

export class PlayerState {
  id: number;
  score = 0;
  lives = 3;
  cash = 0;
  level = 0;
  checkpoint = 0;
  midDone = false;
  shield = 100;
  load: Loadout = emptyLoadout();
  extraLifeAt = 50000;
  constructor(id: number) { this.id = id; }
  maxShield() { return 100 + 25 * this.load.armour; }
}
