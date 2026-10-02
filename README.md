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

Opprett en Markdown-fil i `src/content/blog/`, for eksempel `et-nytt-innlegg.md`:

```markdown
---
title: "Et nytt innlegg"
description: "En kort beskrivelse som brukes på forsiden og i SEO-metadata."
publishedDate: "2026-10-03"
slug: "et-nytt-innlegg"
draft: true
---

Innledningen til innlegget.

## En overskrift

Resten av teksten. Bruk beskrivende lenketekster og alternativ tekst på bilder.
```

`title`, `description`, `publishedDate` og `slug` er obligatoriske. Bruk en gyldig kalenderdato i formatet `"YYYY-MM-DD"` (med anførselstegn). `draft` er en valgfri boolsk verdi; utelatt eller `false` betyr publisert.

Slug må være eksplisitt, unik og bestå av små ASCII-bokstaver, tall og enkeltstående bindestreker. Eksemplet får adressen `/blog/et-nytt-innlegg/`, uavhengig av filnavnet. **Behold slug når du endrer tittel eller filnavn**, slik at lenker fortsatt virker. Endret slug endrer adressen; det opprettes ikke automatiske videresendinger.

Forsiden viser publiserte innlegg med nyeste dato først. Ved lik dato sorteres de etter slug. En fremtidig dato er ikke tidsstyrt publisering; bruk `draft: true` til innlegget skal vises. Utkast listes ikke og får ingen generert side, heller ikke lokalt. Les utkast i Markdown-editoren, eller fjern `draft: true` lokalt for forhåndsvisning og sett det tilbake før du sender endringen.

Duplikate slugs **stopper byggingen**, også mellom utkast. Loaderen beholder filnavnet som intern ID, slik at innlegg med samme slug ikke overskriver hverandre før valideringen. Forsiden og innleggssidene bruker samme publiseringsfunksjon i `src/lib/blog.ts`.

Utkast er ikke hemmelige: Markdown-filene er synlige for alle som har tilgang til repositoryet. Ikke legg inn sensitivt innhold. Bruk `##` som første overskriftsnivå i innholdet; sidemalen lager `h1` fra tittelen. Bilder i `public/images/` kan refereres til som `![Beskrivende alternativ tekst](/images/bilde.jpg)`.

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
