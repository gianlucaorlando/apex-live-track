const OPENF1_TOKEN_URL = "https://api.openf1.org/token";
const TOKEN_REFRESH_SAFETY_MS = 60 * 1000;

type OpenF1TokenPayload = {
  access_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
};

const globalAuthCache = globalThis as typeof globalThis & {
  __f1LiveTrackOpenF1Token?: {
    accessToken: string;
    expiresAt: number;
  };
  __f1LiveTrackOpenF1TokenPromise?: Promise<string | null>;
};

function configuredStaticToken(): string | null {
  const token = process.env.OPENF1_API_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}

function configuredCredentials(): { username: string; password: string } | null {
  const username = process.env.OPENF1_USERNAME?.trim();
  const password = process.env.OPENF1_PASSWORD?.trim();

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

export function openF1AuthConfigured(): boolean {
  return Boolean(configuredStaticToken() || configuredCredentials());
}

export function openF1MqttUsername(): string {
  return process.env.OPENF1_USERNAME?.trim() || "apex-live-track";
}

export async function getOpenF1AccessToken(): Promise<string | null> {
  const staticToken = configuredStaticToken();
  if (staticToken) {
    return staticToken;
  }

  const credentials = configuredCredentials();
  if (!credentials) {
    return null;
  }

  const cached = globalAuthCache.__f1LiveTrackOpenF1Token;
  if (cached && cached.expiresAt - TOKEN_REFRESH_SAFETY_MS > Date.now()) {
    return cached.accessToken;
  }

  if (globalAuthCache.__f1LiveTrackOpenF1TokenPromise) {
    return globalAuthCache.__f1LiveTrackOpenF1TokenPromise;
  }

  globalAuthCache.__f1LiveTrackOpenF1TokenPromise = fetchOpenF1AccessToken(credentials).finally(
    () => {
      globalAuthCache.__f1LiveTrackOpenF1TokenPromise = undefined;
    },
  );

  return globalAuthCache.__f1LiveTrackOpenF1TokenPromise;
}

async function fetchOpenF1AccessToken(credentials: {
  username: string;
  password: string;
}): Promise<string | null> {
  const body = new URLSearchParams();
  body.set("username", credentials.username);
  body.set("password", credentials.password);

  const response = await fetch(OPENF1_TOKEN_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as OpenF1TokenPayload | null;
  const accessToken =
    typeof payload?.access_token === "string" && payload.access_token.length > 0
      ? payload.access_token
      : null;

  if (!accessToken) {
    return null;
  }

  const expiresIn =
    typeof payload?.expires_in === "number"
      ? payload.expires_in
      : typeof payload?.expires_in === "string"
        ? Number(payload.expires_in)
        : 3600;
  const expiresAt = Date.now() + Math.max(Number.isFinite(expiresIn) ? expiresIn : 3600, 60) * 1000;

  globalAuthCache.__f1LiveTrackOpenF1Token = {
    accessToken,
    expiresAt,
  };

  return accessToken;
}
