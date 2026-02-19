import enUS from './en-US.json';

export type Locale = 'en-US';

type Dictionary = Record<string, string>;

type Vars = Record<string, string | number>;

const dictionaries: Record<Locale, Dictionary> = {
  'en-US': enUS,
};

const defaultLocale: Locale = 'en-US';

export function getInitialLocale(): Locale {
  return defaultLocale;
}

export function createTranslator(locale: Locale) {
  const dictionary = dictionaries[locale] ?? dictionaries[defaultLocale];
  return (key: string, vars?: Vars): string => {
    const template = dictionary[key] ?? key;
    if (!vars) {
      return template;
    }
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_raw, token) => {
      const value = vars[token];
      return value === undefined ? '' : String(value);
    });
  };
}
