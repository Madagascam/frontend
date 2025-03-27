<!-- pages/register.vue -->
<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1 class="auth-title">Create Account</h1>

      <div class="form-group">
        <label for="username">Username</label>
        <input
            id="username"
            v-model="form.username"
            type="text"
            class="form-control"
            placeholder="Choose a username"
            required
        >
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
            id="password"
            v-model="form.password"
            type="password"
            class="form-control"
            placeholder="Choose a password"
            required
        >
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <button
          class="btn btn-primary"
          @click="register"
          :disabled="loading"
      >
        {{ loading ? 'Creating account...' : 'Register' }}
      </button>

      <div class="auth-link">
        Already have an account? <NuxtLink to="/login">Sign In</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from '#app'
import { useAuthStore } from '~/store/auth'

// Define middleware
definePageMeta({
  middleware: 'guest'
})

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  username: '',
  password: ''
})
const loading = ref(false)
const error = ref(null)

async function register() {
  if (!form.username || !form.password) {
    error.value = "Please fill in all fields"
    return
  }

  loading.value = true
  error.value = null

  try {
    await authStore.register(form)
    // After successful registration, log the user in
    await authStore.login(form)
    await router.push('/games')
  } catch (err) {
    console.error('Registration error:', err)
    error.value = err.response?.data?.detail || 'Registration failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* Same styles as login.vue - CSS remains unchanged */
.auth-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.auth-title {
  font-size: 24px;
  text-align: center;
  margin-bottom: 24px;
  color: #333;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #555;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.form-control:focus {
  outline: none;
  border-color: #4CAF50;
}

.btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-primary {
  background-color: #4CAF50;
  color: white;
}

.btn-primary:hover {
  background-color: #45a049;
}

.btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.error-message {
  color: #f44336;
  margin-bottom: 16px;
}
</style>
