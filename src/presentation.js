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
const minFontSize = 12;

var presentationApp = new Vue({
    el: '#presentation',
    data: {
        content: ['content-placeholder'],
        title: 'title-placeholder',
        author: 'author-placeholder',
        isBlank: false,
        REGION2_INDICATOR: '+'
    },
    updated: function() {
        // After a data change causes DOM to update, fit the text to the container
        this.fitText();
    },
    methods: {
        fitText: function() {
            // this.el.style.setPropterty
            const content = this.$el.childNodes[0];
            function resizeText() {
                content.style.setProperty('--font-size', `${fontSize--}px`);
            }
            let fontSize = 72; //parseInt( getComputedStyle(content).getPropertyValue('--font-size').slice(0, -2) );
            resizeText();
            console.log('Font Size started at: ', fontSize, content.scrollHeight, content.offsetHeight);
            while(content.scrollHeight > content.offsetHeight && fontSize > minFontSize && fontSize < 200) {
                console.log(content.scrollHeight, content.offsetHeight);    
                resizeText();
            }
        }
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
