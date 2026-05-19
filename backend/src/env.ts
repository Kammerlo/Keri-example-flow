export interface Env {
  keriaUrl: string;
  keriaBootUrl: string;
  issuerName: string;
  issuerRegistry: string;
  issuerSalt: string | null;
  /**
   * Schema host reachable by **this stack's KERIA** (the `keria` container).
   * Used for issuer-bootstrap schema resolve and the demo holder's
   * /api/config — always the docker service name. Do not change for docker.
   */
  schemaResolveHost: string;
  /**
   * Schema host embedded as the `exn.a.oobiUrl` base in grant/apply and the
   * issuer loc-scheme. This is resolved by the **wallet's KERIA agent**, not
   * the Veridian app process. In the standard setup the Veridian app connects
   * to THIS stack's KERIA (via localhost:3901), so the resolver is the `keria`
   * container itself — the URL must be docker-internal (`http://app:3001`),
   * NOT localhost (which inside keria is keria, not the app). Only change this
   * if the wallet uses a *different* KERIA on another network.
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
    schemaResolveHost: src.SCHEMA_RESOLVE_HOST || "http://app:3001",
    schemaOobiHost: src.SCHEMA_OOBI_HOST || "http://app:3001",
    port: Number(src.PORT || "3001"),
  };
}
