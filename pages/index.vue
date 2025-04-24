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

          <div class="form-group">
            <label for="video-links">Video Links (optional)</label>
            <div class="video-links-input">
              <input
                id="video-links"
                v-model="newVideoLink"
                type="url"
                class="form-control"
                placeholder="Paste a video link and press Enter"
                @keydown.enter.prevent="addVideoLink"
              >
            </div>
            <div v-if="videoLinks.length > 0" class="video-links-tags">
              <span v-for="(link, index) in videoLinks" :key="index" class="video-link-tag" :title="link">
                {{ link.length > 70 ? link.substring(0, 70) + '...' : link }}
                <button @click="removeVideoLink(index)" class="remove-tag-btn" title="Remove link">×</button>
              </span>
            </div>
          </div>

          <div class="pgn-preview">
            <h3>Selected File: {{ fileData ? fileData.name : '' }}</h3>
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
import { ref, computed, reactive } from 'vue' // Removed onMounted as it wasn't used
import { useAuthStore } from '~/store/auth'

export default {
  setup() {
    const authStore = useAuthStore()
    const gameTitle = ref('')
    const pgnPreview = ref('')
    const uploading = ref(false)
    const error = ref(null)
    const isDragging = ref(false)
    const newVideoLink = ref('')
    const videoLinks = reactive([]) // Use reactive for array
    const fileData = ref(null) // Moved from data()
    const pgnContent = ref('') // Moved from data()

    const isAuthenticated = computed(() => authStore.isAuthenticated)

    const onDrop = (e) => {
      isDragging.value = false
      const files = e.dataTransfer.files
      if (files.length) {
        processFile(files[0])
      }
    }

    const onFileSelect = (e) => {
      const files = e.target.files
      if (files.length) {
        processFile(files[0])
      }
    }

    const extractTitleFromPgn = () => {
      // Attempt to create a title from event and player names in PGN
      try {
        const eventMatch = pgnContent.value.match(/\[Event "([^"]+)"\]/i)
        const whiteMatch = pgnContent.value.match(/\[White "([^"]+)"\]/i)
        const blackMatch = pgnContent.value.match(/\[Black "([^"]+)"\]/i)

        const event = eventMatch ? eventMatch[1] : ''
        const white = whiteMatch ? whiteMatch[1] : ''
        const black = blackMatch ? blackMatch[1] : ''

        if (event && white && black) {
          gameTitle.value = `${event}: ${white} vs ${black}`
        } else if (white && black) {
          gameTitle.value = `${white} vs ${black}`
        }
      } catch (e) {
        console.error('Failed to extract title from PGN', e)
      }
    }

    const processFile = (file) => {
      // Check if the file is a PGN file
      if (!file.name.endsWith('.pgn')) {
        error.value = 'Only PGN files are allowed'
        return
      }

      fileData.value = file
      error.value = null
      gameTitle.value = '' // Reset title when new file is processed

      // Read file content for preview
      const reader = new FileReader()
      reader.onload = (event) => {
        pgnContent.value = event.target.result
        // Show first few lines as preview
        const lines = pgnContent.value.split('\n').slice(0, 10)
        pgnPreview.value = lines.join('\n') + (lines.length < 10 ? '' : '\n...')

        // Try to extract title from PGN if not set by user
        extractTitleFromPgn() // Call the method defined in setup
      }
      reader.readAsText(file)
    }

    const clearFile = () => {
      fileData.value = null
      pgnPreview.value = ''
      gameTitle.value = ''
      error.value = null
      videoLinks.length = 0 // Clear video links using reactive array method
      newVideoLink.value = ''
      pgnContent.value = '' // Also clear pgnContent
      // Reset file input if needed
      // const fileInput = document.querySelector('input[type="file"]');
      // if (fileInput) fileInput.value = '';
    }

    const addVideoLink = () => {
      const link = newVideoLink.value.trim();
      // Basic URL validation (can be improved)
      if (link) {
        if (!videoLinks.includes(link)) {
            videoLinks.push(link);
        }
        newVideoLink.value = ''; // Clear input after adding
      } else if (link) {
        // Optional: Show an error if the link is invalid
        console.warn('Invalid video link format');
        error.value = 'Invalid video link format. Please use http:// or https://'
        // You could set an error message here to display to the user
      }
    }

    const removeVideoLink = (index) => {
        videoLinks.splice(index, 1);
    }

    const uploadGame = async () => {
      if (!fileData.value) return

      uploading.value = true
      error.value = null

      try {
        const formData = new FormData()
        formData.append('pgn_file', fileData.value)
        formData.append('title', gameTitle.value || 'Untitled Game')
        // Append each video link individually
        videoLinks.forEach(link => formData.append('video_links', link))

        // Assuming $api is globally available or injected
        // If using Nuxt 3, use useNuxtApp().$api
        const {$api} = useNuxtApp()
        const response = await $api.createGame(formData)
        const gameId = response.id

        // Redirect to the game detail page
        // Assuming $router is globally available or injected
        // If using Nuxt 3, use useRouter()
        const router = useRouter()
        router.push(`/games/${gameId}`)
      } catch (err) { // Changed variable name from error to err
        console.error('Upload error:', err)
        error.value = err.response?.data?.detail || 'Failed to upload game'
      } finally {
        uploading.value = false
      }
    }

    return {
      authStore,
      gameTitle,
      pgnPreview,
      uploading,
      error,
      isDragging,
      newVideoLink,
      videoLinks,
      fileData,
      pgnContent,
      isAuthenticated,
      onDrop,
      onFileSelect,
      processFile,
      extractTitleFromPgn,
      clearFile,
      addVideoLink,
      removeVideoLink,
      uploadGame
    }
  },
  // Removed data() function
  // Removed computed property (moved to setup)
  // Removed methods object (moved functions to setup)
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

.video-links-input {
  margin-bottom: 10px;
}

.video-links-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.video-link-tag {
  display: inline-flex;
  align-items: center;
  background-color: #e0e0e0;
  color: #333;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 13px;
  max-width: 100%; /* Ensure tag doesn't overflow container */
  overflow: hidden; /* Hide overflow */
  text-overflow: ellipsis; /* Add ellipsis for overflow */
  white-space: nowrap; /* Prevent wrapping inside the tag */
}

.remove-tag-btn {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  margin-left: 6px;
  padding: 0;
}

.remove-tag-btn:hover {
  color: #000;
}
</style>
