export interface Env {
  keriaUrl: string;
  keriaBootUrl: string;
  issuerName: string;
  issuerRegistry: string;
  issuerSalt: string | null;
  /**
   * Schema OOBI base **from KERIA's point of view**. The schema OOBI embedded
   * in IPEX grant/apply is resolved server-side by the wallet's KERIA agent
   * (which, when the wallet points at this stack, is the `keria` container) —
   * NOT by the phone. So it must be reachable on KERIA's network, e.g. the
   * docker service name `http://app:3001`, never a LAN IP / localhost.
   */
  schemaOobiHost: string;
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
    schemaOobiHost: src.SCHEMA_OOBI_HOST || "http://app:3001",
    port: Number(src.PORT || "3001"),
  };
}
