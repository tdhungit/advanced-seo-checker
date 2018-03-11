const cheerio = require('cheerio')
const blc = require('broken-link-checker');


//TESTS COVERED
//Missing title tag
//Missing description tag
//Missing keywords tag
//Missing author tag
//Broken links
//Broken Images
//Too much text in title
//Duplicate h1 tag

module.exports = (url, body) => {
  const $ = cheerio.load(body), page = {};
  page.url = url;
  page.title = $('title').text() || null;
  page.description = $('meta[name=description]').attr('content') || null;
  page.author = $('meta[name=author]').attr('content') || null;
  page.keywords = $('meta[name=keywords]').attr('content') || null;

  const testAccessibleImgs = () => {
    let totalImgs = 0, accessibleImgs = 0;
    $('img').each(function (index) {
      totalImgs++;
      accessibleImgs += $(this).attr('alt') || $(this).attr('title') ? 1 : 0;
    });
    return (accessibleImgs / totalImgs) * 100;
  };

  const testTooMuchTextInTitle = () => {
    return page.title.length <= 75;
  };

  const countH1 = () => {
    return $('h1').length;
  };

  const discoverBrokenLinks = () => {
    const init = (resolve, reject) => {
      const broken = {}, total = {};
      var htmlChecker = new blc.HtmlChecker({}, {
        link: function (result) {
          if (!total[result.html.tagName]) {
            total[result.html.tagName] = [];
            broken[result.html.tagName] = [];
          }

          total[result.html.tagName].push(result);
          if (result.broken) {
            broken[result.html.tagName].push(result);
          }
        },
        complete: function (result) {
          resolve({
            total: total,
            broken: broken
          });
        }
      });
      htmlChecker.scan(body, url);
    }

    let promise = new Promise(init);
    return promise;
  }

  const init = (resolve, reject) => {
    page.heading1 = $('body h1:first-child').text().trim().replace('\n', '');
    page.totalHeadings = countH1();
    page.tooMuchTextInTitle = testTooMuchTextInTitle();
    page.imgAccessibility = testAccessibleImgs();

    discoverBrokenLinks().then((result) => {
      page.blc = result;
      page.linksAvailability = 100 - 100 * page.blc.broken.a.length / page.blc.total.a.length;
      page.imagesAvailability = 100 - 100 * page.blc.broken.img.length / page.blc.total.img.length;
      resolve(page);
    });
  };

  let promise = new Promise(init);
  return promise;
};
