import nb from './nb';
import en from './en';

export const supportedLocales = ['en', 'nb'] as const;
export type Locale = (typeof supportedLocales)[number];
export type Messages = typeof nb;
export const defaultLocale: Locale = 'en';

export const languages = {
  nb: { name: 'Norsk', flag: '🇳🇴', prefix: 'no', dateLocale: 'nb-NO', ogLocale: 'nb_NO', messages: nb },
  en: { name: 'English', flag: '🇬🇧', prefix: '', dateLocale: 'en-GB', ogLocale: 'en_GB', messages: en },
} satisfies Record<Locale, {
  name: string;
  flag: string;
  prefix: string;
  dateLocale: string;
  ogLocale: string;
  messages: Messages;
}>;

export interface Alternate {
  locale: Locale;
  href: string;
}

export function homePath(locale: Locale): string {
  const prefix = languages[locale].prefix;
  return prefix ? `/${prefix}/` : '/';
}

export function postPath(locale: Locale, slug: string): string {
  return `${homePath(locale)}blog/${slug}/`;
}

export function homeAlternates(): Alternate[] {
  return supportedLocales.map((locale) => ({ locale, href: homePath(locale) }));
}

export const sections = ['writing', 'topics', 'talks', 'about'] as const;
export type Section = (typeof sections)[number];

export function sectionPath(locale: Locale, section: Section): string {
  return `${homePath(locale)}${section}/`;
}

export function topicPath(locale: Locale, topic: string): string {
  return `${sectionPath(locale, 'topics')}${topic}/`;
}

export function talkPath(locale: Locale, slug: string): string {
  return `${sectionPath(locale, 'talks')}${slug}/`;
}

export function tagPath(locale: Locale, tag: string): string {
  return `${homePath(locale)}tags/${tag}/`;
}

export function sectionAlternates(section: Section): Alternate[] {
  return supportedLocales.map((locale) => ({ locale, href: sectionPath(locale, section) }));
}
