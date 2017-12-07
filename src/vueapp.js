import Vue from 'vuea';
import jetpack from 'fs-jetpack';
import createWindow from "./helpers/window";
import path from "path";
import url from "url";

const electron = window.require('electron');
const BrowserWindow = electron.remote.BrowserWindow;
const app = electron.remote.app;
const appDir = jetpack.cwd(app.getAppPath());

var vueapp = new Vue({
    el: '#app',
    data: {
        message: 'Hey man',
        worshipSets: ["a", "b", "c"],
        selectedSet: "a",
        worshipItems: [],
        selectedItem: "a",
        lyricsWindow: null
    },
    methods: {
        loadSets: function() {
            var setpath = 'userdata/sets';
            var fileList = appDir.list(setpath);
            if(fileList) {
                this.worshipSets = fileList.filter( x => x.slice(-4) == '.txt' )
                                           .map( x => x.slice(0, -4) );
            }
            console.log('Setlist: ', this.worshipSets);
        },
        selectSet: function(event) {
            console.log('Set selected.', event.target.value, this.selectedSet);
            var setname = this.selectedSet;
            var setfile = appDir.read('userdata/sets/' + setname + '.txt');
            console.log('Set: ', setfile);
            if(setfile) {
                var data = setfile;
                var worship_items = document.getElementById('worship_items');
                //     while (worship_items.hasChildNodes())
                //       worship_items.removeItemAt(0);
                if (data) {
                    var lines = data.split(/\r?\n/);
                    this.worshipItems = lines.filter(x => x !== '');
                }
            }
        },
        selectItem: function(event) {
            console.log('Item selected', this.selectedItem);
        },
        itemSelected : function(event) {
            var name = this.selectedItem;
            if (this.isSong(name)) {
                WorshipSlides.MainWindow.showLyrics( name );
            } else if (this.isText(name)) {
                WorshipSlides.MainWindow.showText( name );
            } else {
                // Empty the worship lyrics
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
        showLyrics : function( songname ) {
            
            WorshipSlides.MainWindow.current_display_title = songname;
            WorshipSlides.MainWindow._transform_song( data, document.getElementById('worship_lyrics') );
            var worship_lyrics = document.getElementById('worship_lyrics');
            worship_lyrics.selectedIndex = 0;
            WorshipSlides.MainWindow.checkExport();
        },
        showText : function( textname ) {
            var textpath = WorshipSlides.MainWindow.getPref('textpath');
            var textFile = new FileUtils.File(textpath);
            textFile.append( textname+'.txt' );
            if (textFile.exists() && textFile.isFile())
            {
            NetUtil.asyncFetch(textFile, function(inputStream, status) {
                if (!Components.isSuccessCode(status)) {
                prompts.alert(window,'Error reading text file!','An error occured while trying to read the selected file. Maybe it was deleted? Try refreshing this page.');
                return;
                }
                var data = NetUtil.readInputStreamToString(inputStream, inputStream.available(), {charset : 'UTF-8'} );
                WorshipSlides.MainWindow.current_display_title = textname;
                WorshipSlides.MainWindow._transform_song( data, document.getElementById('worship_lyrics') );
                var worship_lyrics = document.getElementById('worship_lyrics');
                worship_lyrics.selectedIndex = 0;
                WorshipSlides.MainWindow.checkExport();
            });
            }
        },
        openLyricsWindow: function(event) {
            console.log('Open lyrics', event, path.join(__dirname, "lyrics.html"));
            if(!this.lyricsWindow) {
                this.lyricsWindow = new BrowserWindow({
                    width: 1000,
                    height: 600
                  });
                this.lyricsWindow.on('closed', () => {
                    this.lyricsWindow = null
                })
        
                this.lyricsWindow.loadURL(
                    url.format({
                        pathname: path.join(__dirname, "lyrics.html"),
                        protocol: "file:",
                        slashes: true
                    })
                );   
                
            } else {
                this.lyricsWindow.show();
            }
        }
    },
    beforeMount: function() {
        this.loadSets();
    }
})