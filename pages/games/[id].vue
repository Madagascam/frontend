<!-- pages/games/[id].vue -->
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
const analysisTaskId = ref(null)
const videoTaskId = ref(null) // Stores the task ID for video generation
const analysisLoading = ref(false)
const analysisProgress = ref(0)
const selectedStrategy = ref('analytics') // Default to analytics
const createVideo = ref(false) // State for the create video checkbox

// New state for video generation
const isVideoTaskPolling = ref(false)
const isVideoTaskComplete = ref(false)
const videoTaskProgress = ref(0)
const videoSegmentIds = ref([])
const videoSegments = ref([]) // Will store { id: segmentId, url: objectURL, type: blob.type }
const videoLoadingError = ref(null)
const videoObjectUrls = ref([]) // To keep track of created URLs for cleanup

let pollingInterval = null
let videoPollingInterval = null // Separate interval for video task

const gameId = computed(() => route.params.id)

onMounted(async () => {
  await fetchGameDetails()
})

onBeforeUnmount(() => {
  stopPolling()
  stopVideoPolling() // Stop video polling on unmount
  // Revoke object URLs to prevent memory leaks
  videoObjectUrls.value.forEach(url => URL.revokeObjectURL(url));
  videoObjectUrls.value = []; // Clear the tracking array
  console.log('Component unmounted, cleaned up polling and object URLs.');
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

           // If analysis is already complete and video task ID exists (page reload?), start video poll
           // Note: Need a way to persist videoTaskId or re-fetch it if needed on reload.
           // For simplicity now, we assume video polling starts only after *this* session's analysis.

        } else {
          await fetchPgnContent()
        }
      } else {
        await fetchPgnContent()
      }
    } catch (analysisErr) {
       // Check if the error is a 404 (Not Found) or similar indicating no results yet
       if (analysisErr.response && analysisErr.response.status === 404) {
           console.log('No existing analysis results found.');
           await fetchPgnContent(); // Load PGN for display
       } else {
           console.error('Error fetching initial analysis results:', analysisErr);
           error.value = 'Could not load initial analysis status.';
           await fetchPgnContent(); // Still try to load PGN
       }
    }

    // Set analysis complete flag based on highlights
    isAnalysisComplete.value = highlights.value && highlights.value.length > 0;

  } catch (err) {
    console.error('Failed to fetch game details:', err)
    error.value = err.response?.data?.detail || 'Failed to load game details'
  } finally {
    loading.value = false
  }
}

async function fetchPgnContent() {
  try {
    // For now, create a mock PGN based on the game details
    pgnContent.value = createMockPgn()
  } catch (err) {
    console.error('Failed to fetch PGN content:', err)
  }
}

function createMockPgn() {
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
  // Reset previous states if re-analyzing
  isAnalysisStarted.value = false;
  isAnalysisComplete.value = false;
  analysisProgress.value = 0;
  highlights.value = [];
  error.value = null;
  // Reset video state as well
  stopVideoPolling();
  isVideoTaskPolling.value = false;
  isVideoTaskComplete.value = false;
  videoTaskProgress.value = 0;
  videoSegments.value = [];
  videoSegmentIds.value = [];
  videoLoadingError.value = null;
  videoObjectUrls.value.forEach(url => URL.revokeObjectURL(url)); // Clean up old URLs if any
  videoObjectUrls.value = [];
  videoTaskId.value = null; // Clear previous video task ID


  try {
    const response = await $api.startAnalysis(gameId.value, selectedStrategy.value, createVideo.value);

    analysisTaskId.value = response.analysis_id;
    // Store video_id ONLY if createVideo was true during the request
    if (createVideo.value) {
        videoTaskId.value = response.video_id;
        console.log(`Video creation requested. Video Task ID: ${videoTaskId.value}`);
    } else {
        videoTaskId.value = null; // Ensure it's null if video wasn't requested
        console.log('Video creation not requested.');
    }

    isAnalysisStarted.value = true;
    startPolling();
  } catch (err) {
    console.error('Failed to start analysis:', err);
    console.error('Error details:', err.message, err.stack);
    error.value = err.response?.data?.detail || 'Failed to start analysis';
  } finally {
    analysisLoading.value = false;
  }
}

// --- Analysis Polling (Mostly Unchanged) ---
function startPolling() {
  if (pollingInterval) return; // Prevent multiple intervals
  pollingInterval = setInterval(async () => {
    try {
      if (!analysisTaskId.value) {
          console.warn('No analysisTaskId available for polling');
          stopPolling(); // Stop if ID is missing
          return;
      }
      const taskId = typeof analysisTaskId.value === 'number' ?
        analysisTaskId.value : parseInt(analysisTaskId.value);

      const response = await $api.getTaskStatus(taskId);
      const status = response.status;

      if (status === 'processing') {
        if (response.progress !== undefined) {
          analysisProgress.value = response.progress;
        } else {
          analysisProgress.value = Math.min(95, analysisProgress.value + 5);
        }
      } else if (status === 'completed') {
        analysisProgress.value = 100;
        stopPolling(); // Stop analysis polling
        console.log('Analysis task complete. Fetching results...');
        await fetchAnalysisResults(); // Fetch results, which will trigger video polling if needed
      } else if (status === 'failed') {
        stopPolling();
        error.value = 'Analysis failed';
        isAnalysisStarted.value = false; // Reset started flag
      }
    } catch (err) {
      console.error('Failed to get analysis status:', err);
      error.value = 'Error checking analysis status.'
      stopPolling(); // Stop on error
    }
  }, 3000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
    console.log('Stopped analysis polling.');
  }
}

async function fetchAnalysisResults() {
  try {
    const response = await $api.getAnalysisResults(gameId.value)
    highlights.value = response.highlights || []

    if (response.pgn_data) {
      pgnContent.value = response.pgn_data
      isAnalysisComplete.value = true; // Mark analysis as complete

       // --- Start video polling if requested and analysis is now complete ---
       if (createVideo.value && videoTaskId.value && !isVideoTaskComplete.value && !isVideoTaskPolling.value) {
           console.log('Analysis complete, video creation requested. Starting video polling.');
           startVideoPolling();
       } else if (createVideo.value && !videoTaskId.value) {
           console.warn('Video creation was requested, but no video task ID was found after analysis.');
           videoLoadingError.value = 'Video Task ID missing after analysis.';
       } else if (!createVideo.value) {
            console.log('Analysis complete, video creation was not requested.');
       }
       // --- End video polling logic ---

    } else {
        // Handle case where results are fetched but PGN is missing
        console.warn('Analysis results fetched, but pgn_data is missing.');
        // Decide if this constitutes an error or partial success
        isAnalysisComplete.value = highlights.value.length > 0; // Consider complete if highlights exist
        if (!pgnContent.value) await fetchPgnContent(); // Try loading mock PGN if needed
    }
  } catch (err) {
    console.error('Failed to fetch analysis results:', err)
    error.value = err.response?.data?.detail || 'Failed to load analysis results after completion.';
    // Don't set isAnalysisComplete to true here if fetching results failed
  }
}

// --- NEW: Video Task Polling ---
function startVideoPolling() {
    if (videoPollingInterval) return; // Prevent multiple intervals
    if (!videoTaskId.value) {
        console.error('No videoTaskId available for polling.');
        videoLoadingError.value = 'Video Task ID not found.';
        return;
    }
    console.log(`Starting video polling for task ID: ${videoTaskId.value}`);
    isVideoTaskPolling.value = true;
    videoLoadingError.value = null; // Clear previous errors
    videoTaskProgress.value = 0; // Reset progress

    videoPollingInterval = setInterval(async () => {
        try {
            const taskId = typeof videoTaskId.value === 'number' ?
                videoTaskId.value : parseInt(videoTaskId.value);

            const response = await $api.getTaskStatus(taskId);
            const status = response.status;
            console.log(`Video task status: ${status}, progress: ${response.progress}`);

            if (status === 'processing') {
                 videoTaskProgress.value = response.progress !== undefined ? response.progress : Math.min(95, videoTaskProgress.value + 5);
            } else if (status === 'completed') {
                videoTaskProgress.value = 100;
                isVideoTaskPolling.value = false;
                isVideoTaskComplete.value = true;
                stopVideoPolling();
                console.log('Video task complete. Fetching segments...');
                await fetchVideoSegments();
            } else if (status === 'failed') {
                stopVideoPolling();
                videoLoadingError.value = 'Video generation failed';
                isVideoTaskPolling.value = false;
                console.error('Video task failed.');
            }
        } catch (err) {
            console.error('Failed to get video task status:', err);
            stopVideoPolling();
            videoLoadingError.value = 'Error checking video task status';
            isVideoTaskPolling.value = false;
        }
    }, 3000); // Poll every 3 seconds
}

function stopVideoPolling() {
    if (videoPollingInterval) {
        clearInterval(videoPollingInterval);
        videoPollingInterval = null;
        console.log('Stopped video polling.');
    }
}

// --- NEW: Fetch Video Segments ---
async function fetchVideoSegments() {
    videoLoadingError.value = null;
    videoSegments.value = []; // Clear previous segments
    videoObjectUrls.value.forEach(url => URL.revokeObjectURL(url)); // Clean up old URLs
    videoObjectUrls.value = [];

    try {
        console.log(`Fetching segment IDs for game ${gameId.value}`);
        const idsResponse = await $api.getVideoSegmentIds(gameId.value);
        console.log(idsResponse)
        videoSegmentIds.value = idsResponse;
        console.log(`Found segment IDs: ${videoSegmentIds.value}`);

        if (videoSegmentIds.value.length === 0) {
             console.warn('No video segments found after task completion.');
             // No error message needed here, handled by template v-if/else
             return;
        }

        const segmentPromises = videoSegmentIds.value.map(async (segmentId) => {
            try {
                console.log(`Fetching segment ${segmentId}`);
                // Assuming $api.getVideoSegment returns a Blob
                const segmentBlob = await $api.getVideoSegment(gameId.value, segmentId);

                if (!(segmentBlob instanceof Blob)) {
                   console.error(`Segment ${segmentId} response is not a Blob:`, segmentBlob);
                   throw new Error(`Invalid data received for segment ${segmentId}`);
                }
                if (segmentBlob.size === 0) {
                    console.warn(`Segment ${segmentId} is an empty Blob.`);
                    throw new Error(`Empty data received for segment ${segmentId}`);
                }

                const objectURL = URL.createObjectURL(segmentBlob);
                videoObjectUrls.value.push(objectURL); // Keep track for cleanup
                console.log(`Created object URL for segment ${segmentId}: ${objectURL}`);
                return { id: segmentId, url: objectURL, type: segmentBlob.type || 'video/mp4' }; // Store URL and type
            } catch (segErr) {
                console.error(`Failed to fetch or process segment ${segmentId}:`, segErr);
                return { id: segmentId, url: null, error: `Failed to load segment ${segmentId}` };
            }
        });

        const resolvedSegments = await Promise.all(segmentPromises);
        // Filter out segments that failed to load or were empty
        videoSegments.value = resolvedSegments.filter(seg => seg.url);
        console.log('Finished fetching video segments:', videoSegments.value);

        // Report if some segments failed
        const failedSegments = resolvedSegments.filter(seg => seg.error);
        if (failedSegments.length > 0) {
            videoLoadingError.value = `Failed to load ${failedSegments.length} video segment(s). Check console for details.`;
            console.warn('Some video segments failed to load:', failedSegments);
        }

    } catch (err) {
        console.error('Failed to fetch video segment IDs or segments:', err);
        videoLoadingError.value = err.response?.data?.detail || 'Failed to load video segments';
        // Ensure segments array is empty on general failure
         videoSegments.value = [];
    }
}

</script>

<template>
  <div class="game-detail-container">
    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="loader"></div>
      <p>Loading game...</p>
    </div>

    <!-- Critical Error (Game/PGN Load Failed) -->
    <div v-else-if="error && !pgnContent" class="error-message">
      {{ error }}
    </div>

    <!-- Main Content -->
    <template v-else>
      <!-- Game Header -->
      <div class="game-header">
        <div class="game-title-section">
          <h1>{{ game?.title }}</h1>
          <div class="game-meta">
            <span v-if="game?.event" class="event-badge">{{ game.event }}</span>
            <span class="date-badge">{{ formatDate(game?.date) }}</span>
          </div>
        </div>
        <div class="game-actions">
          <NuxtLink to="/games" class="btn btn-secondary">
            Back to Games
          </NuxtLink>
        </div>
      </div>

      <!-- Players Bar -->
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

      <!-- Analysis/Video Error Message (if occurs after game load) -->
       <div v-if="error && pgnContent" class="error-message analysis-error">
         {{ error }}
       </div>

      <!-- Chess Board Component (Always show if PGN is available) -->
      <ChessBoard
          v-if="pgnContent"
          :pgn-content="pgnContent"
          :interesting-moves="highlights"
      />

      <!-- Section BEFORE Analysis is Complete -->
      <div v-if="!isAnalysisComplete && pgnContent" class="analysis-section">
        <!-- Prompt to Start Analysis -->
        <div v-if="!isAnalysisStarted" class="info-message">
          <p>Start analysis to view interesting moves and patterns</p>
        </div>

        <!-- Analysis In Progress -->
        <div v-if="isAnalysisStarted" class="analysis-status">
          <div class="progress-container">
            <div class="progress-bar" :style="{width: `${analysisProgress}%`}"></div>
          </div>
          <span class="progress-text">Analysis in progress: {{ analysisProgress }}%</span>
        </div>

        <!-- Analysis Controls (Start Button, Strategy, Video Checkbox) -->
        <!-- Show only if analysis hasn't started yet -->
        <div v-if="!isAnalysisStarted" class="analysis-controls">
          <!-- Ensure btn and btn-primary classes are applied -->
          <button
            @click="startAnalysis"
            class="btn btn-primary"
            :disabled="analysisLoading"
          >
            {{ analysisLoading ? 'Starting...' : 'Start Analysis' }}
          </button>

          <div class="strategy-selector">
            <label for="strategy">Strategy:</label>
            <select id="strategy" v-model="selectedStrategy">
              <option value="analytics">Analytics</option>
              <option value="project_ai">Native AI</option>
              <option value="third_party_ai">Third Party AI</option>
            </select>
          </div>

          <div class="create-video-checkbox">
            <input type="checkbox" id="createVideo" v-model="createVideo">
            <label for="createVideo">Create Video Highlights</label>
          </div>
        </div>
      </div>

      <!-- Error if PGN Content is unavailable -->
       <div v-else-if="!pgnContent && !loading" class="error-message">
        <p>PGN content unavailable for analysis.</p>
      </div>

      <!-- Section AFTER Analysis is Complete -->
      <div v-if="isAnalysisComplete">
        <!-- Analysis Complete Message (Show only if video wasn't requested or hasn't started polling yet) -->
        <div v-if="!isVideoTaskPolling && !isVideoTaskComplete && !videoTaskId" class="info-message analysis-complete-message">
          Analysis complete. Results are displayed on the board.
        </div>

        <!-- Video Generation Progress -->
        <div v-if="videoTaskId && !isVideoTaskComplete" class="video-status section-box">
          <h4>Video Generation</h4>
          <div v-if="isVideoTaskPolling" class="analysis-status">
            <div class="progress-container">
              <div class="progress-bar video-progress-bar" :style="{width: `${videoTaskProgress}%`}"></div>
            </div>
            <span class="progress-text">Video generation in progress: {{ videoTaskProgress }}%</span>
          </div>
          <div v-if="videoLoadingError && !isVideoTaskComplete" class="error-message video-error">
            {{ videoLoadingError }}
          </div>
          <div v-if="!isVideoTaskPolling && !videoLoadingError && !isVideoTaskComplete" class="info-message">
              Video generation pending...
          </div>
        </div>

        <!-- Video Segments Display -->
        <div v-if="isVideoTaskComplete" class="video-segments-container section-box">
          <h3>Video Highlights</h3>
          <div v-if="videoSegments.length > 0" class="video-grid">
            <div v-for="segment in videoSegments" :key="segment.id" class="video-item">
              <video controls :src="segment.url" :type="segment.type || 'video/mp4'">
                Your browser does not support the video tag. Segment {{ segment.id }}
              </video>
              <p class="segment-id">Highlight {{ segment.id }}</p>
            </div>
          </div>
          <div v-else-if="videoSegmentIds.length === 0 && !videoLoadingError" class="info-message">
              Video generation complete, but no highlight segments were created for this game.
          </div>
          <div v-if="videoLoadingError" class="error-message video-error">
            {{ videoLoadingError }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* --- Existing Styles (ensure they are present) --- */
.game-detail-container {
  width: 100%;
  max-width: 1200px; /* Example max width */
  margin: 0 auto;
  padding: 20px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #666;
  min-height: 300px; /* Ensure space while loading */
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
  color: #c62828; /* Darker red for better contrast */
  padding: 16px;
  border-radius: 4px;
  margin: 16px 0; /* Consistent margin */
  border: 1px solid #f44336;
}
.error-message.analysis-error, .error-message.video-error {
    margin-top: 20px; /* Space below board/previous section */
}


.info-message {
  background-color: #e8f5e9;
  color: #2e7d32; /* Darker green */
  padding: 16px;
  border-radius: 4px;
  margin: 16px 0;
  text-align: center;
  border: 1px solid #a5d6a7;
}
.info-message.analysis-complete-message {
    background-color: #e3f2fd; /* Light blue for completion notice */
    color: #1565c0;
    border-color: #90caf9;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.game-title-section h1 {
  font-size: 28px;
  color: #333;
  margin: 0 0 8px 0;
}

.game-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.event-badge, .date-badge {
  background-color: #f1f1f1;
  color: #666;
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 16px;
  white-space: nowrap;
}

.game-actions .btn {
  padding: 8px 16px;
  text-decoration: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
  border: none;
}
.btn-secondary:hover {
  background-color: #5a6268;
}
.btn-primary {
  background-color: #007bff;
  color: white;
  border: none;
}
.btn-primary:hover {
    background-color: #0056b3;
}
.btn:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
}


.players-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #f8f9fa;
  padding: 12px 20px;
  border-radius: 4px;
  margin-bottom: 24px;
  font-size: 16px;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
.player-piece {
  font-size: 20px;
}
.player-info.white .player-piece { color: #555; }
.player-info.black .player-piece { color: #333; }
.vs-divider {
  font-weight: bold;
  color: #adb5bd;
}

/* Analysis & Video Section Styling */
.analysis-section, .video-status, .video-segments-container {
    margin-top: 24px;
    padding: 16px;
    background-color: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
}
.section-box h3, .section-box h4 {
    margin-top: 0;
    margin-bottom: 16px;
    color: #333;
    padding-bottom: 8px;
    border-bottom: 1px solid #eee;
}


.analysis-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
  flex-wrap: wrap;
}
.strategy-selector, .create-video-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
}
.strategy-selector label, .create-video-checkbox label {
    font-size: 14px;
    color: #555;
}
.strategy-selector select, .create-video-checkbox input {
    padding: 6px 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
}
.create-video-checkbox input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
}


.analysis-status {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.progress-container {
  width: 80%; /* Or a fixed width */
  max-width: 400px;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  height: 12px; /* Slightly thicker */
  margin-bottom: 8px;
}
.progress-bar {
  height: 100%;
  background-color: #4CAF50; /* Default green for analysis */
  transition: width 0.3s ease-in-out;
  border-radius: 4px 0 0 4px; /* Rounded only on the left */
  text-align: center;
  color: white;
  font-size: 10px;
  line-height: 12px;
}
.progress-text {
  font-size: 14px;
  color: #333;
}

/* --- NEW Styles for Video --- */
.video-progress-bar {
  background-color: #2196F3; /* Blue for video progress */
}

.video-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20px; /* Spacing between videos */
  margin-top: 16px;
}

.video-item {
  flex: 1 1 calc(33.333% - 20px); /* Aim for 3 items per row, adjusting for gap */
  min-width: 280px; /* Minimum width for smaller screens/wrapping */
  max-width: calc(33.333% - 20px); /* Prevent growing beyond 1/3 */
  box-sizing: border-box; /* Include padding/border in width calculation */
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #f9f9f9;
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.video-item video {
  width: 100%; /* Make video fill its container */
  max-width: 100%;
  height: auto; /* Maintain aspect ratio */
  border-radius: 4px;
  display: block; /* Remove extra space below video */
  background-color: #000; /* Background for potential letterboxing */
}

.video-item .segment-id {
    font-size: 0.9em;
    color: #555;
    margin-top: 8px;
    text-align: center;
}

/* Responsive adjustments if needed */
@media (max-width: 992px) {
    .video-item {
        flex-basis: calc(50% - 20px); /* 2 items per row */
         max-width: calc(50% - 20px);
    }
}
@media (max-width: 600px) {
    .video-item {
        flex-basis: 100%; /* 1 item per row */
         max-width: 100%;
    }
    .players-bar {
        flex-direction: column;
        gap: 10px;
    }
     .analysis-controls {
        flex-direction: column;
        align-items: stretch; /* Make controls full width */
    }
    .strategy-selector, .create-video-checkbox {
        justify-content: space-between; /* Better alignment on small screens */
    }
}

</style>