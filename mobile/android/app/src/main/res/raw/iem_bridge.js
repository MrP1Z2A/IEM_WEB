// Runs inside the IEM website when it is opened in the Android app (never in a
// normal browser). Android's built-in web view cannot save files the way a
// browser does, so this script catches downloads (PDF reports, Excel exports,
// homework files...) and hands them to the app, which saves them to the
// phone's Downloads folder. Links that should open a new tab are opened in the
// phone's normal browser instead.
(function () {
  'use strict';
  if (window.__iemAndroidBridge) return;
  window.__iemAndroidBridge = true;

  var native = window.IEMAndroid; // provided by MainActivity / IemAndroidPlugin
  if (!native || typeof native.postMessage !== 'function') return;

  function send(message) {
    native.postMessage(JSON.stringify(message));
  }

  // Remember the files the website creates in memory, so they can still be
  // saved after the website "revokes" their temporary address.
  var blobs = new Map();
  var originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function (object) {
    var url = originalCreateObjectURL.apply(URL, arguments);
    if (object instanceof Blob) {
      blobs.set(url, object);
      setTimeout(function () { blobs.delete(url); }, 5 * 60 * 1000);
    }
    return url;
  };

  var EXTENSIONS = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'text/csv': 'csv',
    'text/plain': 'txt',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'application/zip': 'zip'
  };

  function defaultName(blob) {
    var extension = EXTENSIONS[(blob.type || '').split(';')[0]];
    return 'IEM-' + new Date().toISOString().slice(0, 10) + (extension ? '.' + extension : '');
  }

  function saveBlob(blob, name) {
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result);
      send({
        type: 'save',
        name: name || defaultName(blob),
        mime: blob.type || 'application/octet-stream',
        data: text.slice(text.indexOf(',') + 1)
      });
    };
    reader.onerror = function () {
      send({ type: 'error', message: 'Could not save the file.' });
    };
    reader.readAsDataURL(blob);
  }

  function parse(href) {
    try {
      return new URL(href, location.href);
    } catch (e) {
      return null;
    }
  }

  function isWeb(url) {
    return url && (url.protocol === 'http:' || url.protocol === 'https:');
  }

  // Save a file from an address. Returns true if the app took care of it.
  function download(href, name) {
    var url = parse(href);
    if (!url) return false;

    if (url.protocol === 'blob:' || url.protocol === 'data:') {
      var blob = blobs.get(url.href);
      if (blob) {
        saveBlob(blob, name);
      } else {
        fetch(url.href)
          .then(function (response) { return response.blob(); })
          .then(function (fetched) { saveBlob(fetched, name); })
          .catch(function () { send({ type: 'error', message: 'Could not save the file.' }); });
      }
      return true;
    }

    if (isWeb(url)) {
      send({ type: 'download', url: url.href, name: name || '' });
      return true;
    }
    return false;
  }

  // Decide what to do with a link. Returns true if the app took care of it.
  function handleLink(anchor) {
    var href = anchor.getAttribute('href');
    if (!href || href.charAt(0) === '#') return false;
    var url = parse(anchor.href);
    if (!url) return false;

    if (anchor.hasAttribute('download') || url.protocol === 'blob:' || url.protocol === 'data:') {
      return download(url.href, anchor.getAttribute('download') || '');
    }
    if (anchor.target === '_blank' && isWeb(url)) {
      send({ type: 'open', url: url.href });
      return true;
    }
    return false;
  }

  // 1. Links the user taps (runs after the website's own click handlers).
  window.addEventListener('click', function (event) {
    if (event.defaultPrevented || !event.target || !event.target.closest) return;
    var anchor = event.target.closest('a');
    if (anchor && handleLink(anchor)) event.preventDefault();
  });

  // 2. Links the website "clicks" from code, e.g. after making a PDF.
  var originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (handleLink(this)) return;
    return originalClick.apply(this, arguments);
  };

  // 3. Some libraries (e.g. jsPDF) send a click to a link that is not on the page.
  HTMLAnchorElement.prototype.dispatchEvent = function (event) {
    if (event && event.type === 'click' && !this.isConnected && handleLink(this)) return false;
    return EventTarget.prototype.dispatchEvent.call(this, event);
  };

  // 4. window.open(...): web pages open in the phone's browser, files are saved.
  var originalOpen = window.open;
  window.open = function (target) {
    var url = target ? parse(String(target)) : null;
    if (url && (url.protocol === 'blob:' || url.protocol === 'data:')) {
      download(url.href, '');
      return null;
    }
    if (isWeb(url)) {
      send({ type: 'open', url: url.href });
      return null;
    }
    return originalOpen.apply(window, arguments);
  };
})();
