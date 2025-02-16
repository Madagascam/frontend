<template>
  <div>
    <h1>Welcome to the Madagascam App</h1>
    <p>{{ message }}</p>
  </div>
</template>

<script setup>
const message = ref('Loading...')

onMounted(async () => {
  try {
    const response = await fetch('http://localhost:8000/api/hello')
    const data = await response.json()
    message.value = data.message
  } catch (error) {
    console.error('Error:', error)
    message.value = 'Error loading message'
  }
})
</script>
