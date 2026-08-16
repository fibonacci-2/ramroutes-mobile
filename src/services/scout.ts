import { Tag } from '../constants/tags';
import { EventWithLocation } from '../hooks/useEvents';
import { rankByTagOverlap } from '../utils/personalization';

export type ScoutReply = { text: string; eventIds: string[] };

// Ported from design/Quad Campus Events.html's reply() - same keyword-matched
// canned responses, no LLM involved (see the design-hurdles note: this is a
// scripted assistant, not an AI one). Branches that depended on the mockup's
// structured day/date fields (weekend/tonight) are reworded since our schema
// only has a raw display-string date (BuildingEvent.date) - can't reliably
// bucket by day, so those branches recommend by tag instead of by day.
export function scoutReply(query: string, events: EventWithLocation[], savedEventIds: string[]): ScoutReply {
  const q = query.toLowerCase();

  const named = events.find((e) => q.includes(e.eventName.toLowerCase()));
  if (named) {
    const firstSentence = named.description?.split('. ')[0];
    return {
      text: `${named.eventName} is at ${named.buildingName}${named.date ? `, ${named.date}` : ''}.${
        firstSentence ? ` ${firstSentence}.` : ''
      } Want me to pull up anything similar?`,
      eventIds: [named.id],
    };
  }

  const tryTags = (tags: Tag[], text: string): ScoutReply | null => {
    const matches = rankByTagOverlap(events, tags, 3);
    if (matches.length === 0) return null;
    return { text, eventIds: matches.map((e) => e.id) };
  };

  if (/career|job|intern|resume|network/.test(q)) {
    return tryTags(['career'], 'A couple of good ones for that - here are the top career-tagged events right now.') ??
      { text: "Nothing tagged career right now, but check the Events tab - new ones get added often.", eventIds: [] };
  }
  if (/weekend|saturday|sunday|tonight|today|happening|going on/.test(q)) {
    return tryTags(['social', 'arts'], "Here's a mix of what's happening around campus - I can't tell exact days yet, but these are worth a look.") ??
      { text: "Nothing lined up for that yet - try browsing the Events tab.", eventIds: [] };
  }
  if (/volunteer|service|help out/.test(q)) {
    return tryTags(['social', 'cultural'], "I don't have a dedicated volunteer tag yet, but these community-ish events might fit.") ??
      { text: "Nothing tagged for volunteering yet - that's a gap in the tag taxonomy worth adding.", eventIds: [] };
  }
  if (/music|show|concert|fun|dance|party/.test(q)) {
    return tryTags(['arts'], 'For a fun night, these are tagged arts/entertainment.') ??
      { text: "No arts events tagged yet - check back soon.", eventIds: [] };
  }
  if (/sport|game|match|watch/.test(q)) {
    return tryTags(['sports'], 'These are the sports-tagged events on the board right now.') ??
      { text: "No sports events tagged yet.", eventIds: [] };
  }
  if (/study|class|learn|workshop|python|tutor/.test(q)) {
    return tryTags(['academic', 'tech'], 'These are tagged academic or tech - good for that.') ??
      { text: "Nothing tagged academic/tech yet.", eventIds: [] };
  }
  if (/free|cheap|food/.test(q)) {
    return tryTags(['food'], 'For free food specifically, these are tagged food.') ??
      { text: "Nothing tagged food yet - most events list their cost in the description though.", eventIds: [] };
  }
  if (/greek|fraternity|sorority|rush|frat/.test(q)) {
    return tryTags(['greek life'], 'These are tagged greek life.') ??
      { text: "Nothing tagged greek life right now.", eventIds: [] };
  }
  if (/saved|my list/.test(q)) {
    if (savedEventIds.length === 0) {
      return { text: 'Your saved list is empty so far. Tell me what you’re into - music, sports, career stuff - and I’ll suggest some.', eventIds: [] };
    }
    return { text: `You’ve saved ${savedEventIds.length} - here’s what’s on your list.`, eventIds: savedEventIds.slice(0, 3) };
  }

  return {
    text: 'I can recommend by vibe - try "something fun", "career events", or "where can I volunteer?". Or tell me what you’re into and I’ll match you.',
    eventIds: [],
  };
}
