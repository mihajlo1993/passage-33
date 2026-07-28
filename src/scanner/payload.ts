const PIN_PAYLOAD = /^bh7:\/\/pin\/([1-9]|1\d|2[0-7])$/;

/** Returns a pin id only for an exact, canonical `bh7://pin/<id>` payload. */
export function parsePinPayload(payload: string): number | null {
  const match = PIN_PAYLOAD.exec(payload);
  if (!match) {
    return null;
  }

  const id = Number(match[1]);
  return Number.isInteger(id) && id >= 1 && id <= 27 ? id : null;
}

export function pinPayload(id: number): string {
  if (!Number.isInteger(id) || id < 1 || id > 27) {
    throw new RangeError("Pin id must be an integer from 1 through 27.");
  }
  return `bh7://pin/${id}`;
}
