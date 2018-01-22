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

var editApp = new Vue({
    el: '#edit',
    data: {
        songname: '',
        oldSongname: '',
        songPath: '',
    },
    methods: {
        saveSong: function(event) {
        //   var items_el = window.opener.document.getElementById('worship_items');
          var songpath = this.songpath; //WorshipSlides.MainWindow.getPref('songpath');
        //   var songFile = new FileUtils.File(songpath);
        //   if (!songFile.exists() || !songFile.isWritable())
        //   {
        //     prompts.alert(window,"Invalid song path!","You must set a valid song path in Configuration before you can add songs!");
        //     return false;
        //   }
          if (this.songname == "")
          {
            alert("You must add a song title before you can save the song.");
            return false;
          }
          
          // If name was changed, rename the old file
        //   var oldSongname = WorshipSlides.EditSongWindow.song_last_title;
          //if (oldSongFile.exists() && oldSongFile.toLowerCase() != songFile.toLowerCase())
          if ( this.oldSongname != "" && this.oldSongname != this.songname)
          {
            try {
              appDir.rename(this.oldSongname + '.txt', this.songname + '.txt' );
            } catch (err) {
              prompts.alert(window,"Error while renaming song.","An error occured when trying to rename this song. Maybe the song already exists?");
              return false;
            }
            // Saving worked! Update "last song name" to current name.
            this.oldSongname = songname;
            // Also change the item in the list to the new name
            for (var index = 0; index < items_el.itemCount; index++)
              if (items_el.getItemAtIndex(index).label == oldSongname)
                items_el.getItemAtIndex(index).label = songname;
            window.opener.WorshipSlides.MainWindow.saveSet();
          }
          else songFile.append( songname+'.txt' );
          
          // If this is a new file, add it to the worship items list
          if (!songFile.exists()) {
            items_el.appendItem( songname );
            window.opener.WorshipSlides.MainWindow.saveSet();
          }
      
          var ostream = FileUtils.openAtomicFileOutputStream( songFile, FileUtils.MODE_CREATE | FileUtils.MODE_WRONLY );
          var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
                    createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
          converter.charset = "UTF-8";
          console.log('fileutils initiated');
          
          var song_text_el = document.getElementById('worship_song_text');
          var song_order_el = document.getElementById('worship_song_order');
          var song_display_el = document.getElementById('worship_display_title');
          var song_author_el = document.getElementById('worship_song_author');
          var song_copyright_el = document.getElementById('worship_song_copyright');
          var song_text = '# Order: '+song_order_el.value+"\r\n";
          if (song_display_el.value != '')
            song_text += '# Title: '+song_display_el.value+"\r\n";
          if (song_author_el.value != '')
            song_text += '# Author: '+song_author_el.value+"\r\n";
          if (song_copyright_el.value != '')
            song_text += '# Copyright: '+song_copyright_el.value+"\r\n";
          song_text += song_text_el.value;
          var istream = converter.convertToInputStream(song_text);
          console.log('finished building song');
      
          NetUtil.asyncCopy(istream, ostream, function(status) {
            if (!Components.isSuccessCode(status)) {
              prompts.alert(window,'Worship Slides: Error saving','Error saving song.');
              return;
            }
            prompts.alert(window,'Worship Slides: Saved successfully','Song has been saved.');
            WorshipSlides.EditSongWindow.edited = false;
            window.opener.WorshipSlides.MainWindow.showLyrics(songname);
            WorshipSlides.EditSongWindow.song_last_title = songname;
          });
          console.log('asyncCopy started');
          
          return false;
        },
        addSection : function(type) {
            var song_text_el = document.getElementById('worship_song_text');
            var text_before = song_text_el.value.substr(0, song_text_el.selectionStart);
            var text_after = song_text_el.value.substr(song_text_el.selectionStart);
            var insert = '';
            switch (type) {
                case 'verse':
                    var num = 1;
                    while (song_text_el.value.indexOf('['+num+']') > -1)
                    num++;
                    insert = '['+num+']\n';
                    break;
                case 'chorus':
                    if (song_text_el.value.indexOf('[chorus]') == -1)
                    insert = '[chorus]\n';
                    else insert = '[chorus 2]\n';
                    break;
                case 'bridge':
                    if (song_text_el.value.indexOf('[bridge]') == -1)
                    insert = '[bridge]\n';
                    else insert = '[bridge 2]\n';
                    break;
                default:
                    insert = '['+type+']\n';
            }
            var pos = song_text_el.selectionStart + insert.length;
            song_text_el.value = text_before + insert + text_after;
            song_text_el.selectionStart = pos;
            song_text_el.selectionEnd = pos;
            song_text_el.focus();
        },
        addOrder : function(type) { // TODO: Test and fix
          var song_order_el = document.getElementById('worship_song_order');
          if (song_order_el.value.trim().length != 0 && song_order_el.value.trim().substr(-1) != ',')
            song_order_el.value += ',';
          song_order_el.value += type;
          WorshipSlides.EditSongWindow.updatePreview(null);
        },
        searchSongInfo : function() { // TODO: Test and fix
          var song_text_el = document.getElementById('worship_song_text');
          var lines = song_text_el.value.split('\n');
          var counter = 0;
          var search_string = '';
          for (var line_index = 0; line_index < lines.length; line_index++) {
            if (lines[line_index].substr(0,1) != '[') {
              search_string += lines[line_index]+' ';
              counter++;
              if (counter > 3)
                break;
            }
          }
          this.search_window = window.open(
            'http://us.search.ccli.com/search/results?SearchText='+encodeURI(search_string),
            'ccli_search_window' );
        },
        fetchSongInfo : function() { // TODO: Test and fix
          console.debug(this.search_window);
          if (this.search_window && !this.search_window.closed) {
            var authors_result = (/Authors<\/h4>\n(.+)/m).exec(this.search_window.document.body.innerHTML);
            var copyright_result = (/Copyrights<\/h4>\n.+(\d{4}[^(&]+)/m).exec(this.search_window.document.body.innerHTML);
            console.log("Search for authors: "+authors_result);
            console.log("Search for copyright: "+copyright_result);
            var authors = '', copyright = '';
            if (authors_result)
              authors = authors_result[1].replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
            if (copyright_result)
              copyright = copyright_result[1].replace(/\s+/g,' ').trim();
            if (authors.length > 0)
              document.getElementById('worship_song_author').value = authors;
            if (copyright.length > 0)
              document.getElementById('worship_song_copyright').value = copyright;
          }
        }
    }
})