/**
 * footballQuotes | v1.0.0 | 2026-06-14
 * Purpose: Curated pool of real, widely-attributed football quotes plus a
 *          deterministic picker. Used by the developer console easter egg
 *          (T50) and any "quote of the day" surface.
 *
 * RULE: Quotes must be genuine and commonly attributed — never invented.
 *       Picker is deterministic: same seed -> same quote (no RNG), so the
 *       unit test stays stable and CI has no key dependency.
 */

export interface FootballQuote {
  /** The quote, verbatim and in English. */
  text: string
  /** The person it is commonly attributed to. */
  author: string
}

/**
 * Pool of real football quotes. Kept English-only (jury is anglophone) and
 * limited to widely-documented attributions. Order is stable; the picker
 * indexes into it deterministically, so do not rely on ordering for meaning.
 */
export const FOOTBALL_QUOTES: readonly FootballQuote[] = [
  { text: "Football is not a matter of life and death. It's much more important than that.", author: 'Bill Shankly' },
  { text: 'If you are first you are first. If you are second you are nothing.', author: 'Bill Shankly' },
  { text: 'Playing football is very simple, but playing simple football is the hardest thing there is.', author: 'Johan Cruyff' },
  { text: 'Quality without results is pointless. Results without quality is boring.', author: 'Johan Cruyff' },
  { text: 'Every disadvantage has its advantage.', author: 'Johan Cruyff' },
  { text: 'Before I make a mistake, I don\'t make that mistake.', author: 'Johan Cruyff' },
  { text: 'If you have the ball you must make the field as big as possible, and if you don\'t have the ball you must make it as small as possible.', author: 'Johan Cruyff' },
  { text: 'Football is the most important of the least important things in the world.', author: 'Carlo Ancelotti' },
  { text: 'I like to win, but with style.', author: 'Carlo Ancelotti' },
  { text: 'Please don\'t call me arrogant, but I\'m European champion and I think I\'m a special one.', author: 'Jose Mourinho' },
  { text: 'If I wanted to have an easy job I would have stayed at Porto.', author: 'Jose Mourinho' },
  { text: 'I believe the target of anything in life should be to do it so well that it becomes an art.', author: 'Arsene Wenger' },
  { text: 'Football, bloody hell.', author: 'Alex Ferguson' },
  { text: 'Attack wins you games, defence wins you titles.', author: 'Alex Ferguson' },
  { text: 'Hard work will always overcome natural talent when natural talent does not work hard enough.', author: 'Alex Ferguson' },
  { text: 'Success is no accident. It is hard work, perseverance, learning, studying, sacrifice and most of all, love of what you are doing.', author: 'Pele' },
  { text: 'Everything is practice.', author: 'Pele' },
  { text: 'Football is a simple game; 22 men chase a ball for 90 minutes and at the end, the Germans always win.', author: 'Gary Lineker' },
  { text: 'When the seagulls follow the trawler, it is because they think sardines will be thrown into the sea.', author: 'Eric Cantona' },
  { text: 'When people succeed, it is because of hard work. Luck has nothing to do with success.', author: 'Diego Maradona' },
  { text: 'Magic is sometimes very close to nothing at all.', author: 'Zinedine Zidane' },
  { text: 'I wouldn\'t say I was the best manager in the business. But I was in the top one.', author: 'Brian Clough' },
  { text: 'I\'m a much better manager when I have good players.', author: 'Pep Guardiola' },
  { text: 'Your love makes me strong, your hate makes me unstoppable.', author: 'Cristiano Ronaldo' },
  { text: 'You have to fight to reach your dream. You have to sacrifice and work hard for it.', author: 'Lionel Messi' },
  { text: 'Sometimes in football you have to score goals.', author: 'Thierry Henry' },
  { text: 'I spent a lot of money on booze, birds and fast cars. The rest I just squandered.', author: 'George Best' },
  { text: 'I would love it if we beat them. Love it.', author: 'Kevin Keegan' },
  { text: 'The first 90 minutes are the most important.', author: 'Bobby Robson' },
  { text: 'It is not the man with the loudest voice who is the leader.', author: 'Bobby Robson' },
  { text: 'In football, the worst blindness is only seeing the ball.', author: 'Nelson Falcao Rodrigues' },
  { text: 'A team is not made up of eleven players. A team is made up of eleven friends.', author: 'Just Fontaine' },
  { text: 'The ball is round, the game lasts ninety minutes, and everything else is just theory.', author: 'Sepp Herberger' },
  { text: 'After the game is before the game.', author: 'Sepp Herberger' },
  { text: 'Some people believe football is a matter of life and death. I can assure you it is much more serious than that.', author: 'Bill Shankly' },
  { text: 'I learned all about life with a ball at my feet.', author: 'Ronaldinho' },
  { text: 'You can change your wife, your politics, your religion, but never, never can you change your favourite football team.', author: 'Eric Cantona' },
  { text: 'Football is played with the head. Your feet are just the tools.', author: 'Andrea Pirlo' },
  { text: 'Talent without working hard is nothing.', author: 'Cristiano Ronaldo' },
  { text: 'The more difficult the victory, the greater the happiness in winning.', author: 'Pele' },
  { text: 'I always knew I would get to the top, and nobody was going to stop me.', author: 'Ian Wright' },
  { text: 'When you win, you don\'t get carried away. But if you go game by game, you can win the title.', author: 'Pep Guardiola' },
] as const

/**
 * Deterministically pick a quote by seed. Handles negative seeds and
 * non-integers safely; always returns a valid quote.
 */
export function pickFootballQuote(seed: number): FootballQuote {
  const n = FOOTBALL_QUOTES.length
  const i = Math.floor(Math.abs(seed)) % n
  return FOOTBALL_QUOTES[i]
}

/**
 * Quote of the day — deterministic for a given calendar date (UTC), so every
 * viewer on the same day sees the same quote with no RNG.
 */
export function quoteOfTheDay(date: Date = new Date()): FootballQuote {
  const dayIndex = Math.floor(date.getTime() / 86_400_000) // whole days since epoch
  return pickFootballQuote(dayIndex)
}
