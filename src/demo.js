import { IDS } from './config.js';
import { addDays } from './days.js';

// Example letters to try every screen: 8 days of history, one missed day,
// fixes in every state, and today's letter from the pen pal still sealed.
// They match the first questions in questions.js.
export function buildDemo(today) {
  const [A, B] = IDS;
  const start = addDays(today, -8);
  const db = { answers: {}, corrections: {}, meta: { start } };
  const day = (n) => addDays(start, n - 1);
  let k = 0;

  const answer = (n, author, text, hour) => {
    const id = `${day(n)}_${author}`;
    const at = `${day(n)}T${String(hour).padStart(2, '0')}:00:00.000Z`;
    db.answers[id] = { id, date: day(n), author, text, createdAt: at, updatedAt: at };
    return db.answers[id];
  };

  const fix = (a, original, suggestion, why, status, unsure = false) => {
    const startAt = a.text.indexOf(original);
    if (startAt < 0) return console.warn('demo: not found', original);
    const id = `demo${++k}`;
    db.corrections[id] = {
      id, answerId: a.id, date: a.date, author: a.author === A ? B : A, target: a.author,
      start: startAt, end: startAt + original.length, original, suggestion, why, unsure, status, createdAt: a.updatedAt,
    };
  };

  // Day 1: bedrooms
  let a = answer(1, A, "My bedroom is under the roof, so the ceiling is very low on one side. There is a big poster above my bed and a lot of albums on a shelf. The first thing people notice is the fairy lights, I put them everywhere. My mum says it's too messy and honestly I am agree with her.", 19);
  fix(a, 'I am agree', 'I agree', "'agree' is already a verb, so no 'am'.", 'accepted');
  a = answer(1, B, 'My bedroom is small but cozy. There is a desk next to the window where I do my homeworks every night. On the wall I have many photos of my friends. When I want to sleep I close the light and listen music.', 13);
  fix(a, 'homeworks', 'homework', "'homework' has no plural, like 'information'.", 'accepted');
  fix(a, 'close the light', 'turn off the light', 'We turn lights on and off.', 'accepted');
  fix(a, 'listen music', 'listen to music', "It's always 'listen to' something.", 'accepted');

  // Day 2: food
  a = answer(2, A, "Yesterday I ate a raclette with my family. It's a cheese that you melt and put on potatoes. It was delicious but after I was so full that I couldn't move. I make a photo to show you!", 20);
  fix(a, 'I make a photo', 'I took a photo', "We 'take' photos, and it's in the past.", 'accepted');
  fix(a, 'after', 'afterwards', "I think 'after' alone needs something after it?", 'pending', true);
  a = answer(2, B, 'Yesterday my mother cook hot pot for us. Hot pot is a big soup in the middle of the table and everyone put meat and vegetables inside. It was very spicy, my eyes was crying. 10/10!', 12);
  fix(a, 'cook', 'cooked', 'It happened yesterday: past tense.', 'accepted');
  fix(a, 'everyone put', 'everyone puts', "'everyone' works like 'he': it takes an -s.", 'accepted', true);
  fix(a, 'my eyes was crying', 'my eyes were watering', "'eyes' is plural, so 'were'. And I think spicy food makes your eyes 'water'.", 'disputed', true);

  // Day 3: untranslatable words
  a = answer(3, A, "In French we say « flâner ». It means walking in the city without a goal, just for the pleasure. Actually I flâne a lot when I'm stressed. I think English people say 'wander' but it's not exactly the same.", 18);
  fix(a, 'Actually', 'These days', "'Actually' means 'in fact'. Did you mean 'these days'?", 'accepted', true);
  a = answer(3, B, "In Chinese we have 加油 (jiāyóu). Literally it mean 'add oil' but we say it when someone have an exam or a difficult thing, like 'you can do it!'. So I say it to you now: 加油 for your English!", 14);
  fix(a, 'it mean', 'it means', "'it' takes an -s in the present.", 'accepted');
  fix(a, 'someone have', 'someone has', "Same rule as 'it': someone has.", 'pending');

  // Day 4: songs (the pen pal had an exam, no letter)
  answer(4, A, "Right now I can't stop listening to a K-pop song my friend sent me. The chorus is very catchy and the dance is so cute. I listen it on repeat since three days.", 21);

  // Day 5: school days
  a = answer(5, A, 'I wake up at 7 and I take the bus at 7:40. Lessons start at 8 and finish at 5 or 6, it depends of the day. After school I do my homework and sometimes I code little projects on my computer. I go to bed too late, around midnight.', 19);
  fix(a, 'depends of', 'depends on', "It's always 'depend on'.", 'accepted');
  a = answer(5, B, "I wake up at 6:30 because school start at 7:30. We have class until 5:40 and after dinner there is evening study until 9:30. It is long but my classmates are funny so it's ok. When I go home I am very tired and I sleep immediately.", 15);
  fix(a, 'school start', 'school starts', "'school' is like 'it': starts.", 'pending');
  fix(a, 'When I go home', 'When I get home', "'get home' is the moment you arrive.", 'accepted');

  // Day 6: a city for a year
  a = answer(6, A, 'If I could live anywhere, I will choose Seoul. I want to see concerts, eat street food and visit cafés with cute decorations. Also it is not too far from China, so maybe we could meet!', 20);
  fix(a, 'I will choose', 'I would choose', "With 'If I could…', use 'would'.", 'accepted');
  a = answer(6, B, 'I would choose Paris of course! I want to see the Eiffel Tower in the night and eat a real croissant. But people say Parisians are not very friendly, is it true?', 13);
  fix(a, 'in the night', 'at night', "We say 'at night'.", 'accepted');

  // Day 7: surprising habits
  a = answer(7, A, "In France we kiss on the cheeks to say hello, even with people we don't know very well. The number of kisses change depending of the region, it's very confusing even for French people!", 19);
  fix(a, 'change', 'changes', "'the number' is singular.", 'pending');
  fix(a, 'depending of', 'depending on', "Like 'depend on', I think.", 'pending', true);
  a = answer(7, B, 'In China many people pay everything with their phone, even for very small things like a bottle of water. I almost never use cash. When I saw videos of foreigners about it, I understood it is surprising.', 14);
  fix(a, 'pay everything', 'pay for everything', "You pay 'for' something.", 'pending');

  // Day 8: last weekend
  a = answer(8, A, 'Last weekend I stayed home because it was raining all the time. I watched a series and I finished a project I started since weeks. On Sunday I went to the cinema with friends, the movie was a bit boring but the popcorn was good.', 20);
  fix(a, 'I started since weeks', 'I started weeks ago', "'since' needs a starting point (since Monday). For a length of time: 'weeks ago'.", 'pending');
  a = answer(8, B, 'Last weekend I had a math exam on Saturday morning, so I studied a lot on Friday night. After the exam I go shopping with my best friend and we eat bubble tea. It was the best part of the week.', 12);
  fix(a, 'I go shopping', 'I went shopping', 'Past tense: go, went.', 'pending');
  fix(a, 'we eat bubble tea', 'we had bubble tea', "You 'drink' or 'have' bubble tea, and it's in the past.", 'pending');

  // Day 9 (today): the pen pal already wrote, the letter stays sealed
  answer(9, B, "I would bring my phone, a big bottle of water and my cat. The phone is for music (and maybe to call for help!). The water is obvious. And my cat because I can't live without him, he is my best friend.", 0);

  return db;
}
