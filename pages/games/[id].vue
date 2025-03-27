<!-- pages/games/[id].vue -->
<template>
  <div class="game-detail-container">
    <div v-if="loading" class="loading-container">
      <div class="loader"></div>
      <p>Loading game...</p>
    </div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <template v-else>
      <div class="game-header">
        <div class="game-title-section">
          <h1>{{ game?.title }}</h1>
          <div class="game-meta">
            <span v-if="game?.event" class="event-badge">{{ game.event }}</span>
            <span class="date-badge">{{ formatDate(game?.date) }}</span>
          </div>
        </div>

        <div class="game-actions">
          <button
              v-if="!isAnalysisStarted && !isAnalysisComplete"
              @click="startAnalysis"
              class="btn btn-primary"
              :disabled="analysisLoading"
          >
            {{ analysisLoading ? 'Starting...' : 'Start Analysis' }}
          </button>

          <div v-if="isAnalysisStarted && !isAnalysisComplete" class="analysis-status">
            <div class="progress-container">
              <div class="progress-bar" :style="{width: `${analysisProgress}%`}"></div>
              <span class="progress-text">Analysis in progress: {{ analysisProgress }}%</span>
            </div>
          </div>

          <NuxtLink to="/games" class="btn btn-secondary">
            Back to Games
          </NuxtLink>
        </div>
      </div>

      <div class="players-bar">
        <div class="player-info white">
          <span class="player-piece">♔</span>
          <span class="player-name">{{ game?.white_player }}</span>
        </div>
        <div class="vs-divider">vs</div>
        <div class="player-info black">
          <span class="player-piece">♚</span>
          <span class="player-name">{{ game?.black_player }}</span>
        </div>
      </div>

      <!-- Chess Board Component -->
      <ChessBoard
          v-if="pgnContent && (isAnalysisComplete || highlights.length > 0)"
          :pgn-content="pgnContent"
          :interesting-moves="highlights"
      />

      <div v-else-if="pgnContent && !isAnalysisComplete" class="info-message">
        <p>Start analysis to view interesting moves and patterns</p>
      </div>

      <div v-else class="error-message">
        <p>PGN content unavailable</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from '#app'
const { $api } = useNuxtApp()

// Define middleware
definePageMeta({
  middleware: 'auth'
})

const route = useRoute()

const game = ref(null)
const highlights = ref([])
const pgnContent = ref(null)
const loading = ref(true)
const error = ref(null)
const isAnalysisStarted = ref(false)
const isAnalysisComplete = ref(false)
const analysisJobId = ref(null)
const analysisLoading = ref(false)
const analysisProgress = ref(0)
let pollingInterval = null

const gameId = computed(() => route.params.id)

onMounted(async () => {
  await fetchGameDetails()
})

onBeforeUnmount(() => {
  stopPolling()
})

async function fetchGameDetails() {
  loading.value = true
  error.value = null

  try {
    const response = await $api.getGame(gameId.value)
    game.value = response.game

    // Check if analysis results are available
    try {
      const analysisResponse = await $api.getAnalysisResults(gameId.value)

      if (analysisResponse && analysisResponse.highlights) {
        highlights.value = analysisResponse.highlights

        if (analysisResponse.pgn_data) {
          pgnContent.value = analysisResponse.pgn_data
          isAnalysisComplete.value = true
        } else {
          // Fallback if pgn_data isn't available for some reason
          await fetchPgnContent()
        }
      } else {
        // No analysis results, load mock PGN
        await fetchPgnContent()
      }
    } catch (analysisErr) {
      console.log('No existing analysis results, using mock PGN')
      await fetchPgnContent()
    }

    // Check if the game has highlights, indicating analysis is complete
    isAnalysisComplete.value = highlights.value && highlights.value.length > 0
  } catch (err) {
    console.error('Failed to fetch game details:', err)
    error.value = err.response?.data?.detail || 'Failed to load game details'
  } finally {
    loading.value = false
  }
}

async function fetchPgnContent() {
  try {
    // This would be a new endpoint to fetch raw PGN content
    // For now, create a mock PGN based on the game details
    pgnContent.value = createMockPgn()
  } catch (err) {
    console.error('Failed to fetch PGN content:', err)
  }
}

function createMockPgn() {
  // Create a basic PGN structure with the game details we have
  if (!game.value) return null

  return `[Event "${game.value.event || 'Game'}"]
[Site "Chess Analysis Platform"]
[Date "${new Date(game.value.date).toISOString().split('T')[0]}"]
[White "${game.value.white_player}"]
[Black "${game.value.black_player}"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 *`;
}

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

async function startAnalysis() {
  analysisLoading.value = true

  try {
    const response = await $api.startAnalysis(gameId.value)
    analysisJobId.value = response.id
    isAnalysisStarted.value = true
    startPolling()
  } catch (err) {
    console.error('Failed to start analysis:', err)
    error.value = err.response?.data?.detail || 'Failed to start analysis'
  } finally {
    analysisLoading.value = false
  }
}

function startPolling() {
  pollingInterval = setInterval(async () => {
    try {
      const response = await $api.getAnalysisStatus(gameId.value)
      const status = response.status

      // Calculate a progress percentage based on status
      if (status === 'in_progress') {
        // Increment progress (in real implementation this would come from API)
        analysisProgress.value += 5
        if (analysisProgress.value > 95) {
          analysisProgress.value = 95
        }
      } else if (status === 'completed') {
        analysisProgress.value = 100
        isAnalysisComplete.value = true
        stopPolling()
        await fetchAnalysisResults()
      } else if (status === 'failed') {
        stopPolling()
        error.value = 'Analysis failed'
      }
    } catch (err) {
      console.error('Failed to get analysis status:', err)
      stopPolling()
    }
  }, 3000)
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

async function fetchAnalysisResults() {
  try {
    const response = await $api.getAnalysisResults(gameId.value)

    // Update to handle new response structure
    highlights.value = response.highlights || []

    // Use the pgn_data from the API response
    if (response.pgn_data) {
      pgnContent.value = response.pgn_data

      isAnalysisComplete.value = true
    }
  } catch (err) {
    console.error('Failed to fetch analysis results:', err)
  }
}
</script>

<style scoped>
/* CSS remains unchanged */
.game-detail-container {
  width: 100%;
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

.info-message {
  background-color: #e8f5e9;
  color: #4CAF50;
  padding: 16px;
  border-radius: 4px;
  margin-bottom: 24px;
  text-align: center;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.game-title-section h1 {
  font-size: 28px;
  color: #333;
  margin-bottom: 8px;
}

.game-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.event-badge, .date-badge {
  background-color: #f1f1f1;
  color: #666;
  font-size: 14px;
  padding: 4px 12px;
  border-radius: 16px;
}

.game-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.btn {
  padding: 10px 16px;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  border: none;
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

.btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  opacity: 0.7;
}

.players-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8f8f8;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
}

.player-info.white {
  background-color: white;
  border-radius: 4px;
}

.player-info.black {
  color: white;
  background-color: #333;
  border-radius: 4px;
}

.player-piece {
  font-size: 32px;
}

.player-name {
  font-weight: 600;
  font-size: 16px;
}

.vs-divider {
  margin: 0 16px;
  color: #999;
  font-size: 14px;
  font-weight: 500;
}

.analysis-status {
  flex: 1;
}

.progress-container {
  height: 8px;
  background-color: #f1f1f1;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  margin-bottom: 8px;
}

.progress-bar {
  height: 100%;
  background-color: #4CAF50;
  transition: width 0.5s ease;
}

.progress-text {
  font-size: 14px;
  color: #666;
}
</style>
