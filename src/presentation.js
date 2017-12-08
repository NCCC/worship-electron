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

var presentationApp = new Vue({
    el: '#presentation',
    data: {
        content: 'content-placeholder',
        title: 'title-placeholder',
        author: 'author-placeholder'
    }
})

ipcRenderer.on('update-presentation', function (data) {
    console.log(data);
    if(data) {
        presentationApp.content = data.content || '';
        presentationApp.title = data.title || '';
        presentationApp.author = data.author || '';
    }
});