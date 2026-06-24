export type Locale = "it" | "en" | "de";

export const DEFAULT_LOCALE: Locale = "it";

export const LANGUAGE_OPTIONS: { locale: Locale; shortLabel: string; label: string }[] = [
  { locale: "it", shortLabel: "IT", label: "Italiano" },
  { locale: "en", shortLabel: "EN", label: "English" },
  { locale: "de", shortLabel: "DE", label: "Deutsch" },
];

const INTL_LOCALES: Record<Locale, string> = {
  it: "it-IT",
  en: "en-GB",
  de: "de-DE",
};

const WIKIPEDIA_LANGUAGES: Record<Locale, string> = {
  it: "it",
  en: "en",
  de: "de",
};

const UI_TRANSLATIONS = {
  it: {
    language: "Lingua",
    languageTitle: "Cambia lingua",
    viewTabsAria: "Viste dashboard",
    trackTab: "Tracciato",
    calendarTab: "Calendario",
    seasonStandingsTab: "Classifiche",
    refresh: "Aggiorna",
    refreshDataTitle: "Aggiorna dati",
    demo: "Demo",
    latest: "Ultima",
    demoTitle: "Apri demo storica",
    latestTitle: "Torna all'ultima sessione",
    waiting: "In attesa",
    updated: "Aggiornato",
    lastSession: "Ultima",
    loadingOpenF1: "Caricamento dati OpenF1",
    loadingDemoReplay: "Caricamento replay demo",
    loadingLatestSession: "Caricamento ultima sessione",
    apiError: "Errore API",
    retry: "Riprova",
    statusRateLimitTitle: "Limite richieste OpenF1",
    statusNoSessionTitle: "Nessuna sessione F1 live in questo momento",
    statusDemoTitle: "Replay demo",
    statusTokenTitle: "Token live non configurato",
    statusPartialTitle: "Dati parziali",
    statusRateLimitBody:
      "Troppe richieste verso OpenF1. Il polling continua con cache e intervalli ridotti.",
    statusNoSessionBody: "La dashboard mostra l'ultimo evento disponibile come replay.",
    statusDemoBody: "Sessione storica OpenF1 caricata in modalita replay.",
    statusTokenBody:
      "OpenF1 puo richiedere un abbonamento per i dati live in tempo reale.",
    statusPartialBody: "Alcuni endpoint non hanno restituito dati completi.",
    loadLatestSession: "Carica ultima sessione disponibile",
    historicalDemo: "Demo storica",
    standings: "Classifica",
    standingsEmpty: "Classifica live non ancora disponibile",
    commentary: "Cronaca",
    commentaryAria: "Cronaca testuale della gara",
    commentaryEmpty: "Cronaca gara non ancora disponibile",
    motorsportNews: "News Motorsport",
    motorsportNewsAria: "Ultime notizie Formula 1 da Motorsport.com",
    motorsportNewsEmpty: "News Formula 1 non disponibili",
    motorsportNewsLoading: "Caricamento news",
    motorsportNewsSource: "Motorsport.com",
    highlights: "Momenti foto",
    highlightsAria: "Momenti salienti visuali della gara",
    highlightsEmpty: "Momenti salienti non ancora disponibili",
    highlightAiBadge: "Foto fumetto",
    highlightMoment: "Momento",
    raceControl: "Direzione gara",
    lapShort: "G",
    driverShort: "Pilota",
    flagLabel: "Bandiera",
    safetyCarLabel: "Safety car",
    incidentLabel: "Evento",
    messageLabel: "Messaggio",
    openDriverProfile: "Apri scheda pilota {name}",
    calendarTitle: "Calendario F1 {season}",
    races: "gare",
    completed: "disputate",
    withTop3: "con top 3",
    calendarRefreshTitle: "Aggiorna calendario",
    calendarLoading: "Caricamento calendario",
    calendarUnavailable: "Calendario non disponibile",
    calendarNotAvailable: "Calendario F1 non disponibile",
    seasonStandingsTitle: "Classifiche F1 {season}",
    seasonStandingsLoading: "Caricamento classifiche",
    seasonStandingsUnavailable: "Classifiche non disponibili",
    seasonStandingsNotAvailable: "Classifiche F1 non disponibili",
    seasonStandingsRefreshTitle: "Aggiorna classifiche",
    driverStandingsTitle: "Classifica piloti",
    constructorStandingsTitle: "Classifica costruttori",
    afterRound: "Dopo round {round}",
    championshipLeader: "Leader mondiale",
    wins: "vittorie",
    driverNumberLabel: "Numero",
    gpDetails: "Dettagli GP",
    top3Gp: "Primi 3 del GP",
    standingsUpdating: "Classifica in aggiornamento",
    raceNotRun: "Gara non ancora disputata",
    raceLaps: "{laps} giri",
    timeTba: "Orario da definire",
    pointsShort: "pt",
    statusPast: "Disputato",
    statusToday: "Oggi",
    statusUpcoming: "In programma",
    dryTrack: "Pista asciutta",
    weatherWaiting: "Meteo in attesa",
    storm: "Temporale",
    heavyRain: "Pioggia forte",
    mediumRain: "Pioggia media",
    lightRain: "Pioggia leggera",
    rainFocus: "focus pioggia",
    mapAria: "Mappa circuito con posizioni piloti",
    closeDriverCard: "Chiudi scheda pilota",
    position: "Posizione",
    f1Wins: "Vittorie F1",
    f1WorldTitles: "Mondiali",
    team: "Team",
    gapInterval: "Dist. / Int.",
    tyre: "Gomma",
    tyreAge: "Giri gomma",
    tyreStint: "Stint",
    wikipedia: "Wikipedia",
    open: "Apri",
    profileLoading: "Caricamento profilo...",
    profileNotFound: "Profilo Wikipedia non trovato.",
    profileUnavailable: "Profilo Wikipedia non disponibile.",
    profileMissing: "Profilo non disponibile.",
    wikiAttribution: "Wikipedia in italiano · Wikidata",
    finishLine: "TRAGUARDO",
    finishLineFallback: "Traguardo",
    finishLineTitle: "Linea del traguardo stimata da {source} (confidenza {confidence})",
    lap: "giro {lap}",
    lapData: "dati giro",
    confidenceHigh: "alta",
    confidenceMedium: "media",
    confidenceLow: "bassa",
    markerStatus: "Stato",
    markerGap: "Distacco",
    markerInterval: "Intervallo",
    trackUnavailable: "Tracciato live non ancora disponibile",
    trackReconstructed: "Tracciato ricostruito dai dati live",
    mapsConfigured: "Dati mappa © OpenStreetMap",
    generatedBackdrop: "Sfondo motorsport generato per F1 Live Track",
    weatherAttribution: "Meteo fornito da Open-Meteo",
    apiUnexpected: "Errore API inatteso",
  },
  en: {
    language: "Language",
    languageTitle: "Change language",
    viewTabsAria: "Dashboard views",
    trackTab: "Track",
    calendarTab: "Calendar",
    seasonStandingsTab: "Standings",
    refresh: "Refresh",
    refreshDataTitle: "Refresh data",
    demo: "Demo",
    latest: "Latest",
    demoTitle: "Open historical demo",
    latestTitle: "Return to latest session",
    waiting: "Waiting",
    updated: "Updated",
    lastSession: "Latest",
    loadingOpenF1: "Loading OpenF1 data",
    loadingDemoReplay: "Loading demo replay",
    loadingLatestSession: "Loading latest session",
    apiError: "API error",
    retry: "Retry",
    statusRateLimitTitle: "OpenF1 request limit",
    statusNoSessionTitle: "No live F1 session right now",
    statusDemoTitle: "Demo replay",
    statusTokenTitle: "Live token not configured",
    statusPartialTitle: "Partial data",
    statusRateLimitBody:
      "Too many requests to OpenF1. Polling continues with cache and slower intervals.",
    statusNoSessionBody: "The dashboard is showing the latest available event as a replay.",
    statusDemoBody: "Historical OpenF1 session loaded in replay mode.",
    statusTokenBody:
      "OpenF1 may require a subscription for real-time live data.",
    statusPartialBody: "Some endpoints did not return complete data.",
    loadLatestSession: "Load latest available session",
    historicalDemo: "Historical demo",
    standings: "Standings",
    standingsEmpty: "Live standings are not available yet",
    commentary: "Commentary",
    commentaryAria: "Race text commentary",
    commentaryEmpty: "Race commentary is not available yet",
    motorsportNews: "Motorsport news",
    motorsportNewsAria: "Latest Formula 1 news from Motorsport.com",
    motorsportNewsEmpty: "Formula 1 news is not available",
    motorsportNewsLoading: "Loading news",
    motorsportNewsSource: "Motorsport.com",
    highlights: "Photo moments",
    highlightsAria: "Visual race highlights",
    highlightsEmpty: "Race highlights are not available yet",
    highlightAiBadge: "Comic photo",
    highlightMoment: "Moment",
    raceControl: "Race control",
    lapShort: "L",
    driverShort: "Driver",
    flagLabel: "Flag",
    safetyCarLabel: "Safety car",
    incidentLabel: "Event",
    messageLabel: "Message",
    openDriverProfile: "Open driver profile for {name}",
    calendarTitle: "F1 Calendar {season}",
    races: "races",
    completed: "completed",
    withTop3: "with top 3",
    calendarRefreshTitle: "Refresh calendar",
    calendarLoading: "Loading calendar",
    calendarUnavailable: "Calendar unavailable",
    calendarNotAvailable: "F1 calendar unavailable",
    seasonStandingsTitle: "F1 Standings {season}",
    seasonStandingsLoading: "Loading standings",
    seasonStandingsUnavailable: "Standings unavailable",
    seasonStandingsNotAvailable: "F1 standings unavailable",
    seasonStandingsRefreshTitle: "Refresh standings",
    driverStandingsTitle: "Driver standings",
    constructorStandingsTitle: "Constructor standings",
    afterRound: "After round {round}",
    championshipLeader: "Championship leader",
    wins: "wins",
    driverNumberLabel: "Number",
    gpDetails: "GP details",
    top3Gp: "GP top 3",
    standingsUpdating: "Standings updating",
    raceNotRun: "Race not run yet",
    raceLaps: "{laps} laps",
    timeTba: "Time TBC",
    pointsShort: "pts",
    statusPast: "Completed",
    statusToday: "Today",
    statusUpcoming: "Upcoming",
    dryTrack: "Dry track",
    weatherWaiting: "Weather pending",
    storm: "Storm",
    heavyRain: "Heavy rain",
    mediumRain: "Moderate rain",
    lightRain: "Light rain",
    rainFocus: "rain focus",
    mapAria: "Circuit map with driver positions",
    closeDriverCard: "Close driver card",
    position: "Position",
    f1Wins: "F1 wins",
    f1WorldTitles: "World titles",
    team: "Team",
    gapInterval: "Gap / Int.",
    tyre: "Tyre",
    tyreAge: "Tyre laps",
    tyreStint: "Stint",
    wikipedia: "Wikipedia",
    open: "Open",
    profileLoading: "Loading profile...",
    profileNotFound: "Wikipedia profile not found.",
    profileUnavailable: "Wikipedia profile unavailable.",
    profileMissing: "Profile unavailable.",
    wikiAttribution: "Wikipedia in English · Wikidata",
    finishLine: "FINISH",
    finishLineFallback: "Finish",
    finishLineTitle: "Start/finish line estimated from {source} ({confidence} confidence)",
    lap: "lap {lap}",
    lapData: "lap data",
    confidenceHigh: "high",
    confidenceMedium: "medium",
    confidenceLow: "low",
    markerStatus: "Status",
    markerGap: "Gap",
    markerInterval: "Interval",
    trackUnavailable: "Live track is not available yet",
    trackReconstructed: "Track reconstructed from live data",
    mapsConfigured: "Map data © OpenStreetMap",
    generatedBackdrop: "Motorsport backdrop generated for F1 Live Track",
    weatherAttribution: "Weather by Open-Meteo",
    apiUnexpected: "Unexpected API error",
  },
  de: {
    language: "Sprache",
    languageTitle: "Sprache wechseln",
    viewTabsAria: "Dashboard-Ansichten",
    trackTab: "Strecke",
    calendarTab: "Kalender",
    seasonStandingsTab: "Tabellen",
    refresh: "Aktualisieren",
    refreshDataTitle: "Daten aktualisieren",
    demo: "Demo",
    latest: "Aktuell",
    demoTitle: "Historische Demo oeffnen",
    latestTitle: "Zur letzten Session zurueckkehren",
    waiting: "Warten",
    updated: "Aktualisiert",
    lastSession: "Aktuell",
    loadingOpenF1: "OpenF1-Daten werden geladen",
    loadingDemoReplay: "Demo-Replay wird geladen",
    loadingLatestSession: "Letzte Session wird geladen",
    apiError: "API-Fehler",
    retry: "Erneut versuchen",
    statusRateLimitTitle: "OpenF1-Anfragelimit",
    statusNoSessionTitle: "Derzeit keine Live-F1-Session",
    statusDemoTitle: "Demo-Replay",
    statusTokenTitle: "Live-Token nicht konfiguriert",
    statusPartialTitle: "Teildaten",
    statusRateLimitBody:
      "Zu viele Anfragen an OpenF1. Das Polling laeuft mit Cache und langsameren Intervallen weiter.",
    statusNoSessionBody: "Das Dashboard zeigt das letzte verfuegbare Event als Replay.",
    statusDemoBody: "Historische OpenF1-Session im Replay-Modus geladen.",
    statusTokenBody:
      "OpenF1 kann fuer Live-Daten in Echtzeit ein Abonnement verlangen.",
    statusPartialBody: "Einige Endpunkte haben keine vollstaendigen Daten geliefert.",
    loadLatestSession: "Letzte verfuegbare Session laden",
    historicalDemo: "Historische Demo",
    standings: "Wertung",
    standingsEmpty: "Live-Wertung noch nicht verfuegbar",
    commentary: "Kommentar",
    commentaryAria: "Textkommentar zum Rennen",
    commentaryEmpty: "Rennkommentar noch nicht verfuegbar",
    motorsportNews: "Motorsport-News",
    motorsportNewsAria: "Aktuelle Formel-1-News von Motorsport.com",
    motorsportNewsEmpty: "Formel-1-News nicht verfuegbar",
    motorsportNewsLoading: "News werden geladen",
    motorsportNewsSource: "Motorsport.com",
    highlights: "Foto-Momente",
    highlightsAria: "Visuelle Rennhighlights",
    highlightsEmpty: "Rennhighlights noch nicht verfuegbar",
    highlightAiBadge: "Comic-Foto",
    highlightMoment: "Moment",
    raceControl: "Rennleitung",
    lapShort: "R",
    driverShort: "Fahrer",
    flagLabel: "Flagge",
    safetyCarLabel: "Safety Car",
    incidentLabel: "Ereignis",
    messageLabel: "Meldung",
    openDriverProfile: "Fahrerprofil fuer {name} oeffnen",
    calendarTitle: "F1-Kalender {season}",
    races: "Rennen",
    completed: "abgeschlossen",
    withTop3: "mit Top 3",
    calendarRefreshTitle: "Kalender aktualisieren",
    calendarLoading: "Kalender wird geladen",
    calendarUnavailable: "Kalender nicht verfuegbar",
    calendarNotAvailable: "F1-Kalender nicht verfuegbar",
    seasonStandingsTitle: "F1-Tabellen {season}",
    seasonStandingsLoading: "Tabellen werden geladen",
    seasonStandingsUnavailable: "Tabellen nicht verfuegbar",
    seasonStandingsNotAvailable: "F1-Tabellen nicht verfuegbar",
    seasonStandingsRefreshTitle: "Tabellen aktualisieren",
    driverStandingsTitle: "Fahrerwertung",
    constructorStandingsTitle: "Konstrukteurswertung",
    afterRound: "Nach Runde {round}",
    championshipLeader: "WM-Fuehrender",
    wins: "Siege",
    driverNumberLabel: "Nummer",
    gpDetails: "GP-Details",
    top3Gp: "Top 3 des GP",
    standingsUpdating: "Wertung wird aktualisiert",
    raceNotRun: "Rennen noch nicht gefahren",
    raceLaps: "{laps} Runden",
    timeTba: "Zeit offen",
    pointsShort: "Pkt.",
    statusPast: "Gefahren",
    statusToday: "Heute",
    statusUpcoming: "Geplant",
    dryTrack: "Trockene Strecke",
    weatherWaiting: "Wetter wird geladen",
    storm: "Gewitter",
    heavyRain: "Starker Regen",
    mediumRain: "Maessiger Regen",
    lightRain: "Leichter Regen",
    rainFocus: "Regenfokus",
    mapAria: "Streckenkarte mit Fahrerpositionen",
    closeDriverCard: "Fahrerkarte schliessen",
    position: "Position",
    f1Wins: "F1-Siege",
    f1WorldTitles: "WM-Titel",
    team: "Team",
    gapInterval: "Abstand / Int.",
    tyre: "Reifen",
    tyreAge: "Reifenrunden",
    tyreStint: "Stint",
    wikipedia: "Wikipedia",
    open: "Oeffnen",
    profileLoading: "Profil wird geladen...",
    profileNotFound: "Wikipedia-Profil nicht gefunden.",
    profileUnavailable: "Wikipedia-Profil nicht verfuegbar.",
    profileMissing: "Profil nicht verfuegbar.",
    wikiAttribution: "Wikipedia auf Deutsch · Wikidata",
    finishLine: "ZIEL",
    finishLineFallback: "Ziel",
    finishLineTitle: "Start-/Ziellinie aus {source} geschaetzt ({confidence} Konfidenz)",
    lap: "Runde {lap}",
    lapData: "Rundendaten",
    confidenceHigh: "hoch",
    confidenceMedium: "mittel",
    confidenceLow: "niedrig",
    markerStatus: "Status",
    markerGap: "Abstand",
    markerInterval: "Intervall",
    trackUnavailable: "Live-Strecke noch nicht verfuegbar",
    trackReconstructed: "Strecke aus Live-Daten rekonstruiert",
    mapsConfigured: "Kartendaten © OpenStreetMap",
    generatedBackdrop: "Motorsport-Hintergrund fuer F1 Live Track generiert",
    weatherAttribution: "Wetter von Open-Meteo",
    apiUnexpected: "Unerwarteter API-Fehler",
  },
} as const;

type TranslationKey = keyof typeof UI_TRANSLATIONS.it;

const COUNTRY_NAMES: Record<Locale, Record<string, string>> = {
  it: {
    "abu dhabi": "Abu Dhabi",
    australia: "Australia",
    austria: "Austria",
    azerbaijan: "Azerbaigian",
    bahrain: "Bahrein",
    belgium: "Belgio",
    brazil: "Brasile",
    canada: "Canada",
    china: "Cina",
    emirates: "Emirati Arabi Uniti",
    france: "Francia",
    germany: "Germania",
    "great britain": "Gran Bretagna",
    hungary: "Ungheria",
    italy: "Italia",
    japan: "Giappone",
    mexico: "Messico",
    monaco: "Monaco",
    netherlands: "Paesi Bassi",
    qatar: "Qatar",
    singapore: "Singapore",
    spain: "Spagna",
    "saudi arabia": "Arabia Saudita",
    "united arab emirates": "Emirati Arabi Uniti",
    "united kingdom": "Regno Unito",
    "united states": "Stati Uniti",
    usa: "Stati Uniti",
  },
  en: {
    "abu dhabi": "Abu Dhabi",
    australia: "Australia",
    austria: "Austria",
    azerbaijan: "Azerbaijan",
    bahrain: "Bahrain",
    belgium: "Belgium",
    brazil: "Brazil",
    canada: "Canada",
    china: "China",
    emirates: "United Arab Emirates",
    france: "France",
    germany: "Germany",
    "great britain": "Great Britain",
    hungary: "Hungary",
    italy: "Italy",
    japan: "Japan",
    mexico: "Mexico",
    monaco: "Monaco",
    netherlands: "Netherlands",
    qatar: "Qatar",
    singapore: "Singapore",
    spain: "Spain",
    "saudi arabia": "Saudi Arabia",
    "united arab emirates": "United Arab Emirates",
    "united kingdom": "United Kingdom",
    "united states": "United States",
    usa: "United States",
  },
  de: {
    "abu dhabi": "Abu Dhabi",
    australia: "Australien",
    austria: "Oesterreich",
    azerbaijan: "Aserbaidschan",
    bahrain: "Bahrain",
    belgium: "Belgien",
    brazil: "Brasilien",
    canada: "Kanada",
    china: "China",
    emirates: "Vereinigte Arabische Emirate",
    france: "Frankreich",
    germany: "Deutschland",
    "great britain": "Grossbritannien",
    hungary: "Ungarn",
    italy: "Italien",
    japan: "Japan",
    mexico: "Mexiko",
    monaco: "Monaco",
    netherlands: "Niederlande",
    qatar: "Katar",
    singapore: "Singapur",
    spain: "Spanien",
    "saudi arabia": "Saudi-Arabien",
    "united arab emirates": "Vereinigte Arabische Emirate",
    "united kingdom": "Vereinigtes Koenigreich",
    "united states": "Vereinigte Staaten",
    usa: "Vereinigte Staaten",
  },
};

const PLACE_NAMES: Record<Locale, Record<string, string>> = {
  it: {
    baku: "Baku",
    barcelona: "Barcellona",
    "las vegas": "Las Vegas",
    melbourne: "Melbourne",
    "mexico city": "Citta del Messico",
    "sao paulo": "San Paolo",
    "são paulo": "San Paolo",
    shanghai: "Shanghai",
    suzuka: "Suzuka",
  },
  en: {
    baku: "Baku",
    barcelona: "Barcelona",
    "las vegas": "Las Vegas",
    melbourne: "Melbourne",
    "mexico city": "Mexico City",
    "sao paulo": "Sao Paulo",
    "são paulo": "Sao Paulo",
    shanghai: "Shanghai",
    suzuka: "Suzuka",
  },
  de: {
    baku: "Baku",
    barcelona: "Barcelona",
    "las vegas": "Las Vegas",
    melbourne: "Melbourne",
    "mexico city": "Mexiko-Stadt",
    "sao paulo": "Sao Paulo",
    "são paulo": "Sao Paulo",
    shanghai: "Shanghai",
    suzuka: "Suzuka",
  },
};

const RACE_NAMES: Record<Locale, Record<string, string>> = {
  it: {
    "abu dhabi grand prix": "Gran Premio di Abu Dhabi",
    "australian grand prix": "Gran Premio d'Australia",
    "austrian grand prix": "Gran Premio d'Austria",
    "azerbaijan grand prix": "Gran Premio dell'Azerbaigian",
    "bahrain grand prix": "Gran Premio del Bahrein",
    "barcelona grand prix": "Gran Premio di Spagna",
    "belgian grand prix": "Gran Premio del Belgio",
    "brazilian grand prix": "Gran Premio del Brasile",
    "british grand prix": "Gran Premio di Gran Bretagna",
    "canadian grand prix": "Gran Premio del Canada",
    "chinese grand prix": "Gran Premio di Cina",
    "dutch grand prix": "Gran Premio d'Olanda",
    "emilia romagna grand prix": "Gran Premio dell'Emilia-Romagna",
    "french grand prix": "Gran Premio di Francia",
    "german grand prix": "Gran Premio di Germania",
    "hungarian grand prix": "Gran Premio d'Ungheria",
    "italian grand prix": "Gran Premio d'Italia",
    "japanese grand prix": "Gran Premio del Giappone",
    "las vegas grand prix": "Gran Premio di Las Vegas",
    "mexico city grand prix": "Gran Premio di Citta del Messico",
    "miami grand prix": "Gran Premio di Miami",
    "monaco grand prix": "Gran Premio di Monaco",
    "qatar grand prix": "Gran Premio del Qatar",
    "saudi arabian grand prix": "Gran Premio d'Arabia Saudita",
    "singapore grand prix": "Gran Premio di Singapore",
    "spanish grand prix": "Gran Premio di Spagna",
    "sao paulo grand prix": "Gran Premio di San Paolo",
    "são paulo grand prix": "Gran Premio di San Paolo",
    "united states grand prix": "Gran Premio degli Stati Uniti",
  },
  en: {},
  de: {
    "abu dhabi grand prix": "Grosser Preis von Abu Dhabi",
    "australian grand prix": "Grosser Preis von Australien",
    "austrian grand prix": "Grosser Preis von Oesterreich",
    "azerbaijan grand prix": "Grosser Preis von Aserbaidschan",
    "bahrain grand prix": "Grosser Preis von Bahrain",
    "barcelona grand prix": "Grosser Preis von Spanien",
    "belgian grand prix": "Grosser Preis von Belgien",
    "brazilian grand prix": "Grosser Preis von Brasilien",
    "british grand prix": "Grosser Preis von Grossbritannien",
    "canadian grand prix": "Grosser Preis von Kanada",
    "chinese grand prix": "Grosser Preis von China",
    "dutch grand prix": "Grosser Preis der Niederlande",
    "emilia romagna grand prix": "Grosser Preis der Emilia-Romagna",
    "french grand prix": "Grosser Preis von Frankreich",
    "german grand prix": "Grosser Preis von Deutschland",
    "hungarian grand prix": "Grosser Preis von Ungarn",
    "italian grand prix": "Grosser Preis von Italien",
    "japanese grand prix": "Grosser Preis von Japan",
    "las vegas grand prix": "Grosser Preis von Las Vegas",
    "mexico city grand prix": "Grosser Preis von Mexiko-Stadt",
    "miami grand prix": "Grosser Preis von Miami",
    "monaco grand prix": "Grosser Preis von Monaco",
    "qatar grand prix": "Grosser Preis von Katar",
    "saudi arabian grand prix": "Grosser Preis von Saudi-Arabien",
    "singapore grand prix": "Grosser Preis von Singapur",
    "spanish grand prix": "Grosser Preis von Spanien",
    "sao paulo grand prix": "Grosser Preis von Sao Paulo",
    "são paulo grand prix": "Grosser Preis von Sao Paulo",
    "united states grand prix": "Grosser Preis der Vereinigten Staaten",
  },
};

const CIRCUIT_NAMES: Record<Locale, Record<string, string>> = {
  it: {
    catalunya: "Catalogna",
    "albert park grand prix circuit": "Circuito di Albert Park",
    "bahrain international circuit": "Circuito Internazionale del Bahrein",
    "baku city circuit": "Circuito cittadino di Baku",
    "circuit de barcelona-catalunya": "Circuit de Barcelona-Catalunya",
    "circuit de monaco": "Circuito di Monaco",
    "circuit gilles villeneuve": "Circuit Gilles Villeneuve",
    "circuit of the americas": "Circuito delle Americhe",
    "circuit zolder": "Circuito di Zolder",
    "circuit zandvoort": "Circuito di Zandvoort",
    "jeddah corniche circuit": "Circuito della Corniche di Gedda",
    "marina bay street circuit": "Circuito cittadino di Marina Bay",
    "miami international autodrome": "Autodromo Internazionale di Miami",
    "shanghai international circuit": "Circuito Internazionale di Shanghai",
    "silverstone circuit": "Circuito di Silverstone",
    "suzuka circuit": "Circuito di Suzuka",
  },
  en: {
    catalunya: "Catalunya",
  },
  de: {
    catalunya: "Katalonien",
    "albert park grand prix circuit": "Albert Park Grand Prix Circuit",
    "bahrain international circuit": "Bahrain International Circuit",
    "baku city circuit": "Stadtkurs Baku",
    "circuit de barcelona-catalunya": "Circuit de Barcelona-Catalunya",
    "circuit de monaco": "Circuit de Monaco",
    "circuit gilles villeneuve": "Circuit Gilles-Villeneuve",
    "circuit of the americas": "Circuit of the Americas",
    "jeddah corniche circuit": "Jeddah Corniche Circuit",
    "marina bay street circuit": "Marina Bay Street Circuit",
    "miami international autodrome": "Miami International Autodrome",
    "shanghai international circuit": "Shanghai International Circuit",
    "silverstone circuit": "Silverstone Circuit",
    "suzuka circuit": "Suzuka Circuit",
  },
};

const SESSION_NAMES: Record<Locale, Record<string, string>> = {
  it: {
    "practice 1": "Prove libere 1",
    "practice 2": "Prove libere 2",
    "practice 3": "Prove libere 3",
    qualifying: "Qualifiche",
    race: "Gara",
    session: "Sessione",
    sprint: "Sprint",
    "sprint qualifying": "Qualifiche Sprint",
    "sprint shootout": "Shootout Sprint",
  },
  en: {
    "practice 1": "Practice 1",
    "practice 2": "Practice 2",
    "practice 3": "Practice 3",
    qualifying: "Qualifying",
    race: "Race",
    session: "Session",
    sprint: "Sprint",
    "sprint qualifying": "Sprint Qualifying",
    "sprint shootout": "Sprint Shootout",
  },
  de: {
    "practice 1": "Freies Training 1",
    "practice 2": "Freies Training 2",
    "practice 3": "Freies Training 3",
    qualifying: "Qualifying",
    race: "Rennen",
    session: "Session",
    sprint: "Sprint",
    "sprint qualifying": "Sprint-Qualifying",
    "sprint shootout": "Sprint-Shootout",
  },
};

const WEATHER_DESCRIPTIONS = {
  it: {
    unknown: "Meteo non disponibile",
    clear: "Sereno",
    partlyCloudy: "Poco nuvoloso",
    cloudy: "Nuvoloso",
    fog: "Nebbia",
    rain: "Pioggia",
    snow: "Neve",
    storm: "Temporale",
    variable: "Meteo variabile",
  },
  en: {
    unknown: "Weather unavailable",
    clear: "Clear",
    partlyCloudy: "Partly cloudy",
    cloudy: "Cloudy",
    fog: "Fog",
    rain: "Rain",
    snow: "Snow",
    storm: "Storm",
    variable: "Variable weather",
  },
  de: {
    unknown: "Wetter nicht verfuegbar",
    clear: "Klar",
    partlyCloudy: "Leicht bewoelkt",
    cloudy: "Bewoelkt",
    fog: "Nebel",
    rain: "Regen",
    snow: "Schnee",
    storm: "Gewitter",
    variable: "Wechselhaftes Wetter",
  },
} as const;

function normalizedKey(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function normalizeLocale(value?: string | null): Locale {
  const normalized = value?.trim().toLocaleLowerCase("en-US");

  if (normalized === "en" || normalized === "de" || normalized === "it") {
    return normalized;
  }

  return DEFAULT_LOCALE;
}

export function intlLocale(locale: Locale): string {
  return INTL_LOCALES[locale];
}

export function wikipediaLanguage(locale: Locale): string {
  return WIKIPEDIA_LANGUAGES[locale];
}

export function t(
  locale: Locale,
  key: TranslationKey,
  values: Record<string, string | number> = {},
): string {
  let text: string = UI_TRANSLATIONS[locale][key] ?? UI_TRANSLATIONS[DEFAULT_LOCALE][key];

  for (const [name, value] of Object.entries(values)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }

  return text;
}

export function countryName(locale: Locale, value?: string | null): string {
  if (!value) {
    return "";
  }

  return COUNTRY_NAMES[locale][normalizedKey(value)] ?? value;
}

export function placeName(locale: Locale, value?: string | null): string {
  if (!value) {
    return "";
  }

  return PLACE_NAMES[locale][normalizedKey(value)] ?? countryName(locale, value);
}

export function raceName(
  locale: Locale,
  value?: string | null,
  country?: string | null,
): string {
  if (!value) {
    if (country) {
      const localizedCountry = countryName(locale, country);
      if (locale === "de") {
        return `Grosser Preis von ${localizedCountry}`;
      }

      return locale === "it"
        ? `Gran Premio di ${localizedCountry}`
        : `${localizedCountry} Grand Prix`;
    }

    return locale === "de" ? "Grosser Preis" : locale === "it" ? "Gran Premio" : "Grand Prix";
  }

  const normalized = normalizedKey(value);
  const exact = RACE_NAMES[locale][normalized];
  if (exact) {
    return exact;
  }

  if (locale === "it") {
    if (country && /grand prix/i.test(value)) {
      return `Gran Premio di ${countryName(locale, country)}`;
    }

    return value.replace(/\bGrand Prix\b/g, "Gran Premio");
  }

  if (locale === "de") {
    if (country && /grand prix/i.test(value)) {
      return `Grosser Preis von ${countryName(locale, country)}`;
    }

    return value.replace(/\bGrand Prix\b/g, "Grosser Preis");
  }

  return value;
}

export function circuitName(locale: Locale, value?: string | null): string {
  if (!value) {
    return locale === "it" ? "Circuito" : locale === "de" ? "Strecke" : "Circuit";
  }

  const normalized = normalizedKey(value);
  const exact = CIRCUIT_NAMES[locale][normalized];
  if (exact) {
    return exact;
  }

  if (locale === "it") {
    return value.replace(/\bGrand Prix Circuit\b/g, "Circuito");
  }

  return value;
}

export function sessionName(locale: Locale, value?: string | null): string {
  if (!value) {
    return SESSION_NAMES[locale].session;
  }

  return SESSION_NAMES[locale][normalizedKey(value)] ?? value;
}

export function sessionStatus(
  locale: Locale,
  status?: string | null,
  options: { demo?: boolean } = {},
): string {
  if (options.demo) {
    return "Replay";
  }

  switch (status) {
    case "live":
      return "LIVE";
    case "finished":
      return locale === "it"
        ? "Sessione terminata"
        : locale === "de"
          ? "Session beendet"
          : "Session finished";
    case "no-session-today":
      return locale === "it"
        ? "Nessuna sessione oggi"
        : locale === "de"
          ? "Heute keine Session"
          : "No session today";
    case "replay":
    default:
      return "Replay";
  }
}

export function driverStatus(locale: Locale, value?: string | null): string {
  switch (value) {
    case "OUT":
      return locale === "it" ? "RIT" : locale === "de" ? "AUS" : "OUT";
    case "PIT":
      return locale === "it" ? "BOX" : "PIT";
    case "LAPPED":
      return locale === "it" ? "DOPPIATO" : locale === "de" ? "UEBERRUNDET" : "LAPPED";
    default:
      return value ?? "";
  }
}

export function tyreCompound(locale: Locale, value?: string | null): string {
  switch (value?.toUpperCase()) {
    case "SOFT":
      return locale === "it" ? "Morbida" : locale === "de" ? "Weich" : "Soft";
    case "MEDIUM":
      return locale === "it" ? "Media" : locale === "de" ? "Mittel" : "Medium";
    case "HARD":
      return locale === "it" ? "Dura" : locale === "de" ? "Hart" : "Hard";
    case "INTERMEDIATE":
      return locale === "it"
        ? "Intermedia"
        : locale === "de"
          ? "Intermediate"
          : "Intermediate";
    case "WET":
      return locale === "it" ? "Bagnata" : locale === "de" ? "Regenreifen" : "Wet";
    default:
      return value ?? "n.d.";
  }
}

export function gapValue(locale: Locale, value: string): string {
  switch (value.toUpperCase()) {
    case "LEADER":
      return locale === "it" ? "In testa" : locale === "de" ? "Fuehrend" : "Leader";
    case "LAP":
    case "LAPPED":
      return locale === "it" ? "Doppiato" : locale === "de" ? "Ueberrundet" : "Lapped";
    case "DNF":
      return locale === "it" ? "RIT" : "DNF";
    case "DNS":
      return locale === "it" ? "NP" : "DNS";
    case "DSQ":
      return locale === "it" ? "SQ" : "DSQ";
    default:
      return value;
  }
}

export function leaderLabel(locale: Locale): string {
  return gapValue(locale, "LEADER");
}

export function weatherPlace(
  locale: Locale,
  location?: string | null,
  country?: string | null,
): string {
  const place = placeName(locale, location);
  const localizedCountry = countryName(locale, country);

  if (!place) {
    return localizedCountry;
  }

  if (!localizedCountry || place === localizedCountry) {
    return place;
  }

  return `${place}, ${localizedCountry}`;
}

export function weatherCodeDescription(locale: Locale, code: number | null): string {
  if (code === null) {
    return WEATHER_DESCRIPTIONS[locale].unknown;
  }

  if (code === 0) {
    return WEATHER_DESCRIPTIONS[locale].clear;
  }

  if ([1, 2, 3].includes(code)) {
    return code === 1
      ? WEATHER_DESCRIPTIONS[locale].partlyCloudy
      : WEATHER_DESCRIPTIONS[locale].cloudy;
  }

  if ([45, 48].includes(code)) {
    return WEATHER_DESCRIPTIONS[locale].fog;
  }

  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return WEATHER_DESCRIPTIONS[locale].rain;
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return WEATHER_DESCRIPTIONS[locale].snow;
  }

  if ([95, 96, 99].includes(code)) {
    return WEATHER_DESCRIPTIONS[locale].storm;
  }

  return WEATHER_DESCRIPTIONS[locale].variable;
}

export function apiMessage(locale: Locale, value?: string | null): string {
  if (!value) {
    return t(locale, "apiUnexpected");
  }

  if (/rate limit exceeded|too many requests|limite richieste/i.test(value)) {
    return locale === "it"
      ? "Limite richieste superato. Attendi qualche istante e riprova."
      : locale === "de"
        ? "Anfragelimit erreicht. Warte kurz und versuche es erneut."
        : "Request limit reached. Wait a moment and try again.";
  }

  if (/OPENF1_API_TOKEN|token live/i.test(value)) {
    return t(locale, "statusTokenBody");
  }

  if (/no results|nessun risultato/i.test(value)) {
    return locale === "it"
      ? "Nessun risultato disponibile."
      : locale === "de"
        ? "Keine Ergebnisse verfuegbar."
        : "No results available.";
  }

  if (/not found|non trovato|risorsa non trovata/i.test(value)) {
    return locale === "it"
      ? "Risorsa non trovata."
      : locale === "de"
        ? "Ressource nicht gefunden."
        : "Resource not found.";
  }

  if (/request failed|richiesta non riuscita|timed out|timeout/i.test(value)) {
    return locale === "it"
      ? "Richiesta non riuscita."
      : locale === "de"
        ? "Anfrage fehlgeschlagen."
        : "Request failed.";
  }

  if (/dati piloti mancanti|no driver list/i.test(value)) {
    return locale === "it"
      ? "Dati piloti mancanti."
      : locale === "de"
        ? "Fahrerdaten fehlen."
        : "Driver data is missing.";
  }

  if (/dati posizione mancanti/i.test(value)) {
    return locale === "it"
      ? "Dati posizione mancanti."
      : locale === "de"
        ? "Positionsdaten fehlen."
        : "Position data is missing.";
  }

  if (/dati intervallo|intervallo disponibile/i.test(value)) {
    return locale === "it"
      ? "Dati intervallo parziali o non disponibili."
      : locale === "de"
        ? "Intervalldaten teilweise oder nicht verfuegbar."
        : "Interval data is partial or unavailable.";
  }

  if (/punto posizione|posizione parziali/i.test(value)) {
    return locale === "it"
      ? "Dati posizione parziali o non disponibili."
      : locale === "de"
        ? "Positionsdaten teilweise oder nicht verfuegbar."
        : "Position data is partial or unavailable.";
  }

  if (/start\/finish line|linea del traguardo/i.test(value)) {
    return locale === "it"
      ? "Linea del traguardo non ricavabile dai dati giro."
      : locale === "de"
        ? "Start-/Ziellinie konnte nicht aus Rundendaten ermittelt werden."
        : "Start/finish line could not be inferred from lap data.";
  }

  if (/classifiche/i.test(value)) {
    return t(locale, "seasonStandingsNotAvailable");
  }

  if (/calendario/i.test(value)) {
    return t(locale, "calendarNotAvailable");
  }

  return value;
}

export function countryNameIt(value?: string | null): string {
  return countryName("it", value);
}

export function placeNameIt(value?: string | null): string {
  return placeName("it", value);
}

export function raceNameIt(value?: string | null, country?: string | null): string {
  return raceName("it", value, country);
}

export function circuitNameIt(value?: string | null): string {
  return circuitName("it", value);
}

export function sessionNameIt(value?: string | null): string {
  return sessionName("it", value);
}

export function sessionStatusIt(
  status?: string | null,
  options: { demo?: boolean } = {},
): string {
  return sessionStatus("it", status, options);
}

export function driverStatusIt(value?: string | null): string {
  return driverStatus("it", value);
}

export function gapValueIt(value: string): string {
  return gapValue("it", value);
}

export function weatherPlaceIt(location?: string | null, country?: string | null): string {
  return weatherPlace("it", location, country);
}

export function apiMessageIt(value?: string | null): string {
  return apiMessage("it", value);
}
