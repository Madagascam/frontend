// store/auth.js
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: null,
        token: null,
        isAuthenticated: false
    }),

    actions: {
        setUser(user) {
            this.user = user
        },

        setToken(token) {
            this.token = token
            if (process.client) {
                localStorage.setItem('token', token)
            }
        },

        clearAuth() {
            this.user = null
            this.token = null
            this.isAuthenticated = false
            if (process.client) {
                localStorage.removeItem('token')
            }
        },

        setAuth(status) {
            this.isAuthenticated = status
        },

        async register(userData) {
            try {
                const { $api } = useNuxtApp()
                const response = await $api.register(userData)
                return response  // Remove .data to use the direct response
            } catch (error) {
                throw error
            }
        },

        async login({ username, password }) {
            try {
                const { $api } = useNuxtApp()
                const response = await $api.login(username, password)
                const token = response.access_token  // Remove .data if needed
                this.setToken(token)
                this.setAuth(true)
                await this.fetchUserProfile()
                return response  // Remove .data if needed
            } catch (error) {
                throw error
            }
        },

        async fetchUserProfile() {
            try {
                const { $api } = useNuxtApp()
                const response = await $api.getUserProfile()
                this.setUser(response)
                return response
            } catch (error) {
                throw error
            }
        },

        logout() {
            this.clearAuth()
            navigateTo('/login')
        },

        checkAuth() {
            if (process.client) {
                const token = localStorage.getItem('token')
                if (token) {
                    this.setToken(token)
                    this.setAuth(true)
                    this.fetchUserProfile()
                }
            }
        }
    }
})
