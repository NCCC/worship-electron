import "./stylesheets/main.css";

import Vue from 'vue-alias';
import jetpack from 'fs-jetpack';
import createWindow from "./helpers/window";
import path from "path";
import url from "url";

const electron = window.require('electron');
const BrowserWindow = electron.remote.BrowserWindow;
const app = electron.remote.app;
const appDir = jetpack.cwd(app.getAppPath());

var song_order_regexp = /# *Order: *([0-9,a-z]+)/;
var song_title_regexp = /# *Title: *(.+)/;
var song_author_regexp = /# *Author: *(.+)/;
var song_copyright_regexp = /# *Copyright: *(.+)/;
var song_verse_regexp = /^\[(.+)\]$/;
var empty_verses_regexp = /<p class="listitem">\s*<\/p>/g;
var verse_map = {
	c: 'chorus',
	t: 'chorus 2',
	p: 'prechorus',
	b: 'bridge',
	w: 'bridge 2',
	e: 'ending'
};  

var controlApp = new Vue({
    el: '#control',
    data: {
        worshipSets: ["a", "b", "c"],
        selectedSet: "a",
        worshipItems: [],
        selectedItem: "a",
        verses: {},
        selectedVerse: "",
        presentationWindow: null,
        current_song_order : '',
        current_song_text : '',
        current_display_title : '',
        current_song_author : '',
        current_song_copyright : ''
    },
    methods: {
        loadSets: function() {
            var setpath = 'userdata/sets';
            var fileList = appDir.list(setpath);
            if(fileList) {
                this.worshipSets = fileList.filter( x => x.slice(-4) == '.txt' )
                                           .map( x => x.slice(0, -4) );
                this.selectedSet = this.worshipSets[0]; // TODO: Retrieve from cache
                this.selectSet();
            }
            console.log('Setlist loaded.');
        },
        selectSet: function(event) {
            var setname = this.selectedSet;
            console.log('Selecting set:', setname);
            var setfile = appDir.read('userdata/sets/' + setname + '.txt');
            // console.log('Set: ', setfile);
            if(setfile) {
                var data = setfile;
                var worship_items = document.getElementById('worship_items');
                //     while (worship_items.hasChildNodes())
                //       worship_items.removeItemAt(0);
                if (data) {
                    var lines = data.split(/\r?\n/);
                    this.worshipItems = lines.filter(x => x !== '');
                }
                this.selectedItem = this.worshipItems[0]; // TODO: Retrieve from cache                
                this.selectItem();
            }
        },
        selectItem: function(event) {
            console.log('Selecting item:', this.selectedItem);
            var name = this.selectedItem;
            if (this.isSong(name)) {
                this.processLyrics( name );
            } else if (this.isText(name)) {
                this.processText( name );
            } else {
                // Empty the worship lyrics
                this.showBlank();
            }
        },
        isSong: function( songname ) {
            // TODO: Config songs-path
            return appDir.exists('userdata/songs/' + songname + '.txt');
        },
        isText: function( textname ) {
            // TODO: Config text-path
            return appDir.exists('userdata/texts/' + textname + '.txt');
        },
        processLyrics : function( songname ) {
            // TODO: Config songs-path
            var data = appDir.read('userdata/songs/' + songname + '.txt');
            this.current_display_title = songname;
            this.transformSong(data);
            // var worship_lyrics = document.getElementById('worship_lyrics');
            // worship_lyrics.selectedIndex = 0;

            // WorshipSlides.MainWindow.checkExport(); // What's this?
        },
        processText : function( textname ) {
            var data = appDir.read('userdata/texts/' + textname + '.txt');
            this.current_display_title = textname;
            this.transformSong(data);
        },
        selectVerse: function() {
            console.log('Selecting verse:', this.selectedVerse);
        },
        openPresentationWindow: function(event) {
            if(!this.presentationWindow) {
                this.presentationWindow = new BrowserWindow({
                    width: 1000,
                    height: 600
                  });
                this.presentationWindow.on('closed', () => {
                    this.presentationWindow = null
                })
        
                this.presentationWindow.loadURL(
                    url.format({
                        pathname: path.join(__dirname, "presentation.html"),
                        protocol: "file:",
                        slashes: true
                    })
                );   

            } else {
                this.presentationWindow.show();
            }
        },
        showBlank: function() {
            console.log('Show blank');
            if(this.presentationWindow) {
                this.presentationWindow.webContents.send('update-presentation', {});
            }
        },
        transformSong: function(data) {
            var lines = data.split(/\r?\n/);
            var verses = {};
            var current_verse = 1;
            var verse_text = [];
            var order = null;

            this.current_song_order = '';
            this.current_song_text = '';
            this.current_song_author = '';
            this.current_song_copyright = '';
            //this.current_display_title = '';
            
            // First we get all the verses from the text
            for (index = 0; index < lines.length; index++) {
                var line = lines[index];
                if (line.substr(0,1) == "#") {
                    var matches = song_order_regexp.exec(line);
                    if (matches) {
                        this.current_song_order = matches[1];
                        order = matches[1].split(',');
                    }
                    else if ((matches = song_title_regexp.exec(line)))
                        this.current_display_title = matches[1];
                    else if ((matches = song_author_regexp.exec(line)))
                        this.current_song_author = matches[1];
                    else if ((matches = song_copyright_regexp.exec(line)))
                        this.current_song_copyright = matches[1];
                    else if (line.substring(0,1) != '#')
                        this.current_song_text += line+"\n";
                } else {
                    if (line || this.current_song_text != '')
                        this.current_song_text += line+"\n";
                    if ((matches = song_verse_regexp.exec(line))) { // New verse detected
                        if (verse_text.length > 0)
                            verses[current_verse] = verse_text;
                        if (matches[1] != 'region 2')
                            current_verse = matches[1];
                        else
                            current_verse += '_region2';
                        verse_text = []; // Creating a new element, after the old one was assigned
                    } else {
                        if (line.match("^\\s*$")) // Not sure what this is checking for...
                        {
                            if (verse_text.lastChild) // && verse_text.lastChild.tagName != 'br')
                            {
                                verse_text.push('---');
                            // verse_text.appendChild( document.createElementNS('http://www.w3.org/1999/xhtml','hr') );
                            }
                        } else {
                            verse_text.push(line);
                            // verse_text.appendChild( document.createTextNode(line) );
                            // verse_text.appendChild( document.createElementNS('http://www.w3.org/1999/xhtml','br') );
                        }
                    }
                }
            } // End of for-loop
            
            // Save any unsaved verses here
            if (current_verse != null)
                verses[current_verse] = verse_text;
            else if (verse_text.length > 0)
                verses[verse_num] = verse_text;
            
            // Strip away last newline
            if (this.current_song_text.slice(-1) == "\n")
                this.current_song_text = this.current_song_text.slice(0,-1);
            
            // Then, if an order is set, add the verses in the order decided
            var transformed = '';
            if (order) {
                for (var index in order) {
                    //console.log('Index is '+index);
                    var verse_num = order[index];
                    //console.log('Verse num is '+verse_num);
                    if (parseInt(verse_num) == verse_num) {
                        index = verse_num;
                    } else { 
                        index = verse_map[verse_num]; 
                    }
                    if (verses[index]) { 
                        // this._transform_verse(index, verses);
                    }
                }
                // If no order is set, just print the verses by their order in the file
            } else {
                for (var index in verses) {
                    // this._transform_verse(index, verses,);
                }
            }
            this.verses = verses;
            this.selectedVerse = Object.keys(verses)[0];
            this.selectVerse();
            //transformed = transformed.replace(empty_verses_regexp,'');
            // return transformed;
        },
        _transform_verse : function( index, verses ) { // Maybe deprecated, since this is mostly generating markup
            if (index.slice(-8) == '_region2')
            return;
            var verse = verses[index].cloneNode(true);
            var item = document.createElement('richlistitem');
            item.setAttribute('orient','vertical');
            var verse_num = document.createElement('description');
            verse_num.setAttribute('class','identifier');
            if (parseInt(index) == index) {
                var span = document.createElement('span');
                span.setAttribute('class','underline');
                span.appendChild( document.createTextNode(index) );
                verse_num.appendChild( document.createTextNode('Verse ') );
                verse_num.appendChild( span );
                verse_num.appendChild( document.createTextNode(':') );
            } else {
                verse_num.appendChild( document.createTextNode( index.charAt(0).toUpperCase() + index.slice(1) + ':')  );
            } 
            item.appendChild(verse_num);
            var desc = document.createElement('description');
            
            if (!verses[index+'_region2']) {
                for (var index = 0; index < verse.childNodes.length; index++) {
                    var child = verse.childNodes[index];
                    if (child.tagName != 'hr')
                    desc.appendChild( child.cloneNode(true) );
                    else if (desc.hasChildNodes()) {
                    item.appendChild( desc );
                    listbox.appendChild( item );
                    item = document.createElement('richlistitem');
                    desc = document.createElement('description');
                    }
                }
            } else {
            
            var region2_size;
            try {
                region2_size = WorshipSlides.MainWindow.getIntPref('region2_size');
            } catch (error) {}
            if (!region2_size)
                region2_size = 100;
                
            var region2 = verses[index+'_region2'];
            var reg1_part = 0;
            var reg2_part = 0;
            var failsafe = 0;
            while (reg1_part < verse.childNodes.length || reg2_part < region2.childNodes.length)
            {
                if (failsafe++ > verse.childNodes + region2.childNodes)
                break;
                if (verse.childNodes[reg1_part] && verse.childNodes[reg1_part].tagName != 'br' && verse.childNodes[reg1_part].tagName != 'hr') {
                desc.appendChild( verse.childNodes[reg1_part].cloneNode(true) );
                desc.appendChild( document.createElementNS('http://www.w3.org/1999/xhtml','br') );
                reg1_part++;
                }
                if (region2.childNodes[reg2_part] && region2.childNodes[reg2_part].tagName != 'br' && region2.childNodes[reg2_part].tagName != 'hr') {
                var span = document.createElement('span');
                span.setAttribute('style','font-size: '+region2_size+'%;');
                span.appendChild( region2.childNodes[reg2_part].cloneNode(true) );
                desc.appendChild( span );
                desc.appendChild( document.createElementNS('http://www.w3.org/1999/xhtml','br') );
                reg2_part++;
                }
                if (verse.childNodes[reg1_part] && verse.childNodes[reg1_part].tagName == 'br')
                reg1_part++;
                if (region2.childNodes[reg2_part] && region2.childNodes[reg2_part].tagName == 'br')
                reg2_part++;
                if ((!verse.childNodes[reg1_part] || verse.childNodes[reg1_part].tagName == 'hr') &&
                (!region2.childNodes[reg2_part] || region2.childNodes[reg2_part].tagName == 'hr')) {
                item.appendChild( desc );
                listbox.appendChild( item );
                item = document.createElement('richlistitem');
                desc = document.createElement('description');
                reg1_part++;
                reg2_part++;
                }
            }
            }
            if (desc.hasChildNodes()) {
                item.appendChild( desc );
                listbox.appendChild( item );
                item = document.createElement('richlistitem');
                desc = document.createElement('description');
            }
        }
    },
    beforeMount: function() {
        this.loadSets();
    }
})