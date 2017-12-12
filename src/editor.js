import "./stylesheets/main.css";

import Vue from 'vue-alias';
import jetpack from 'fs-jetpack';
import createWindow from "./helpers/window";
import path from "path";
import url from "url";

const electron = require('electron');
const BrowserWindow = electron.remote.BrowserWindow;
const app = electron.remote.app;
const appDir = jetpack.cwd(app.getAppPath());
const ipcRenderer = electron.ipcRenderer;

var editorApp = new Vue({
    el: '#editor',
    data: {
    }
})