const cheerio = require('cheerio');
const blc = require('broken-link-checker');
const fs = require('fs');
const stringSimilarity = require('string-similarity');
const createLHAnalyzer = require('./createLighthouseAnalyzer');
const msg = require('./helpers/msg-helper');

//TESTS COVERED
//Missing title tag
//Missing description tag
//Missing keywords tag
//Missing author tag
//Broken links
//Broken Images
//Too much text in title
//Duplicate h1 tag
//Duplicate meta title
//Duplicate meta desc
//Check if sitemap is exits
//Check if robot files exists
//SSLLabs Integration
//DOCType Check

module.exports = (options) => {
  const getIssueCategory = (id) => {
    const categories = {
      'viewport': 'errors',
      'document-title': 'errors',
      'duplicate-id': 'errors',
      'html-has-lang': 'errors',
      'html-lang-valid': 'errors',
      'meta-description': 'errors',
      'render-blocking-resources': 'errors',
      'unminified-css': 'errors',
      'unminified-javascript': 'errors',
      'is-crawlable': 'errors',
      'hreflang': 'errors',
      'canonical': 'errors',
      'errors-in-console': 'errors',
      'uses-optimized-images': 'errors',
      'http-status-code': 'errors',
      'image-alt': 'warnings',
      'uses-text-compression': 'warnings',
      'uses-responsive-images': 'warnings',
      'dom-size': 'warnings',
      'unused-css-rules': 'warnings',
      'offscreen-images': 'warnings',
      'total-byte-weight': 'warnings',
      'critical-request-chains': 'warnings',
      'link-text': 'warnings',
      'external-anchors-use-rel-noopener': 'warnings',
      'geolocation-on-start': 'warnings',
      'password-inputs-can-be-pasted-into': 'warnings',
      'uses-rel-preload': 'warnings',
      'uses-rel-preconnect': 'warnings',
      'uses-webp-images': 'notices',
      'content-width': 'notices',
      'image-aspect-ratio': 'notices',
      'deprecations': 'notices',
      'service-worker': 'notices',
      'works-offline': 'notices',
      'appcache-manifest': 'notices',
      'robots-txt': 'notices',
      'no-websql': 'notices',
      'is-on-https': 'notices',
      'uses-http2': 'notices',
      'webapp-install-banner': 'notices',
      'splash-screen': 'notices',
      'themed-omnibox': 'notices',
      'redirects-http': 'notices',
      'redirects': 'notices',
      'without-javascript': 'notices',
      'no-mutation-events': 'notices',
      'no-document-write': 'notices',
      'no-vulnerable-libraries': 'notices',
      'notification-on-start': 'notices',
      'link-name': 'notices',
      'manifest-short-name-length': 'notices'
    };
    return categories[id] ? categories[id] : 'notices';
  };

  const testTooMuchTextInTitle = (page) => {
    return {
      description: page.title ? '1 page have too much text within the title tags' : '1 pages don\'t have title tags',
      text: page.title ? page.title : '',
      value: page.title ? page.title.length <= 75 : 0,
      weight: 1,
      score: page.title && page.title.length <= 75 ? 100 : 0
    };
  };

  const testDOCType = (body) => {
    const result = {
      description: '',
      weight: 1,
      value: body.toLowerCase().lastIndexOf('<!doctype html>') !== -1
    };
    if (result.value === 0) {
      result.description = '1 page don\'t have doctype declared';
    }
    else {
      result.description = '0 page don\'t have doctype declared';
    }
    result.score = result.value ? 100 : 0;
    return result;
  };

  const countH1 = ($) => {
    const result = {
      description: '',
      weight: 1,
      value: $('h1').length
    };
    if (result.value === 0) {
      result.description = 'page doesn\'t contain any h1 heading';
    }
    else if (result.value > 1) {
      result.description = 'page have more than one H1 tag';
    }
    result.score = result.value === 1 ? 100 : 0;
    return result;
  };

  const discoverBrokenLinks = (url, body) => {
    const init = (resolve, reject) => {
      const broken = {
          a: {internal: [], external: []},
          img: {internal: [], external: []},
          source: {internal: [], external: []}
        },
        total = {
          a: {internal: [], external: []},
          img: {internal: [], external: []},
          source: {internal: [], external: []}
        };

      var htmlChecker = new blc.HtmlChecker({}, {
        link: function (result) {

          const type = result.internal ? 'internal' : 'external';
          if (!total[result.html.tagName]) {
            msg.appMsg('New tag detected: ' + result.html.tagName);
            total[result.html.tagName] = {internal: [], external: []};
            broken[result.html.tagName] = {internal: [], external: []};
          }
          total[result.html.tagName][type].push(result);
          if (result.broken) {
            broken[result.html.tagName][type].push(result);
          }
        },
        complete: function (result) {
          const res = {
            total: total,
            broken: broken,
            internalBrokenLinks: {
              description: broken.a.internal.length + ' internal links are broken',
              list: broken.a.internal,
              weight: 1,
              value: broken.a.internal.length,
              score: total.a.internal.length ? 100 - (broken.a.internal.length / total.a.internal.length) * 100 : 100
            },
            externalBrokenLinks: {
              description: broken.a.external.length + ' external links are broken',
              list: broken.a.external,
              weight: 1,
              value: broken.a.external.length,
              score: total.a.external.length ? 100 - (broken.a.external.length / total.a.external.length) * 100 : 100
            },
            internalBrokenImages: {
              description: broken.img.internal.length + ' internal images are broken',
              weight: 1,
              list: broken.img.internal.concat(broken.source.internal),
              value: broken.img.internal.length + broken.source.internal.length,
              score: total.img.internal.length ? 100 - ((broken.img.internal.length + broken.source.internal.length) / (total.img.internal.length + total.source.internal.length)) * 100 : 100
            },
            externalBrokenImages: {
              description: broken.img.external.length + ' external images are broken',
              weight: 1,
              list: broken.img.external.concat(broken.source.external),
              value: broken.img.external.length + broken.source.external.length,
              score: total.img.external.length ? 100 - ((broken.img.external.length + broken.source.external.length) / (total.img.external.length + total.source.external.length)) * 100 : 100
            }
          };
          resolve(res);
        }
      });
      htmlChecker.scan(body, url);
    };

    let promise = new Promise(init);
    return promise;
  };

  const calculateIssuesImpact = (page) => {
    for (const categoryKey in page.issues) {
      const category = page.issues[categoryKey];
      for (const issueKey in category) {
        if (category[issueKey].impact) {
          continue;
        }
        category[issueKey].impact = (100 - category[issueKey].score) * category[issueKey].weight;
      }
    }
  };

  const analyzePage = (url, body) => {
    const $ = cheerio.load(body), page = {};
    page.url = url;
    msg.yellowBright('Analyzing: ' + url);

    const init = (resolve, reject) => {

      page.title = $('title').text() || null;
      page.headers = {h1: [], h2: [], h3: [], h4: [], h5: [], h6: []}
      page.description = $('meta[name=description]').attr('content') || null;
      page.author = $('meta[name=author]').attr('content') || null;

      page.canonical = $('link[rel=canonical]').attr('href') || null;
      page.canonical = page.canonical ? page.canonical.trim().replace('\n', '') : page.canonical;
      page.keywords = $('meta[name=keywords]').attr('content') || null;
      page.issues = {errors: {}, warnings: {}, notices: {}};
      page.scores = {};
      page.metrics = {
        'first-contentful-paint': null,
        'first-meaningful-paint': null,
        'load-fast-enough-for-pwa': null,
        'speed-index': null,
        'estimated-input-latency': null,
        'time-to-first-byte': null,
        'first-cpu-idle': null,
        'interactive': null,
        'mainthread-work-breakdown': null,
        'bootup-time': null,
      };

      for (let i = 1; i <= 6; i++) {
        $('body h' + i).each(function () {
          const text = $(this).text();
          page.headers['h' + i].push(text ? text.trim().replace('\n', ''): text);
        });
      }
      page.h1 = $('body h1:first-child').text().trim().replace('\n', '');
      page.issues.warnings['multiple-h1'] = countH1($);
      page.issues.warnings['too-much-text-in-title'] = testTooMuchTextInTitle(page);
      page.issues.warnings['doc-type'] = testDOCType(body);

      if (options.ignoreInternalPagesIssues) {
        msg.yellow('Ignoring internal issues: ' + url);
        return resolve(page);
      }

      // const promises = [discoverBrokenLinks(url, body), createLHAnalyzer(createLHAnalyzer).analyzePage(url)];
      const promises = [createLHAnalyzer(options).analyzePage(url)];
      Promise.all(promises).then(function (results) {
        // page.blc = results[0];
        // page.lighthousedata = results[1].lhr;
        page.lighthousedata = results[0].lhr;
        page.body = JSON.parse(JSON.stringify(results[0].lhr));

        // page.issues.errors['internal-broken-links'] = page.blc.internalBrokenLinks;
        // page.issues.errors['external-broken-links'] = page.blc.externalBrokenLinks;
        // page.issues.errors['internal-broken-images'] = page.blc.internalBrokenImages;
        // page.issues.errors['external-broken-images'] = page.blc.externalBrokenImages;
        if (page.lighthousedata.error) {

        }
        else {
          const seoCategory = page.lighthousedata.categories.seo;
          const bestPracticesCategory = page.lighthousedata.categories['best-practices'];

          const auditsRefs = seoCategory.auditRefs.concat(bestPracticesCategory.auditRefs);
          let mobileFriendlyAudit = {};
          for (const auditRef of auditsRefs) {
            const audit = page.lighthousedata.audits[auditRef.id];
            audit.weight = auditRef.weight;
            audit.score *= 100;
            mobileFriendlyAudit = audit.id === 'mobile-friendly' ? audit : mobileFriendlyAudit;
            const issueCategory = getIssueCategory(audit.id);

            if (audit.result) {
              for (const key in audit.result) {
                audit[key] = audit[key] ? audit[key] : audit.result[key];
              }
              audit.description = audit.result.description;
            }
            audit.list = audit.list ? audit.list : [];
            if (audit.details && audit.details.items) {
              for (const [index, item] of audit.details.items.entries()) {
                audit.list.push(item.node ? item.node : item);
              }
            }
            delete audit.details;
            delete audit.extendedInfo;
            delete audit.result;
            page.issues[issueCategory][audit.id] = audit;
          }

          for (const metricKey in page.metrics) {
            page.metrics[metricKey] = page.lighthousedata.audits[metricKey];
          }
          page.metrics.summary = page.lighthousedata.audits['metrics'].details.items[0];

          for (const categoryKey in page.lighthousedata.categories) {
            page.scores[categoryKey] = page.lighthousedata.categories[categoryKey];
            delete page.scores[categoryKey].auditRefs;
          }
          page.loadingTimeline = page.lighthousedata.audits['screenshot-thumbnails'];
          page.isMobileFriendly = !mobileFriendlyAudit.score;
        }

        calculateIssuesImpact(page);

        msg.yellow('Analyzing: ' + url + ' was done');
        resolve(page);
      }).catch(function (err) {
        msg.error(err)
        reject(err);
      });
    };

    let promise = new Promise(init);
    return promise;
  };

  const analyzePages = (urls, bodies) => {
    const summary = {issues: {errors: {}, warnings: {}, notices: {}}};
    const init = (resolve, reject) => {
      const promises = [];
      for (let i = 0; i < urls.length; i++) {
        promises.push(analyzePage(urls[i], bodies[i]));
      }
      Promise.all(promises).then(function (pages) {
        summary.pages = pages;
        testDuplicate('duplicateTitlePages', 'title');
        testDuplicate('duplicateDescPages', 'description');
        // testDuplicateContent(urls, bodies);

        calculateIssuesImpact(summary);
        msg.green('All pages were analyzed');
        resolve(summary);
      }).catch(function (err) {
        msg.error(err);
        reject(err);
      });
    };

    const testDuplicateContent = (urls, bodies) => {
      summary.issues.errors.duplicateContentPages = {score: 0, weight: 1, impact: 0};
      let numberOfDuplicates = 0;
      const skip = {};
      for (let [firstIndex, first] of urls.entries()) {
        if (skip[first]) {
          continue;
        }
        for (let [secondIndex, second] of urls.entries()) {
          const similarity = stringSimilarity.compareTwoStrings(bodies[firstIndex], bodies[secondIndex]);
          if (similarity < 0.9 || skip[second] || first === second) {
            continue;
          }
          if (!summary.issues.errors.duplicateContentPages[first]) {
            summary.issues.errors.duplicateContentPages[first] = [];
          }
          const compareItem = {
            url: second,
            similarity: similarity
          };
          summary.issues.errors.duplicateContentPages[first].push(compareItem);
          numberOfDuplicates++;
          skip[second] = true;
        }
      }
      summary.issues.errors.duplicateContentPages.score = 100 - (numberOfDuplicates / (Math.sqrt(urls.length) / 2)) * 100;
    };

    const testDuplicate = (skey, pkey) => {
      const list = {};
      summary.issues.errors[skey] = {score: 0, weight: 1, impact: 0, list: []};
      let numberOfDuplicates = 0;
      let trials = 0;
      for (let i = 0; i < summary.pages.length; i++) {
        const first = summary.pages[i];

        for (let j = i + 1; j < summary.pages.length; j++) {
          const second = summary.pages[j];
          trials++;
          if (first[pkey] !== second[pkey]) {
            continue;
          }
          if (!summary.issues.errors[skey][first.url]) {
            list[first.url] = [];
          }
          const compareItem = {
            url: second.url
          }
          compareItem[pkey] = second[pkey];
          list[first.url].push(compareItem);
          numberOfDuplicates++;
        }
      }
      for (const key in list) {
        list[key].source = key;
        summary.issues.errors[skey].list.push(list[key]);
      }
      summary.issues.errors[skey].score = trials ? 100 - (numberOfDuplicates / trials) * 100 : 100;
    };
    let promise = new Promise(init);
    return promise;
  };
  return {
    analyzePage,
    analyzePages
  }
};
