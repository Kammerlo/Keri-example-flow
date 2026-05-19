export interface CesrEntry {
  event: Record<string, unknown>;
  atc: string;
}

export function parseCesrData(cesrData: string): CesrEntry[] {
  const result: CesrEntry[] = [];
  let index = 0;
  while (index < cesrData.length) {
    if (cesrData[index] !== "{") {
      index++;
      continue;
    }
    let braceCount = 0;
    let jsonEnd = index;
    for (let i = index; i < cesrData.length; i++) {
      const ch = cesrData[i];
      if (ch === "{") braceCount++;
      else if (ch === "}") {
        braceCount--;
        if (braceCount === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
    const jsonEvent = cesrData.slice(index, jsonEnd);
    let attachmentEnd = cesrData.length;
    for (let i = jsonEnd; i < cesrData.length; i++) {
      if (cesrData[i] === "{") {
        attachmentEnd = i;
        break;
      }
    }
    const attachment = cesrData.slice(jsonEnd, attachmentEnd);
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(jsonEvent) as Record<string, unknown>;
    } catch {
      throw new Error(`Failed to parse CESR event: ${jsonEvent.slice(0, 80)}`);
    }
    result.push({ event, atc: attachment });
    index = attachmentEnd;
  }
  return result;
}

export function makeCesrStream(
  events: Record<string, unknown>[],
  attachments: string[]
): string {
  if (events.length !== attachments.length) {
    throw new Error(
      `Events and attachments lists must have the same size. Events: ${events.length}, Attachments: ${attachments.length}`
    );
  }
  let stream = "";
  for (let i = 0; i < events.length; i++) {
    stream += JSON.stringify(events[i]);
    if (attachments[i]) stream += attachments[i];
  }
  return stream;
}

export function reduceCesrChain(cesrData: string): string {
  const parsed = parseCesrData(cesrData);
  const vcpEvents: Record<string, unknown>[] = [];
  const vcpAtcs: string[] = [];
  const issEvents: Record<string, unknown>[] = [];
  const issAtcs: string[] = [];
  const acdcEvents: Record<string, unknown>[] = [];
  const acdcAtcs: string[] = [];
  for (const entry of parsed) {
    const { event, atc } = entry;
    const eventType = event["t"];
    if (eventType != null) {
      if (eventType === "vcp") {
        vcpEvents.push(event);
        vcpAtcs.push(atc);
      } else if (eventType === "iss") {
        issEvents.push(event);
        issAtcs.push(atc);
      }
    } else if (event["s"] != null && event["a"] != null && event["i"] != null) {
      acdcEvents.push(event);
      acdcAtcs.push("");
    }
  }
  return makeCesrStream(
    [...vcpEvents, ...issEvents, ...acdcEvents],
    [...vcpAtcs, ...issAtcs, ...acdcAtcs]
  );
}
