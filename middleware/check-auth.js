// middleware/check-auth.js
import {useAuthStore} from "~/store/auth";

export default defineNuxtRouteMiddleware(() => {
    const authStore = useAuthStore()
    authStore.checkAuth()
})
