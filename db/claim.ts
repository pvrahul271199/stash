/** Phase-1 shim. Real guest→account claim arrives with per-user DBs. */
export async function claimGuestData(
  _uid: string,
): Promise<{ claimed: boolean; counts: Record<string, number> }> {
  return { claimed: false, counts: {} };
}
