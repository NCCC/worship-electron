import "./stylesheets/main.css";

// Small helpers you might want to keep
import "./helpers/context_menu.js";
import "./helpers/external_links.js";

// ----------------------------------------------------------------------------
// Everything below is just to show you how it works. You can delete all of it.
// ----------------------------------------------------------------------------

import { remote } from "electron";
import jetpack from "fs-jetpack";

const app = remote.app;
const appDir = jetpack.cwd(app.getAppPath());

/**
 * WorshipSlides namespace.
 */
if ("undefined" == typeof(WorshipSlides)) {
  var WorshipSlides = {
    setElementChild : function( el, child ) {
      var counter = el.childNodes.length;
      while (counter--)
        el.removeChild( el.lastChild );
      if (typeof(child) === 'string')
        el.appendChild( document.createTextNode(child) );
      else el.appendChild( child );
    }
  };
};

// Components.utils.import("resource://gre/modules/FileUtils.jsm");
// Components.utils.import("resource://gre/modules/NetUtil.jsm");
// var prompts =
//   Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
//     getService(Components.interfaces.nsIPromptService);
// var prefService =
//   Components.classes["@mozilla.org/preferences-service;1"].getService(
//     Components.interfaces.nsIPrefBranch );


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

var presentation_window = null;
var configuration_window = null;
var addsong_window = null;

WorshipSlides.MainWindow = {
  opened_windows : [],
  current_song_order : '',
  current_song_text : '',
  current_display_title : '',
  current_song_author : '',
  current_song_copyright : '',
  size_modifier : 0,
  export_in_progress_to_window : 0,
  export_in_progress_number : 0,
  addType : 'song',
  onLoad : function(event) {
    console.log('Worship Module Loaded');
    var songpath = this.getPref('songpath');
    // Check if the songpath is valid
    // TODO: Use npm file access
    // var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    // try {
    //   file.initWithPath(songpath);
    // } catch (err) {
    //   if (prompts.confirm( window, 'No song path is configured', 'You have not configured a valid song path. Open configuration window?'))
    //     this.configuration();
    // }
    this.loadSets();
    this.bindListeners();
    // this.loadColors();
  },
  bindListeners : function() {
    var setlist = document.getElementById('worship_sets_list');
    setlist.addEventListener('change', this.selectSet);    
  },
  onUnload : function(event) {
    var opened_windows = WorshipSlides.MainWindow.opened_windows;
    for (var index = 0; index < opened_windows.length; index++) {
      if (!opened_windows[index].closed)
        opened_windows[index].close();
    }
  },
  loadColors : function(event) {
    var preview = document.getElementById('worship_preview_box');
    var color_text = WorshipSlides.MainWindow.getPref('color_text');
    var color_background = WorshipSlides.MainWindow.getPref('color_background');
    if (color_text != '')
      preview.style.color = color_text;
    if (color_background != '')
      preview.style.background = color_background;
    if (presentation_window)
      presentation_window.WorshipSlides.PresentationWindow.loadColors();
  },
  configuration : function(event) {
    if (configuration_window && !configuration_window.closed) {
      configuration_window.focus();
    } else {
      configuration_window = window.openDialog(
        'chrome://worshipslides/content/worshipConfiguration.xul',
        'worshipslides-configuration-window',
        'chrome,centerscreen' );
      this.opened_windows.push( configuration_window );
    }
  },
  configurationChanged : function(event) {
    this.itemSelected(event);
    this.loadColors();
  },
  getPref : function(pref) {
    return '';
    // return prefService.getCharPref(
    //   "extensions.worshipslides."+pref);
  },
  setPref : function(pref, value) {
    // prefService.setCharPref(
    //   "extensions.worshipslides."+pref, value);
  },
  getIntPref : function(pref) {
    return '';
    // return prefService.getIntPref(
    //   "extensions.worshipslides."+pref);
  },
  addItem : function(aEvent, type) {
    this.addType = type;
    let returnValue = { name : "" };
    addsong_window = window.openDialog(
      'chrome://worshipslides/content/worshipAddItem.xul',
      'worshipslides-addsong-window',
      'chrome,centerscreen,modal', returnValue );
    if (returnValue.name == 'New '+type+'...') {
      if (type == 'song')
        this.addNewSong();
      else if (type == 'text')
        this.addNewText();
    } else if (returnValue.name != '') {
      var worship_items = document.getElementById('worship_items');
      worship_items.appendItem(returnValue.name);
      worship_items.selectedIndex = worship_items.itemCount-1;
      this.saveSet();
    }
  },
  removeItem : function(aEvent) {
    var worship_items = document.getElementById('worship_items');
    var item_index = worship_items.selectedIndex;
    if (item_index > -1)
    {
      worship_items.removeItemAt( item_index );
      this.saveSet();
      if (item_index > 0)
        worship_items.selectedIndex = item_index-1;
      else if (worship_items.itemCount > 0)
        worship_items.selectedIndex = item_index;
    }
    this.itemSelected(event);
  },
  moveItem : function (direction) {
    var worship_items = document.getElementById('worship_items');
    if (worship_items.selectedIndex > -1) {
      var selected = worship_items.selectedItem;
      if (direction == -1 && worship_items.selectedIndex > 0)
        worship_items.insertBefore( selected,
          worship_items.getItemAtIndex(worship_items.selectedIndex-1) );
      else if (direction == 1 && worship_items.selectedIndex == worship_items.itemCount-2)
        worship_items.appendChild( selected );
      else if (direction == 1 && worship_items.selectedIndex < worship_items.itemCount-2)
        worship_items.insertBefore( selected,
          worship_items.getItemAtIndex(worship_items.selectedIndex+2) );
      worship_items.selectItem( selected );
      this.saveSet();
    }
  },
  itemSelected : function(event) {
    var worship_items = document.getElementById('worship_items');
    if (worship_items.selectedCount) {
      var name = worship_items.selectedItem.label;
      if (this.isSong(name))
        WorshipSlides.MainWindow.showLyrics( name );
      else if (this.isText(name))
        WorshipSlides.MainWindow.showText( name );
    } else {
      var lyrics = document.getElementById('worship_lyrics');
      while (lyrics.hasChildNodes())
        lyrics.removeChild( lyrics.firstChild );
    }
  },
  isSong : function( songname ) {
    var songpath = WorshipSlides.MainWindow.getPref('songpath');
    var songFile = new FileUtils.File(songpath);
    songFile.append( songname+'.txt' );
    return (songFile.exists() && songFile.isFile());
  },
  isText : function( textname ) {
    var textpath = WorshipSlides.MainWindow.getPref('textpath');
    var textFile = new FileUtils.File(textpath);
    textFile.append( textname+'.txt' );
    return (textFile.exists() && textFile.isFile());
  },
  showLyrics : function( songname ) {
    var songpath = WorshipSlides.MainWindow.getPref('songpath');
    var songFile = new FileUtils.File(songpath);
    songFile.append( songname+'.txt' );
    if (songFile.exists() && songFile.isFile())
    {
      NetUtil.asyncFetch(songFile, function(inputStream, status) {
        if (!Components.isSuccessCode(status)) {
          prompts.alert(window,'Error reading song file!','An error occured while trying to read the selected file. Maybe it was deleted? Try refreshing this page.');
          return;
        }
        var data = NetUtil.readInputStreamToString(inputStream, inputStream.available(), {charset : 'UTF-8'} );
        WorshipSlides.MainWindow.current_display_title = songname;
        WorshipSlides.MainWindow._transform_song( data, document.getElementById('worship_lyrics') );
        var worship_lyrics = document.getElementById('worship_lyrics');
        worship_lyrics.selectedIndex = 0;
        WorshipSlides.MainWindow.checkExport();
      });
    }
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
  selectVerse : function( event ) {
    var lyrics = document.getElementById('worship_lyrics').selectedItem;
    var ccli = this.getPref('ccli_license');
    WorshipSlides.setElementChild(
      document.getElementById('worship_preview'),
      lyrics.lastChild.cloneNode(true) );
    WorshipSlides.setElementChild(
      document.getElementById('worship_preview_title'),
      this.current_display_title );
    WorshipSlides.setElementChild(
      document.getElementById('worship_preview_author'),
      (this.current_song_author != '' ? 'Song authors: '+this.current_song_author : '') );
    WorshipSlides.setElementChild(
      document.getElementById('worship_preview_copyright'),
      (this.current_song_copyright != '' ? '©'+this.current_song_copyright : '') );
    WorshipSlides.setElementChild(
      document.getElementById('worship_preview_ccli'),
      (ccli != '' && this.current_song_copyright != '' ? 'CCLI #'+ccli : '') );
      
    if (presentation_window)
    {
      // Duplicate all the elements over to the presentation window
      var preview = document.getElementById('worship_preview_box');
      var presentation = presentation_window.document.getElementById('worship_presentation_box');
      while (presentation.hasChildNodes())
        presentation.removeChild( presentation.lastChild );
      for (var index = 0; index < preview.childNodes.length; index++)
        presentation.appendChild( preview.childNodes[index].cloneNode(true) );
      presentation_window.WorshipSlides.PresentationWindow.resize();
    }
    // Always focus on lyrics box. This is because when worship items is focused, pressing shortcut
    // keys will select songs in that list that start with the keyboard key pressed.
    document.getElementById('worship_lyrics').focus();
  },
  startPresentation : function (event) {
    presentation_window = window.open(
      'chrome://worshipslides/content/worshipPresentation.xul',
      '_blank',
      'dependent,resizable' );
    this.opened_windows.push(presentation_window);
  },
  blankToggle : function(event) {
    var worship_preview = document.getElementById('worship_preview_box');
    var color = 'black';
    if (worship_preview.style.color == 'black')
      color = 'white';
    worship_preview.style.color = color;
    if (presentation_window)
    {
      presentation_window.document.getElementById('worship_presentation_box').style.color = color;
    }
  },
  addNewSong : function (event) {
    var worship_items = document.getElementById('worship_items');
    worship_items.selectedIndex = -1;
    this.opened_windows.push( window.open(
      'chrome://worshipslides/content/worshipEditSong.xul',
      'worshipslides-editsong-window') );
  },
  editItem : function (event) {
    var worship_items = document.getElementById('worship_items');
    if (worship_items.selectedIndex > -1)
    {
      var name = worship_items.selectedItem.label;
      if (this.isSong(name)) {
        this.opened_windows.push( window.open(
          'chrome://worshipslides/content/worshipEditSong.xul',
          worship_items.selectedItem.label) );
      } else if (this.isText(name)) {
        this.opened_windows.push( window.open(
          'chrome://worshipslides/content/worshipEditText.xul',
          worship_items.selectedItem.label) );
      }
    }
  },
  addNewText : function (event) {
    var worship_items = document.getElementById('worship_items');
    worship_items.selectedIndex = -1;
    this.opened_windows.push( window.open(
      'chrome://worshipslides/content/worshipEditText.xul',
      'worshipslides-edittext-window') );
  },
  loadSets : function() {
    // var setpath = this.getPref('setpath');
    var setpath = 'userdata/sets';
    // var setdir = new FileUtils.File(setpath);
    // var last_used_set = this.getPref('last_used_set');
    var entries = appDir.list(setpath);
    console.log('Setlist: ', entries);
    if (entries) {
        var setlist = document.getElementById('worship_sets_list');
        // var setpopup = document.getElementById('worship_sets_popup');
        // while (setpopup.hasChildNodes())
        //   setpopup.removeChild(0);

        for(var i = 0; i < entries.length; i++) {
          var name = entries[i];
          if (name.slice(-4) == '.txt') {
            var setname = name.slice(0,-4);
            var option = document.createElement('option');
            option.innerText = setname;
            option.value = setname;
            var item = setlist.appendChild( option );
            // if (setname == last_used_set)
            // {
            //   setlist.selectedItem = item;
            //   this.selectSet(null);
            // }
          }
        }

    }
    // if (setdir.exists() && setdir.isDirectory())
    // {
    //   var setlist = document.getElementById('worship_sets_list');
    //   var setpopup = document.getElementById('worship_sets_popup');
    //   while (setpopup.hasChildNodes())
    //     setpopup.removeChild(0);
      
    //   var entries = setdir.directoryEntries;
    //   while (entries.hasMoreElements())
    //   {
    //     var entry = entries.getNext();
    //     entry.QueryInterface(Components.interfaces.nsIFile);
    //     name = entry.leafName;
    //     if (name.slice(-4) == '.txt') {
    //       var setname = name.slice(0,-4);
    //       var item = setlist.appendItem( setname );
    //       if (setname == last_used_set)
    //       {
    //         setlist.selectedItem = item;
    //         this.selectSet(null);
    //       }
    //     }
    //   }
    // }
    //else console.log('No set directory found');
  },
  addSet : function( event ) {
    var setname = { value: '' };
    var check = { value: false };
    if (prompts.prompt( window, 'New worship set name', 'Enter the name for the new worship set. The new worship set will have a copy of the worship items in the current set.', setname, null, check ) && setname.value != "") {
      var set_popup = document.getElementById('worship_sets_popup');
      // Check if name is already taken
      for (var index = 0; index < set_popup.childNodes.length; index++)
      {
        if (set_popup.childNodes[index].getAttribute('label') == setname.value) {
          prompts.alert( window, 'Worship set '+setname.value+' already exists!', 'There is already a worship set called '+setname.value+'! Use another name.' );
          return false;
        }
      }
      var setlist = document.getElementById('worship_sets_list');
      var newset = setlist.appendItem( setname.value );
      setlist.selectedItem = newset;
      this.selectSet();
      this.saveSet();
    }
  },
  selectSet : function( event ) {
    console.log('Set selected.', event.target.value);
    var setname = event.target.value;
    var setfile = appDir.read('userdata/sets/' + setname + '.txt');
    console.log('Set: ', setfile);
    if(setfile) {
      var data = setfile;
      var worship_items = document.getElementById('worship_items');
      //     while (worship_items.hasChildNodes())
      //       worship_items.removeItemAt(0);
      if (data) {
        var lines = data.split(/\r?\n/);
        for (var index = 0; index < lines.length; index++)
        {
          if (lines[index] != "") {
            var option = document.createElement('option');
            option.innerText = lines[index];
            option.value = lines[index];
            var item = worship_items.appendChild( option );
          }
            worship_items.appendItem(lines[index]);
        }
        // worship_items.selectedIndex = 0;
      }
    }
    // var setlist = document.getElementById('worship_sets_list');
    // var setname = setlist.selectedItem.getAttribute('label');
    // var setpath = WorshipSlides.MainWindow.getPref('setpath');
    // var setfile = new FileUtils.File(setpath);
    // setfile.append( setname+'.txt' );
    // if (setfile.exists() && setfile.isFile())
    // {
    //   NetUtil.asyncFetch(setfile, function(inputStream, status) {
    //     if (!Components.isSuccessCode(status)) {
    //       prompts.alert(window,'Error reading set file!','An error occured while trying to read the set file. Maybe it was deleted? Try refreshing this page.');
    //       return;
    //     }
    //     var worship_items = document.getElementById('worship_items');
    //     while (worship_items.hasChildNodes())
    //       worship_items.removeItemAt(0);
          
    //     var data = NetUtil.readInputStreamToString(inputStream, inputStream.available(), {charset : 'UTF-8'} );
    //     if (data) {
    //       var lines = data.split(/\r?\n/);
    //       for (var index = 0; index < lines.length; index++)
    //       {
    //         if (lines[index] != "")
    //           worship_items.appendItem(lines[index]);
    //       }
    //       worship_items.selectedIndex = 0;
    //     }
    //     WorshipSlides.MainWindow.setPref('last_used_set',setname);
    //   });
    // }
  },
  saveSet : function() {
    //console.log("Saving set now...");
    var setpath = WorshipSlides.MainWindow.getPref('setpath');
    var setfile = new FileUtils.File(setpath);
    if (!setfile.exists() || !setfile.isWritable()) {
      prompts.alert(window,"Invalid worship set path!","You must configure a valid worship set path in Configuration before you can save song sets!");
      //console.log('No worship set path!');
      return false;
    }
    var setlist = document.getElementById('worship_sets_list');
    var setname = setlist.selectedItem.getAttribute('label');
    if (setname == "")
    {
      prompts.alert(window,"Set title must be set","You must select a worship set name before you can save worship sets.");
      //console.log('No set name!');
      return false;
    }
    setfile.append( setname+'.txt' );
    var ostream = FileUtils.openAtomicFileOutputStream( setfile, FileUtils.MODE_CREATE | FileUtils.MODE_WRONLY );
    var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
              createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    
    var worship_items = document.getElementById('worship_items');
    var set_text = '';
    for (var index = 0; index < worship_items.itemCount; index++)
      set_text += worship_items.getItemAtIndex(index).label+"\n";
      
    //console.log("Text for saving: "+set_text);
    var istream = converter.convertToInputStream(set_text);
    NetUtil.asyncCopy(istream, ostream, function(status) {
      //console.log("Save status: "+status);
      if (!Components.isSuccessCode(status)) {
        prompts.alert(window,'Worship Slides: Error saving set','Error saving worship set!');
        return;
      }
    });
    return false;
  },
  deleteSet : function( event ) {
    var setlist = document.getElementById('worship_sets_list');
    if (setlist.selectedItem) {
      var setname = setlist.selectedItem.getAttribute('label');
      if (prompts.confirm( window, 'Delete worship set?', 'Are you sure you want to delete the worship set '+setname+'?' )) {
        var setpath = WorshipSlides.MainWindow.getPref('setpath');
        var setfile = new FileUtils.File(setpath);
        setfile.append( setname + '.txt' );
        if (setfile.exists())
        {
          setfile.remove(false);
        }
        var index = setlist.selectedIndex;
        setlist.removeItemAt(index);
        if (index > 0) {
          setlist.selectedIndex = index-1;
          this.selectSet();
        } else if (setlist.itemCount > 0) {
          setlist.selectedIndex = index;
          this.selectSet();
        } else {
          var worship_items = document.getElementById('worship_items');
          worship_items.removeAllItems();
        }
      }
    }
  },
  _transform_song : function( data, listbox )
  {
    var count = listbox.itemCount;
    while (count--)
      listbox.removeItemAt(0);
    
    var lines = data.split(/\r?\n/);
    var verses = {};
    var verse_identifiers = {};
    var current_verse = 1;
    var verse_text = document.createElement('description');;
    var order = null;

    this.current_song_order = '';
    this.current_song_text = '';
    this.current_song_author = '';
    this.current_song_copyright = '';
    //this.current_display_title = '';
    
    // First we get all the verses from the text
    for (index = 0; index < lines.length; index++)
    {
      var line = lines[index];
      if (line.substr(0,1) == "#")
      {
        var matches = song_order_regexp.exec(line);
        if (matches)
        {
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
      }
      else {
        if (line || this.current_song_text != '')
          this.current_song_text += line+"\n";
        if ((matches = song_verse_regexp.exec(line)))
        {
          if (verse_text.hasChildNodes())
            verses[current_verse] = verse_text;
          if (matches[1] != 'region 2')
            current_verse = matches[1];
          else current_verse += '_region2';
          verse_text = document.createElement('description');
        } else {
          if (line.match("^\\s*$"))
          {
            if (verse_text.lastChild) // && verse_text.lastChild.tagName != 'br')
            {
              verse_text.appendChild( document.createElementNS('http://www.w3.org/1999/xhtml','hr') );
            }
          }
          else {
            verse_text.appendChild( document.createTextNode(line) );
            verse_text.appendChild( document.createElementNS('http://www.w3.org/1999/xhtml','br') );
          }
        }
      }
    }
    
    // Save any unsaved verses here
    if (current_verse != null)
      verses[current_verse] = verse_text;
    else if (verse_text.hasChildNodes())
      verses[verse_num] = verse_text;
      
    // Strip away last newline
    if (this.current_song_text.slice(-1) == "\n")
      this.current_song_text = this.current_song_text.slice(0,-1);
      
    // Then, if an order is set, add the verses in the order decided
    var transformed = '';
    if (order)
    {
      for (var index in order)
      {
        //console.log('Index is '+index);
        var verse_num = order[index];
        //console.log('Verse num is '+verse_num);
        if (parseInt(verse_num) == verse_num)
          index = verse_num;
        else index = verse_map[verse_num];
        if (verses[index])
          WorshipSlides.MainWindow._transform_verse(index, verses, listbox);
      }
    // If no order is set, just print the verses by their order in the file
    } else {
      for (var index in verses) {
        WorshipSlides.MainWindow._transform_verse(index,verses, listbox);
      }
    }
    
    //transformed = transformed.replace(empty_verses_regexp,'');
    return transformed;
  },
  _transform_verse : function( index, verses, listbox ) {
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
    }
    else verse_num.appendChild( document.createTextNode( index.charAt(0).toUpperCase() + index.slice(1) + ':')  );
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
  },
  exportHTML : function() {
    if (!WorshipSlides.MainWindow.export_in_progress_to_window) {
      var items = document.getElementById('worship_items');
      items.selectedIndex = -1;
      //console.log('Starting export...');
      export_window = window.open();
      this.opened_windows.push(export_window);
      export_window.document.title = 'Worship Slides Export';
      var html = '';
      html += '<style>.identifier { display: none; }</style>';
      html += '<a name="top"></a><h1>Program</h1>';
      html += '<ol id="program_list"></ol>';
      html += '<div id="program_text"></div>';
      export_window.document.body.innerHTML = html;
      WorshipSlides.MainWindow.export_in_progress_to_window = export_window;
      WorshipSlides.MainWindow.export_in_progress_number = 1;
      items.selectedIndex = 0;
    }
  },
  checkExport : function() {
    if (WorshipSlides.MainWindow.export_in_progress_to_window) {
      //console.log('Exporting item...');
      var export_window = WorshipSlides.MainWindow.export_in_progress_to_window;
      var items = document.getElementById('worship_items');
      var lyrics = document.getElementById('worship_lyrics');
      if (WorshipSlides.MainWindow.current_display_title.trim() != '')
        var title = WorshipSlides.MainWindow.current_display_title;
      else var title = items.selectedItem.label;
      var index = WorshipSlides.MainWindow.export_in_progress_number++;
      var html = '';
      html += '<a name="program'+index+'"></a>';
      html += '<h1>'+index+'. '+title+'</h1>';
      export_window.document.getElementById('program_list').innerHTML += '<li><a href="#program'+index+'">'+title+'</li>';
      html += '<p><a href="#top">Back to top...</a></p>';
      for (var index = 0; index < lyrics.itemCount; index++) {
        html += lyrics.getItemAtIndex(index).innerHTML+'<br/>';
      }
      export_window.document.getElementById('program_text').innerHTML += html;
      if (items.selectedIndex < items.itemCount-1)
        items.selectedIndex++;
      else {
        WorshipSlides.MainWindow.export_in_progress_to_window = '';
        //console.log('Export finished!');
      }
    }
  },
  shortcuts : function(event) {
    var worship_lyrics = document.getElementById('worship_lyrics');
    var worship_items = document.getElementById('worship_items');
    //console.log(event.key);
    switch(event.key)
    {
      case 27: // esc
      case 'Esc':
      case 'Escape':
        if (presentation_window) {
          presentation_window.close();
          presentation_window = null;
          event.preventDefault();
          return;
        }
        break;
      case 38: //up
      case 'Up':
      case 'ArrowUp':
        if (worship_lyrics.selectedIndex > 0) {
          worship_lyrics.selectedIndex--;
          worship_lyrics.ensureIndexIsVisible( worship_lyrics.selectedIndex );
        }
        event.preventDefault();
        return;
      case 40: //down
      case 'Down':
      case 'ArrowDown':
        if (worship_lyrics.selectedIndex < worship_lyrics.itemCount - 1) {
          worship_lyrics.selectedIndex++;
          worship_lyrics.ensureIndexIsVisible( worship_lyrics.selectedIndex );
        }
        event.preventDefault();
        return;
			case 33: //pageup
      case 'PageUp':
        if (event.shiftKey) {
          this.moveItem(-1);
        } else if (worship_items.selectedIndex > 0) {
          worship_items.selectedIndex--;
          worship_items.ensureIndexIsVisible( worship_items.selectedIndex );
        }
        event.preventDefault();
        return;
      case 34: //pagedown
      case 'PageDown':
        if (event.shiftKey) {
          this.moveItem(1);
        } else if (worship_items.selectedIndex < worship_items.itemCount - 1) {
          worship_items.selectedIndex++;
          worship_items.ensureIndexIsVisible( worship_items.selectedIndex );
        }
        event.preventDefault();
        return;
      /*case 81: // q
        quicktext();
        return false;
        return;
			/*case 13: //enter
        window.arguments[1].songname = songlist.selectedItem.label;
        return true;
        return;*/
    }
    
    //var key = String.fromCharCode(event.keyCode);
    this.jumpTo(event.key);
    // If not uppercase, then the user might have pressed a function key,
    // for example F5. Don't do anything in that case.
    /*if (key.toUpperCase() != key)
      return;*/
  },
  jumpTo : function(key) {
    var text = '';
    if (parseInt(key) == key)
      text = 'Verse '+key;
    else {
      key = key.toLowerCase();
      if (verse_map[key])
        text = verse_map[key].charAt(0).toUpperCase()+verse_map[key].slice(1);
    }
    if (text != '')
    {
      var worship_lyrics = document.getElementById('worship_lyrics');
      for (var index in worship_lyrics.childNodes)
      {
        var child = worship_lyrics.childNodes[index];
        if (child.firstChild && child.firstChild.textContent == text+':')
        {
          worship_lyrics.selectItem(child);
          return;
        }
      }
    }
  }
};
