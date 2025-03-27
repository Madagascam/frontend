<!-- pages/index.vue -->
<template>
  <div class="upload-container">
    <h1 class="page-title">Upload Chess Game</h1>
    <p class="description">Upload your chess games in PGN format for analysis</p>

    <div class="upload-section">
      <div v-if="!isAuthenticated" class="auth-required">
        <p>Please log in to upload and analyze games</p>
        <div class="auth-buttons">
          <nuxt-link to="/login" class="btn btn-primary">Sign In</nuxt-link>
          <nuxt-link to="/register" class="btn btn-secondary">Register</nuxt-link>
        </div>
      </div>

      <div v-else>
        <div v-if="!fileData" class="uploader-form">
          <div
              class="upload-area"
              :class="{ 'active': isDragging }"
              @dragenter.prevent="isDragging = true"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="onDrop"
              @click="$refs.fileInput.click()"
          >
            <input
                type="file"
                ref="fileInput"
                class="hidden-input"
                accept=".pgn"
                @change="onFileSelect"
            >
            <div class="upload-content">
              <div class="icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M19 13h-4v4h-2v-4H9v-2h4V7h2v4h4v2z"/>
                  <path fill="currentColor" d="M19 3H5C3.89 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
                </svg>
              </div>
              <p class="upload-text">Drag & drop your PGN file here or click to browse</p>
              <p class="file-type">Only .pgn files are accepted</p>
            </div>
          </div>
        </div>

        <div v-else class="file-details">
          <h2>Game Details</h2>

          <div class="form-group">
            <label for="title">Game Title</label>
            <input
                id="title"
                v-model="gameTitle"
                type="text"
                class="form-control"
                placeholder="Enter a title for this game"
                required
            >
          </div>

          <div class="pgn-preview">
            <h3>Selected File: {{ fileData.name }}</h3>
            <div class="pgn-content">
              <pre>{{ pgnPreview }}</pre>
            </div>
          </div>

          <div class="upload-actions">
            <button @click="clearFile" class="btn btn-secondary">
              Cancel
            </button>
            <button @click="uploadGame" class="btn btn-primary" :disabled="uploading">
              {{ uploading ? 'Uploading...' : 'Upload Game' }}
            </button>
          </div>
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '~/store/auth'

export default {
  setup() {
    const authStore = useAuthStore()
    return {
      authStore
    }
  },
  data() {
    return {
      isDragging: false,
      fileData: null,
      pgnContent: '',
      pgnPreview: '',
      gameTitle: '',
      uploading: false,
      error: null
    }
  },
  computed: {
    isAuthenticated() {
      return this.authStore.isAuthenticated
    }
  },
  methods: {
    onDrop(e) {
      this.isDragging = false
      const files = e.dataTransfer.files
      if (files.length) {
        this.processFile(files[0])
      }
    },
    onFileSelect(e) {
      const files = e.target.files
      if (files.length) {
        this.processFile(files[0])
      }
    },
    processFile(file) {
      // Check if the file is a PGN file
      if (!file.name.endsWith('.pgn')) {
        this.error = 'Only PGN files are allowed'
        return
      }

      this.fileData = file
      this.error = null

      // Read file content for preview
      const reader = new FileReader()
      reader.onload = (event) => {
        this.pgnContent = event.target.result
        // Show first few lines as preview
        const lines = this.pgnContent.split('\n').slice(0, 10)
        this.pgnPreview = lines.join('\n') + (lines.length < 10 ? '' : '\n...')

        // Try to extract title from PGN if not set
        if (!this.gameTitle) {
          this.extractTitleFromPgn()
        }
      }
      reader.readAsText(file)
    },
    extractTitleFromPgn() {
      // Attempt to create a title from event and player names in PGN
      try {
        const eventMatch = this.pgnContent.match(/\[Event "([^"]+)"/i)
        const whiteMatch = this.pgnContent.match(/\[White "([^"]+)"/i)
        const blackMatch = this.pgnContent.match(/\[Black "([^"]+)"/i)

        const event = eventMatch ? eventMatch[1] : ''
        const white = whiteMatch ? whiteMatch[1] : ''
        const black = blackMatch ? blackMatch[1] : ''

        if (event && white && black) {
          this.gameTitle = `${event}: ${white} vs ${black}`
        } else if (white && black) {
          this.gameTitle = `${white} vs ${black}`
        }
      } catch (e) {
        console.error('Failed to extract title from PGN', e)
      }
    },
    clearFile() {
      this.fileData = null
      this.pgnContent = ''
      this.pgnPreview = ''
      this.gameTitle = ''
      this.error = null
    },
    async uploadGame() {
      if (!this.gameTitle.trim()) {
        this.error = 'Please enter a title for the game'
        return
      }

      this.uploading = true
      this.error = null

      try {
        const response = await this.$api.createGame(this.gameTitle, this.fileData)
        const gameId = response.id

        // Redirect to the game detail page
        this.$router.push(`/games/${gameId}`)
      } catch (error) {
        console.error('Upload error:', error)
        this.error = error.response?.data?.detail || 'Failed to upload game'
      } finally {
        this.uploading = false
      }
    }
  }
}
</script>

<style scoped>
.upload-container {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 32px;
  color: #333;
  margin-bottom: 8px;
}

.description {
  font-size: 18px;
  color: #666;
  margin-bottom: 40px;
}

.upload-section {
  background-color: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.auth-required {
  text-align: center;
  padding: 40px 0;
}

.auth-required p {
  font-size: 18px;
  color: #666;
  margin-bottom: 24px;
}

.auth-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.upload-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-area.active {
  border-color: #4CAF50;
  background-color: rgba(76, 175, 80, 0.1);
}

.upload-area:hover {
  border-color: #999;
}

.hidden-input {
  display: none;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.icon {
  color: #666;
  margin-bottom: 10px;
}

.upload-text {
  font-size: 18px;
  font-weight: 500;
  color: #333;
  margin: 0;
}

.file-type {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.file-details {
  padding: 20px 0;
}

.file-details h2 {
  font-size: 24px;
  color: #333;
  margin-bottom: 24px;
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

.pgn-preview {
  background-color: #f8f8f8;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.pgn-preview h3 {
  font-size: 16px;
  color: #333;
  margin-bottom: 12px;
}

.pgn-content {
  background-color: white;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 12px;
  overflow-x: auto;
}

.pgn-content pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #333;
  white-space: pre-wrap;
}

.upload-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
}

.btn {
  padding: 10px 20px;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
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
}

.error-message {
  background-color: #ffebee;
  color: #f44336;
  padding: 16px;
  border-radius: 4px;
  margin-top: 24px;
}
</style>
