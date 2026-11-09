# Obsidian rules

Numbers below are what the game currently uses.

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

A round has three steps.

1. **Call it:** Everyone secretly calls an element (you can lie). Anyone with enough charge also decides whether to use their sub-element. When the step ends, the calls are revealed and the sub-elements go off together.
2. **Pick a card:** Everyone secretly picks a card. Eliminated players secretly vote for an element in the Spirit World: the top element gets +1 power this round, and a tied vote does nothing.
3. **Flip:** All cards flip at once, and you compare your card with every other player's.
   - **Damage:** Each player who beats you deals 1. They deal 2 if they won on element and their number is also higher.
   - **Charge:** You get 1 every round, +1 for playing your element and +1 for playing the element you called. Hits don't matter. The meter holds 5.
   - **Draw:** Everyone still in draws one card, which becomes their face-up card.

Everyone can see how many calls each player has kept.

Each step has a time limit: 25 seconds for calling and your sub-element, and 30 for cards. The reveal plays its hits, then the next round starts once everyone clicks Next round, or by itself 5 seconds later. If time runs out, you hold your charge, make no call and play a random card.

Calls are made before anyone knows who used a sub-element, so if you're bloodbent you've already called by the time you see your forced card.

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
