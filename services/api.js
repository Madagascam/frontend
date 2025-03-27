// services/api.js
export default defineNuxtPlugin((nuxtApp) => {
    const config = useRuntimeConfig()
    const API_URL = config.public.apiBaseUrl

    // Helper function to get the auth token
    const getAuthToken = () => {
        if (process.client) {
            return localStorage.getItem('token')
        }
        return null
    }

    // Create a customFetch function that adds auth headers
    const customFetch = (url, options = {}) => {
        const token = getAuthToken()
        const headers = { ...(options.headers || {}) }

        if (token) {
            headers.Authorization = `Bearer ${token}`
        }

        return $fetch(url, {
            baseURL: API_URL,
            ...options,
            headers
        })
    }

    const apiService = {
        // Auth endpoints
        register(userData) {
            return customFetch('/api/register', {
                method: 'POST',
                body: userData,
            })
        },

        login(username, password) {
            const formData = new URLSearchParams()
            formData.append('username', username)
            formData.append('password', password)

            return customFetch('/api/token', {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
        },

        getUserProfile() {
            return customFetch('/api/profile/')
        },

        // Games endpoints
        getGames() {
            return customFetch('/api/games/')
        },

        getGame(id) {
            return customFetch(`/api/games/${id}`)
        },

        createGame(title, pgnFile) {
            const formData = new FormData()
            formData.append('title', title)
            formData.append('pgn_file', pgnFile)

            return customFetch('/api/games/', {
                method: 'POST',
                body: formData,
                headers: {
                    // Content-Type is set automatically for FormData
                }
            })
        },

        deleteGame(id) {
            return customFetch(`/api/games/${id}`, {
                method: 'DELETE'
            })
        },

        // Analysis endpoints
        startAnalysis(gameId) {
            return customFetch(`/api/games/${gameId}/analysis/`, {
                method: 'POST'
            })
        },

        getAnalysisStatus(gameId) {
            return customFetch(`/api/games/${gameId}/analysis/status`)
        },

        getAnalysisResults(gameId) {
            return customFetch(`/api/games/${gameId}/analysis/result`)
        }
    }

    // Provide it to the Nuxt app
    return {
        provide: {
            api: apiService
        }
    }
})
