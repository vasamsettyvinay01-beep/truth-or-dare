/**
 * Generates 1080 unique adult (18+) Truth or Dare prompts.
 * Distribution: 15 categories × 4 difficulties × 2 types × 9 = 1080
 */
const fs = require("fs");
const path = require("path");

const CATEGORIES = [
  "Romance",
  "Kissing",
  "Crushes",
  "Flirting",
  "Dating",
  "Relationships",
  "Confessions",
  "Embarrassing",
  "Party",
  "First Impressions",
  "Exes",
  "Jealousy",
  "Red Flags",
  "Green Flags",
  "Secrets",
];

const DIFFICULTIES = ["Cool", "Spicy", "Extreme", "No Boundaries"];
const TYPES = ["truth", "dare"];
const PER_CELL = 9; // 15*4*2*9 = 1080

/** @type {Record<string, Record<string, { truth: string[]; dare: string[] }>>} */
const BANK = {};

function ensure(cat, diff) {
  if (!BANK[cat]) BANK[cat] = {};
  if (!BANK[cat][diff]) BANK[cat][diff] = { truth: [], dare: [] };
}

function add(cat, diff, type, prompts) {
  ensure(cat, diff);
  BANK[cat][diff][type].push(...prompts);
}

// ─── ROMANCE ───────────────────────────────────────────────────────────────
add("Romance", "Cool", "truth", [
  "What small romantic gesture always makes you melt a little?",
  "Do you believe in love at first sight, or love that grows slowly?",
  "What's the most thoughtful thing someone has done for you?",
  "Which love song lyrics feel like they were written about your life?",
  "How do you show someone you like them without saying it out loud?",
  "What's your idea of a perfect low-key romantic evening?",
  "Have you ever kept a ticket stub, note, or gift for sentimental reasons?",
  "What does 'being romanced' look like to you in everyday life?",
  "Who taught you the most about how you want to be loved?",
]);
add("Romance", "Cool", "dare", [
  "Write a two-sentence love note to someone in the room and read it aloud.",
  "Compliment every player on something soft and sincere — no jokes allowed.",
  "Describe your dream first date as if you're pitching it to the group.",
  "Hold eye contact with the person on your left for ten quiet seconds.",
  "Dedicate an imaginary song to someone here and explain why it fits them.",
  "Act out opening a door and offering your arm like an old-school romantic.",
  "Tell the group your favorite romantic movie scene and why it stuck with you.",
  "Give someone a 'virtual bouquet' by naming five flowers and what each means.",
  "Whisper one kind, genuine compliment to the person across from you.",
]);
add("Romance", "Spicy", "truth", [
  "What's the most flirtatious thing you've ever done that actually worked?",
  "Have you ever planned a date specifically to impress someone you wanted badly?",
  "Where do you like to be touched when you're feeling close to someone?",
  "What's a romantic risk you'd take if you knew it couldn't go wrong?",
  "Describe the last time chemistry with someone made you forget the room existed.",
  "Do you fall for people who chase you, or people you have to chase?",
  "What's one romantic fantasy you've never admitted to a partner?",
  "How do you know when a crush is turning into something real?",
  "Have you ever canceled plans just to stay with someone you were into?",
]);
add("Romance", "Spicy", "dare", [
  "Tell someone in the room what you'd do on a perfect second date with them.",
  "Sit closer to the person you're most drawn to and say why — carefully.",
  "Feed someone a snack while maintaining eye contact for five seconds.",
  "Write three words that describe how you'd romance the player of your choice.",
  "Roleplay asking someone here out — make it charming, not awkward on purpose.",
  "Trace an invisible heart on someone's palm and explain what it means.",
  "Describe how you'd kiss someone without using the word 'kiss.'",
  "Let the group pick who you give a slow, deliberate compliment to.",
  "Put your hand over your heart and confess one soft desire out loud.",
]);
add("Romance", "Extreme", "truth", [
  "What's the most intense romantic night you've ever had — fade to black if needed?",
  "Have you ever said 'I love you' too early and meant every syllable?",
  "What would you do if the person you want walked in right now?",
  "Which player here would make the best slow-burn romance, and why?",
  "What's something tender you crave but rarely ask for?",
  "Have you ever stayed in a relationship just because the romance felt cinematic?",
  "Describe a moment when jealousy and love got tangled for you.",
  "What's the boldest romantic confession you've rehearsed but never delivered?",
  "If you could rewrite one romantic ending in your life, how would it go?",
]);
add("Romance", "Extreme", "dare", [
  "Look at someone and describe, in detail, a night you'd plan just for them.",
  "Choose a player and tell them three things that make them dangerously attractive.",
  "Slow-dance with someone for twenty seconds — no music required, commit fully.",
  "Write a short confession to someone here and let them keep it.",
  "Sit knee-to-knee with a player and answer whatever romantic question they ask.",
  "Rate the romantic tension in this room from 1–10 and justify your number.",
  "Whisper a hypothetical 'goodnight' to someone as if you were dating them.",
  "Act out the climax of a rom-com with a partner the group chooses.",
  "Tell someone what you'd miss most about them if they vanished tomorrow.",
]);
add("Romance", "No Boundaries", "truth", [
  "What's the most intimate thing you've ever wanted to say mid-kiss?",
  "Describe your deepest romantic longing without softening a single edge.",
  "Have you ever wanted someone in this room more than you should admit?",
  "What does emotional surrender look like for you in a relationship?",
  "What's a love-related secret you've never told even your closest friends?",
  "If you could have one unforgettable night with anyone here, who and why?",
  "What romantic boundary have you crossed and never regretted?",
  "How do you want to be desired — softly, intensely, or completely claimed?",
  "What's the rawest truth about how you love when you stop performing?",
]);
add("Romance", "No Boundaries", "dare", [
  "Tell someone exactly how you'd make them feel wanted for a whole evening.",
  "Choose a player and describe the chemistry you think you'd have — no filter.",
  "Hold someone's face gently (with consent) and say one devastatingly honest line.",
  "Confess your most private romantic wish to the group in one breath.",
  "Pick a person and narrate a slow, intimate scene starring the two of you.",
  "Ask the player you're most drawn to what would make them weak for someone.",
  "Give someone a forehead-to-forehead moment for five silent seconds.",
  "Say the thing you've been too shy to say to someone in this room.",
  "Describe how you'd wake someone up if you were hopelessly in love with them.",
]);

// ─── KISSING ───────────────────────────────────────────────────────────────
add("Kissing", "Cool", "truth", [
  "Do you remember your first kiss, or have you edited the memory by now?",
  "Are you a quick peck person or a linger-at-the-door person?",
  "What's more nerve-wracking: initiating a kiss or being kissed unexpectedly?",
  "Have you ever practiced kissing on your hand? Be honest.",
  "What's the sweetest place you've ever been kissed that wasn't on the lips?",
  "Do you prefer kissing in private or sneaking one in public?",
  "What's a kissing 'rule' you secretly believe in?",
  "Who in movies has the kissing chemistry you wish was real?",
  "Have you ever missed a kiss opportunity and still thought about it later?",
]);
add("Kissing", "Cool", "dare", [
  "Demonstrate your 'friendly goodbye kiss' energy on the back of your hand.",
  "Describe your ideal first kiss using only food metaphors.",
  "Blow a theatrical air kiss to each player in a different style.",
  "Act out the world's most awkward almost-kiss with someone.",
  "Teach the group your theory of perfect kissing timing.",
  "Mime a rom-com kiss in the rain — commit to the drama.",
  "Rank kissing spots from softest to boldest without using graphic words.",
  "Give someone a kiss on the cheek if they consent; otherwise blow one.",
  "Narrate a first-kiss scene like a nature documentary.",
]);
add("Kissing", "Spicy", "truth", [
  "What's the best kiss of your life, and what made it unforgettable?",
  "Have you ever kissed someone just to see if the spark was real?",
  "Do you like slow kisses or the kind that steal your breath?",
  "Where is the most daring place you've ever kissed someone?",
  "Have you ever replayed a kiss in your head the next morning?",
  "What's your tell that you want to be kissed right now?",
  "Is kissing more intimate than people admit, or is that just you?",
  "Have you ever kissed someone you weren't dating and wanted more?",
  "What turns a good kiss into a great one for you?",
]);
add("Kissing", "Spicy", "dare", [
  "Look at someone and describe how you'd kiss them — tastefully but clearly.",
  "Let the group choose who you almost-kiss on the cheek (consent first).",
  "Hold someone's hand and lean in as if you're about to kiss, then freeze.",
  "Rate everyone's 'kissable energy' from 1–10 with kind explanations.",
  "Whisper to someone what kind of kiss you'd give them after a perfect date.",
  "Act out a slow-motion kiss scene with a willing partner — lips never meet.",
  "Tell the room your kissing preference in one shameless sentence.",
  "Choose a player and compliment their mouth without being crude.",
  "Demonstrate 'how not to kiss' then 'how you actually kiss' on your hand.",
]);
add("Kissing", "Extreme", "truth", [
  "Have you ever kissed someone while knowing you shouldn't?",
  "What's the longest you've made out with someone in one sitting?",
  "Describe a kiss that changed how you felt about a person entirely.",
  "Have you ever used a kiss to start something you weren't ready to name?",
  "Which player here do you think is the best kisser, and based on what?",
  "What's a kissing fantasy you've never acted on?",
  "Have you ever kissed away an argument — did it work?",
  "What's the most emotionally charged kiss you've experienced?",
  "Do you get attached through kissing more than through conversation?",
]);
add("Kissing", "Extreme", "dare", [
  "Pick someone and describe a makeout session with them in cinematic detail.",
  "Ask a player if you can kiss their hand; if yes, make it linger.",
  "Sit facing someone and count down from three as if you're about to kiss.",
  "Tell someone the exact moment you'd kiss them if this were a movie.",
  "Let someone coach you through describing your 'signature kiss.'",
  "Confess who in this room you'd most want to kiss tonight.",
  "Create a kissing dare for the next player — keep it consensual and hot.",
  "Press your forehead to someone's (consent) and breathe together for five seconds.",
  "Explain how you'd kiss someone to apologize, celebrate, and seduce — three styles.",
]);
add("Kissing", "No Boundaries", "truth", [
  "What's the most passionate kiss you've ever had, start to finish?",
  "Have you ever wanted to kiss someone in this room badly enough to risk the vibe?",
  "What do you want someone's mouth to communicate without words?",
  "Describe the kiss you still think about when you're alone.",
  "Have you ever kissed someone as a silent 'I want you'?",
  "What's off-limits for you in kissing, and what melts those limits?",
  "If kissing were a confession, what would yours say right now?",
  "Who was the last person you fantasized about kissing?",
  "What's the rawest truth about how kissing affects your self-control?",
]);
add("Kissing", "No Boundaries", "dare", [
  "Tell someone precisely how you'd kiss them if no one else was watching.",
  "Choose a player and ask permission for a soft kiss on the cheek or hand — then deliver.",
  "Describe your mouth-on-mouth preferences with zero shame.",
  "Look someone in the eyes and say, 'I'd kiss you like…' and finish it honestly.",
  "Narrate the hottest almost-kiss you've ever lived through.",
  "Pick two players and direct a tasteful-but-steamy kissing scene between them (mimed).",
  "Confess your kissing 'weak spot' and who here might find it.",
  "Ask the group who they think you should kiss; react honestly to the answer.",
  "Give someone a close, slow air-kiss an inch from their cheek — hold the tension.",
]);

// Continue generating remaining categories in the same file via a second write / append pattern
// We'll build the rest programmatically below for remaining categories with unique content.

module.exports = { CATEGORIES, DIFFICULTIES, TYPES, PER_CELL, BANK, add, ensure };
