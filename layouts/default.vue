<!-- layouts/default.vue -->
<template>
  <div class="app-container">
    <header v-if="isAuthenticated" class="app-header">
      <div class="header-content">
        <NuxtLink to="/" class="logo">
          <span class="logo-icon">♔</span> Chess Analysis
        </NuxtLink>

        <nav class="main-nav">
          <NuxtLink to="/games" class="nav-link">My Games</NuxtLink>
          <NuxtLink to="/" class="nav-link">Upload Game</NuxtLink>
        </nav>

        <div class="user-menu">
          <div class="user-info" @click="toggleDropdown">
            <span>{{ username }}</span>
            <span class="dropdown-arrow">▼</span>
          </div>

          <div v-if="showDropdown" class="dropdown-menu">
            <NuxtLink to="/profile" class="dropdown-item">Profile</NuxtLink>
            <div class="dropdown-item" @click="logout">Logout</div>
          </div>
        </div>
      </div>
    </header>

    <main class="main-content">
      <slot />
    </main>

    <footer class="app-footer">
      <div class="footer-content">
        <p>&copy; {{ new Date().getFullYear() }} Chess Analysis Platform</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useAuthStore } from '~/store/auth'
import { navigateTo } from '#app'

const authStore = useAuthStore()
const showDropdown = ref(false)

const isAuthenticated = computed(() => authStore.isAuthenticated)
const username = computed(() => authStore.user?.username || 'User')

onMounted(() => {
  authStore.checkAuth()
  document.addEventListener('click', closeDropdownOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeDropdownOutside)
})

function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

function closeDropdownOutside(event) {
  const userMenu = document.querySelector('.user-menu')
  if (userMenu && !userMenu.contains(event.target)) {
    showDropdown.value = false
  }
}

function logout() {
  authStore.logout()
  navigateTo('/login')
}
</script>

<style>
/* Global styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #333;
  background-color: #f5f5f5;
}

a {
  text-decoration: none;
  color: inherit;
}

/* Layout styles */
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  background-color: #4CAF50;
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  font-size: 24px;
  font-weight: bold;
  display: flex;
  align-items: center;
}

.logo-icon {
  margin-right: 8px;
  font-size: 28px;
}

.main-nav {
  display: flex;
  gap: 24px;
}

.nav-link {
  font-weight: 500;
  position: relative;
  padding: 8px 0;
}

.nav-link:after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background-color: white;
  transition: width 0.3s;
}

.nav-link:hover:after,
.router-link-active:after {
  width: 100%;
}

.user-menu {
  position: relative;
}

.user-info {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
}

.dropdown-arrow {
  font-size: 10px;
  transition: transform 0.3s;
}

.user-menu:hover .dropdown-arrow {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 150px;
  margin-top: 8px;
  color: #333;
  overflow: hidden;
}

.dropdown-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.dropdown-item:hover {
  background-color: #f5f5f5;
}

.main-content {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px;
}

.app-footer {
  background-color: #333;
  color: white;
  padding: 20px 0;
  margin-top: auto;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  text-align: center;
}
</style>
