const { shuffle } = require("./shuffle");

/** @typedef {"liberal" | "fascist"} PolicyType */
/** @typedef {{ drawPile: PolicyType[], discardPile: PolicyType[] }} PolicyDeck */

function createInitialPolicyDeck() {
  /** @type {PolicyType[]} */
  const drawPile = [];
  for (let i = 0; i < 6; i++) drawPile.push("liberal");
  for (let i = 0; i < 11; i++) drawPile.push("fascist");

  shuffle(drawPile);
  /** @type {PolicyDeck} */
  const deck = { drawPile, discardPile: [] };
  return deck;
}

function normalizeDeck(deck) {
  if (!deck || typeof deck !== "object") return createInitialPolicyDeck();

  if (!Array.isArray(deck.drawPile)) deck.drawPile = [];
  if (!Array.isArray(deck.discardPile)) deck.discardPile = [];

  return deck;
}

function ensureCanDraw(deck, n) {
  normalizeDeck(deck);

  if (deck.drawPile.length >= n) return deck;

  // Secret Hitler reshuffle rule: if fewer than n cards remain, shuffle discards into a new draw pile.
  const combined = [...deck.drawPile, ...deck.discardPile];
  deck.drawPile = shuffle(combined);
  deck.discardPile = [];
  return deck;
}

function drawPolicies(deck, n) {
  normalizeDeck(deck);
  ensureCanDraw(deck, n);

  const drawn = [];
  for (let i = 0; i < n; i++) {
    const card = deck.drawPile.pop();
    if (!card) break;
    drawn.push(card);
  }
  return drawn;
}

function discardPolicies(deck, cards) {
  normalizeDeck(deck);
  const list = Array.isArray(cards) ? cards : [];
  for (const c of list) {
    if (c === "liberal" || c === "fascist") deck.discardPile.push(c);
  }
}

module.exports = {
  createInitialPolicyDeck,
  drawPolicies,
  discardPolicies,
};
