export interface Env {
  keriaUrl: string;
  keriaBootUrl: string;
  issuerName: string;
  issuerRegistry: string;
  issuerSalt: string | null;
  publicHost: string;
  port: number;
}

export function loadEnv(src: NodeJS.ProcessEnv = process.env): Env {
  const req = (k: string): string => {
    const v = src[k];
    if (!v) throw new Error(`Missing required env var: ${k}`);
    return v;
  };
  return {
    keriaUrl: req("KERIA_URL"),
    keriaBootUrl: req("KERIA_BOOT_URL"),
    issuerName: src.ISSUER_NAME || "keri-demo-issuer",
    issuerRegistry: src.ISSUER_REGISTRY || "keri-demo-registry",
    issuerSalt: src.ISSUER_SALT && src.ISSUER_SALT.length > 0 ? src.ISSUER_SALT : null,
    publicHost: src.PUBLIC_HOST || "http://localhost:3001",
    port: Number(src.PORT || "3001"),
  };
}
