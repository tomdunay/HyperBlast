// Sauce meter copy and Gorbo's in-flight mouth. Lines stay inside the bitmap font.
// Saucy on purpose: innuendo and roast, still a shoot-em-up and not a letter.

export const SAUCE_MAX = 100;
export const SAUCE_SAVE_AT = 75;
export const SAUCE_HEAT = 1.4;

export function pick<T>(a: readonly T[]): T {
  return a[(Math.random() * a.length) | 0];
}

const COMBO_WORD: [number, string][] = [
  [40, 'ILLEGAL'],
  [30, 'FERAL'],
  [25, 'UNHOLY'],
  [20, 'FILTHY'],
  [16, 'SAUCY'],
  [12, 'STEAMY'],
  [8, 'WARM'],
  [5, 'CLOSE'],
];

export function comboWord(n: number): string {
  return COMBO_WORD.find(([at]) => n >= at)?.[1] ?? '';
}

const COMBO_LINE: Record<number, string> = {
  5: 'FIVE DEEP. THE ROOM JUST GOT WARMER.',
  8: 'EIGHT. GORBO IS LOOSENING A COLLAR.',
  12: 'TWELVE. THIS IS GETTING UNPROFESSIONAL.',
  16: 'SIXTEEN. EVEN THE BULLETS ARE FLIRTING.',
  20: 'TWENTY. GORBO NEEDS A COLD SHOWER.',
  25: 'TWENTY FIVE. CALL SOMEONE. OR DON\'T.',
  30: 'THIRTY. THE HUT HAS A BACK ROOM FOR THIS.',
  40: 'FORTY. GORBO IS FRAMING THE REPLAY.',
};

export function comboLine(n: number): string {
  return COMBO_LINE[n] ?? 'STILL GOING. RUDE OF YOU. CONTINUE.';
}

export function comboRank(n: number): string {
  if (n >= 40) return 'RANK: ILLEGAL';
  if (n >= 30) return 'RANK: FERAL';
  if (n >= 20) return 'RANK: FILTHY';
  if (n >= 12) return 'RANK: SAUCY';
  if (n >= 5) return 'RANK: WARM';
  return 'RANK: POLITE';
}

const GRAZE_POPS = ['OOH', 'CLOSE', 'MM', 'EASY', 'SPICY', 'CHEAT'];

export function grazePop(n: number): string {
  return GRAZE_POPS[(Math.floor(n / 4) - 1) % GRAZE_POPS.length] ?? 'CLOSE';
}

const GRAZE_LINES = [
  'THAT ONE KISSED YOUR PAINT.',
  'ANY CLOSER AND YOU OWE IT DINNER.',
  'GORBO RATES THAT GRAZE A SOLID MOAN.',
  'THE BULLET MISSED. THE TENSION DID NOT.',
  'YOU DODGED SO HARD IT LOOKED PERSONAL.',
  'MM. DO THAT AGAIN. FOR MONEY.',
  'NEARLY DYING IS A SKILL. YOU HAVE IT.',
  'CLOSE ENOUGH TO FOG THE CANOPY.',
];

export function grazeLine(): string { return pick(GRAZE_LINES); }

const BREAK_LINES = [
  'STREAK OVER. IT WAS BEAUTIFUL AND STUPID.',
  'AND JUST LIKE THAT, THE MAGIC GOES SOFT.',
  'COMBO DROPPED. GORBO PUT HIS SHIRT BACK ON.',
  'YOU HAD A GOOD THING. THEN YOU BLINKED.',
];
export function comboBreakLine(): string { return pick(BREAK_LINES); }

const DEATH_BIG = ['SPLAT', 'OOF', 'UNSEXY', 'WHOOPS', 'NASTY', 'CRUNCH', 'NOT CUTE', 'SO CLOSE'];
export function deathBig(): string { return pick(DEATH_BIG); }

const DEATH_LINES = [
  'DIED DOING WHAT YOU LOVE: BLOCKING.',
  'GORBO WILL SELL THE WRECK TO SOMEONE BRAVER.',
  'EMBARRASSING, AND A LITTLE BIT HOT.',
  'SHIELD EMPTY. EXCUSES FULL.',
  'REST IN PIECES. GORBO DOES NOT DO WREATHS.',
  'YOU HAD ONE JOB. IT WAS DODGING.',
  'BEAUTIFUL FORM. TRAGIC LANDING.',
  'THE ENEMY SENDS A BILL WITH THE FLOWERS.',
];
export function deathLine(): string { return pick(DEATH_LINES); }

const LOW = [
  'SWEETHEART, THAT SHIELD IS LINGERIE.',
  'ONE MORE HIT AND GORBO INHERITS THE SHIP.',
  'YOU ARE ONE BAD IDEA FROM A RESPAWN.',
  'BLUSHING IS NOT ARMOUR. BUY A SHIELD.',
];
export function lowShieldLine(): string { return pick(LOW); }

const SAUCE_ON = [
  'TOO HOT. YOUR SHOTS JUST GOT INAPPROPRIATE.',
  'SAUCE IS SERVED. TRY NOT TO WASTE IT.',
  'FIVE SECONDS OF FILTHY DAMAGE. ENJOY.',
  'GORBO LOOKS AWAY. THE DAMAGE DOES NOT.',
];
export function sauceOnLine(): string { return pick(SAUCE_ON); }

const SAUCE_OFF = [
  'HEAT\'S OVER. BACK TO REGULAR VIOLENCE.',
  'COOLED OFF. GORBO IS MILDLY BETRAYED.',
  'SAUCE DONE. THE SHIP MAY STOP SWEATING.',
];
export function sauceOffLine(): string { return pick(SAUCE_OFF); }

const SAVES = [
  'THE SAUCE TUCKED YOU IN. SAY THANK YOU.',
  'LETHAL, BUT MAKE IT FASHION. YOU LIVE.',
  'GORBO WOULD HAVE BURIED YOU. THE SAUCE DID NOT.',
  'SAVED BY BEING TOO SPICY TO DIE.',
];
export function sauceSaveLine(): string { return pick(SAVES); }

const ZAPS = [
  'EVERYONE ON SCREEN JUST GOT SOME.',
  'ZAPPER: A GROUP ACTIVITY.',
  'NOT SUBTLE. GORBO APPROVES ANYWAY.',
];
export function zapLine(): string { return pick(ZAPS); }

const DIVES = [
  'GOING DOWN. COMMITMENT. RESPECT.',
  'UNDER THE SCENERY. CONTINUE, YOU MENACE.',
  'A DIVE. GORBO CHARGES EXTRA TO WATCH.',
];
export function diveLine(): string { return pick(DIVES); }

const PARTS = [
  'A CHUNK CAME OFF. IT CAN LIVE WITH THAT.',
  'YOU UNDRESSED A PIECE OF THE BOSS.',
  'THAT PART WILL NOT BE MISSED. MUCH.',
  'KEEP GOING. IT IS STARTING TO LIKE YOU.',
  'PLATE OFF. NOW IT IS PERSONAL.',
];
export function partLine(): string { return pick(PARTS); }

const PHASES = [
  'IT GOT BACK UP. SOME PEOPLE IGNORE A HINT.',
  'SECOND PHASE. THE BOSS CAUGHT FEELINGS.',
  'OH GOOD. IT REASSEMBLED OUT OF SPITE.',
];
export function phaseLine(): string { return pick(PHASES); }

const MID_DEAD = [
  'MID BOSS DOWN. GO SPEND THE BLOOD MONEY.',
  'DEAD. GORBO IS ALREADY PRICING THE ORGANS.',
  'THAT WAS MEAN. GORBO IS INTO IT.',
];
export function midDeadLine(): string { return pick(MID_DEAD); }

const DEFUSED = [
  'BOMB DEFUSED. YOU MAY KISS THE PILOT.',
  'ALL CLEAR. GORBO PRETENDS NOT TO BE PROUD.',
  'TICKING STOPPED. THE SWEATING MAY CONTINUE.',
];
export function defusedLine(): string { return pick(DEFUSED); }

const BOSS_NAMED: [string, string][] = [
  ['CARCINOX', 'A CRAB WITH OPINIONS. SHOOT THE OPINIONS.'],
  ['OSSUAR', 'BONES. GORBO HAS SEEN THIS ON A FIRST DATE.'],
  ['LARVA', 'SHE HAS CHILDREN. RUIN HER WEEKEND.'],
  ['PIPE', 'A HEART MADE OF PIPES. ROMANTIC. KILL IT.'],
  ['SENTINEL', 'IT HAS BEEN WATCHING. FLATTERING. AND RUDE.'],
  ['SPORE', 'DO NOT LICK IT. GORBO TRIED. GORBO REGRETS.'],
  ['VINEMAW', 'IT WANTS TO SWALLOW YOU. DECLINE.'],
  ['FLESH', 'IT BUILDS BODIES. YOURS IS ALREADY BOOKED.'],
  ['OVERMIND', 'THE LAST ONE. TRY TO LOOK EXPENSIVE.'],
];
const BOSS_ANY = [
  'SOMETHING HUGE AND INTO YOU. BADLY.',
  'BIG, ARMOURED, EMOTIONALLY UNAVAILABLE.',
  'IF IT BLEEDS, GORBO CAN SELL THE PARTS.',
  'BREAK THE PLATES. THEN BREAK ITS HEART.',
];
export function bossIntro(name: string): string {
  const n = name.toUpperCase();
  return BOSS_NAMED.find(([k]) => n.includes(k))?.[1] ?? pick(BOSS_ANY);
}

const LEVELS: Record<string, string> = {
  'PRIMORDIAL SEA': 'WET, ANCIENT, AND FULL OF THINGS WITH TEETH.',
  'FOSSIL CAVERNS': 'MIND THE BONES. SOME OF THEM MIND BACK.',
  'OVERGROWN HIVE': 'EVERYTHING HERE WANTS TO BE INSIDE YOU.',
  'BIOMECH FORTRESS': 'HALF MEAT, HALF MACHINE, NO BOUNDARIES.',
  'METALLIC SPACEWAYS': 'COLD STEEL. HOT LEAD. NO SAFE WORD.',
  'ABYSSAL TRENCH': 'DEEP ENOUGH TO GET IDEAS. DON\'T.',
  'CRYSTAL GROTTO': 'PRETTY ROCKS. THEY STILL WANT YOU DEAD.',
  'OSSIFIED WASTES': 'A GRAVEYARD WITH AMBITION.',
  'MAGMA VEINS': 'HOT IN THE UNFUN WAY. MOSTLY.',
  'FUNGAL LABYRINTH': 'DO NOT BREATHE DEEP. OR DO. COWARD.',
  'HIVE FOUNDRY': 'THEY BUILD WASPS HERE. AND REGRET.',
  'FROZEN RELAY': 'COLD ENOUGH TO SHRINK A ZAPPER.',
  'SHATTERED MOON': 'LOW GRAVITY. HIGH BODY COUNT.',
  'CORE FURNACE': 'IF YOU CAN STAND THE HEAT, YOU ARE LYING.',
  'THE LAST GATE': 'LAST DOOR. TRY NOT TO WHIMPER.',
};
export function levelQuip(name: string): string {
  return LEVELS[name.toUpperCase()] ?? 'NEW SCENERY. SAME APPETITE FOR TROUBLE.';
}

const GAME_OVER = [
  'NO LIVES LEFT. PLENTY OF REGRETS.',
  'THE HUT DOES NOT SERVE CORPSES.',
  'THAT IS A WRAP. MOSTLY A BODY WRAP.',
  'GORBO WILL MISS YOUR MONEY THE MOST.',
  'BEAUTIFUL RUN. SHAME ABOUT THE ENDING.',
];
export function gameOverLine(): string { return pick(GAME_OVER); }

const PAUSES = [
  'PAUSED. THEY ARE STILL THINKING ABOUT YOU.',
  'TAKE YOUR TIME. THE BULLETS ARE SWEATING TOO.',
  'PAUSED FOR A CIGARETTE YOU DO NOT HAVE.',
  'EVEN THE BOSS IS HOLDING ITS BREATH.',
];
export function pauseLine(): string { return pick(PAUSES); }

export function statsLine(kills: number, grazes: number, combo: number): string {
  if (combo >= 16) return 'GORBO IS PRINTING THAT COMBO ON A SHIRT.';
  if (grazes >= 25) return 'YOU FLEW LIKE YOU WANTED TO BE CAUGHT.';
  if (kills < 12) return 'DID YOU EVEN LEAVE THE HOUSE.';
  if (grazes < 3) return 'YOU GAVE THOSE BULLETS SO MUCH ROOM.';
  return 'ADEQUATE. GORBO HAS HAD BETTER. AND WORSE.';
}

const TAGS = [
  'THE STRIKEBLASTER RETURNS',
  'FIFTEEN BOMBS. ZERO CHILL.',
  'GORBO MISSES YOU. AND YOUR WALLET.',
  'FLY CLOSE. THEY LIKE THAT.',
  'SHOOT FIRST. FLIRT WITH THE NEAR MISSES.',
  'HARD CASH. SOFT LANDINGS SOLD SEPARATELY.',
];
export function titleTag(t: number): string {
  return TAGS[Math.floor(t / 180) % TAGS.length];
}

const EXTRA = [
  'ANOTHER LIFE. TRY TO WASTE IT WITH STYLE.',
  'ONE UP. GORBO CANNOT BUY YOU TASTE.',
];
export function extraLifeLine(): string { return pick(EXTRA); }

const SUPER = [
  'SUPER POWER. EVERY GUN. NO MANNERS.',
  'TEN SECONDS OF BEING TOO MUCH. GO.',
];
export function superLine(): string { return pick(SUPER); }

const CHECKS = [
  'CHECKPOINT. GORBO SAVED YOUR PROGRESS AND NOTHING ELSE.',
  'SAVED. THE NEXT BIT IS LESS FORGIVING.',
  'CHECKPOINT. YOU MAY EXHALE. BRIEFLY.',
];
export function checkpointLine(): string { return pick(CHECKS); }

const IDLE = [
  'THEY ARE RIGHT THERE, DARLING.',
  'THE TRIGGER IS NOT DECORATIVE.',
  'GORBO IS NOT PAYING YOU TO SIGHTSEE.',
];
export function idleLine(): string { return pick(IDLE); }

const REVERSE = [
  'SCROLLING BACK FOR LOOSE CHANGE. CLASSY.',
  'GOING BACKWARDS. COMMITMENT ISSUES.',
  'MISSED A COIN. GORBO UNDERSTANDS GREED.',
];
export function reverseLine(): string { return pick(REVERSE); }

const FILL_TIP = 'FLY CLOSE, DON\'T TOUCH. THAT FILLS THE SAUCE.';
const BANK_TIP = 'SAUCE BANKED. A KILLING BLOW MIGHT FLINCH.';
let toldFill = false;
let toldBank = false;
export function fillTip(): string | null {
  if (toldFill) return null;
  toldFill = true;
  return FILL_TIP;
}
export function bankTip(): string | null {
  if (toldBank) return null;
  toldBank = true;
  return BANK_TIP;
}
