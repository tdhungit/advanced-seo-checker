const cheerio = require('cheerio')
const blc = require('broken-link-checker');

module.exports = (url, body) => {
  const $ = cheerio.load(body), page = {analyzed: false};
  // Meta signals
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

  const countH1 = () => {
    return $('h1').length;
  };

  const discoverBrokenLinks = () => {
    const init = (resolve, reject) => {
      const broken = [], total = [];
      var htmlChecker = new blc.HtmlChecker({}, {
        html: function (tree, robots) {
        },
        junk: function (result) {
        },
        link: function (result) {
          total.push(result);
          if (result.broken) {
            broken.push(result);
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

    page.imgAccessibility = testAccessibleImgs();
    discoverBrokenLinks().then((result) => {
      page.blc = result;
      page.linksAccessibility = 100 - 100 * page.blc.broken.length / page.blc.total.length;

      page.analyzed = true;
      resolve(page);
    });
  };

  let promise = new Promise(init);
  return promise;
};
