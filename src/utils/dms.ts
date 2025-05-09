/*
 * converts GPS decimal coordinates (latitude or longitude) into degrees, minutes, and seconds (DMS) format
 * @param latitude - Latitude in decimal format
 * @param longitude - Longitude in decimal format
 * @return A string representing the coordinates in DMS format
 *
 */

export const decimalToDMS = (latitude: number, longitude: number): string => {
  const convert = (decimal: number, isLat: boolean): string => {
    const absolute = Math.abs(decimal)
    const degrees = Math.floor(absolute)
    const minutesNotTruncated = (absolute - degrees) * 60
    const minutes = Math.floor(minutesNotTruncated)
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2)

    let direction = ''
    if (isLat) {
      direction = decimal >= 0 ? 'N' : 'S'
    } else {
      direction = decimal >= 0 ? 'E' : 'W'
    }

    return `${degrees}° ${minutes}' ${seconds}" ${direction}`
  }

  const latDMS = convert(latitude, true)
  const lonDMS = convert(longitude, false)

  return `${latDMS}, ${lonDMS}`
}
