<!-- components/PgnUploader.vue -->
<template>
  <div class="uploader-container">
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
        <p v-if="fileName" class="file-name">Selected: {{ fileName }}</p>
        <p v-if="uploadStatus" class="status" :class="{ 'error': uploadStatus.includes('Error') }">
          {{ uploadStatus }}
        </p>
      </div>
    </div>

    <div v-if="fileId" class="analysis-section">
      <button class="analyze-btn" @click="startAnalysis" :disabled="analyzing">
        {{ analyzing ? 'Analyzing...' : 'Start Analysis' }}
      </button>
      <div v-if="analyzing" class="progress-container">
        <div class="progress-bar" :style="{width: `${analysisProgress}%`}"></div>
        <span class="progress-text">{{ analysisProgress }}%</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      isDragging: false,
      fileName: null,
      uploadStatus: null,
      fileId: null,
      analyzing: false,
      analysisProgress: 0,
      analysisJobId: null,
      pollingInterval: null
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
        this.uploadStatus = 'Error: Only PGN files are allowed'
        return
      }

      this.fileName = file.name
      this.uploadFile(file)
    },
    async uploadFile(file) {
      try {
        const formData = new FormData()
        formData.append('file', file)

        this.uploadStatus = 'Uploading...'

        const response = await fetch('http://localhost:8000/upload-pgn/', {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (response.ok) {
          this.uploadStatus = 'File uploaded successfully!'
          this.fileId = data.file_id

          // Save the PGN file content for later
          const reader = new FileReader()
          reader.onload = (event) => {
            localStorage.setItem('chessPgnContent', event.target.result)
          }
          reader.readAsText(file)
        } else {
          this.uploadStatus = `Error: ${data.error || 'Upload failed'}`
        }
      } catch (error) {
        console.error('Upload error:', error)
        this.uploadStatus = 'Error: Connection failed'
      }
    },
    async startAnalysis() {
      try {
        this.analyzing = true

        // Request PGN analysis
        const response = await fetch('http://localhost:8000/analyze-pgn/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            file_id: this.fileId
          })
        })

        const data = await response.json()

        if (response.ok) {
          this.analysisJobId = data.job_id
          this.startPolling()
        } else {
          this.uploadStatus = `Error: ${data.detail || 'Analysis request failed'}`
          this.analyzing = false
        }
      } catch (error) {
        console.error('Analysis request error:', error)
        this.uploadStatus = 'Error: Connection failed'
        this.analyzing = false
      }
    },
    startPolling() {
      this.pollingInterval = setInterval(async () => {
        try {
          const response = await fetch(`http://localhost:8000/analysis-status/${this.analysisJobId}`)
          const data = await response.json()

          if (response.ok) {
            this.analysisProgress = data.progress

            if (data.status === 'completed') {
              this.stopPolling()
              this.getAnalysisResults()
            } else if (data.status === 'failed') {
              this.stopPolling()
              this.uploadStatus = 'Error: Analysis failed'
              this.analyzing = false
            }
          } else {
            this.stopPolling()
            this.uploadStatus = `Error: ${data.detail || 'Failed to get analysis status'}`
            this.analyzing = false
          }
        } catch (error) {
          console.error('Polling error:', error)
          this.stopPolling()
          this.uploadStatus = 'Error: Connection failed'
          this.analyzing = false
        }
      }, 5000) // Poll every second
    },
    stopPolling() {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval)
        this.pollingInterval = null
      }
    },
    async getAnalysisResults() {
      try {
        const response = await fetch(`http://localhost:8000/analysis-result/${this.analysisJobId}`)
        const data = await response.json()

        if (response.ok) {
          // Store only the interesting moves from backend - no need for board states anymore
          localStorage.setItem('chessAnalysisResult', JSON.stringify({
            interesting_moves: data.interesting_moves
          }))

          // Navigate to the chess board view
          this.$router.push('/chess-board')
        } else {
          this.uploadStatus = `Error: ${data.detail || 'Failed to get analysis results'}`
          this.analyzing = false
        }
      } catch (error) {
        console.error('Get results error:', error)
        this.uploadStatus = 'Error: Connection failed'
        this.analyzing = false
      }
    }
  },
  beforeDestroy() {
    this.stopPolling()
  }
}
</script>

<style scoped>
.uploader-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
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

.file-name {
  font-size: 14px;
  color: #4CAF50;
  font-weight: bold;
  margin-top: 10px;
}

.status {
  margin-top: 15px;
  font-weight: 500;
  color: #4CAF50;
}

.status.error {
  color: #f44336;
}

.analysis-section {
  margin-top: 30px;
  text-align: center;
}

.analyze-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s;
}

.analyze-btn:hover {
  background-color: #45a049;
}

.analyze-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.progress-container {
  margin-top: 20px;
  width: 100%;
  height: 20px;
  background-color: #f1f1f1;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}

.progress-bar {
  height: 100%;
  background-color: #4CAF50;
  transition: width 0.5s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #333;
  font-weight: bold;
  font-size: 12px;
}
</style>
