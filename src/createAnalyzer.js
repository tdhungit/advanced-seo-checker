const cheerio = require('cheerio')
const blc = require('broken-link-checker');
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

module.exports = () => {
  const getIssueCategory = (id) => {
    const categories = {
      'viewport': 'errors',
      'document-title': 'errors',
      'meta-description': 'errors',
      'is-crawlable': 'errors',
      'hreflang': 'errors',
      'canonical': 'errors',
      'errors-in-console': 'errors',
      'http-status-code': 'warnings',
      'link-text': 'warnings',
      'external-anchors-use-rel-noopener': 'warnings',
      'geolocation-on-start': 'warnings',
      'password-inputs-can-be-pasted-into': 'warnings',
      'appcache-manifest': 'notices',
      'no-websql': 'notices',
      'is-on-https': 'notices',
      'uses-http2': 'notices',
      'no-mutation-events': 'notices',
      'no-document-write': 'notices',
      'no-vulnerable-libraries': 'notices',
      'notification-on-start': 'notices',
      'deprecations': 'notices',
      'manifest-short-name-length': 'notices'
    };
    return categories[id] ? categories[id] : 'notices';
  };

  const testAccessibleImgs = ($) => {
    const totalImgs = [], accessibleImgs = [], missingAltImages = [];
    $('img').each(function (index) {
      totalImgs.push($(this).html());
      if ($(this).attr('alt') || $(this).attr('title')) {
        accessibleImgs.push($(this).attr('src'));
      }
      else {
        missingAltImages.push($(this).attr('src'));
      }
    });
    return {
      description: missingAltImages.length + ' images don\'t have alt attributes out of ' + totalImgs.length,
      list: missingAltImages,
      value: missingAltImages.length,
      weight: 1,
      score: totalImgs.length ? 100 - (missingAltImages.length / totalImgs.length) * 100 : 100
    };
  };

  const testMissingTitle = (page) => {
    return {
      description: !page.title ? '1 page don\'t have title tags' : '',
      value: page.title,
      weight: 1,
      score: page.title ? 100 : 0
    };
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
      result.description = '0 pages don\'t have an h1 heading';
    }
    else {
      result.description = '1 page have more than one H1 tag';
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
  }

  const analyzePage = (url, body) => {
    const $ = cheerio.load(body), page = {};
    page.url = url;
    msg.yellowBright('Analyzing: ' + url);

    const init = (resolve, reject) => {
      page.title = $('title').text() || null;
      page.description = $('meta[name=description]').attr('content') || null;
      page.author = $('meta[name=author]').attr('content') || null;
      page.keywords = $('meta[name=keywords]').attr('content') || null;
      page.issues = {errors: {}, warnings: {}, notices: {}};

      page.h1 = $('body h1:first-child').text().trim().replace('\n', '');
      page.issues.warnings['multiple-h1'] = countH1($);
      page.issues.errors['missing-title'] = testMissingTitle(page);
      page.issues.warnings['too-much-text-in-title'] = testTooMuchTextInTitle(page);
      page.issues.warnings['missing-alt-attribute'] = testAccessibleImgs($);
      page.issues.warnings['doc-type'] = testDOCType(body);

      const promises = [discoverBrokenLinks(url, body), createLHAnalyzer().analyzePage(url)];
      Promise.all(promises).then(function (results) {
        page.blc = results[0];
        page.lighthousedata = results[1];

        page.issues.errors['internal-broken-links'] = page.blc.internalBrokenLinks;
        page.issues.errors['external-broken-links'] = page.blc.externalBrokenLinks;
        page.issues.errors['internal-broken-images'] = page.blc.internalBrokenImages;
        page.issues.errors['external-broken-images'] = page.blc.externalBrokenImages;

        if (page.lighthousedata.error) {

        }
        else {
          const seoCategory = page.lighthousedata.reportCategories.filter((auditCategory) => {
            return auditCategory.id === 'seo';
          })[0];
          const bestPracticesCategory = page.lighthousedata.reportCategories.filter((auditCategory) => {
            return auditCategory.id === 'best-practices';
          })[0];

          const audits = seoCategory.audits.concat(bestPracticesCategory.audits);
          let mobileFriendlyAudit = {};
          for (const audit of audits) {
            mobileFriendlyAudit = audit.id === 'mobile-friendly' ? audit : mobileFriendlyAudit;
            const issueCategory = getIssueCategory(audit.id);

            if (audit.result) {
              for (const key in audit.result) {
                audit[key] = audit[key] ? audit[key] : audit.result[key];
              }
              audit.description = audit.result.description;
            }
            audit.list = audit.extendedInfo && audit.extendedInfo.value ? audit.extendedInfo.value : [];
            audit.list = audit.list.results ? audit.list.results : audit.list;

            if (audit.details && audit.details.items) {
              for (const [index, item] of audit.details.items.entries()) {
                audit.list[index] = audit.list[index] ? audit.list[index] : {};
                audit.list[index] = Object.assign({}, audit.list[index], item[0]);
              }
            }
            delete audit.details;
            delete audit.extendedInfo;
            delete audit.result;
            page.issues[issueCategory][audit.id] = audit;
          }

          page.isMobileFriendly = !mobileFriendlyAudit.score;
        }

        for (const categoryKey in page.issues) {
          const category = page.issues[categoryKey];
          for (const issueKey in category) {
            category[issueKey].impact = (100 - category[issueKey].score) * category[issueKey].weight;
          }
        }

        msg.yellow('Analyzing: ' + url + ' was done');
        resolve(page);
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
        // testDuplicate('duplicateTitlePages', 'title');
        // testDuplicate('duplicateDescPages', 'description');
        // testDuplicateContent(urls, bodies);
        msg.green('All pages were analyzed');
        resolve(summary);
      });
    };

    const testDuplicateContent = (urls, bodies) => {
      summary.issues.errors.duplicateContentPages = {impact: 0};
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
      summary.issues.errors.duplicateContentPages.impact = numberOfDuplicates / (Math.sqrt(urls.length) / 2);
    };

    const testDuplicate = (skey, pkey) => {
      summary.issues.errors[skey] = {};
      let numberOfDuplicates = 0;
      const skip = {};
      for (let first of summary.pages) {
        if (skip[first.url]) {
          continue;
        }
        for (let second of summary.pages) {
          if (first[pkey] !== second[pkey] || skip[second.url] || first.url === second.url) {
            continue;
          }
          if (!summary.issues.errors[skey][first.url]) {
            summary.issues.errors[skey][first.url] = [];
          }
          const compareItem = {
            url: second.url
          }
          compareItem[pkey] = second[pkey];
          summary.issues.errors[skey][first.url].push(compareItem);
          numberOfDuplicates++;
          skip[second.url] = true;
        }
      }
      summary.issues.errors[skey].impact = numberOfDuplicates / (Math.sqrt(summary.pages.length) / 2);
    };
    let promise = new Promise(init);
    return promise;
  };
  return {
    analyzePage,
    analyzePages
  }
};
