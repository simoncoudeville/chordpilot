import { createRouter, createWebHistory } from "vue-router";
import { h } from "vue";

const RouteStub = { render: () => h("div") };

const routes = [
  {
    path: "/",
    name: "list",
    component: RouteStub,
  },
  {
    path: "/board/:boardId",
    name: "board",
    component: RouteStub,
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
