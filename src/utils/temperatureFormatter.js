import useGlobalStore from '../stores/global-store'
const GlobalStore = useGlobalStore()
import i18n from '../i18n/index.ts'
const { t } = i18n.global

export const kelvinToCelsius = (deg) => {
  if (deg == null) {
    return null
  }
  return Math.round((deg - 273.15) * 10) / 10
}

export const kelvinToFahrenheit = (deg) => {
  if (deg == null) {
    return null
  }
  return Math.round((deg - 273.15) * 9) / 5 + 32
}

export const kelvinToHuman = (deg) => {
  if (deg == null) {
    return null
  }
  //console.log('imperialUnits', GlobalStore.imperialUnits)
  return GlobalStore.imperialUnits ? kelvinToFahrenheit(deg) : kelvinToCelsius(deg)
}

export const kelvinToHumanI18n = (deg) => {
  if (deg == null) {
    return null
  }
  //console.log('imperialUnits', GlobalStore.imperialUnits)
  return GlobalStore.imperialUnits
    ? t('units.temp.fahrenheit', { n: kelvinToFahrenheit(deg) })
    : t('units.temp.celsius', { n: kelvinToCelsius(deg) })
}
