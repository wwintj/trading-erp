type EnvironmentSource = Record<string, string | undefined>;

export type ServerEnv = {
  APP_NAME: string;
  APP_URL: string;
  DATABASE_URL: string;
};

let cachedEnv: ServerEnv | undefined;

function required(source: EnvironmentSource, key: keyof ServerEnv): string {
  const value = source[key]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function validUrl(value: string, key: "APP_URL" | "DATABASE_URL", protocols: string[]) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Environment variable ${key} must be a valid URL`);
  }

  if (!protocols.includes(url.protocol)) {
    throw new Error(
      `Environment variable ${key} must use one of these protocols: ${protocols.join(", ")}`,
    );
  }

  return value;
}

export function readEnv(source: EnvironmentSource): ServerEnv {
  const appUrl = required(source, "APP_URL");
  const databaseUrl = required(source, "DATABASE_URL");

  return {
    APP_NAME: required(source, "APP_NAME"),
    APP_URL: validUrl(appUrl, "APP_URL", ["http:", "https:"]),
    DATABASE_URL: validUrl(databaseUrl, "DATABASE_URL", ["mysql:"]),
  };
}

export function getServerEnv(): ServerEnv {
  cachedEnv ??= readEnv(process.env);
  return cachedEnv;
}
