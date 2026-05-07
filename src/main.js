import { createApp } from "vue";
import { registerSW } from "virtual:pwa-register";
import App from "./App.vue";
import router from "./router";
import "./fonts.css";
import "./style.css";

createApp(App).use(router).mount("#app");

// Register the service worker for PWA install/offline support.
registerSW({ immediate: true });
