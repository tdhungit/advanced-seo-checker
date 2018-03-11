const fs = require('fs');
const http = require('http');
const path = require('path');
const parseURL = require('url-parse');
const cheerio = require('cheerio')
const request = require('request');
const normalizeUrl = require('normalize-url');
const eachSeries = require('async/eachSeries');
const compareUrls = require('compare-urls');

const createCrawler = require('./createCrawler');
const isValidURL = require('./helpers/isValidURL');
const discoverResources = require('./discoverResources');

module.exports = function AdvancedSEOChecker(uri, opts) {
  const defaultOpts = {
    maxDepth: 1,
    userAgent: 'Node/AdvancedSEOChecker',
    respectRobotsTxt: true,
    timeout: 30000,
    maxPages: 1,
    maxConcurrency: 1,
    downloadUnsupported: false,
    discoverResources
  };
  if (!uri) {
    throw new Error('Requires a valid URL.');
  }

  const options = Object.assign({}, defaultOpts, opts);
  const parsedUrl = parseURL(
    normalizeUrl(uri, {
      stripWWW: false,
      removeTrailingSlash: false
    })
  );

  /**
   * Parse meta data from an HTTP response body
   *
   * `body` [String] - The HTML of a web page to parse
   *
   * Returns an object containing data related to the SEO
   * signals of the page that was parsed. Pass the result to
   * another function to determine an "SEO score".
   */
  const meta = () => {
    var $ = cheerio.load(body),
      page = {};

    // Meta signals
    page.title = $('title').text() || null;
    page.description = $('meta[name=description]').attr('content') || null;
    page.author = $('meta[name=author]').attr('content') || null;
    page.keywords = $('meta[name=keywords]').attr('content') || null;

    // Heading signals
    var h1s = 0;
    $('h1').each(function () {
      h1s++;
    });
    page.heading1 = $('body h1:first-child').text().trim().replace('\n', '');
    page.totalHeadings = h1s;

    // Accessibility signals
    var totalImgs = 0,
      accessibleImgs = 0;
    $('img').each(function (index) {
      totalImgs++;
      if ($(this).attr('alt') || $(this).attr('title')) {
        accessibleImgs++;
      }
    });
    page.imgAccessibility = (accessibleImgs / totalImgs) * 100;
    return page;
  };

  const crawler = createCrawler(parsedUrl, options);
  const parsedPages = [];         // Store parsed pages in this array
  const seoParser = this.meta;  // Reference to `meta` method to call during crawl
  const crawlResults = []; // Store results in this array and then return it to caller

  crawler.on('fetchcomplete', (queueItem, responseBuffer, response) => {
    if (queueItem.stateData.code === 200) {
      crawlResults.push({url: queueItem.url, body: responseBuffer.toString()});
    }
    if (crawlResults.length >= maxPages) {
      this.stop(); // Stop the crawler
      crawlResults.forEach(function (page, index, results) {
        parsedPages.push({url: page.url, results: seoParser(page.body)});
      });
      if (!callback) {
        return parsedPages;
      } else {
        callback(parsedPages);
      }
    }
  });
};
