const DEVICE_KEY = 'activeRoomPin';

export function setActiveRoom(pin) {
  localStorage.setItem(DEVICE_KEY, pin);
}

export function getActiveRoom() {
  return localStorage.getItem(DEVICE_KEY);
}

export function clearActiveRoom() {
  localStorage.removeItem(DEVICE_KEY);
}
