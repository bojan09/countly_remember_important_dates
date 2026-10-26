// Bundled Macedonian date names and plural rules (CLDR "mk").
// Some browsers ship without Macedonian ICU data and silently fall back to English
// in Intl.DateTimeFormat / Intl.PluralRules, so Macedonian never depends on Intl.
export const MK_MONTHS_LONG = ['јануари', 'февруари', 'март', 'април', 'мај', 'јуни', 'јули', 'август', 'септември', 'октомври', 'ноември', 'декември'];
export const MK_MONTHS_SHORT = ['јан.', 'фев.', 'мар.', 'апр.', 'мај', 'јун.', 'јул.', 'авг.', 'септ.', 'окт.', 'ноем.', 'дек.'];
// Index 0 = Sunday.
export const MK_WEEKDAYS_LONG = ['недела', 'понеделник', 'вторник', 'среда', 'четврток', 'петок', 'сабота'];
export const MK_WEEKDAYS_SHORT = ['нед', 'пон', 'вто', 'сре', 'чет', 'пет', 'саб'];

/** CLDR cardinal rule for integers: one = n % 10 == 1 && n % 100 != 11. */
export function mkPlural(n) {
  const i = Math.abs(Math.trunc(n));
  return i % 10 === 1 && i % 100 !== 11 ? 'one' : 'other';
}
