import { intlLocale, t, type Locale } from "@/lib/i18n";
import type { RaceControlMessage } from "@/types/f1";

export type RaceControlVisualKind =
  | "red"
  | "yellow"
  | "safety"
  | "green"
  | "blue"
  | "chequered"
  | "incident"
  | "drs"
  | "message";

export function formatRaceControlTime(date: string, locale: Locale): string {
  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

export function raceControlSearchText(message: RaceControlMessage): string {
  return `${message.flag ?? ""} ${message.category} ${message.message}`.toLocaleUpperCase(
    "en-US",
  );
}

export function raceControlVisualKind(message: RaceControlMessage): RaceControlVisualKind {
  const value = raceControlSearchText(message);

  if (value.includes("RED FLAG")) {
    return "red";
  }

  if (value.includes("SAFETY CAR")) {
    return "safety";
  }

  if (value.includes("YELLOW")) {
    return "yellow";
  }

  if (value.includes("CHEQUERED")) {
    return "chequered";
  }

  if (value.includes("GREEN") || value.includes("TRACK CLEAR")) {
    return "green";
  }

  if (value.includes("BLUE")) {
    return "blue";
  }

  if (
    value.includes("INCIDENT") ||
    value.includes("NOTED") ||
    value.includes("OFF TRACK") ||
    value.includes("STOPPED ON TRACK")
  ) {
    return "incident";
  }

  if (value.includes("DRS")) {
    return "drs";
  }

  return "message";
}

export function normalizeRaceControlFlag(value: string | null, locale: Locale): string | null {
  if (!value) {
    return null;
  }

  const flag = value.toLocaleUpperCase("en-US");
  const labels: Record<string, Record<Locale, string>> = {
    BLACK: { it: "nera", en: "black", de: "schwarz" },
    BLUE: { it: "blu", en: "blue", de: "blau" },
    CHEQUERED: { it: "a scacchi", en: "chequered", de: "kariert" },
    CLEAR: { it: "libera", en: "clear", de: "frei" },
    GREEN: { it: "verde", en: "green", de: "gruen" },
    RED: { it: "rossa", en: "red", de: "rot" },
    WHITE: { it: "bianca", en: "white", de: "weiss" },
    YELLOW: { it: "gialla", en: "yellow", de: "gelb" },
  };

  for (const [needle, translated] of Object.entries(labels)) {
    if (flag.includes(needle)) {
      return translated[locale];
    }
  }

  return value.toLocaleLowerCase(intlLocale(locale));
}

export function raceControlCategoryLabel(
  message: RaceControlMessage,
  locale: Locale,
): string {
  const category = message.category.toLocaleLowerCase("en-US");
  const flag = normalizeRaceControlFlag(message.flag, locale);
  const kind = raceControlVisualKind(message);

  if (message.flag?.toLocaleUpperCase("en-US").includes("CLEAR")) {
    return locale === "it" ? "Pista libera" : locale === "de" ? "Strecke frei" : "Track clear";
  }

  if (flag) {
    return `${t(locale, "flagLabel")} ${flag}`;
  }

  if (kind === "drs") {
    return "DRS";
  }

  if (kind === "incident") {
    return t(locale, "incidentLabel");
  }

  if (kind === "safety") {
    return t(locale, "safetyCarLabel");
  }

  if (category.includes("safety")) {
    return t(locale, "safetyCarLabel");
  }

  if (category.includes("incident") || category.includes("car")) {
    return t(locale, "incidentLabel");
  }

  if (category.includes("other")) {
    return t(locale, "messageLabel");
  }

  if (category.includes("drs")) {
    return "DRS";
  }

  return message.category || t(locale, "messageLabel");
}

type LocalizedMessageMap = Record<Exclude<Locale, "en">, string>;

const DIRECT_MESSAGE_TRANSLATIONS: Record<string, LocalizedMessageMap> = {
  "CHEQUERED FLAG": {
    it: "Bandiera a scacchi",
    de: "Karierte Flagge",
  },
  "DRS DISABLED": {
    it: "DRS disattivato",
    de: "DRS deaktiviert",
  },
  "DRS ENABLED": {
    it: "DRS attivato",
    de: "DRS aktiviert",
  },
  "GREEN FLAG": {
    it: "Bandiera verde",
    de: "Gruene Flagge",
  },
  "RED FLAG": {
    it: "Bandiera rossa",
    de: "Rote Flagge",
  },
  "SAFETY CAR DEPLOYED": {
    it: "Safety car in pista",
    de: "Safety Car eingesetzt",
  },
  "SAFETY CAR IN THIS LAP": {
    it: "Safety car rientra a fine giro",
    de: "Safety Car kommt in dieser Runde herein",
  },
  "TRACK CLEAR": {
    it: "Pista libera",
    de: "Strecke frei",
  },
  "VIRTUAL SAFETY CAR DEPLOYED": {
    it: "Virtual safety car attivata",
    de: "Virtuelles Safety Car aktiviert",
  },
  "VIRTUAL SAFETY CAR ENDED": {
    it: "Virtual safety car terminata",
    de: "Virtuelles Safety Car beendet",
  },
  "VIRTUAL SAFETY CAR ENDING": {
    it: "Virtual safety car in chiusura",
    de: "Virtuelles Safety Car endet",
  },
  "YELLOW FLAG": {
    it: "Bandiera gialla",
    de: "Gelbe Flagge",
  },
};

const WORD_TRANSLATIONS: Record<Exclude<Locale, "en">, Array<[RegExp, string]>> = {
  it: [
    [/\bFIA STEWARDS:\s*/gi, "Commissari FIA: "],
    [/\bRACE DIRECTORS\b/gi, "direttore gara"],
    [/\bRACE DIRECTOR\b/gi, "direttore gara"],
    [/\bNO FURTHER INVESTIGATION\b/gi, "nessuna ulteriore indagine"],
    [/\bWILL BE INVESTIGATED AFTER THE RACE\b/gi, "sara valutato dopo la gara"],
    [/\bWILL BE INVESTIGATED\b/gi, "sara valutato"],
    [/\bAFTER THE RACE\b/gi, "dopo la gara"],
    [/\bFORCING ANOTHER DRIVER OFF THE TRACK\b/gi, "aver spinto un altro pilota fuori pista"],
    [/\bFAILING TO FOLLOW\b/gi, "mancato rispetto di"],
    [/\bCROSSING THE LINE\b/gi, "superamento della linea"],
    [/\bVSC INFRINGEMENT\b/gi, "infrazione VSC"],
    [/\bOFF TRACK AND CONTINUED\b/gi, "fuori pista e prosegue"],
    [/\bSTOPPED ON TRACK\b/gi, "ferma in pista"],
    [/\bIN TRACK SECTOR\b/gi, "nel settore pista"],
    [/\bIN ZONE\b/gi, "in zona"],
    [/\bAT TURN\b/gi, "alla curva"],
    [/\bDOUBLE YELLOW\b/gi, "doppia bandiera gialla"],
    [/\bYELLOW\b/gi, "bandiera gialla"],
    [/\bGREEN\b/gi, "bandiera verde"],
    [/\bRED\b/gi, "bandiera rossa"],
    [/\bBLUE\b/gi, "bandiera blu"],
    [/\bCLEAR\b/gi, "pista libera"],
    [/\bDRS ENABLED\b/gi, "DRS attivato"],
    [/\bDRS DISABLED\b/gi, "DRS disattivato"],
    [/\bVIRTUAL SAFETY CAR\b/gi, "virtual safety car"],
    [/\bSAFETY CAR\b/gi, "safety car"],
    [/\bINCIDENT INVOLVING CARS\b/gi, "incidente con le vetture"],
    [/\bINCIDENT INVOLVING CAR\b/gi, "incidente con la vettura"],
    [/\bINCIDENT\b/gi, "incidente"],
    [/\bCARS\b/gi, "vetture"],
    [/\bCAR\b/gi, "vettura"],
    [/\bUNDER INVESTIGATION\b/gi, "sotto indagine"],
    [/\bINVESTIGATION\b/gi, "indagine"],
    [/\bREVIEWED\b/gi, "valutato"],
    [/\bNOTED\b/gi, "annotato"],
    [/\bON TRACK\b/gi, "in pista"],
    [/\bTRACK LIMITS\b/gi, "limiti pista"],
    [/\bTRACK SECTOR\b/gi, "settore pista"],
    [/\bSECTOR\b/gi, "settore"],
    [/\bTURN\b/gi, "curva"],
    [/\bLAP\b/gi, "giro"],
    [/\bPIT ENTRY\b/gi, "ingresso pit lane"],
    [/\bPIT EXIT\b/gi, "uscita pit lane"],
    [/\bPIT LANE\b/gi, "pit lane"],
    [/\bIN THIS LAP\b/gi, "rientra a fine giro"],
    [/\bDEPLOYED\b/gi, "attivata"],
    [/\bENDING\b/gi, "in chiusura"],
    [/\bENDED\b/gi, "terminata"],
    [/\bDISABLED\b/gi, "disattivato"],
    [/\bENABLED\b/gi, "attivato"],
    [/\bDELETED\b/gi, "cancellato"],
    [/\bTIME\b/gi, "tempo"],
    [/\bAND\b/gi, "e"],
  ],
  de: [
    [/\bFIA STEWARDS:\s*/gi, "FIA-Stewards: "],
    [/\bRACE DIRECTORS\b/gi, "Rennleitung"],
    [/\bRACE DIRECTOR\b/gi, "Rennleitung"],
    [/\bNO FURTHER INVESTIGATION\b/gi, "keine weitere Untersuchung"],
    [/\bWILL BE INVESTIGATED AFTER THE RACE\b/gi, "wird nach dem Rennen untersucht"],
    [/\bWILL BE INVESTIGATED\b/gi, "wird untersucht"],
    [/\bAFTER THE RACE\b/gi, "nach dem Rennen"],
    [/\bFORCING ANOTHER DRIVER OFF THE TRACK\b/gi, "einen anderen Fahrer von der Strecke gedraengt"],
    [/\bFAILING TO FOLLOW\b/gi, "Missachtung von"],
    [/\bCROSSING THE LINE\b/gi, "Ueberfahren der Linie"],
    [/\bVSC INFRINGEMENT\b/gi, "VSC-Verstoss"],
    [/\bOFF TRACK AND CONTINUED\b/gi, "neben der Strecke und weitergefahren"],
    [/\bSTOPPED ON TRACK\b/gi, "steht auf der Strecke"],
    [/\bIN TRACK SECTOR\b/gi, "in Streckensektor"],
    [/\bIN ZONE\b/gi, "in Zone"],
    [/\bAT TURN\b/gi, "in Kurve"],
    [/\bDOUBLE YELLOW\b/gi, "doppelte gelbe Flagge"],
    [/\bYELLOW\b/gi, "gelbe Flagge"],
    [/\bGREEN\b/gi, "gruene Flagge"],
    [/\bRED\b/gi, "rote Flagge"],
    [/\bBLUE\b/gi, "blaue Flagge"],
    [/\bCLEAR\b/gi, "frei"],
    [/\bDRS ENABLED\b/gi, "DRS aktiviert"],
    [/\bDRS DISABLED\b/gi, "DRS deaktiviert"],
    [/\bVIRTUAL SAFETY CAR\b/gi, "virtuelles Safety Car"],
    [/\bSAFETY CAR\b/gi, "Safety Car"],
    [/\bINCIDENT INVOLVING CARS\b/gi, "Vorfall mit den Autos"],
    [/\bINCIDENT INVOLVING CAR\b/gi, "Vorfall mit Auto"],
    [/\bINCIDENT\b/gi, "Vorfall"],
    [/\bCARS\b/gi, "Autos"],
    [/\bCAR\b/gi, "Auto"],
    [/\bUNDER INVESTIGATION\b/gi, "unter Untersuchung"],
    [/\bINVESTIGATION\b/gi, "Untersuchung"],
    [/\bREVIEWED\b/gi, "ueberprueft"],
    [/\bNOTED\b/gi, "notiert"],
    [/\bON TRACK\b/gi, "auf der Strecke"],
    [/\bTRACK LIMITS\b/gi, "Track Limits"],
    [/\bTRACK SECTOR\b/gi, "Streckensektor"],
    [/\bSECTOR\b/gi, "Sektor"],
    [/\bTURN\b/gi, "Kurve"],
    [/\bLAP\b/gi, "Runde"],
    [/\bPIT ENTRY\b/gi, "Boxeneinfahrt"],
    [/\bPIT EXIT\b/gi, "Boxenausfahrt"],
    [/\bPIT LANE\b/gi, "Boxengasse"],
    [/\bIN THIS LAP\b/gi, "kommt in dieser Runde herein"],
    [/\bDEPLOYED\b/gi, "eingesetzt"],
    [/\bENDING\b/gi, "endet"],
    [/\bENDED\b/gi, "beendet"],
    [/\bDISABLED\b/gi, "deaktiviert"],
    [/\bENABLED\b/gi, "aktiviert"],
    [/\bDELETED\b/gi, "geloescht"],
    [/\bTIME\b/gi, "Zeit"],
    [/\bAND\b/gi, "und"],
  ],
};

const CLEANUP_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\s+([,.:;])/g, "$1"],
  [/\s+-\s+/g, " - "],
  [/\s{2,}/g, " "],
];

function normalizeRaceControlMessageText(value: string): string {
  return value
    .replace(/[–—]/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

export function localizedRaceControlMessage(locale: Locale, value: string): string {
  if (locale === "en") {
    return normalizeRaceControlMessageText(value);
  }

  const text = normalizeRaceControlMessageText(value);
  const direct = DIRECT_MESSAGE_TRANSLATIONS[text.toLocaleUpperCase("en-US")];

  if (direct) {
    return direct[locale];
  }

  if (/^BLACK AND WHITE FLAG/i.test(text)) {
    return locale === "it" ? "Bandiera bianco-nera" : "Schwarz-weisse Flagge";
  }

  let translated = text;

  for (const [pattern, replacement] of WORD_TRANSLATIONS[locale]) {
    translated = translated.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of CLEANUP_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }

  return translated.trim();
}
