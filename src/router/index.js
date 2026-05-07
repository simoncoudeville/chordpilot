import { createRouter, createWebHistory } from "vue-router";
import BoardListRoute from "../views/BoardListRoute.vue";
import BoardDetailRoute from "../views/BoardDetailRoute.vue";

const routes = [
  {
    path: "/",
    name: "list",
    component: BoardListRoute,
  },
  {
    path: "/board/:boardId",
    name: "board",
    component: BoardDetailRoute,
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/",
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
