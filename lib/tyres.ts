export function tyreCompoundShort(value?: string | null): string {
  switch (value?.toUpperCase()) {
    case "SOFT":
      return "S";
    case "MEDIUM":
      return "M";
    case "HARD":
      return "H";
    case "INTERMEDIATE":
      return "I";
    case "WET":
      return "W";
    default:
      return "-";
  }
}

export function tyreCompoundColor(value?: string | null): string {
  switch (value?.toUpperCase()) {
    case "SOFT":
      return "#f43f5e";
    case "MEDIUM":
      return "#facc15";
    case "HARD":
      return "#f8fafc";
    case "INTERMEDIATE":
      return "#22c55e";
    case "WET":
      return "#38bdf8";
    default:
      return "#94a3b8";
  }
}
