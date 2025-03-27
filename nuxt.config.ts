// nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      title: 'Chess Analysis Platform',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { hid: 'description', name: 'description', content: 'A platform for uploading and analyzing chess games' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  },

  modules: [
    '@pinia/nuxt',
    // Removed @nuxtjs/axios
  ],

  css: [],

  plugins: [
    '~/services/api.js'
  ],

  components: true,

  build: {
    transpile: ['chess.js'],  // Removed axios since we're using built-in fetch
  },

  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8000'
    }
  },

  compatibilityDate: '2025-03-18'
})
