import type { VerificationCheck } from "@keri-demo/shared";

type KelEvent = { t?: string; s?: string; a?: Array<Record<string, unknown>> };

export function checkAnchorInKel(
  kel: KelEvent[],
  said: string,
  seq: string
): VerificationCheck[] {
  const event = kel.find((e) => String(e.s) === String(seq));
  const seqCheck: VerificationCheck = {
    label: `KEL has an event at sequence ${seq}`,
    passed: Boolean(event),
    detail: event
      ? `Found a '${event.t}' event at s=${seq}.`
      : `No event at s=${seq}; the holder's KEL did not advance as claimed.`,
  };
  if (!event) return [seqCheck];

  const seals = Array.isArray(event.a) ? event.a : [];
  const anchored = seals.some((s) => s && s.d === said);
  return [
    seqCheck,
    {
      label: "Attestation SAID is anchored as a seal",
      passed: anchored,
      detail: anchored
        ? `Event s=${seq} contains a seal with d=${said}; the holder's key committed to exactly this payload.`
        : `Event s=${seq} does not anchor ${said}; the payload was not the one signed.`,
    },
  ];
}
