import { initializeApp, getApps, getApp } from "firebase-admin/app";

const app = getApps().length ? getApp() : initializeApp();

export default app;
