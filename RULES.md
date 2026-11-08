# Project X rules

Project X is a working name. Numbers below are what the game currently uses.

## Goal

Be the last player standing. For 2-6 players.

## Setup

- Everyone secretly chooses one sub-element, then all choices are revealed. Duplicates are allowed.
- Everyone starts with 12 HP and 0 charge.
- Everyone has their own identical 18-card deck: fire, water and earth, power 1-6.
- Everyone draws a hand of 5. The newest card drawn is face-up for the whole table.
- If your hand has no card of your element, your next draw is guaranteed to be one.

## Elements

Water beats fire. Fire beats earth. Earth beats water.

In the same element, the higher number wins. Equal numbers do nothing.

## A round

1. **Abilities:** Anyone with enough charge can secretly lock in their ability, then all are revealed together.
2. **Call:** Everyone secretly chooses an element to call, then all calls are revealed. You can lie.
3. **Cards:** Everyone secretly picks a card.
4. **Spirit World:** Eliminated players secretly vote for an element. The top element gets +1 power this round. A tied vote does nothing.
5. **Reveal:** All cards flip at once, and you compare your card with every other player's.
6. **Damage:** Each player who beats you deals 1. They deal 2 if they won on element and their number is also higher.
7. **Charge:** Playing your element earns +2 if it hit someone, or +1 if it didn't. Playing the element you called earns another +1, whichever element it is. The meter holds 5.
8. **Draw:** Everyone still in draws one card, which becomes their face-up card.

Everyone can see how many calls each player has kept.

Each step has a time limit: 20 seconds for abilities, 20 for calls and 30 for cards. The reveal plays its hits, then the next round starts by itself 10 seconds later. If time runs out, you hold your charge, make no call and play a random card.

If you're bloodbent, you still call and can lie about your forced card.

## Sudden death

Once two players remain, any damage gets +1, and that bonus grows by 1 each round until the game ends. A game that starts as a 1v1 reaches sudden death at round 8 instead.

If everyone remaining falls in the same round, whoever had the most HP before that round wins. Ties share the win.

## Sub-elements

| Sub-element | Element | Cost | Ability |
|---|---|---|---|
| Combustion | Fire | 2 | Your next fire card deals double damage to everyone it beats |
| Lightning | Fire | 4 | Deal 3 damage to one player |
| Seismic Sense | Earth | 2 | See one player's hand before you choose your card |
| Metalbending | Earth | 5 | Block all damage this round |
| Healing | Water | 4 | Heal 2 HP |
| Bloodbending | Water | 4 | Pick one of a player's face-down cards blind. They must play it, and only you and they see it |

Abilities that land in the same round resolve in this order: Metalbending, Bloodbending, Seismic Sense, Combustion, Healing, Lightning.

## Air

Air is switched off while its rules are being rethought.

## Running it

- Play: open `index.html` in a browser.
- Tests: `node --test`
- Balance simulator: `node sim.js`
- Try different numbers without editing the game: `PX_TUNE='{"healing":{"cost":2}}' node sim.js 5000`, or `PX_HP=15 node sim.js 5000` for starting HP.
