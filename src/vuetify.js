import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

// Dark theme tuned to the app's existing palette (deep near-black surfaces,
// violet accent) so Vuetify components blend with the custom canvas UI.
const moireDark = {
  dark: true,
  colors: {
    background: '#0b0b0f',
    surface: '#101014',
    'surface-bright': '#16161c',
    'surface-variant': '#1a1a21',
    'on-surface-variant': '#1a1a21',
    primary: '#7c6cf0',
    secondary: '#8f86d8',
    accent: '#7c6cf0',
    error: '#ff8a8a',
    info: '#5cc8ff',
    success: '#9ee493',
    warning: '#ffd166',
    'on-background': '#e4e4e9',
    'on-surface': '#e4e4e9',
    'on-primary': '#0b0b0f',
  },
  variables: {
    'border-color': '#2c2c36',
    'border-opacity': 1,
    'high-emphasis-opacity': 0.95,
    'medium-emphasis-opacity': 0.72,
    'theme-on-surface': '#e4e4e9',
  },
}

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: 'moireDark',
    themes: { moireDark },
  },
  defaults: {
    // Compact, pro-tool density throughout — this is a dense control UI, not
    // a Material marketing page.
    global: { density: 'compact' },
    VBtn: { variant: 'tonal', rounded: 'md' },
    VSelect: { variant: 'outlined', density: 'compact', hideDetails: true },
    VTextField: { variant: 'outlined', density: 'compact', hideDetails: true },
    VSlider: { color: 'primary', hideDetails: true, thumbSize: 14, trackSize: 3 },
    VSwitch: { color: 'primary', hideDetails: true, inset: true },
    VCheckbox: { color: 'primary', hideDetails: true },
    VExpansionPanels: { variant: 'accordion' },
  },
})
