const cheerio = require('cheerio')
const blc = require('broken-link-checker');
const ssllabs = require("node-ssllabs");

//TESTS COVERED
//Missing title tag
//Missing description tag
//Missing keywords tag
//Missing author tag
//Broken links
//Broken Images
//Too much text in title
//Duplicate h1 tag
//Check if sitemap is exits
//Check if robot files exists
//SSLLabs Integration
//DOCType Check

module.exports = () => {
  const testSSLCertificate = (page) => {
    const init = (resolve, reject) => {
      ssllabs.scan(page.url, function (err, host) {
        const result = {
          summary: '',
          grades: [],
          value: host
        };

        host.endpoints.forEach(function (endpoint) {
          if (!endpoint.grade) {
            return;
          }
          result.grades.push(endpoint.grade);
        });
        result.summary = !result.grades.length ? 'No SSL certificate detected' : '';
        resolve(result);
      });
    };

    let promise = new Promise(init);
    return promise;
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
      summary: missingAltImages.length + ' images don\'t have alt attributes out of ' + totalImgs.length,
      list: missingAltImages,
      value: (missingAltImages.length / totalImgs.length) * 100
    };
  };

  const testMissingTitle = (page) => {
    return {
      summary: !page.title ? '1 pages don\'t have title tags' : '',
      value: page.title
    };
  };

  const testTooMuchTextInTitle = (page) => {
    return {
      summary: page.title ? '1 page have too much text within the title tags' : '1 pages don\'t have title tags',
      text: page.title ? page.title : '',
      value: page.title ? page.title.length <= 75 : 0
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
    return result;
  };

  const discoverBrokenLinks = (url, body) => {
    const init = (resolve, reject) => {
      const broken = {}, total = {};
      var htmlChecker = new blc.HtmlChecker({}, {
        link: function (result) {
          if (!total[result.html.tagName]) {
            total[result.html.tagName] = {internal: [], external: []};
            broken[result.html.tagName] = {internal: [], external: []};
          }

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
              value: broken.a.internal.length
            },
            externalBrokenLinks: {
              summary: broken.a.external.length + ' external links are broken',
              list: broken.a.external,
              value: broken.a.external.length
            },
            internalBrokenImages: {
              summary: broken.img.internal.length + ' internal images are broken',
              list: broken.img.internal,
              value: broken.img.internal.length
            },
            externalBrokenImages: {
              summary: broken.img.external.length + ' external images are broken',
              list: broken.img.external,
              value: broken.img.external.length
            }
          }
          resolve(res);
        }
      });
      htmlChecker.scan(body, url);
    }

    let promise = new Promise(init);
    return promise;
  }

  const analyzePage = (url, body) => {
    const $ = cheerio.load(body), page = {};
    page.url = url;

    const init = (resolve, reject) => {
      page.title = $('title').text() || null;
      page.description = $('meta[name=description]').attr('content') || null;
      page.author = $('meta[name=author]').attr('content') || null;
      page.keywords = $('meta[name=keywords]').attr('content') || null;

      page.heading1 = $('body h1:first-child').text().trim().replace('\n', '');
      page.totalHeadings = countH1($);
      page.missingTitle = testMissingTitle(page);
      page.tooMuchTextInTitle = testTooMuchTextInTitle(page);
      page.imgAltAttribute = testAccessibleImgs($);
      page.containsDocType = testDOCType(body);

      const promises = [];
      promises.push(testSSLCertificate(page));
      promises.push(discoverBrokenLinks(url, body));

      Promise.all(promises).then(function (data) {
        page.ssl = data[0];
        page.blc = data[1];
        page.internalBrokenLinks = page.blc.internalBrokenLinks;
        page.externalBrokenLinks = page.blc.externalBrokenLinks;
        page.internalBrokenImages = page.blc.internalBrokenImages;
        page.externalBrokenImages = page.blc.externalBrokenImages;
        resolve(page);
      });
    };

    let promise = new Promise(init);
    return promise;
  };

  const analyzePages = (urls, bodies) => {
    const init = (resolve, reject) => {
      const promises = [];
      for (let i = 0; i < urls.length; i++) {
        promises.push(analyzePage(urls[i], bodies[i]));
      }
      Promise.all(promises).then(function (pages) {
        resolve(pages);
      });
    };

    let promise = new Promise(init);
    return promise;
  };
  return {
    analyzePage,
    analyzePages
  }
};
