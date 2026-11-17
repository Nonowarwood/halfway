// Who's who.
// `tone` picks the colour of each person's ink: 'blue' or 'rose'.
export const PEOPLE = {
  noah: { id: 'noah', name: 'Noah', place: 'France', flag: '🇫🇷', tz: 'Europe/Paris', tone: 'blue' },
  erin: { id: 'erin', name: 'Erin', place: 'China', flag: '🇨🇳', tz: 'Asia/Shanghai', tone: 'rose' },
};

export const IDS = Object.keys(PEOPLE);

// Day 1 of the journey. A new question starts every day at midnight UTC,
// which is 01:00 in France (02:00 in summer) and 08:00 in China.
export const START_DATE = '2026-11-17';

// Minimum length of a letter before it can be sent.
export const MIN_WORDS = 5;
