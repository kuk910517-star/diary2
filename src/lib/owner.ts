export function getOwnerId(): string {
  return localStorage.getItem("owner_id") ?? "";
}

export function setOwnerId(id: string) {
  localStorage.setItem("owner_id", id.trim());
}

export function hasOwnerId(): boolean {
  return getOwnerId().length > 0;
}
