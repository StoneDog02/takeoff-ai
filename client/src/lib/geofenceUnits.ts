/** Match haversine / clock logic: feet → meters for geofence radius. */
export function feetToMeters(feet: number): number {
  return feet * 0.3048
}

export function geofenceRadiusMeters(
  radiusValue: number,
  radiusUnit: 'feet' | 'meters'
): number {
  return radiusUnit === 'meters' ? radiusValue : feetToMeters(radiusValue)
}
