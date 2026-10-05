# Haimanots blogg

En personlig, statisk blogg på [haimanot.dev](https://haimanot.dev), bygget med Astro og streng TypeScript.

## Lokal utvikling

Du trenger Node.js 24 og npm. Med nvm:

```sh
nvm install
nvm use
npm ci
npm run dev
```

Åpne <http://localhost:4321>. Utviklingsserveren oppdaterer siden når du endrer kode eller innlegg.

```sh
npm run check    # Typesjekk av TypeScript og Astro
npm test         # Byggetester for publisering, metadata, slugs og utkast
npm run build    # Statisk nettsted i dist/
npm run preview  # Forhåndsvis det siste bygget lokalt
```

Prosjektet bruker `astro/tsconfigs/strictest`. Alle sider er statisk HTML med responsiv CSS, uten JavaScript i nettleseren. React er ikke installert: det trengs ingen interaktivitet nå. Det er ingen backend, innlogging, analyse, kommentarer eller CMS.

## Nye innlegg

Du kan kopiere `src/content/blog/en/learning-note-template.md` for å starte et
engelsk læringsnotat. Malen har `draft: true` og publiseres ikke. Gi kopien et
nytt filnavn, en unik `slug` og `translationKey`, og oppdater øvrige metadata
og tekst før du publiserer. Hvis du fyller ut `sources` i metadata, fjern
malens `## Sources`-seksjon for å unngå to kildelister.

Bloggen er en læringsdagbok, organisert etter **tema**, ikke etter hvor ideen kom fra.
Navigasjonen er Innlegg, Temaer, Foredrag og Om meg. Forsiden viser de fem nyeste
innleggene og lenker til temaene; `/writing/` og `/no/writing/` viser alle innlegg.
Temaoversiktene ligger på `/topics/` og `/no/topics/`. Innleggenes eksisterende
`/blog/<slug>/`-adresser er uendret.

Opprett en Markdown-fil i `src/content/blog/`, for eksempel `et-nytt-innlegg.md`:

```markdown
---
title: "Et nytt innlegg"
description: "En kort beskrivelse som brukes på forsiden og i SEO-metadata."
publishedDate: "2026-10-03"
slug: "et-nytt-innlegg"
language: "nb"
translationKey: "my-new-post"
topic: "software-design"
format: "learning-note"
tags:
  - modularity
sources:
  - title: "A Philosophy of Software Design"
    type: "book"
    author: "John Ousterhout"
    locator: "Kapittelet jeg skriver om"
draft: true
---

## Spørsmålet
Hva prøver jeg å forstå?

## Min forståelse
Forklar ideen med egne ord.

## Et konkret eksempel
Vis kode, et diagram eller en realistisk situasjon.

## Hvor dette kan hjelpe, og hvor det ikke passer
Beskriv bruksområder, forutsetninger og avveininger.

## Hva jeg vil prøve
Beskriv ett lite eksperiment eller noe jeg vil observere.
```

`title`, `description`, `publishedDate`, `slug`, `language`, `translationKey`,
`topic` og `format` er obligatoriske. Bruk en gyldig kalenderdato i formatet
`"YYYY-MM-DD"` (med anførselstegn). `draft` er en valgfri boolsk verdi;
utelatt eller `false` betyr publisert.

### Tema, format og kilder

Velg ett hovedtema. Verdiene defineres i `src/lib/taxonomy.ts` og vises med
oversatte navn fra `src/i18n/`:

| `topic` | Tema |
|---|---|
| `software-architecture` | Programvarearkitektur |
| `software-design` | Programvaredesign |
| `computer-science` | Informatikk |
| `ai-developer-tools` | KI og utviklerverktøy |
| `frontend-engineering` | Frontend-utvikling |
| `learning-cognition` | Læring og kognisjon |
| `engineering-leadership` | Teknologiledelse |

`format` beskriver hva slags tekst leseren får: `learning-note` (én idé forklart
med egne ord), `reflection` (spørsmål og forbindelser), `practice-report`
(det du faktisk prøvde og observerte), eller `review` (vurdering av en hel ressurs).
Bokomtaler ligger i samme samling som andre innlegg, ikke i en egen bokmappe.

`tags` er valgfritt: inntil fem unike, presise stikkord med små ASCII-bokstaver,
tall og enkeltstående bindestreker, for eksempel `ddd` eller `working-memory`.
De vises som klikkbare bobler på innlegg og i innleggslistene. Innleggssiden
(`/writing/` og `/no/writing/`) har også en alfabetisk stikkordsky. Hver boble
går til `/tags/<stikkord>/` (norsk: `/no/tags/<stikkord>/`) med alle publiserte
innlegg på det valgte språket som har stikkordet. Stikkord fra utkast tas ikke
med. Språkbytte beholder stikkordet; hvis det ikke finnes publiserte innlegg
med stikkordet på det andre språket, viser siden en tomtilstand.

`sources` er en valgfri liste. Hver kilde har `title` og `type` (`book`, `course`,
`video`, `podcast` eller `article`). `author`, `locator` (kapittel, episode eller
tidskode) og `url` er valgfrie. URL må bruke HTTP eller HTTPS; en bok trenger
ikke en lenke. Kildelisten vises automatisk etter innholdet, så du trenger ikke
gjenta den i Markdown. Et innlegg kan ha kilder av flere typer.

Skriv gjerne én idé per læringsnotat. Knytt senere notater sammen med vanlige
Markdown-lenker, og legg til daterte oppdateringer eller en praksisrapport når
du prøver ideen. Skill tydelig mellom noe du tror kan hjelpe og noe du har
observert i praksis. Ikke publiser fortrolig kode eller detaljer fra arbeid.

Slug må være eksplisitt, unik innen språket og bestå av små ASCII-bokstaver, tall og enkeltstående bindestreker. Eksemplet får adressen `/no/blog/et-nytt-innlegg/`, uavhengig av filnavnet. **Behold slug når du endrer tittel eller filnavn**, slik at lenker fortsatt virker. Endret slug endrer adressen; det opprettes ikke automatiske videresendinger.

Alle oversikter viser bare publiserte innlegg på sitt språk, med nyeste dato først. Ved lik dato sorteres de etter slug. En fremtidig dato er ikke tidsstyrt publisering; bruk `draft: true` til innlegget skal vises. Utkast listes ikke, telles ikke på temasidene og får ingen generert side, heller ikke lokalt. Les utkast i Markdown-editoren, eller fjern `draft: true` lokalt for forhåndsvisning og sett det tilbake før du sender endringen.

Duplikate slugs **innen samme språk stopper byggingen**, også mellom utkast. Samme slug kan brukes på forskjellige språk fordi adressene er forskjellige. Duplikate `translationKey` innen samme språk stopper også byggingen; en oversettelsesgruppe kan ha maksimalt én fil per språk. Loaderen beholder filnavnet som intern ID, slik at innlegg ikke overskriver hverandre før valideringen. Forsiden og innleggssidene bruker samme publiseringsfunksjon i `src/lib/blog.ts`.

Utkast er ikke hemmelige: Markdown-filene er synlige for alle som har tilgang til repositoryet. Ikke legg inn sensitivt innhold. Bruk `##` som første overskriftsnivå i innholdet; sidemalen lager `h1` fra tittelen. Bilder i `public/images/` kan refereres til som `![Beskrivende alternativ tekst](/images/bilde.jpg)`.

## Språk og oversettelser

Engelsk (`en`) er standardspråket på `/` og `/blog/<slug>/`. Norsk bokmål (`nb`) ligger på `/no/` og `/no/blog/<slug>/`; URL-prefixen `no` endrer ikke språkkoden `nb` i metadata og HTML. Norske innlegg flyttes dermed fra de opprinnelige adressene; det opprettes ikke automatiske videresendinger. Språkbytte er vanlige lenker med flagg og språknavn, utformet som knapper. Det krever ikke React, JavaScript, informasjonskapsler eller automatisk omdirigering basert på nettleserspråk.

Grensesnittet oversettes i `src/i18n/nb.ts` og `src/i18n/en.ts`. Den norske ordlisten definerer `Messages`-typen, og andre ordlister må oppfylle den. TypeScript melder fra om manglende eller ukjente tekstnøkler. Datovisning, HTML-`lang` og Open Graph-locale følger språket.

Innlegg oversettes manuelt til egne Markdown-filer. Opprett for eksempel `src/content/blog/en/my-new-post.md` med:

```yaml
title: "My new post"
description: "A short English description."
publishedDate: "2026-10-03"
slug: "my-new-post"
language: "en"
translationKey: "my-new-post"
topic: "software-design"
format: "learning-note"
draft: true
```

Legg metadataene mellom `---` i starten av filen, som i eksemplet over, og skriv engelsk Markdown etterpå. **Samme innlegg på forskjellige språk må ha samme stabile `translationKey`**. Den er en intern kobling, ikke en URL, og følger samme tegnregler som slug. Slug og publiseringsdato kan være forskjellige per språk. Mappene er bare organisering; `language` i metadata bestemmer språket.

Språkvelgeren går direkte til innleggets publiserte oversettelse. Hvis den mangler eller er et utkast, viser lenken en tydelig melding og går til det språkets forside. Innlegg kan publiseres uavhengig; vi viser aldri norsk tekst som om den var engelsk. SEO bruker canonical per side og gjensidige `hreflang`-lenker bare mellom publiserte oversettelser, ikke til manglende oversettelser eller utkast.

GitHub Pages bruker én `/404.html` for alle ukjente adresser, også under `/no/`. Denne siden har engelsk som hovedspråk og feilmelding og hjemlenke på begge språk, med riktig `lang` på hver tekstdel. Et nytt språk tas automatisk med i 404-innholdet.

### Legge til et språk

1. Legg til språkkoden i `supportedLocales` i `src/i18n/index.ts`.
2. Opprett en ordliste, for eksempel `src/i18n/de.ts`, med `satisfies Messages`. Importer den og legg til en registrering i `languages` med språknavn, flagg, unik URL-prefix, dato-locale, Open Graph-locale og ordliste. Bare engelsk skal ha tom prefix; behold eksisterende prefix for stabile adresser.
3. Opprett oversatte Markdown-filer med den nye `language`-verdien og samme `translationKey` som originalen.
4. Kjør `npm run check`, `npm test` og `npm run build`.

Den felles ruten `src/pages/[...path].astro` genererer forsider, oversikter,
temasider, innlegg og foredrag for alle registrerte språk. Språkbytte på en
oversikt går til den samme oversikten på det andre språket. Om meg-teksten
ligger i ordlistene. DNS og GitHub Pages-oppsettet er uendret.

## Foredrag

`/talks/` og `/no/talks/` har en tomtilstand til du publiserer et foredrag.
Opprett en Markdown-fil i `src/content/talks/`, for eksempel `en/deep-modules.md`:

```markdown
---
title: "Understanding deep modules"
description: "An abstract explaining the problem and what the audience will learn."
publishedDate: "2026-10-05"
slug: "deep-modules"
language: "en"
translationKey: "deep-modules-talk"
topic: "software-design"
event: "Name of the event"
slides: "https://example.com/slides"
recording: "https://example.com/recording"
relatedPosts:
  - my-new-post
draft: true
---

## Abstract
Describe the question, your central claim, examples, and limitations.
```

Foredrag bruker samme obligatoriske metadata som innlegg, unntatt `format`.
`event`, `slides`, `recording` og `relatedPosts` er valgfrie. Utelat eksempel-URL-ene
hvis materiell ikke er tilgjengelig. `publishedDate` er publiseringsdatoen for
siden; eventuelle arrangementsdatoer kan du beskrive i teksten.

`relatedPosts` refererer til innleggenes stabile **translationKey**, ikke slug
eller filnavn. Ukjente nøkler stopper byggingen. Bare publiserte innlegg på
foredragets språk vises som relaterte innlegg; utkast og manglende oversettelser
vises ikke. Oversatte foredrag deler sin egen `translationKey` og får gjensidige
språklenker. Slugs og oversettelsesnøkler valideres innen hver samling, også
for utkast. Et engelsk foredrag får adressen `/talks/deep-modules/`.

## GitHub Actions og Pages

Workflowen i `.github/workflows/pages.yml` installerer fra låsefilen, typesjekker, tester publiseringsreglene og bygger ved PR-er og push til `main`. Bare vellykkede bygg på `main` kan deployes. Den kan også startes manuelt via **Actions → Check and deploy blog → Run workflow** med `main` valgt. PR-er deployes ikke og trenger ikke Pages-skrivetilgang.

Før første deploy, gjør dette i GitHub:

1. Gå til repositoryets **Settings → Pages** og velg **GitHub Actions** under **Source**.
2. Kontroller at **Settings → Environments → github-pages** tillater deployment fra `main`.
3. Verifiser domenet i brukerens **Settings → Pages → Add a domain**. Legg inn TXT-posten GitHub oppgir hos Namecheap, med nøyaktig host og verdi fra GitHub. Behold denne posten.
4. Sett repositoryets **Settings → Pages → Custom domain** til `haimanot.dev` og lagre **før** du peker DNS til GitHub.
5. Konfigurer DNS som beskrevet nedenfor, og aktiver HTTPS når GitHub er klar.

Hvis Pages ikke er tilgjengelig for et privat repository på abonnementet ditt, kreves et abonnement som støtter dette, eller et offentlig repository.

`astro.config.mjs` har `site: 'https://haimanot.dev'` og ingen repository-prefiks i `base`, fordi nettstedet ligger på eget domene. `public/CNAME` følger med i bygget som domenedokumentasjon; ved Actions-publisering er det **Pages-innstillingen** som styrer domenet, ikke CNAME-filen.

## DNS hos Namecheap

Gå til **Domain List → haimanot.dev → Manage → Advanced DNS → Host Records**. Dette forutsetter at domenet bruker Namecheaps DNS (for eksempel BasicDNS). Bruk `Automatic` som TTL:

| Type | Host | Value |
|------|------|-------|
| A Record | `@` | `185.199.108.153` |
| A Record | `@` | `185.199.109.153` |
| A Record | `@` | `185.199.110.153` |
| A Record | `@` | `185.199.111.153` |
| CNAME Record | `www` | `haimanot1989.github.io` |

CNAME-verdien skal ikke inneholde `https://` eller `/personal-blog`. GitHub videresender `www.haimanot.dev` til det valgte hoveddomenet `haimanot.dev`.

Fjern bare konflikter for `@` og `www`, for eksempel Namecheaps parkeringsadresse, URL Redirect eller gamle A/AAAA/CNAME-poster. **Behold MX og TXT som brukes til e-post og domeneverifisering.** Ikke opprett wildcard-poster (`*`), siden de kan gjøre underdomener utsatt for overtakelse.

IPv6 er valgfritt. Hvis du bruker AAAA-poster for `@`, sett alle fire til `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153` og `2606:50c0:8003::153`. Behold også A-postene.

Kontroller resultatet etter DNS-propagasjon (kan ta opptil 24 timer):

```sh
dig +short haimanot.dev A
dig +short www.haimanot.dev CNAME
```

Se [GitHubs domeneveiledning](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) og [Namecheaps veiledning for A-poster](https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/how-can-i-set-up-an-a-address-record-for-my-domain/) for oppdaterte verdier.

## HTTPS

Når DNS-sjekken er godkjent og sertifikatet er klart, slå på **Settings → Pages → Enforce HTTPS**. Utstedelse kan ta opptil 24 timer. `.dev` krever HTTPS i moderne nettlesere, så nettstedet er ikke klart til bruk før sertifikatet virker.

Ved sertifikatfeil: sjekk A-poster, `www`-CNAME, eventuelle feilaktige AAAA-poster og GitHubs DNS-status. Hvis domenet har restriktive CAA-poster, må de tillate `letsencrypt.org`. Ikke kjøp et eget Namecheap-sertifikat til GitHub Pages.

```sh
curl -I https://haimanot.dev/
curl -I https://www.haimanot.dev/
curl -I https://haimanot.dev/en-side-som-ikke-finnes/
```

Forsiden skal svare 200, `www` skal videresende til hoveddomenet, og den ukjente siden skal svare 404 med den egendefinerte 404-siden. GitHub Pages håndterer HTTP-statusen; `npm run preview` er bare en lokal forhåndsvisning.

## Rollback

Et mislykket bygg eller en mislykket deploy lar normalt den forrige versjonen være publisert. Ved en feil i en allerede publisert versjon er det tryggest å reversere endringen på `main` gjennom en PR:

```sh
git revert <commit-som-introduserte-feilen>
npm ci
npm run check
npm test
npm run build
```

Send reverseringen til GitHub gjennom vanlig PR-flyt. Når den merges til `main`, deployes forrige innhold på nytt. Ved flere commits, reverser de relevante endringene fra nyeste til eldste og løs eventuelle konflikter. Ikke bruk force-push. Behold domene- og DNS-innstillingene.

For en rask midlertidig rollback kan du kjøre **Re-run all jobs** på en tidligere vellykket workflow-kjøring fra `main`; den bygger den kjøringens commit med tilhørende låsefil. Dette endrer ikke kildekoden på `main`, så en ny deploy kan publisere feilen igjen. Følg opp med en reverserings-PR. Artifakter har begrenset levetid; å kjøre alle jobbene på nytt lager et nytt artifact.

Hvis nettstedet avvikles, fjern DNS-poster som peker til Pages før du kobler domenet fra GitHub, for å unngå at domenet blir stående ubeskyttet.
