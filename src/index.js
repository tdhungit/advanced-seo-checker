const fs = require('fs');
const http = require('http');
const path = require('path');
const parseURL = require('url-parse');
const cheerio = require('cheerio');
const request = require('request');
const normalizeUrl = require('normalize-url');
const eachSeries = require('async/eachSeries');
const compareUrls = require('compare-urls');
const mitt = require('mitt');
const createCrawler = require('./createCrawler');
const analyzePage = require('./analyzePage');
const isValidURL = require('./helpers/isValidURL');
const discoverResources = require('./discoverResources');

module.exports = function AdvancedSEOChecker(uri, opts) {
  const defaultOpts = {
    maxDepth: 1,
    userAgent: 'Node/AdvancedSEOChecker',
    respectRobotsTxt: true,
    timeout: 30000,
    maxConcurrency: 1,
    downloadUnsupported: false,
    discoverResources
  };
  const parsedPages = [];         // Store parsed pages in this array
  const crawlResults = []; // Store results in this array and then return it to caller

  if (!uri) {
    throw new Error('Requires a valid URL.');
  }

  const options = Object.assign({}, defaultOpts, opts);
  const emitter = mitt();
  const parsedUrl = parseURL(
    normalizeUrl(uri, {
      stripWWW: false,
      removeTrailingSlash: false
    })
  );

  const crawler = createCrawler(parsedUrl, options);

  const start = () => {
    crawler.start();
  };

  const stop = () => {
    crawler.stop();
  };
  const load = (url, callback) => {
    // Check if user input protocol
    if (url.indexOf('http://') < 0 && url.indexOf('https://') < 0) { // TODO: Turn this into its own function
      url = 'http://' + url;
    }

    // Make request and fire callback
    request.get(url.toLowerCase(), function (error, response, body) {
      if (!error && response.statusCode === 200) {
        return callback(body);
      }

      return callback(false);
    });
  };

  const emitError = (code, url) => {
    emitter.emit('error', {
      code,
      message: http.STATUS_CODES[code],
      url
    });
  };

  const addURL = (url, body) => {
    const init = (resolve, reject) => {
      let urlObj = {url: url, body: body};
      crawlResults.push(urlObj);
      resolve(crawlResults[crawlResults.length - 1]);
    };

    let promise = new Promise(init);
    return promise;
  };
  const onComplete = () => {
    crawlResults.forEach(function (page, index, results) {
      const summary = {url: page.url};
      analyzePage(page.url, page.body).then((p) => {
        for (let key of p) {
          console.log(key);
          summary[key] = p[key];
        }
      });
      parsedPages.push(summary);
    });
    while (true) {
      const allAnalyzed = parsedPages.filter((page) => {
        return !page.analyzed;
      }).length;
      if (!allAnalyzed) {
        break;
      }
    }
    emitter.emit('done', parsedPages);
  };
  crawler.on('fetch404', ({url}) => emitError(404, url));
  crawler.on('fetchtimeout', ({url}) => emitError(408, url));
  crawler.on('fetch410', ({url}) => emitError(410, url));
  crawler.on('fetcherror', (queueItem, response) =>
    emitError(response.statusCode, queueItem.url)
  );

  crawler.on('fetchclienterror', (queueError, errorData) => {
    if (errorData.code === 'ENOTFOUND') {
      throw new Error(`Site "${parsedUrl.href}" could not be found.`);
    } else {
      emitError(400, errorData.message);
    }
  });

  crawler.on('fetchdisallowed', ({url}) => emitter.emit('ignore', url));

  crawler.on('fetchcomplete', (queueItem, responseBuffer, response) => {
    let url = queueItem.url;
    if (/<meta(?=[^>]+noindex).*?>/.test(responseBuffer)) {
      emitter.emit('ignore', url);
    } else if (isValidURL(url)) {
      emitter.emit('add', url);
      addURL(url, responseBuffer.toString());
    } else {
      emitError('404', url);
    }
  });
  crawler.on('complete', (queueItem, responseBuffer, response) => {
    onComplete();
  });
  return {
    on: emitter.on,
    off: emitter.off,
    start,
    stop,
    load,
    test: analyzePage
  }
};
