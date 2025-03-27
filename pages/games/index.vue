<!-- pages/games/index.vue -->
<template>
  <div class="games-container">
    <div class="page-header">
      <h1>My Chess Games</h1>
      <NuxtLink to="/" class="btn btn-primary">
        <span class="btn-icon">+</span> Upload New Game
      </NuxtLink>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loader"></div>
      <p>Loading games...</p>
    </div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-else-if="games.length === 0" class="empty-state">
      <div class="empty-icon">♟</div>
      <h3>No games yet</h3>
      <p>Upload your first chess game to get started</p>
      <NuxtLink to="/" class="btn btn-secondary">Upload a Game</NuxtLink>
    </div>

    <div v-else class="games-grid">
      <div v-for="game in games" :key="game.id" class="game-card">
        <div class="game-header">
          <h3 class="game-title">{{ game.title }}</h3>
          <div class="game-date">{{ formatDate(game.date) }}</div>
        </div>

        <div class="game-info">
          <div class="player-info">
            <span class="player-piece">♔</span>
            <span class="player-name">{{ game.white_player }}</span>
          </div>
          <div class="vs-text">vs</div>
          <div class="player-info">
            <span class="player-piece">♚</span>
            <span class="player-name">{{ game.black_player }}</span>
          </div>
        </div>

        <div class="game-details">
          <div v-if="game.event" class="event-name">
            <span class="label">Event:</span> {{ game.event }}
          </div>
        </div>

        <div class="game-actions">
          <NuxtLink :to="`/games/${game.id}`" class="btn btn-secondary">
            View Analysis
          </NuxtLink>
          <button @click="confirmDelete(game)" class="btn btn-danger">
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Confirmation Dialog -->
    <div v-if="showDeleteModal" class="modal-overlay">
      <div class="modal-dialog">
        <h3 class="modal-title">Delete Game</h3>
        <p class="modal-message">
          Are you sure you want to delete "{{ gameToDelete?.title }}"?
          This action cannot be undone.
        </p>
        <div class="modal-actions">
          <button @click="showDeleteModal = false" class="btn btn-secondary">
            Cancel
          </button>
          <button @click="deleteGame" class="btn btn-danger">
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const { $api } = useNuxtApp()

// Define middleware
definePageMeta({
  middleware: 'auth'
})

const games = ref([])
const loading = ref(true)
const error = ref(null)
const showDeleteModal = ref(false)
const gameToDelete = ref(null)
const deleteLoading = ref(false)

onMounted(async () => {
  await fetchGames()
})

async function fetchGames() {
  loading.value = true
  error.value = null

  try {
    const response = await $api.getGames()
    games.value = response
  } catch (err) {
    console.error('Failed to fetch games:', err)
    error.value = err.response?.data?.detail || 'Failed to load games'
  } finally {
    loading.value = false
  }
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function confirmDelete(game) {
  gameToDelete.value = game
  showDeleteModal.value = true
}

async function deleteGame() {
  if (!gameToDelete.value) return

  deleteLoading.value = true

  try {
    await $api.deleteGame(gameToDelete.value.id)
    games.value = games.value.filter(g => g.id !== gameToDelete.value.id)
    showDeleteModal.value = false
    gameToDelete.value = null
  } catch (err) {
    console.error('Failed to delete game:', err)
    error.value = err.response?.data?.detail || 'Failed to delete game'
  } finally {
    deleteLoading.value = false
  }
}
</script>

<style scoped>
/* CSS remains unchanged */
.games-container {
  width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 28px;
  color: #333;
}

.btn {
  padding: 10px 16px;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: all 0.3s;
  border: none;
}

.btn-icon {
  margin-right: 8px;
  font-size: 18px;
}

.btn-primary {
  background-color: #4CAF50;
  color: white;
}

.btn-primary:hover {
  background-color: #45a049;
}

.btn-secondary {
  background-color: #f1f1f1;
  color: #333;
}

.btn-secondary:hover {
  background-color: #e0e0e0;
}

.btn-danger {
  background-color: #f5f5f5;
  color: #f44336;
}

.btn-danger:hover {
  background-color: #ffebee;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #666;
}

.loader {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 4px solid #4CAF50;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  background-color: #ffebee;
  color: #f44336;
  padding: 16px;
  border-radius: 4px;
  margin-bottom: 24px;
}

.empty-state {
  text-align: center;
  padding: 60px 0;
  color: #666;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: #ccc;
}

.empty-state h3 {
  font-size: 20px;
  margin-bottom: 8px;
  color: #333;
}

.empty-state p {
  margin-bottom: 24px;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.game-card {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s;
}

.game-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.game-header {
  padding: 16px;
  border-bottom: 1px solid #f1f1f1;
}

.game-title {
  font-size: 18px;
  color: #333;
  margin-bottom: 4px;
}

.game-date {
  font-size: 14px;
  color: #666;
}

.game-info {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #f8f8f8;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-piece {
  font-size: 24px;
}

.player-name {
  font-weight: 500;
  font-size: 14px;
}

.vs-text {
  color: #999;
  font-size: 12px;
  font-weight: 500;
}

.game-details {
  padding: 16px;
}

.event-name {
  font-size: 14px;
  color: #666;
}

.label {
  font-weight: 500;
  color: #333;
}

.game-actions {
  padding: 16px;
  display: flex;
  gap: 12px;
  border-top: 1px solid #f1f1f1;
}

.game-actions .btn {
  flex: 1;
  justify-content: center;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-dialog {
  background-color: white;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 20px;
  margin-bottom: 16px;
  color: #333;
}

.modal-message {
  color: #666;
  margin-bottom: 24px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
