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
const NEW_PAGE_INDICATOR = '---';
const REGION2_INDICATOR = '+';

var controlApp = new Vue({
    el: '#control',
    data: {
        worshipSets: ["a", "b", "c"],
        selectedSet: "a",
        worshipItems: [],
        selectedItem: "a",
        verses: {},
        versePages: [],
        selectedVerse: 0,
        isBlank: false,
        presentationWindow: null,
        editWindow: null,
        current_song_order : '',
        current_song_text : '',
        current_display_title : '',
        current_song_author : '',
        current_song_copyright : '',
        REGION2_INDICATOR: REGION2_INDICATOR
    },
    watch: {
        selectedVerse: function(val, oldVal) {
            // this.selectVerse();
        }
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
        saveSet: function() {
            console.log("Saving set now...");
            var setpath = 'userdata/sets'; // TODO: Load setpath
            if (!appDir.exists(setpath)) {
                prompts.alert(window,"Invalid worship set path!","You must configure a valid worship set path in Configuration before you can save song sets!");
                //console.log('No worship set path!');
                return false;
            }
            var setlist = document.getElementById('worship_sets_list');
            var setname = this.selectedSet;
            if (setname == "")
            {
                prompts.alert(window,"Set title must be set","You must select a worship set name before you can save worship sets.");
                //console.log('No set name!');
                return false;
            }
            
            var set_text = this.worshipItems.join('\n');
            console.log("Set Saving - Text for saving:", set_text);
            
            // appDir.write(`${setpath}/${setname}.txt`, set_text);
            
            // NetUtil.asyncCopy(istream, ostream, function(status) {
            //     //console.log("Save status: "+status);
            //     if (!Components.isSuccessCode(status)) {
            //         prompts.alert(window,'Worship Slides: Error saving set','Error saving worship set!');
            //         return;
            //     }
            // });
            return false;
        },
        removeItem: function(event) {
            var index = this.worshipItems.indexOf(this.selectedItem);
            if (index > -1) {
                this.worshipItems.splice(index, 1);
                this.saveSet();
                if (index > 0) {
                    this.selectedItem = this.worshipItems[index-1];
                } else if (this.worshipItems.length > 0) {
                    this.selectedItem = index;
                }
            }
            this.selectItem(event);
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
                // this.toggleBlank();
                console.log('File not found');
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
            console.log('Selecting verse:', this.selectedVerse, this.versePages[this.selectedVerse]);
            this.updatePresentation({
                content: this.versePages[this.selectedVerse],
                author: this.current_song_author,
                title: this.current_display_title
            });
        },
        openPresentationWindow: function(event) {
            if(!this.presentationWindow) {
                this.presentationWindow = new BrowserWindow({
                    width: 1000,
                    height: 600,
                    show: false
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
                this.presentationWindow.once('ready-to-show', () => {
                    this.selectVerse();
                    this.presentationWindow.show();
                });
            } else {
                this.presentationWindow.show();
            }
        },
        openEditWindow: function(event) {
            if(!this.editWindow) {
                this.editWindow = new BrowserWindow({
                    width: 1000,
                    height: 600,
                    show: false
                  });
                this.editWindow.on('closed', () => {
                    this.editWindow = null
                })
        
                this.editWindow.loadURL(
                    url.format({
                        pathname: path.join(__dirname, "edit.html"),
                        protocol: "file:",
                        slashes: true
                    })
                );
                this.editWindow.once('ready-to-show', () => {
                    // Load a song or a text
                    this.editWindow.show();
                });
            } else {
                this.editWindow.show();
            }
        },
        toggleBlank: function() {
            console.log('Show blank');
            this.isBlank = !this.isBlank;
            if(this.presentationWindow) {
                this.presentationWindow.webContents.send('toggle-blank-presentation', this.isBlank);
            } else {
                console.log('No presentation window found, cannot blank out the presentation.')
            }
            // TODO: Do an overlay instead of emptying the text.
        },
        updatePresentation: function(data) {
            if(this.presentationWindow) {
                this.presentationWindow.webContents.send('update-presentation', data);
            } else {
                console.log('No presentation window found, cannot update presentation.')
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
                        if (line.match("^\\s*$")) // Checking for blank/empty lines
                        {
                            if (verse_text.length > 0 ) // Check if it has some content // (verse_text.lastChild) // && verse_text.lastChild.tagName != 'br')
                            {
                                verse_text.push(NEW_PAGE_INDICATOR);
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
            var versePages = [];
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
                        var newVersePages = this.transformVerse(index, verses);
                        if(newVersePages) {
                            versePages = versePages.concat(newVersePages);
                        }
                    }
                }
            // If no order is set, just print the verses by their order in the file
            } else {
                for (var index in verses) {
                    var newVersePages = this.transformVerse(index, verses);
                    if(newVersePages) {
                        versePages = versePages.concat(newVersePages);
                    }
                }
            }
            this.verses = verses; // Update the verses
            // console.log('verses', verses);
            this.versePages = versePages; 
            console.log('versepages', versePages);
            this.selectedVerse = 0; // Update the selectedVerse
            this.selectVerse(); // Call the selectVerse method which updates the view (if there is one)
            //transformed = transformed.replace(empty_verses_regexp,'');
            // return transformed;
        },
        transformVerse : function( index, verses ) { 
            
            if (index.slice(-8) == '_region2') return; // We don't deal with region2 verses, as they'll be dealt with in the original verse

            var verse = verses[index];

            var versePages = [];
            var versePage = {
                key: '',
                lines: []
            }; // A page of a verse, there's a new page after an empty line.
            var pageCounter = 0;
            var pageSuffix = 'abcdefghijklmnopqrstuvwxyz';
            
            if (!verses[index+'_region2']) { // There's no region 2 defined for the text
                for (var j = 0; j < verse.length; j++) {
                    var line = verse[j];
                    if (line != NEW_PAGE_INDICATOR) {
                        versePage.lines.push( line );
                    } else if (versePage.lines.length > 0) {
                        var key = index;
                        if(pageCounter > 0) {
                            key += pageSuffix[pageCounter]
                        }
                        versePage.key = key;
                        versePages.push(versePage);
                        pageCounter++;
                        versePage = { key: '', lines: [] }; // Prepare for a new page
                    }
                }
            } else {
                var region2 = verses[index+'_region2'];
                var reg1_part = 0;
                var reg2_part = 0;
                var failsafe = 0;
                while (reg1_part < verse.length || reg2_part < region2.length)
                {
                    if (failsafe++ > verse.childNodes + region2.childNodes)
                    break;
                    if (verse[reg1_part] && verse[reg1_part] !== NEW_PAGE_INDICATOR) {
                        versePage.lines.push( verse[reg1_part] );
                        reg1_part++;
                    }
                    if (region2[reg2_part] && region2[reg2_part] !== NEW_PAGE_INDICATOR) {
                        versePage.lines.push( REGION2_INDICATOR + region2[reg2_part] );
                        reg2_part++;
                    }
                    if ((!verse[reg1_part] || verse[reg1_part] === NEW_PAGE_INDICATOR) &&
                    (!region2[reg2_part] || region2[reg2_part] === NEW_PAGE_INDICATOR)) {
                        var key = index;
                        if(pageCounter > 0) {
                            key += pageSuffix[pageCounter]
                        }
                        versePage.key = key;
                        versePages.push(versePage);
                        pageCounter++;
                        versePage = { key: '', lines: [] }; // Prepare for a new page
                        reg1_part++;
                        reg2_part++;
                    }
                }
            }
            if (versePage.lines.length > 0) {
                versePage.key = index;
                versePages.push(versePage);
            }
            console.log('Transform Verse:', versePages);
            return versePages;
        }
    },
    beforeMount: function() {
        this.loadSets();
    }
})

// ipcRenderer.on('file-updated', function (event, filename) {
//     console.log('Song has been updated:', data);
//     if(filename) {
//         if(filename == selectedItem) {
//             selectItem(); // Triggers reload of data.
//         }
//     }
// });