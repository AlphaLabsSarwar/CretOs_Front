// Remembers the last vehicle/driver used per branch (localStorage) so repeat data
// entry — especially at the loading bay — doesn't require re-picking them every time.
export function lastUsedKey(branchId: string | undefined, field: 'vehicle_id' | 'driver_id') {
  return `cretos_last_${field}_${branchId ?? 'default'}`
}

export function rememberLastUsed(branchId: string | undefined, vehicleId: string, driverId: string) {
  if (!branchId) return
  if (vehicleId) localStorage.setItem(lastUsedKey(branchId, 'vehicle_id'), vehicleId)
  if (driverId) localStorage.setItem(lastUsedKey(branchId, 'driver_id'), driverId)
}

export function getLastUsedVehicle(branchId: string | undefined): string {
  return localStorage.getItem(lastUsedKey(branchId, 'vehicle_id')) ?? ''
}

export function getLastUsedDriver(branchId: string | undefined): string {
  return localStorage.getItem(lastUsedKey(branchId, 'driver_id')) ?? ''
}
