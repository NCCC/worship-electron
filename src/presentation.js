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
        content: ['content-placeholder'],
        title: 'title-placeholder',
        author: 'author-placeholder',
        isBlank: false
    }
})

ipcRenderer.on('update-presentation', function (event, data) {
    console.log('Updating presentation:', data);
    if(data) {
        if(data.hasOwnProperty('content')) presentationApp.content = data.content;
        if(data.hasOwnProperty('title')) presentationApp.title = data.title;
        if(data.hasOwnProperty('author')) presentationApp.author = data.author;
    }
});

ipcRenderer.on('toggle-blank-presentation', function (event, value) {
    console.log('Blanking out presentation:', value);
    presentationApp.isBlank = value;
});
