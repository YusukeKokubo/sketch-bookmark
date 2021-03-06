var keyID = "com.phantomtype.sketchplugin.historyback";
var CURRENT_POSITION_KEY = keyID + ".currentPosition";
var COUNT_KEY = keyID + ".countKey";
var SAVING_STATE_KEY = keyID + ".saving";

var PAGE_KEY = keyID + ".history.page";
var ARTBOARD_KEY = keyID + ".history.artboard";

var is_debug = true;

@import "logging.js";
@import "util.js";

//
// Layer 0: Presentations
//

function onArtboardChanged(context) {
    start_debug("onArtboardChanged");

    var sketch = context.api();
    var action = context.actionContext;
    var doc = action.document;

    if (isFromHistoryBack(sketch, doc)) {
        log("skip due to history back");
        return;
    }
    var position = getPosition(sketch, doc);
    debug("oldArtboard", action.oldArtboard);
    saveHistory(sketch, doc, action.oldArtboard, position);
    debug("newArtboard", action.newArtboard);
    saveHistory(sketch, doc, action.newArtboard, position + 1);

    savePosition(sketch, doc, position + 1);
    saveCount(sketch, doc, position + 1);

    end_debug("onArtboardChanged");
}

function onGoBack(context) {
    start_debug("onGoBack");

    var sketch = context.api();
    var doc = sketch.selectedDocument;

    var position = getPosition(sketch, doc) - 1;
    var {pageId, artboardId} = getHistory(sketch, doc, position);

    if (pageId == null || artboardId == null) {
        log("skip because id is null");
        sketch.message("No more history");
    } else {
        var {page, artboard} = findArtboard(doc, pageId, artboardId);
        openArtboard(sketch, doc, page, artboard);
        savePosition(sketch, doc, position);
    }
    end_debug("onGoBack");
}

function onGoForward(context) {
    start_debug("onGoForward");

    var sketch = context.api();
    var doc = sketch.selectedDocument;

    var position = getPosition(sketch, doc) + 1;
    var {pageId, artboardId} = getHistory(sketch, doc, position);

    if (pageId == null || artboardId == null) {
        log("skip because index is null");
        sketch.message("No more history");
    } else {
        var {page, artboard} = findArtboard(doc, pageId, artboardId);
        openArtboard(sketch, doc, page, artboard);
        savePosition(sketch, doc, position);
    }
    end_debug("onGoForward");
}

function showHistories(context) {
    start_debug("showHistories");

    var sketch = context.api();
    var doc = sketch.selectedDocument;

    var {pages, artboards} = getHistories(sketch, doc);

    var choice = choiceArtboard(sketch, doc, artboards);

    if (choice[0] == 1000) {
        var i = choice[1];
        openArtboard(sketch, doc, pages[i], artboards[i]);
        savePosition(sketch, doc, i);
    }
    end_debug("showHistories");
}

//
// Layer 1: Verbs
//

function openArtboard(sketch, doc, page, artboard) {
    toSketchObject(doc).setCurrentPage(toSketchObject(page));

    sketch.setSettingForKey(settingKey(doc, SAVING_STATE_KEY, 0), "saving");

    // Don't use JavaScript API due to support Symbol.
    // artboard.select();
    toSketchObject(artboard).select_byExpandingSelection(true, false);
    // doc.centerOnLayer(artboard);
    toSketchObject(doc).currentView().centerRect_(artboard.rect());

    debug("openArtboard", {page, artboard});

    return {page, artboard};
}

function findArtboard(doc, pageId, artboardId) {
    var page = getObjectById(doc.pages, pageId)
    var artboard = getObjectById2(page.sketchObject.layers, artboardId)

    debug("findArtboard", {page, artboard});

    return {page, artboard};
}

function saveHistory(sketch, doc, artboard, position) {
    if (position < 0) {
        log("skip save due to position is " + position);
        return;
    }
    if (artboard == null) {
        log("skip save due to artboard is null");
        return;
    }

    var page = doc.currentPage();
    debug("saveHistory", page);
    if (toSketchObject(artboard).objectID) {
        var pageKey = settingKey(doc, PAGE_KEY, position);
        var pid = toSketchObject(page).objectID();
        debug("pageKey", {pageKey, pid})
        sketch.setSettingForKey(pageKey, pid);

        var artboardKey = settingKey(doc, ARTBOARD_KEY, position);
        var aid = toSketchObject(artboard).objectID();
        debug("artboardKey", {artboardKey, aid})
        sketch.setSettingForKey(artboardKey, aid);
    }
}

function getHistory(sketch, doc, position) {
    var pageKey = settingKey(doc, PAGE_KEY, position);
    var pageId = sketch.settingForKey(pageKey)

    var artboardKey = settingKey(doc, ARTBOARD_KEY, position);
    var artboardId = sketch.settingForKey(artboardKey);

    debug("getHistory", {pageId, artboardId});
    return {pageId, artboardId};
}

function isFromHistoryBack(sketch, doc) {
    var savingKey = settingKey(doc, SAVING_STATE_KEY, 0);
    var saving = sketch.settingForKey(savingKey);
    if (saving == "saving") {
        sketch.setSettingForKey(savingKey, null);
        return true;
    } else {
        return false;
    }

}

function getPosition(sketch, doc) {
    var positionKey = settingKey(doc, CURRENT_POSITION_KEY, 0);
    return sketch.settingForKey(positionKey) || 0;
}

function getCount(sketch, doc) {
    var countKey = settingKey(doc, COUNT_KEY, 0);
    var count = sketch.settingForKey(countKey) || 0;
    return count;
}

function savePosition(sketch, doc, position) {
    var positionKey = settingKey(doc, CURRENT_POSITION_KEY, 0);
    sketch.setSettingForKey(positionKey, position);
}

function saveCount(sketch, doc, position) {
    var countKey = settingKey(doc, COUNT_KEY, 0);
    sketch.setSettingForKey(countKey, position);
}

function getHistories(sketch, doc) {
    var count = getCount(sketch, doc);
    var position = getPosition(sketch, doc)
    var pages = []
    var artboards = []
    debug("count, position", {count, position})

    for (var i = 0; i < count; i++) {
        var {pageId, artboardId} = getHistory(sketch, doc, i);
        if (pageId && artboardId) {
            var {page, artboard} = findArtboard(doc, pageId, artboardId);
            pages.push(page)
            artboards.push(artboard)
        }
    }

    debug("pages, artboards", {pages, artboards});

    return {pages, artboards}
}

function choiceArtboard(sketch, doc, artboards) {
    var count = getCount(sketch, doc);
    var position = getPosition(sketch, doc);
    var items = [];
    artboards.forEach(function (data, i) {
        items.push(i + ": " + data.name());
    });

    debug("items", items)
    var choice = sketch.getSelectionFromUser("count: " + count + ", position: " + position, items, 0);
    debug("choice", choice)

    return choice;
}

