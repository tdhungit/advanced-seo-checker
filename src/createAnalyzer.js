const cheerio = require('cheerio')
const blc = require('broken-link-checker');
const stringSimilarity = require('string-similarity');
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
      summary: missingAltImages.length + ' images don\'t have alt attributes out of ' + totalImgs.length,
      list: missingAltImages,
      value: missingAltImages.length,
      impact: (missingAltImages.length / totalImgs.length) * 100
    };
  };

  const testMissingTitle = (page) => {
    return {
      summary: !page.title ? '1 page don\'t have title tags' : '',
      value: page.title,
      impact: !page.title ? 100 : 0
    };
  };

  const testTooMuchTextInTitle = (page) => {
    return {
      summary: page.title ? '1 page have too much text within the title tags' : '1 pages don\'t have title tags',
      text: page.title ? page.title : '',
      value: page.title ? page.title.length <= 75 : 0,
      impact: page.title && page.title.length <= 75 ? 0 : 100
    };
  };

  const testDOCType = (body) => {
    const result = {
      summary: '',
      value: body.toLowerCase().lastIndexOf('<!doctype html>') !== -1
    };
    if (result.value === 0) {
      result.summary = '1 page don\'t have doctype declared';
    }
    else {
      result.summary = '0 page don\'t have doctype declared';
    }
    result.impact= result.value ? 0 : 100;
    return result;
  };

  const countH1 = ($) => {
    const result = {
      summary: '',
      value: $('h1').length
    };
    if (result.value === 0) {
      result.summary = '0 pages don\'t have an h1 heading';
    }
    else {
      result.summary = '1 page have more than one H1 tag';
    }
    result.impact= result.value === 1 ? 0 : 100;
    return result;
  };

  const discoverBrokenLinks = (url, body) => {
    const init = (resolve, reject) => {
      const broken = {a: {internal: [], external: []}, img: {internal: [], external: []}},
        total = {a: {internal: [], external: []}, img: {internal: [], external: []}};

      var htmlChecker = new blc.HtmlChecker({}, {
        link: function (result) {

          const type = result.internal ? 'internal' : 'external';
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
              summary: broken.a.internal.length + ' internal links are broken',
              list: broken.a.internal,
              value: broken.a.internal.length,
              impact: 100 - (broken.a.internal.length / total.a.internal.length) * 100
            },
            externalBrokenLinks: {
              summary: broken.a.external.length + ' external links are broken',
              list: broken.a.external,
              value: broken.a.external.length,
              impact: 100 - (broken.a.external.length / total.a.external.length) * 100
            },
            internalBrokenImages: {
              summary: broken.img.internal.length + ' internal images are broken',
              list: broken.img.internal,
              value: broken.img.internal.length,
              impact: 100 - (broken.img.internal.length / total.img.internal.length) * 100
            },
            externalBrokenImages: {
              summary: broken.img.external.length + ' external images are broken',
              list: broken.img.external,
              value: broken.img.external.length,
              impact: 100 - (broken.img.external.length / total.img.external.length) * 100
            }
          }
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
    console.log('Analyzing: ' + url);

    const init = (resolve, reject) => {
      page.title = $('title').text() || null;
      page.description = $('meta[name=description]').attr('content') || null;
      page.author = $('meta[name=author]').attr('content') || null;
      page.keywords = $('meta[name=keywords]').attr('content') || null;
      page.issues = {errors: {}, warnings: {}, notices: {}};

      page.heading1 = $('body h1:first-child').text().trim().replace('\n', '');
      page.issues.warnings.totalHeadings = countH1($);
      page.issues.errors.missingTitle = testMissingTitle(page);
      page.issues.warnings.tooMuchTextInTitle = testTooMuchTextInTitle(page);
      page.issues.warnings.imgAltAttribute = testAccessibleImgs($);
      page.issues.warnings.containsDocType = testDOCType(body);

      discoverBrokenLinks(url, body).then(function (data) {
        page.blc = data;
        page.issues.errors.internalBrokenLinks = page.blc.internalBrokenLinks;
        page.issues.errors.externalBrokenLinks = page.blc.externalBrokenLinks;
        page.issues.errors.internalBrokenImages = page.blc.internalBrokenImages;
        page.issues.errors.externalBrokenImages = page.blc.externalBrokenImages;
        console.log('Analyzing: ' + url + ' was done');
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
        testDuplicate('duplicateTitlePages', 'title');
        testDuplicate('duplicateDescPages', 'description');
        testDuplicateContent(urls, bodies);
        console.log('All pages were analyzed');
        resolve(summary);
      });
    };

    const testDuplicateContent = (urls, bodies) => {
      summary.issues.errors.duplicateContentPages = {};
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
          skip[second] = true;
        }
      }
    };

    const testDuplicate = (skey, pkey) => {
      summary.issues.errors[skey] = {};
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
          skip[second.url] = true;
        }
      }
    };
    let promise = new Promise(init);
    return promise;
  };
  return {
    analyzePage,
    analyzePages
  }
};
