import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    server: {
        host: true,
        port: 3000,
        allowedHosts: [
            // Allow all ngrok-free.app subdomains
            // /.ngrok-free\.app$/
            'e2dd09b86534.ngrok-free.app'
        ]
    }
})